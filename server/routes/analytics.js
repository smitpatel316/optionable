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

export default router;
