import React from 'react';
import { formatCurrency } from '../../utils/formatters';

// P/L attribution by underlying (fork addition 2026-08-28): which names
// actually make the wheel money. Realized totals are capital-weighted ROI
// style (per Smit's total-ROI preference); open exposure sits alongside.

const Pnl = ({ v }) => (
    <span className={`font-mono ${v > 0 ? 'text-emerald-600 dark:text-emerald-400' : v < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
        {v > 0 ? '+' : ''}{formatCurrency(v)}
    </span>
);

export const AttributionPanel = ({ attribution }) => {
    if (!attribution || attribution.rows.length === 0) return null;
    const { rows } = attribution;

    return (
        <section className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-baseline justify-between">
                <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-200">P/L Attribution by Underlying</h3>
                <span className="text-xs text-slate-400">
                    realized <Pnl v={attribution.totalRealized} /> · open unrealized <Pnl v={attribution.totalOpenUnrealized} />
                </span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700">
                        <tr>
                            <th className="px-3 py-2 font-semibold">Underlying</th>
                            <th className="px-3 py-2 font-semibold text-right">Realized P/L</th>
                            <th className="px-3 py-2 font-semibold text-center">W/L</th>
                            <th className="px-3 py-2 font-semibold text-right">Win Rate</th>
                            <th className="px-3 py-2 font-semibold text-right">ROI (wt.)</th>
                            <th className="px-3 py-2 font-semibold text-right">Open Collat.</th>
                            <th className="px-3 py-2 font-semibold text-right">Open Unreal.</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                        {rows.map((r) => (
                            <tr key={r.ticker} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="px-3 py-2 font-mono font-semibold text-slate-700 dark:text-slate-200">{r.ticker}</td>
                                <td className="px-3 py-2 text-right"><Pnl v={r.realized} /></td>
                                <td className="px-3 py-2 text-center font-mono text-xs text-slate-500 dark:text-slate-400">{r.wins}W/{r.losses}L</td>
                                <td className="px-3 py-2 text-right font-mono text-xs text-slate-500 dark:text-slate-400">{r.winRate != null ? `${r.winRate}%` : '—'}</td>
                                <td className="px-3 py-2 text-right font-mono text-xs text-slate-500 dark:text-slate-400">{r.weightedRoi != null ? `${r.weightedRoi}%` : '—'}</td>
                                <td className="px-3 py-2 text-right font-mono text-xs text-slate-500 dark:text-slate-400">{r.openCount > 0 ? formatCurrency(r.openCollateral) : '—'}</td>
                                <td className="px-3 py-2 text-right text-xs">{r.openCount > 0 ? <Pnl v={r.openUnrealized} /> : '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="px-3 py-2 text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-700">
                Realized = closed option trades only (rolls carry into the final leg). ROI (wt.) is capital-weighted: realized P/L ÷ closed collateral.
            </p>
        </section>
    );
};
