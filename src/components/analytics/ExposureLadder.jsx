import React from 'react';
import { formatCurrency } from '../../utils/formatters';

// Expiry ladder / collateral release schedule (fork addition 2026-08-28).
// Where your cash is locked, and when it frees up. Rows are ordered by expiry;
// bar width is proportional to the capital parked at that date. TradesViz-style
// "capital at risk by date", derived from open trades + engine marks.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (iso) => {
    const [, m, d] = iso.split('-').map(Number);
    return `${MONTHS[m - 1]} ${d}`;
};

export const ExposureLadder = ({ exposure }) => {
    if (!exposure || exposure.expirations.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6 text-center text-sm text-slate-400">
                No upcoming expirations — nothing deployed right now.
            </div>
        );
    }

    const maxCollateral = Math.max(...exposure.expirations.map((e) => e.collateral));
    const thisWeek = exposure.expirations.filter((e) => e.dte != null && e.dte <= 7);

    return (
        <section className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-baseline justify-between">
                <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-200">Collateral Release Schedule</h3>
                <span className="text-xs text-slate-400">
                    {formatCurrency(exposure.totalCollateral)} across {exposure.expirationCount} expiration{exposure.expirationCount !== 1 ? 's' : ''}
                    {thisWeek.length > 0 && ` · ${formatCurrency(thisWeek.reduce((s, e) => s + e.collateral, 0))} frees within 7d`}
                </span>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-700">
                {exposure.expirations.map((e) => {
                    const hot = e.dte != null && e.dte <= 7;
                    const width = Math.max((e.collateral / maxCollateral) * 100, 8);
                    return (
                        <div key={e.date} className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <div className="flex items-center gap-3">
                                <div className={`w-16 shrink-0 font-mono text-sm ${hot ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-slate-600 dark:text-slate-300'}`}>
                                    {fmtDate(e.date)}
                                </div>
                                <div className="flex-1">
                                    <div className="h-5 rounded bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                        <div
                                            className={`h-full rounded transition-all ${hot ? 'bg-amber-400/80 dark:bg-amber-500/70' : 'bg-indigo-400/80 dark:bg-indigo-500/70'}`}
                                            style={{ width: `${width}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="w-24 shrink-0 text-right font-mono text-sm text-slate-700 dark:text-slate-200">
                                    {formatCurrency(e.collateral)}
                                </div>
                            </div>
                            <div className="mt-1 ml-[76px] flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400">
                                <span>{e.dte != null ? `${e.dte}d` : ''}</span>
                                <span>{e.count} position{e.count !== 1 ? 's' : ''} ({e.tickers.join(', ')})</span>
                                <span>premium left: {formatCurrency(e.premiumRemaining)}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
            {exposure.fundingQueue.length > 0 && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-700">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Engine funding queue — cash reserved for queued trades</div>
                    <div className="flex flex-wrap gap-2">
                        {exposure.fundingQueue.map((q, i) => (
                            <span key={i} className="text-xs px-2 py-1 rounded bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 font-mono">
                                {q.underlying} ${q.strike}P {fmtDate(q.expiry)} needs {formatCurrency(q.need)}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
};
