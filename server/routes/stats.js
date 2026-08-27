import { Router } from 'express';
import { db } from '../db/connection.js';
import { toDollars } from '../utils/conversions.js';
import { apiResponse } from '../utils/response.js';

const router = Router();

// GET stats/summary - Using SQL aggregations for performance
router.get('/', (req, res) => {
    try {
        const { accountId } = req.query;
        // Build account filter fragments
        const acctWhere = accountId ? 'WHERE accountId = ?' : '';
        const acctAnd = accountId ? 'AND accountId = ?' : '';
        const acctParams = accountId ? [Number(accountId)] : [];

        // Main stats aggregation - single query.
        // totalPnL is CASH-BASIS (Smit's rule 2026-08-27): sell-side premium is
        // booked when cash lands (open trades have closePrice = 0), buy-back
        // cost is booked when paid. A roll's net credit shows up immediately.
        const mainStats = db.prepare(`
            SELECT
                COUNT(*) as totalTrades,
                COUNT(CASE WHEN status = 'Open' THEN 1 END) as openCount,
                COUNT(CASE WHEN status = 'Expired' THEN 1 END) as expiredCount,
                COUNT(CASE WHEN status = 'Assigned' THEN 1 END) as assignedCount,
                COUNT(CASE WHEN status = 'Rolled' THEN 1 END) as rolledCount,
                COUNT(CASE WHEN status = 'Closed' THEN 1 END) as closedCount,
                COALESCE(SUM(CASE WHEN type IN ('CSP', 'CC') THEN (entryPrice - closePrice) * quantity * 100 - commission
                             WHEN type IN ('CALL', 'PUT') THEN (closePrice - entryPrice) * quantity * 100 - commission
                             ELSE 0 END), 0) as totalPnL,
                COALESCE(SUM(CASE WHEN status NOT IN ('Open', 'Rolled') THEN
                             CASE WHEN type IN ('CSP', 'CC') THEN (entryPrice - closePrice) * quantity * 100 - commission
                             WHEN type IN ('CALL', 'PUT') THEN (closePrice - entryPrice) * quantity * 100 - commission
                             ELSE 0 END ELSE 0 END), 0) as finalizedPnL,
                COALESCE(SUM(entryPrice * quantity * 100), 0) as totalPremium,
                COALESCE(SUM(CASE WHEN status = 'Open' AND type IN ('CSP', 'CC') THEN strike * quantity * 100
                             WHEN status = 'Open' AND type IN ('CALL', 'PUT') THEN entryPrice * quantity * 100
                             ELSE 0 END), 0) as capitalAtRisk,
                COALESCE(SUM(commission), 0) as totalCommissions
            FROM trades
            ${acctWhere}
        `).get(...acctParams);

        // Chain statistics - count roots and resolved chains
        const chainStats = db.prepare(`
            SELECT
                COUNT(*) as totalChains,
                COUNT(CASE WHEN status NOT IN ('Open', 'Rolled') THEN 1 END) as resolvedChains
            FROM trades
            WHERE parentTradeId IS NULL ${acctAnd}
        `).get(...acctParams);

        // Calculate chain P/L using recursive CTE (no N+1 queries)
        // Account filter only on base case (roots); children follow via parentTradeId
        const chainPnLStats = db.prepare(`
            WITH RECURSIVE chain_walk AS (
                -- Base: start from root trades (no parent)
                SELECT
                    id as root_id,
                    id as current_id,
                    CASE WHEN type IN ('CALL', 'PUT') THEN (closePrice - entryPrice) * quantity * 100 - commission
                         ELSE (entryPrice - closePrice) * quantity * 100 - commission END as chain_pnl,
                    status as final_status
                FROM trades
                WHERE parentTradeId IS NULL ${acctAnd}

                UNION ALL

                -- Recursive: follow children
                SELECT
                    cw.root_id,
                    t.id as current_id,
                    cw.chain_pnl + CASE WHEN t.type IN ('CALL', 'PUT') THEN (t.closePrice - t.entryPrice) * t.quantity * 100 - t.commission
                                       ELSE (t.entryPrice - t.closePrice) * t.quantity * 100 - t.commission END,
                    t.status as final_status
                FROM chain_walk cw
                JOIN trades t ON t.parentTradeId = cw.current_id
            ),
            -- Get final state of each chain (last trade in chain)
            chain_finals AS (
                SELECT root_id, chain_pnl, final_status
                FROM chain_walk cw
                WHERE NOT EXISTS (
                    SELECT 1 FROM trades t WHERE t.parentTradeId = cw.current_id
                )
            )
            SELECT
                COUNT(CASE WHEN final_status NOT IN ('Open', 'Rolled') AND chain_pnl > 0 THEN 1 END) as winning_chains,
                COUNT(CASE WHEN final_status NOT IN ('Open', 'Rolled') THEN 1 END) as resolved_chains
            FROM chain_finals
        `).get(...acctParams);

        const winningChains = chainPnLStats.winning_chains || 0;
        const resolvedCount = chainPnLStats.resolved_chains || 0;
        const winRate = resolvedCount > 0 ? (winningChains / resolvedCount) * 100 : 0;

        // Monthly P/L, cash-basis: premium lands in the open month, buy-back
        // cost in the close month (sells: +entry at open, -close at close;
        // buys: -entry at open, +close at close; commission at open).
        const monthlyStats = db.prepare(`
            SELECT month, SUM(delta) as pnl FROM (
                SELECT strftime('%Y-%m', openedDate) as month,
                       CASE WHEN type IN ('CALL', 'PUT') THEN -entryPrice * quantity * 100 - commission
                            ELSE entryPrice * quantity * 100 - commission END as delta
                FROM trades
                ${acctWhere}
                UNION ALL
                SELECT strftime('%Y-%m', closedDate) as month,
                       CASE WHEN type IN ('CALL', 'PUT') THEN closePrice * quantity * 100
                            ELSE -closePrice * quantity * 100 END as delta
                FROM trades
                WHERE status != 'Open' AND closedDate IS NOT NULL ${acctAnd}
            )
            GROUP BY month
            ORDER BY month DESC
        `).all(...acctParams, ...acctParams);

        // Monthly finalized P/L (previous definition: closed trades only)
        const monthlyFinalized = db.prepare(`
            SELECT
                strftime('%Y-%m', COALESCE(closedDate, openedDate)) as month,
                SUM(CASE WHEN type IN ('CALL', 'PUT') THEN (closePrice - entryPrice) * quantity * 100 - commission
                         ELSE (entryPrice - closePrice) * quantity * 100 - commission END) as pnl
            FROM trades
            WHERE status NOT IN ('Open', 'Rolled') ${acctAnd}
            GROUP BY month
            ORDER BY month DESC
        `).all(...acctParams);

        // Ticker P/L aggregation
        const tickerStats = db.prepare(`
            SELECT
                ticker,
                SUM(CASE WHEN type IN ('CALL', 'PUT') THEN (closePrice - entryPrice) * quantity * 100 - commission
                         ELSE (entryPrice - closePrice) * quantity * 100 - commission END) as pnl
            FROM trades
            ${acctWhere}
            GROUP BY ticker
            ORDER BY pnl DESC
        `).all(...acctParams);

        // Best ticker
        const bestTicker = tickerStats.length > 0 ? tickerStats[0] : null;

        // Average ROI for completed trades
        const avgRoiResult = db.prepare(`
            SELECT AVG(
                CASE WHEN strike > 0 AND quantity > 0 AND type IN ('CSP', 'CC')
                THEN ((entryPrice - closePrice) * 100.0 - commission * 1.0 / quantity) / strike
                WHEN quantity > 0 AND entryPrice > 0 AND type IN ('CALL', 'PUT')
                THEN ((closePrice - entryPrice) * 100.0 - commission * 1.0 / quantity) / entryPrice
                ELSE 0 END
            ) as avgRoi
            FROM trades
            WHERE status NOT IN ('Open', 'Rolled') ${acctAnd}
        `).get(...acctParams);

        // Capital gains from positions
        const positionStats = db.prepare(`
            SELECT
                COALESCE(SUM(CASE WHEN soldDate IS NOT NULL THEN capitalGainLoss ELSE 0 END), 0) as realizedCapitalGL,
                COUNT(CASE WHEN soldDate IS NOT NULL THEN 1 END) as closedPositions,
                COUNT(CASE WHEN soldDate IS NULL THEN 1 END) as openPositions
            FROM positions
            ${acctWhere}
        `).get(...acctParams);

        // Convert all money values from cents to dollars
        apiResponse.success(res, {
            totalPnL: toDollars(mainStats.totalPnL),
            bookedPnL: toDollars(mainStats.totalPnL), // alias: totalPnL is cash-basis
            finalizedPnL: toDollars(mainStats.finalizedPnL),
            totalPremiumCollected: toDollars(mainStats.totalPremium),
            totalTrades: mainStats.totalTrades,
            openTradesCount: mainStats.openCount,
            completedTradesCount: mainStats.expiredCount + mainStats.assignedCount + mainStats.closedCount,
            capitalAtRisk: toDollars(mainStats.capitalAtRisk),
            winningChains,
            totalChains: chainStats.totalChains,
            resolvedChains: resolvedCount,
            winRate,
            avgRoi: avgRoiResult.avgRoi || 0,
            totalAssigned: mainStats.assignedCount,
            totalExpired: mainStats.expiredCount,
            totalRolled: mainStats.rolledCount,
            monthlyStats: Object.fromEntries(monthlyStats.map(m => [m.month, toDollars(m.pnl)])),
            monthlyFinalized: Object.fromEntries(monthlyFinalized.map(m => [m.month, toDollars(m.pnl)])),
            tickerStats: Object.fromEntries(tickerStats.map(t => [t.ticker, toDollars(t.pnl)])),
            bestTicker: bestTicker ? { ...bestTicker, pnl: toDollars(bestTicker.pnl) } : null,
            // Capital gains from stock positions
            realizedCapitalGL: toDollars(positionStats.realizedCapitalGL),
            openPositions: positionStats.openPositions,
            closedPositions: positionStats.closedPositions,
            totalPnLWithCapitalGains: toDollars(mainStats.totalPnL + positionStats.realizedCapitalGL),
            totalCommissions: toDollars(mainStats.totalCommissions)
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        apiResponse.error(res, 'Failed to fetch stats');
    }
});

// GET stats/deployment?accountId=X — daily deployed-capital series.
// Reconstructs, for each day since the first activity: capital securing open
// CSPs/CCs (strike*qty*100) + cost basis of assigned stock still held, vs the
// account's total value (net deposits + realized P&L up to that day).
// All DB money is cents; output is dollars.
router.get('/deployment', (req, res) => {
    try {
        const { accountId } = req.query;
        const acctWhere = accountId ? 'WHERE accountId = ?' : '';
        const acctAnd = accountId ? 'AND accountId = ?' : '';
        const acctParams = accountId ? [Number(accountId)] : [];

        const trades = db.prepare(`
            SELECT type, strike, quantity, entryPrice, closePrice, commission,
                   openedDate, closedDate, status
            FROM trades ${acctWhere}
        `).all(...acctParams);
        const positions = db.prepare(`
            SELECT costBasis, shares, acquiredDate, soldDate, capitalGainLoss
            FROM positions ${acctWhere}
        `).all(...acctParams);
        const funds = db.prepare(`
            SELECT type, amount, date FROM fund_transactions ${acctWhere}
        `).all(...acctParams);

        const day10 = (s) => (s || '').slice(0, 10);
        const today = new Date().toISOString().slice(0, 10);

        // Find the first day anything happened
        const starts = [
            ...trades.map(t => day10(t.openedDate)),
            ...funds.map(f => day10(f.date)),
        ].filter(Boolean).sort();
        if (starts.length === 0) return apiResponse.success(res, { days: [] });
        const start = starts[0];

        // Realized options P&L per close day (cents)
        const realizedByDay = {};
        for (const t of trades) {
            if (!t.closedDate) continue;
            let pnl = 0;
            if (t.type === 'CSP' || t.type === 'CC') {
                pnl = (t.entryPrice - t.closePrice) * t.quantity * 100 - t.commission;
            } else {
                pnl = (t.closePrice - t.entryPrice) * t.quantity * 100 - t.commission;
            }
            const d = day10(t.closedDate);
            realizedByDay[d] = (realizedByDay[d] || 0) + pnl;
        }
        // Realized stock gains per sell day
        for (const p of positions) {
            if (p.soldDate && p.capitalGainLoss != null) {
                const d = day10(p.soldDate);
                realizedByDay[d] = (realizedByDay[d] || 0) + p.capitalGainLoss;
            }
        }
        // Fund flows per day (signed, cents)
        const fundsByDay = {};
        for (const f of funds) {
            const sign = (f.type === 'deposit' || f.type === 'dividend' || f.type === 'interest') ? 1 : -1;
            const d = day10(f.date);
            fundsByDay[d] = (fundsByDay[d] || 0) + sign * f.amount;
        }

        const days = [];
        let runningTotal = 0;
        const cur = new Date(start + 'T00:00:00Z');
        const end = new Date(today + 'T00:00:00Z');
        while (cur <= end) {
            const d = cur.toISOString().slice(0, 10);
            runningTotal += (fundsByDay[d] || 0) + (realizedByDay[d] || 0);

            let deployed = 0;
            for (const t of trades) {
                const open = day10(t.openedDate) <= d;
                const stillOpen = !t.closedDate || day10(t.closedDate) > d;
                if (open && stillOpen && (t.type === 'CSP' || t.type === 'CC')) {
                    deployed += t.strike * t.quantity * 100;
                }
            }
            for (const p of positions) {
                const held = day10(p.acquiredDate) <= d && (!p.soldDate || day10(p.soldDate) > d);
                if (held) deployed += p.costBasis * p.shares;
            }

            const total = runningTotal;
            days.push({
                date: d,
                deployed: toDollars(deployed),
                total: toDollars(total),
                idle: toDollars(Math.max(total - deployed, 0)),
                pct: total > 0 ? Math.round((deployed / total) * 1000) / 10 : 0,
            });
            cur.setUTCDate(cur.getUTCDate() + 1);
        }

        apiResponse.success(res, { days });
    } catch (error) {
        console.error('Error computing capital deployment:', error);
        apiResponse.error(res, 'Failed to compute capital deployment');
    }
});

export default router;
