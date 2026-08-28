import { Router } from 'express';
import YahooFinance from 'yahoo-finance2';
import { db } from '../db/connection.js';

// Advanced analytics (fork addition, 2026-08-28): portfolio Greeks & risk,
// expiry ladder, wheel-cycle analytics, P/L attribution. Read-only derivations
// from the trades table + the engine_dashboard blobs the wheel-stack engine
// pushes — no writes, no schema changes, no external calls.
//
// Units: trades.strike/entryPrice/closePrice are INTEGER CENTS per share.
// Engine blob numbers are DOLLARS (the engine formats them) — never mix.

const router = Router();

// ---------------- shared helpers ----------------

const getEngineBlob = (key) => {
    try {
        const row = db.prepare('SELECT payload, updated_at FROM engine_dashboard WHERE key = ?').get(key);
        if (!row) return { data: null, updatedAt: null };
        return { data: JSON.parse(row.payload), updatedAt: row.updated_at };
    } catch (error) {
        console.error(`Analytics: engine blob '${key}' unreadable:`, error.message);
        return { data: null, updatedAt: null };
    }
};

const daysUntil = (iso) => {
    if (!iso) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(`${iso}T00:00:00`);
    if (isNaN(d)) return null;
    return Math.round((d - today) / 86400000);
};

const openTradesFor = (accountId) => db.prepare(`
    SELECT id, ticker, type, strike, quantity, delta, entryPrice, expirationDate, openedDate, accountId
    FROM trades
    WHERE status = 'Open' ${accountId ? 'AND accountId = ?' : ''}
`).all(...(accountId ? [Number(accountId)] : []));

// ---------------- Greeks & risk ----------------

// GET /api/analytics/risk?accountId=N
router.get('/risk', (req, res) => {
    try {
        const accountId = req.query.accountId || null;
        const open = openTradesFor(accountId);
        const { data: enginePositions, updatedAt } = getEngineBlob('positions');

        let collateralCents = 0;   // Σ strike*100*qty (cents) — CSP capital at risk
        let netDelta = 0;          // share-equivalents: short put +Δ, short call −Δ (entry abs-Δ model)
        let deltaCoverage = 0;     // how many open trades carry a delta
        let premiumCollectedCents = 0;
        let maxLossCents = 0;      // CSP worst case: stock to zero (collateral − premium)
        const seenMaxLossTickers = new Set();

        for (const t of open) {
            const dollarsStrike = t.strike / 100;
            const entry = t.entryPrice / 100;
            const collateral = dollarsStrike * 100 * t.quantity;
            collateralCents += collateral * 100;
            premiumCollectedCents += entry * 100 * t.quantity * 100;
            if (t.delta != null) {
                netDelta += (t.type === 'CSP' ? 1 : -1) * t.delta * 100 * t.quantity;
                deltaCoverage += 1;
            }
            if (t.type === 'CSP' && !seenMaxLossTickers.has(t.id)) {
                maxLossCents += (collateral - entry * 100 * t.quantity) * 100;
                seenMaxLossTickers.add(t.id);
            }
        }

        // Engine-pushed positions mark the book to market: remaining premium,
        // theta estimate, ITM/hot-DTE flags. Falls back to open-trade entries
        // when no push exists yet (fresh install) — source fields say which.
        let premiumRemaining = null;
        let thetaPerDayEstimate = null;
        let unrealizedPL = null;
        let itmCount = null;
        let dteHotCount = null;
        let nearestExpiryDays = null;
        let source = 'trades-table';

        const optPositions = Array.isArray(enginePositions)
            ? enginePositions.filter((p) => p.type === 'CSP' || p.type === 'CC')
            : [];

        if (optPositions.length > 0) {
            source = 'engine-push';
            premiumRemaining = 0;
            thetaPerDayEstimate = 0;
            unrealizedPL = 0;
            itmCount = 0;
            dteHotCount = 0;
            for (const p of optPositions) {
                const remaining = (Number(p.currentPrice) || 0) * 100 * (p.contracts || 1);
                premiumRemaining += remaining;
                const dte = p.dte ?? daysUntil(p.expiry);
                thetaPerDayEstimate += remaining / Math.max(dte || 1, 1); // linear-decay estimate
                unrealizedPL += Number(p.unrealizedPL) || 0;
                if (p.otmPct != null && Number(p.otmPct) < 0) itmCount += 1;
                if (dte != null && dte < 7) dteHotCount += 1;
                if (dte != null && (nearestExpiryDays == null || dte < nearestExpiryDays)) nearestExpiryDays = dte;
            }
        } else if (open.length > 0) {
            // Fallback: nothing pushed yet — entry premium is the remaining premium.
            premiumRemaining = premiumCollectedCents / 100;
            const dtes = open.map((t) => daysUntil(t.expirationDate)).filter((d) => d != null);
            nearestExpiryDays = dtes.length ? Math.min(...dtes) : null;
        }

        res.json({
            success: true,
            data: {
                asOf: updatedAt,
                source,
                openCount: open.length,
                deltaCoverage,
                collateralAtRisk: Math.round(collateralCents) / 100,
                premiumCollected: Math.round(premiumCollectedCents) / 100,
                premiumRemaining: premiumRemaining == null ? null : Math.round(premiumRemaining * 100) / 100,
                maxLoss: Math.round(maxLossCents) / 100,
                netDelta: Math.round(netDelta * 10) / 10,
                thetaPerDayEstimate: thetaPerDayEstimate == null ? null : Math.round(thetaPerDayEstimate * 100) / 100,
                unrealizedPL: unrealizedPL == null ? null : Math.round(unrealizedPL * 100) / 100,
                itmCount,
                dteHotCount,
                nearestExpiryDays,
                notes: [
                    'netDelta uses each trade\'s entry delta (abs) — stale as price moves',
                    'thetaPerDayEstimate assumes linear decay of remaining premium',
                ],
            },
        });
    } catch (error) {
        console.error('Analytics risk failed:', error);
        res.status(500).json({ success: false, error: 'Failed to compute risk analytics' });
    }
});

// ---------------- Expiry ladder / collateral release ----------------

// GET /api/analytics/exposure?accountId=N
router.get('/exposure', (req, res) => {
    try {
        const accountId = req.query.accountId || null;
        const open = openTradesFor(accountId);
        const { data: enginePositions, updatedAt } = getEngineBlob('positions');
        const { data: fundingQueue } = getEngineBlob('fundingQueue');

        // Engine marks keyed by underlying|strike|expiry for mark-to-market premium
        const marks = new Map();
        if (Array.isArray(enginePositions)) {
            for (const p of enginePositions) {
                if (p.type !== 'CSP' && p.type !== 'CC') continue;
                marks.set(`${p.underlying}|${Number(p.strike)}|${p.expiry}`, p);
            }
        }

        const byDate = new Map();
        for (const t of open) {
            const date = t.expirationDate;
            const dollarsStrike = t.strike / 100;
            const mark = marks.get(`${t.ticker}|${dollarsStrike}|${date}`);
            const remaining = mark
                ? (Number(mark.currentPrice) || 0) * 100 * (mark.contracts || 1)
                : (t.entryPrice / 100) * 100 * t.quantity;
            const row = byDate.get(date) || { date, dte: daysUntil(date), count: 0, tickers: new Set(), collateral: 0, premiumRemaining: 0, types: new Set() };
            row.count += 1;
            row.tickers.add(t.ticker);
            row.types.add(t.type);
            row.collateral += dollarsStrike * 100 * t.quantity;
            row.premiumRemaining += remaining;
            byDate.set(date, row);
        }

        const expirations = [...byDate.values()]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((r) => ({
                date: r.date,
                dte: r.dte,
                count: r.count,
                tickers: [...r.tickers].sort(),
                types: [...r.types].sort(),
                collateral: Math.round(r.collateral * 100) / 100,
                premiumRemaining: Math.round(r.premiumRemaining * 100) / 100,
            }));

        res.json({
            success: true,
            data: {
                asOf: updatedAt,
                totalCollateral: expirations.reduce((s, r) => s + r.collateral, 0),
                expirationCount: expirations.length,
                expirations,
                fundingQueue: Array.isArray(fundingQueue) ? fundingQueue : [],
            },
        });
    } catch (error) {
        console.error('Analytics exposure failed:', error);
        res.status(500).json({ success: false, error: 'Failed to compute exposure ladder' });
    }
});

// ---------------- P/L attribution by underlying ----------------

// GET /api/analytics/attribution?accountId=N
router.get('/attribution', (req, res) => {
    try {
        const accountId = req.query.accountId || null;
        const params = [];
        let sql = 'SELECT * FROM trades';
        if (accountId) { sql += ' WHERE accountId = ?'; params.push(accountId); }
        const all = db.prepare(sql).all(...params);

        const { data: enginePositions, updatedAt } = getEngineBlob('positions');
        const bySymbol = {};
        if (Array.isArray(enginePositions)) {
            for (const p of enginePositions) bySymbol[`${p.underlying}|${Number(p.strike)}|${p.expiry}`] = p;
        }

        const per = new Map();
        const bump = (t) => {
            const row = per.get(t.ticker) || { ticker: t.ticker, realized: 0, wins: 0, losses: 0, closedCount: 0, closedCollateral: 0, openCount: 0, openCollateral: 0, openUnrealized: 0, premiumCollected: 0 };
            per.set(t.ticker, row);
            return row;
        };

        for (const t of all) {
            const row = bump(t);
            const dollarsStrike = t.strike / 100;
            const collateral = dollarsStrike * 100 * t.quantity;

            if (t.status === 'Open') {
                row.openCount += 1;
                row.openCollateral += collateral;
                const mark = bySymbol[`${t.ticker}|${dollarsStrike}|${t.expirationDate}`];
                const remaining = mark ? (Number(mark.currentPrice) || 0) * 100 * (mark.contracts || 1) : (t.entryPrice / 100) * 100 * t.quantity;
                row.openUnrealized += (t.entryPrice / 100) * 100 * t.quantity - remaining;
            }

            // Realized leg P/L — same formula + raw-cent units as server/routes/stats.js
            if (t.closePrice != null && (t.status === 'Closed' || t.status === 'Expired' || t.status === 'Assigned' || t.status === 'Rolled')) {
                const isShort = t.type === 'CSP' || t.type === 'CC';
                const diff = isShort ? t.entryPrice - t.closePrice : t.closePrice - t.entryPrice;
                const pnl = (diff * t.quantity * 100 - (t.commission || 0)) / 100;
                row.realized += pnl;
                row.closedCollateral += collateral;
                if (t.status !== 'Rolled') {
                    row.closedCount += 1;
                    if (pnl > 0) row.wins += 1;
                    else if (pnl < 0) row.losses += 1;
                }
            }
            if (t.entryPrice) row.premiumCollected += (t.entryPrice / 100) * 100 * t.quantity;
        }

        const round2 = (v) => Math.round(v * 100) / 100;
        const rows = [...per.values()]
            .map((r) => ({
                ticker: r.ticker,
                realized: round2(r.realized),
                wins: r.wins,
                losses: r.losses,
                closedCount: r.closedCount,
                winRate: r.closedCount ? round2((r.wins / r.closedCount) * 100) : null,
                weightedRoi: r.closedCollateral ? round2((r.realized / r.closedCollateral) * 100) : null,
                openCount: r.openCount,
                openCollateral: round2(r.openCollateral),
                openUnrealized: round2(r.openUnrealized),
                premiumCollected: round2(r.premiumCollected),
            }))
            .sort((a, b) => b.realized - a.realized);

        res.json({
            success: true,
            data: {
                asOf: updatedAt,
                rows,
                totalRealized: round2(rows.reduce((s, r) => s + r.realized, 0)),
                totalOpenCollateral: round2(rows.reduce((s, r) => s + r.openCollateral, 0)),
                totalOpenUnrealized: round2(rows.reduce((s, r) => s + r.openUnrealized, 0)),
            },
        });
    } catch (error) {
        console.error('Analytics attribution failed:', error);
        res.status(500).json({ success: false, error: 'Failed to compute attribution' });
    }
});

// ---------------- Closed-trade quality ----------------

// GET /api/analytics/quality?accountId=N
// How well closed trades actually performed. CLOSED TRADES ONLY — open
// positions never blend in (same discipline as /attribution). Rolled legs are
// excluded (they carry into the final leg, which is the quality sample).
router.get('/quality', (req, res) => {
    try {
        const accountId = req.query.accountId || null;
        const sql = `SELECT ticker, type, strike, quantity, entryPrice, closePrice, openedDate, closedDate, commission
            FROM trades
            WHERE status IN ('Closed', 'Expired', 'Assigned')
            AND closePrice IS NOT NULL AND closedDate IS NOT NULL
            ${accountId ? 'AND accountId = ?' : ''}`;
        const closed = db.prepare(sql).all(...(accountId ? [Number(accountId)] : []));

        const round2 = (v) => Math.round(v * 100) / 100;
        let wins = 0, losses = 0;
        let captureSum = 0, captureCount = 0;
        let daysSum = 0;
        let roiPerDaySum = 0, roiPerDayCount = 0;

        for (const t of closed) {
            const isShort = t.type === 'CSP' || t.type === 'CC';
            // Realized P/L (dollars) — same formula as stats.js:
            // short legs keep (entry − close); long legs keep (close − entry)
            const diffCents = isShort ? t.entryPrice - t.closePrice : t.closePrice - t.entryPrice;
            const pnl = (diffCents * t.quantity * 100 - (t.commission || 0)) / 100;
            if (pnl > 0) wins += 1; else if (pnl < 0) losses += 1;

            // Premium capture: share of the collected premium actually kept.
            if (isShort && t.entryPrice > 0) {
                captureSum += ((t.entryPrice - t.closePrice) / t.entryPrice) * 100;
                captureCount += 1;
            }

            const opened = new Date(`${t.openedDate}T00:00:00`);
            const shut = new Date(`${t.closedDate}T00:00:00`);
            if (isNaN(opened) || isNaN(shut)) continue;
            const days = Math.round((shut - opened) / 86400000);
            daysSum += Math.max(days, 0);

            // ROI/day on this trade's collateral; same-day closes count as 1 day
            const collateral = (t.strike / 100) * 100 * t.quantity;
            if (collateral > 0) {
                roiPerDaySum += ((pnl / collateral) * 100) / Math.max(days, 1);
                roiPerDayCount += 1;
            }
        }

        const closedCount = closed.length;
        res.json({
            success: true,
            data: {
                closedCount,
                wins,
                losses,
                winRate: closedCount ? round2((wins / closedCount) * 100) : null,
                avgCapturePct: captureCount ? round2(captureSum / captureCount) : null,
                avgDaysHeld: closedCount ? round2(daysSum / closedCount) : null,
                avgRoiPerDayPct: roiPerDayCount ? round2(roiPerDaySum / roiPerDayCount) : null,
            },
        });
    } catch (error) {
        console.error('Analytics quality failed:', error);
        res.status(500).json({ success: false, error: 'Failed to compute closed-trade quality' });
    }
});

// ---------------- Wheel cycles ----------------

// GET /api/analytics/cycles?accountId=N
// Groups trades into wheel cycles per ticker: a CSP (and its roll chain) is a
// cycle; after assignment, subsequent CCs attach to the same cycle until it
// closes (final leg Closed/Expired/Assigned with no open successor).
router.get('/cycles', (req, res) => {
    try {
        const accountId = req.query.accountId || null;
        const params = [];
        let sql = 'SELECT * FROM trades ORDER BY openedDate';
        if (accountId) { sql = 'SELECT * FROM trades WHERE accountId = ? ORDER BY openedDate'; params.push(accountId); }
        const all = db.prepare(sql).all(...params);

        // Link roll chains: map parent -> children; a chain's root is the CSP.
        const byId = new Map(all.map((t) => [t.id, t]));
        const chainOf = (t) => {
            let root = t;
            const seen = new Set();
            while (root.parentTradeId && byId.has(root.parentTradeId) && !seen.has(root.id)) {
                seen.add(root.id);
                root = byId.get(root.parentTradeId);
            }
            return root.id;
        };

        const derLegPnl = (t) => { // same formula/units as stats.js
            // only terminal/rolled legs realize P/L (Open rows carry closePrice 0)
            if (t.status === 'Open') return null;
            if (t.closePrice == null) return null;
            const isShort = t.type === 'CSP' || t.type === 'CC';
            const diff = isShort ? t.entryPrice - t.closePrice : t.closePrice - t.entryPrice;
            return (diff * t.quantity * 100 - (t.commission || 0)) / 100;
        };

        const cycles = new Map(); // root trade id -> cycle accumulator
        for (const t of all) {
            if (t.type !== 'CSP' && t.type !== 'CC') continue;
            const rootId = chainOf(t);
            const cyc = cycles.get(rootId) || { ticker: t.type === 'CSP' ? t.ticker : t.ticker, legs: [], rootType: byId.get(rootId)?.type || t.type, start: null, closed: false, lastDate: null };
            cyc.ticker = t.ticker;
            cyc.legs.push(t);
            const d = t.openedDate || t.createdAt;
            if (!cyc.start || d < cyc.start) cyc.start = d;
            const end = t.closedDate || null;
            if (end && (!cyc.lastDate || end > cyc.lastDate)) cyc.lastDate = end;
            cycles.set(rootId, cyc);
        }

        const now = new Date().toISOString().slice(0, 10);
        const list = [...cycles.values()].map((c) => {
            const root = byId.get(c.rootId ?? c.legs[0].id);
            const realized = c.legs.reduce((s, t) => s + (derLegPnl(t) || 0), 0);
            const openLegs = c.legs.filter((t) => t.status === 'Open');
            const isOpen = openLegs.length > 0;
            const collateral = openLegs[0] ? (openLegs[0].strike / 100) * 100 * openLegs[0].quantity
                : Math.max(...c.legs.map((t) => (t.strike / 100) * 100 * t.quantity));
            const endDate = isOpen ? now : c.lastDate;
            const daysHeld = Math.max(0, Math.round((new Date(endDate) - new Date(c.start)) / 86400000));
            const roi = collateral ? (realized / collateral) * 100 : null;
            const apy = roi != null && daysHeld > 0 ? roi * (365 / daysHeld) : null;
            const rollCount = c.legs.filter((t) => t.status === 'Rolled').length;
            return {
                ticker: c.ticker,
                style: root?.type === 'CC' ? 'CC' : 'CSP',
                status: isOpen ? 'Open' : 'Closed',
                legs: c.legs.length,
                rolls: rollCount,
                realized: Math.round(realized * 100) / 100,
                collateral: Math.round(collateral * 100) / 100,
                daysHeld,
                roiPct: roi != null ? Math.round(roi * 100) / 100 : null,
                apyPct: apy != null ? Math.round(apy * 100) / 100 : null,
                start: c.start,
                end: isOpen ? null : c.lastDate,
            };
        }).sort((a, b) => (b.terminalRealized ?? b.realized) - (a.terminalRealized ?? a.realized));

        res.json({ success: true, data: { cycles: list } });
    } catch (error) {
        console.error('Analytics cycles failed:', error);
        res.status(500).json({ success: false, error: 'Failed to compute wheel cycles' });
    }
});

// ---------------- Roll what-if (agamotto-inspired) ----------------

// Indicative net credit for rolling each open short option to the same strike
// ~1 and ~2 weeks further out, from live Yahoo option chains: buy the live leg
// back at the ask, sell the later-expiry leg at the bid (conservative sides).
// The existing P/L column is the "close now" answer; these chips answer
// "what if I roll instead". Quotes cached briefly; per-symbol failures leave
// that position null instead of breaking the panel.

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const ROLL_CACHE_TTL_MS = 10 * 60 * 1000;
const chainCache = new Map(); // symbol -> { fetchedAt, expirations: Date[], legs: Map<iso, Map<strike, leg>> }

const DAY_MS = 86400000;

const strikeKey = (n) => Math.round(Number(n) * 100); // cents — avoids float keys

async function getChains(symbol) {
    const hit = chainCache.get(symbol);
    if (hit && Date.now() - hit.fetchedAt < ROLL_CACHE_TTL_MS) return hit;
    const root = await yahooFinance.options(symbol, {});
    const expirations = (root.expirationDates || []).map((d) => new Date(d));
    const entry = { fetchedAt: Date.now(), expirations, legs: new Map() };
    chainCache.set(symbol, entry);
    return entry;
}

async function getLeg(symbol, expiryDate, strike, optType /* 'put' | 'call' */) {
    const chains = await getChains(symbol);
    const iso = expiryDate.toISOString().slice(0, 10);
    if (!chains.legs.has(iso)) {
        const chain = await yahooFinance.options(symbol, { date: expiryDate });
        const list = chain.options?.[0]?.[optType === 'put' ? 'puts' : 'calls'] || [];
        const m = new Map();
        for (const c of list) m.set(strikeKey(c.strike), { bid: c.bid, ask: c.ask, last: c.lastPrice });
        chains.legs.set(iso, m);
    }
    return chains.legs.get(iso).get(strikeKey(strike)) || null;
}

// Nearest listed expiry in [target, target + 10 days]
function nearestExpiry(expirations, targetMs) {
    let best = null;
    for (const e of expirations) {
        const ms = e.getTime();
        if (ms < targetMs || ms > targetMs + 10 * DAY_MS) continue;
        if (!best || ms < best.getTime()) best = e;
    }
    return best;
}

// GET /api/analytics/roll-whatif — per open CSP/CC: indicative roll credits
router.get('/roll-whatif', async (req, res) => {
    try {
        const { data: enginePositions } = getEngineBlob('positions');
        let rows = [];
        if (Array.isArray(enginePositions)) {
            rows = enginePositions
                .filter((p) => p.type === 'CSP' || p.type === 'CC')
                .map((p) => ({
                    underlying: p.underlying,
                    type: p.type,
                    strike: Number(p.strike),
                    expiry: p.expiry,
                    contracts: Number(p.contracts) || 1,
                }));
        } else {
            rows = openTradesFor(req.query.accountId || null).map((t) => ({
                underlying: t.ticker,
                type: t.type,
                strike: t.strike / 100,
                expiry: t.expirationDate,
                contracts: t.quantity,
            }));
        }

        const results = [];
        for (const p of rows) {
            const base = {
                key: `${p.underlying}|${p.strike}|${p.expiry}|${p.type}`,
                underlying: p.underlying,
                strike: p.strike,
                expiry: p.expiry,
                type: p.type,
                roll1wk: null,
                roll2wk: null,
            };
            try {
                const optType = p.type === 'CC' ? 'call' : 'put';
                const ownMs = dayMsUtc(p.expiry);
                if (ownMs == null) throw new Error('no expiry');
                const chains = await getChains(p.underlying);
                const ownExpiry = (ms) => new Date(ms);
                const own = await getLeg(p.underlying, ownExpiry(ownMs), p.strike, optType);
                const buyBack = own?.ask ?? own?.last ?? null;
                if (buyBack == null) throw new Error('no live quote for current leg');

                for (const [weeks, slot] of [[1, 'roll1wk'], [2, 'roll2wk']]) {
                    const target = ownMs + weeks * 7 * DAY_MS;
                    const exp = nearestExpiry(chains.expirations, target);
                    if (!exp) continue;
                    const leg = await getLeg(p.underlying, exp, p.strike, optType);
                    const sell = leg?.bid ?? leg?.last ?? null;
                    if (sell == null) continue;
                    base[slot] = {
                        to: exp.toISOString().slice(0, 10),
                        // + = cash in from the roll (sell later leg − buy back current)
                        netCredit: Math.round((sell - buyBack) * 100 * p.contracts * 100) / 100,
                    };
                }
            } catch (err) {
                base.error = err.message == null ? 'quote fetch failed' : String(err.message).slice(0, 80);
            }
            results.push(base);
        }

        res.json({ success: true, data: { asOf: new Date().toISOString(), rows: results } });
    } catch (error) {
        console.error('Analytics roll-whatif failed:', error);
        res.status(500).json({ success: false, error: 'Failed to compute roll what-ifs' });
    }
});

function dayMsUtc(iso) {
    if (!iso) return null;
    const ms = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`).getTime();
    return isNaN(ms) ? null : ms;
}

export default router;
