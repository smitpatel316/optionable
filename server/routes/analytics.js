import { Router } from 'express';
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

export default router;
