import React, { useMemo, useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip } from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { API_URL } from '../../utils/constants';
import { shortOptionPayoff, coveredCallCombinedPayoff, estimateUnderlying } from '../../utils/payoff';

// Payoff-at-expiry modal (fork addition 2026-08-28): OptionStrat-style P&L
// curve for an open wheel position. CSPs show the short-put curve; CCs switch
// between the option leg and the combined view (shares + call) when the
// underlying lot is recorded in Stock Positions. All math from src/utils/payoff.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (iso) => {
    if (!iso) return '';
    const [, m, d] = iso.split('-').map(Number);
    return `${MONTHS[m - 1]} ${d}`;
};

const PayoffTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const { s, pnl } = payload[0].payload;
    return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-xs font-mono shadow">
            <div>underlying ${s}</div>
            <div className={pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                P/L {formatCurrency(pnl)}
            </div>
        </div>
    );
};

export const PayoffModal = ({ position, onClose }) => {
    const isCSP = position.type === 'CSP';
    const contracts = position.contracts || 1;
    const [combined, setCombined] = useState(true);
    const [costBasis, setCostBasis] = useState(null);

    // CC wheel leg: look for the underlying shares in Stock Positions
    useEffect(() => {
        if (isCSP) return;
        let alive = true;
        fetch(`${API_URL}/positions`)
            .then((r) => r.json())
            .then((json) => {
                if (!alive) return;
                const rows = json.data || [];
                const match = rows
                    .filter((p) => p.ticker === position.underlying && !p.soldDate)
                    .sort((a, b) => (a.shares || 0) - (b.shares || 0))[0];
                setCostBasis(match ? match.costBasis : null);
            })
            .catch(() => alive && setCostBasis(null));
        return () => { alive = false; };
    }, [isCSP, position.underlying]);

    const useCombined = !isCSP && combined && costBasis != null;
    const model = useMemo(() => (
        useCombined
            ? coveredCallCombinedPayoff({ strike: position.strike, entryPrice: position.entryPrice, costBasis, contracts })
            : shortOptionPayoff({ strike: position.strike, entryPrice: position.entryPrice, contracts, type: position.type })
    ), [useCombined, position, costBasis, contracts]);

    const spot = estimateUnderlying(position.strike, position.otmPct, position.type);
    const optType = isCSP ? 'P' : 'C';

    // Split series at zero so profit/loss areas color independently
    const data = useMemo(() => model.points.map((p) => ({
        ...p,
        above: p.pnl >= 0 ? p.pnl : null,
        below: p.pnl < 0 ? p.pnl : null,
        zeroA: p.pnl >= 0 ? 0 : null,
        zeroB: p.pnl < 0 ? 0 : null,
    })), [model]);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-3xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
                    <div>
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                            Payoff at Expiry — {position.underlying} ${position.strike}{optType} {fmtDate(position.expiry)}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {contracts} contract{contracts !== 1 ? 's' : ''} · entry {formatCurrency(position.entryPrice)} · {isCSP ? 'short put' : useCombined ? 'shares + short call' : 'short call leg'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1" aria-label="Close">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4">
                    <div className="flex flex-wrap gap-2 mb-3">
                        <span className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 font-mono text-slate-600 dark:text-slate-300">
                            breakeven: ${model.breakeven}
                        </span>
                        <span className="text-xs px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-900/30 font-mono text-emerald-700 dark:text-emerald-300">
                            max profit: {formatCurrency(model.maxProfit)}
                        </span>
                        <span className="text-xs px-2 py-1 rounded bg-red-50 dark:bg-red-900/30 font-mono text-red-700 dark:text-red-300">
                            max loss: {model.maxLoss == null ? 'unbounded' : formatCurrency(model.maxLoss)}
                        </span>
                        {spot != null && (
                            <span className="text-xs px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-900/30 font-mono text-indigo-700 dark:text-indigo-300">
                                underlying ≈ ${spot}
                            </span>
                        )}
                        {!isCSP && costBasis != null && (
                            <button
                                onClick={() => setCombined((c) => !c)}
                                className="text-xs px-2 py-1 rounded bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 font-mono hover:bg-sky-200 dark:hover:bg-sky-900/60"
                            >
                                {combined ? 'view: shares + call' : 'view: option leg only'}
                            </button>
                        )}
                    </div>

                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.25} />
                                <XAxis dataKey="s" tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11, fill: '#64748b' }} domain={['dataMin', 'dataMax']} type="number" />
                                <YAxis tickFormatter={(v) => (Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`)} tick={{ fontSize: 11, fill: '#64748b' }} width={60} />
                                <Tooltip content={<PayoffTooltip />} />
                                <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
                                <ReferenceLine x={model.breakeven} stroke="#6366f1" strokeDasharray="6 3" label={{ value: 'BE', position: 'top', fontSize: 10, fill: '#6366f1' }} />
                                {spot != null && (
                                    <ReferenceLine x={spot} stroke="#f59e0b" strokeDasharray="6 3" label={{ value: 'now', position: 'top', fontSize: 10, fill: '#f59e0b' }} />
                                )}
                                <Area type="monotone" dataKey="above" stroke="#10b981" fill="#10b981" fillOpacity={0.25} strokeWidth={2} connectNulls={false} isAnimationActive={false} />
                                <Area type="monotone" dataKey="zeroA" stroke="none" fill="#10b981" fillOpacity={0.25} connectNulls={false} isAnimationActive={false} legendType="none" tooltipType="none" />
                                <Area type="monotone" dataKey="below" stroke="#ef4444" fill="#ef4444" fillOpacity={0.25} strokeWidth={2} connectNulls={false} isAnimationActive={false} />
                                <Area type="monotone" dataKey="zeroB" stroke="none" fill="#ef4444" fillOpacity={0.25} connectNulls={false} isAnimationActive={false} legendType="none" tooltipType="none" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">
                        X axis: underlying price at expiry. Held-to-expiry value; ignores assignment mechanics and further rolls.
                        {isCSP ? ' Max loss assumes the assigned stock goes to zero.' : useCombined ? ` Shares cost basis ${formatCurrency(costBasis)} from Stock Positions.` : ' Short call loss beyond the strike is unbounded.'}
                    </p>
                </div>
            </div>
        </div>
    );
};
