import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatters';

// Open Positions table (2026-08-22): live-ish view of the wheel's open CSPs,
// covered calls, and the SGOV cash sweep. Fed by wheel-stack's end-of-run push
// (POST /api/engine/dashboard -> keys 'positions' + 'fundingQueue'), so data
// refreshes at the 10:05 / 13:05 / 15:05 ET engine runs — the "as of" stamp
// makes that explicit.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmtExpiry = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return `${MONTHS[m - 1]} ${d}`;
};

const fmtStrike = (strike, optType) => {
    if (strike == null) return '';
    const s = Number(strike);
    const str = s % 1 === 0 ? String(s) : s.toFixed(2).replace(/0$/, '');
    return `$${str}${optType}`;
};

const fmtAsOf = (updatedAt) => {
    if (!updatedAt) return null;
    const iso = updatedAt.includes('T') ? updatedAt : updatedAt.replace(' ', 'T') + 'Z';
    const d = new Date(iso);
    if (isNaN(d)) return null;
    return d.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    });
};

const TYPE_STYLE = {
    CSP: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    CC: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    SGOV: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
    STOCK: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
    OPT: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
};

const fmtPct = (value, goodWhenPositive = true) => {
    if (value == null) return <span className="text-slate-300 dark:text-slate-600">—</span>;
    const v = Number(value);
    const good = goodWhenPositive ? v >= 0 : v > 0;
    return (
        <span className={`font-mono ${good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {v > 0 ? '+' : ''}{v.toFixed(1)}%
        </span>
    );
};

const PositionRow = ({ p }) => {
    const optType = p.type === 'CSP' ? 'P' : p.type === 'CC' ? 'C' : '';
    const label = p.type === 'SGOV' || p.type === 'STOCK'
        ? `${p.underlying}${p.contracts ? ` ×${p.contracts}` : ''}`
        : `${p.underlying} ${fmtStrike(p.strike, optType)}${p.expiry ? ` ${fmtExpiry(p.expiry)}` : ''}`;
    const dteHot = p.dte != null && p.dte < 7;
    const plDollars = p.unrealizedPL != null ? Number(p.unrealizedPL) : null;
    return (
        <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
            <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                {label}
                {p.rollsUsed != null && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-mono"
                        title={`Rolled ${p.rollsUsed} of ${p.rollsMax ?? 2} allowed times`}>
                        {p.rollsUsed}/{p.rollsMax ?? 2}
                    </span>
                )}
            </td>
            <td className="px-3 py-2 text-center">
                <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_STYLE[p.type] || TYPE_STYLE.STOCK}`}>
                    {p.type === 'SGOV' ? 'SGOV · cash sweep' : p.type}
                </span>
            </td>
            <td className={`px-3 py-2 text-center font-mono ${dteHot ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-slate-600 dark:text-slate-300'}`}>
                {p.dte != null ? `${p.dte}d` : '—'}
            </td>
            <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-300">
                {p.entryPrice != null ? formatCurrency(p.entryPrice) : '—'}
            </td>
            <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-300">
                {p.currentPrice != null ? formatCurrency(p.currentPrice) : '—'}
            </td>
            <td className="px-3 py-2 text-right">
                {plDollars == null ? <span className="text-slate-300 dark:text-slate-600">—</span> : (
                    <span className={`font-mono ${plDollars < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {plDollars < 0 ? '-' : '+'}{formatCurrency(Math.abs(plDollars))}
                    </span>
                )}
            </td>
            <td className="px-3 py-2 text-right">{fmtPct(p.unrealizedPLpct)}</td>
            <td className="px-3 py-2 text-right">
                {p.otmPct == null
                    ? <span className="text-slate-300 dark:text-slate-600">—</span>
                    : <span className={`font-mono ${Number(p.otmPct) < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}`}>
                        {Number(p.otmPct) < 0 ? 'ITM ' : ''}{Math.abs(Number(p.otmPct)).toFixed(1)}%
                    </span>}
            </td>
        </tr>
    );
};

export const OpenPositionsTable = () => {
    const [data, setData] = useState(null);
    const [failed, setFailed] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/engine/dashboard`);
            if (!res.ok) throw new Error('fetch failed');
            const json = await res.json();
            setData(json.data || null);
            setFailed(false);
        } catch {
            setFailed(true);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const t = setInterval(fetchData, 60000);
        return () => clearInterval(t);
    }, [fetchData]);

    if (failed && !data) return null; // endpoint not deployed yet — stay invisible

    const positions = Array.isArray(data?.positions) ? data.positions : [];
    const queue = Array.isArray(data?.fundingQueue) ? data.fundingQueue : [];
    const asOf = fmtAsOf(data?.updatedAt);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-slate-50/50 dark:bg-slate-800/50">
                <h3 className="font-semibold text-slate-700 dark:text-slate-200">Open Positions</h3>
                {asOf && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">as of {asOf}</span>
                )}
            </div>

            {queue.length > 0 && (
                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 space-y-0.5">
                    {queue.map((q, i) => (
                        <div key={q.symbol || i} className="text-xs text-slate-400 dark:text-slate-500">
                            Queued: {q.underlying} {fmtStrike(q.strike, 'P')}{q.expiry ? ` ${fmtExpiry(q.expiry)}` : ''}
                            {q.need != null ? ` — waiting on funding (${formatCurrency(q.need)})` : ' — waiting on funding'}
                        </div>
                    ))}
                </div>
            )}

            {positions.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-400 dark:text-slate-500 border-dashed">
                    No open positions reported yet — updates at 10:05 / 1:05 / 3:05 ET on trading days.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left [&_th]:border-r [&_th]:border-slate-200 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-slate-100 [&_td:last-child]:border-r-0 dark:[&_th]:border-slate-600 dark:[&_td]:border-slate-700">
                        <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                            <tr>
                                <th className="px-3 py-2 font-semibold">Position</th>
                                <th className="px-3 py-2 font-semibold text-center">Type</th>
                                <th className="px-3 py-2 font-semibold text-center">DTE</th>
                                <th className="px-3 py-2 font-semibold text-right">Entry</th>
                                <th className="px-3 py-2 font-semibold text-right">Current</th>
                                <th className="px-3 py-2 font-semibold text-right">P/L</th>
                                <th className="px-3 py-2 font-semibold text-right">P/L %</th>
                                <th className="px-3 py-2 font-semibold text-right">OTM</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                            {positions.map((p) => <PositionRow key={p.symbol} p={p} />)}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
