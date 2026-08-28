import React from 'react';
import { formatCurrency } from '../../utils/formatters';

// Wheel-cycle tracker (fork addition 2026-08-28): trades grouped into cycles
// per ticker with realized premium, collateral-weighted ROI and annualized APY.
// The wheel's core question: how hard is each dollar working per cycle?

const Pnl = ({ v }) => (
    <span className={`font-mono ${v > 0 ? 'text-emerald-600 dark:text-emerald-400' : v < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
        {v > 0 ? '+' : ''}{formatCurrency(v)}
    </span>
);

export const CyclesPanel = ({ cycles }) => {
    if (!cycles || cycles.length === 0) return null;

    return (
        <section className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-baseline justify-between">
                <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-200">Wheel Cycles</h3>
                <span className="text-xs text-slate-400">
                    {cycles.filter((c) => c.status === 'Open').length} running · {cycles.filter((c) => c.status === 'Closed').length} completed
                </span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700">
                        <tr>
                            <th className="px-3 py-2 font-semibold">Cycle</th>
                            <th className="px-3 py-2 font-semibold text-center">Status</th>
                            <th className="px-3 py-2 font-semibold text-center">Legs</th>
                            <th className="px-3 py-2 font-semibold text-right">Realized</th>
                            <th className="px-3 py-2 font-semibold text-right">Days</th>
                            <th className="px-3 py-2 font-semibold text-right">ROI</th>
                            <th className="px-3 py-2 font-semibold text-right">APY</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                        {cycles.map((c, i) => (
                            <tr key={`${c.ticker}-${c.start}-${i}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-200">
                                    <span className="font-semibold">{c.ticker}</span>{' '}
                                    <span className="text-slate-400">{c.style} · since {c.start}</span>
                                </td>
                                <td className="px-3 py-2 text-center">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status === 'Open' ? 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300' : 'bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-300'}`}>
                                        {c.status}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-center font-mono text-xs text-slate-500 dark:text-slate-400">
                                    {c.legs}{c.rolls > 0 ? ` (${c.rolls} roll${c.rolls !== 1 ? 's' : ''})` : ''}
                                </td>
                                <td className="px-3 py-2 text-right"><Pnl v={c.realized} /></td>
                                <td className="px-3 py-2 text-right font-mono text-xs text-slate-500 dark:text-slate-400">{c.daysHeld}d</td>
                                <td className="px-3 py-2 text-right font-mono text-xs text-slate-500 dark:text-slate-400">{c.roiPct != null ? `${c.roiPct}%` : '—'}</td>
                                <td className={`px-3 py-2 text-right font-mono text-xs ${c.apyPct != null && c.apyPct >= 10 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {c.apyPct != null ? `${c.apyPct}%` : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="px-3 py-2 text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-700">
                ROI = realized premium ÷ collateral · APY annualizes by days held. Open cycles count days through today; roll chains fold into their root cycle.
            </p>
        </section>
    );
};
