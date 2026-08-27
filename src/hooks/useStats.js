import { useState, useMemo, useCallback, useEffect } from 'react';
import { API_URL } from '../utils/constants';
import { calculateMetrics } from '../utils/calculations';
import { bookedPnL as computeBookedPnL, finalizedPnL as computeFinalizedPnL, tradeCashEvents, dailyCumulativeSeries } from '../utils/cashBasis';

export const useStats = (trades, accountId) => {
    const [capitalGainsStats, setCapitalGainsStats] = useState({
        realizedCapitalGL: 0,
        openPositions: 0,
        closedPositions: 0,
        totalCommissions: 0
    });
    const [chartPeriod, setChartPeriod] = useState('all');

    const fetchCapitalGainsStats = useCallback(async () => {
        try {
            const params = accountId ? `?accountId=${accountId}` : '';
            const response = await fetch(`${API_URL}/stats${params}`);
            if (!response.ok) return;
            const json = await response.json();
            setCapitalGainsStats({
                realizedCapitalGL: json.data.realizedCapitalGL || 0,
                openPositions: json.data.openPositions || 0,
                closedPositions: json.data.closedPositions || 0,
                totalCommissions: json.data.totalCommissions || 0
            });
        } catch (err) {
            console.error('Error fetching capital gains stats:', err);
        }
    }, [accountId]);

    useEffect(() => {
        fetchCapitalGainsStats();
    }, [fetchCapitalGainsStats]);

    const stats = useMemo(() => {
        // Filter trades by time period (same as chart)
        const now = new Date();
        const periodStart = {
            '1m': new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()),
            '3m': new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()),
            '6m': new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()),
            'ytd': new Date(now.getFullYear(), 0, 1),
            'all': new Date(0)
        }[chartPeriod];

        const filteredTrades = trades.filter(t => {
            const tradeDate = new Date(t.closedDate || t.expirationDate || t.openedDate);
            return tradeDate >= periodStart;
        });

        // Completed trades = not Open and not Rolled (terminal states only)
        const completedTrades = filteredTrades.filter(t => t.status !== 'Open' && t.status !== 'Rolled');
        const openTrades = filteredTrades.filter(t => t.status === 'Open');

        // P/L for all non-open trades (includes Rolled for accurate total)
        const allClosedTrades = filteredTrades.filter(t => t.status !== 'Open');
        const totalPnL = allClosedTrades.reduce((acc, t) => acc + calculateMetrics(t).pnl, 0);

        // Cash-basis (Smit's rule, 2026-08-27): premium booked when cash lands,
        // costs booked when paid. Open sell premiums count immediately; a
        // later buy-back above premium books a negative delta that day.
        const bookedPnL = computeBookedPnL(filteredTrades);
        const finalizedPnL = computeFinalizedPnL(filteredTrades);

        // Ticker stats, cash-basis (open premiums booked, buy-backs subtracted)
        const tickerStats = {};
        filteredTrades.forEach(t => {
            const pnl = tradeCashEvents(t).reduce((a, e) => a + e.delta, 0);
            const ticker = t.ticker.toUpperCase();
            if (!tickerStats[ticker]) tickerStats[ticker] = 0;
            tickerStats[ticker] += pnl;
        });

        // Monthly stats, cash-basis: premium lands in the open month,
        // buy-back cost in the close month
        const monthlyStats = {};
        filteredTrades.forEach(t => {
            tradeCashEvents(t).forEach(e => {
                const date = new Date(e.date + 'T12:00:00Z');
                const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric', timeZone: 'UTC' });
                if (!monthlyStats[monthKey]) monthlyStats[monthKey] = 0;
                monthlyStats[monthKey] += e.delta;
            });
        });

        // Chain-based win rate calculation
        const chainRoots = filteredTrades.filter(t => !t.parentTradeId);

        const chains = chainRoots.map(root => {
            let chainPnL = calculateMetrics(root).pnl;
            let finalStatus = root.status;
            let currentId = root.id;

            let child = filteredTrades.find(t => t.parentTradeId === currentId);
            while (child) {
                chainPnL += calculateMetrics(child).pnl;
                finalStatus = child.status;
                currentId = child.id;
                child = filteredTrades.find(t => t.parentTradeId === currentId);
            }

            return {
                rootId: root.id,
                chainPnL,
                finalStatus,
                isResolved: finalStatus !== 'Open' && finalStatus !== 'Rolled'
            };
        });

        const resolvedChains = chains.filter(c => c.isResolved);
        const winningChains = resolvedChains.filter(c => c.chainPnL > 0).length;
        const winRate = resolvedChains.length > 0 ? (winningChains / resolvedChains.length) * 100 : 0;

        const avgRoi = completedTrades.length > 0
            ? completedTrades.reduce((acc, t) => acc + calculateMetrics(t).roi, 0) / completedTrades.length
            : 0;

        // Capital-weighted ROI across all completed trades:
        // total P/L divided by total collateral those trades tied up.
        const closedAgg = completedTrades.reduce((acc, t) => {
            const { pnl, collateral } = calculateMetrics(t);
            return { pnl: acc.pnl + pnl, collateral: acc.collateral + collateral };
        }, { pnl: 0, collateral: 0 });
        const totalRoi = closedAgg.collateral > 0
            ? (closedAgg.pnl / closedAgg.collateral) * 100
            : 0;

        const capitalAtRisk = openTrades
            .reduce((acc, t) => acc + calculateMetrics(t).collateral, 0);

        const rolledCount = filteredTrades.filter(t => t.status === 'Rolled').length;

        const totalPremiumCollected = allClosedTrades.reduce((acc, t) => {
            const { pnl } = calculateMetrics(t);
            return acc + pnl;
        }, 0);

        const bestTicker = Object.entries(tickerStats).length > 0
            ? Object.entries(tickerStats).reduce((best, [ticker, pnl]) =>
                pnl > (best?.pnl || -Infinity) ? { ticker, pnl } : best, null)
            : null;

        return {
            totalPnL,
            bookedPnL,
            finalizedPnL,
            bookedWithCapitalGains: bookedPnL + capitalGainsStats.realizedCapitalGL,
            tickerStats,
            monthlyStats,
            winRate,
            avgRoi,
            totalRoi,
            capitalAtRisk,
            openTradesCount: openTrades.length,
            completedTradesCount: completedTrades.length,
            closedTradesCount: allClosedTrades.length,
            resolvedChains: resolvedChains.length,
            rolledCount,
            totalPremiumCollected,
            bestTicker,
            realizedCapitalGL: capitalGainsStats.realizedCapitalGL,
            openPositions: capitalGainsStats.openPositions,
            closedPositions: capitalGainsStats.closedPositions,
            totalPnLWithCapitalGains: totalPnL + capitalGainsStats.realizedCapitalGL,
            totalCommissions: capitalGainsStats.totalCommissions
        };
    }, [trades, capitalGainsStats, chartPeriod]);

    // Build a map of trade chains for visual indicators
    const chainInfo = useMemo(() => {
        const parentToChild = new Map();
        const childToParent = new Map();

        trades.forEach(t => {
            if (t.parentTradeId) {
                parentToChild.set(t.parentTradeId, t.id);
                childToParent.set(t.id, t.parentTradeId);
            }
        });

        return { parentToChild, childToParent };
    }, [trades]);

    // Chart data: two cumulative series over the same dates —
    //   booked (cash): premiums when received, buy-back costs when paid
    //   finalized:     only closed/expired/assigned trades
    // Both are cumulative over full history, then filtered to the period so
    // period views show true levels rather than resetting to zero.
    const chartData = useMemo(() => {
        if (trades.length === 0) return [];

        const now = new Date();
        const periodStart = {
            '1m': new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()),
            '3m': new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()),
            '6m': new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()),
            'ytd': new Date(now.getFullYear(), 0, 1),
            'all': new Date(0)
        }[chartPeriod];

        const fmtLabel = d => new Date(d + 'T12:00:00Z')
            .toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

        const series = dailyCumulativeSeries(trades);

        // Extend both lines to today so the chart always ends at now.
        const todayKey = now.toISOString().slice(0, 10);
        const lastPoint = series[series.length - 1];
        if (lastPoint && lastPoint.fullDate < todayKey) {
            series.push({
                date: fmtLabel(todayKey),
                fullDate: todayKey,
                booked: lastPoint.booked,
                finalized: lastPoint.finalized,
                dayBooked: 0,
                dayFinalized: 0,
                tickers: 'Today'
            });
        }

        return series.filter(p => new Date(p.fullDate + 'T12:00:00Z') >= periodStart);
    }, [trades, chartPeriod]);

    return {
        stats,
        chainInfo,
        chartData,
        chartPeriod,
        setChartPeriod,
        fetchCapitalGainsStats
    };
};
