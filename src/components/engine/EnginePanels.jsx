import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatters';

// Engine panels: capital card + scan funnel, fed by wheel-stack pushes
// (POST /api/engine/dashboard). Empty states until the first push arrives.

const useEngineDashboard = () => {
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

    return { data, failed };
};

const fmtAge = (iso) => {
    if (!iso) return null;
    const then = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
    const mins = Math.max(0, Math.round((Date.now() - then.getTime()) / 60000));
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
};

const Freshness = ({ updatedAt }) => {
    const age = fmtAge(updatedAt);
    if (!age) return null;
    const stale = updatedAt && (Date.now() - new Date(updatedAt.includes('T') ? updatedAt : updatedAt.replace(' ', 'T') + 'Z').getTime()) > 26 * 3600 * 1000;
    return (
        <span className={`text-xs ${stale ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
            Last engine run: {age}{stale ? ' (stale)' : ''}
        </span>
    );
};

const EmptyState = ({ message }) => (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-dashed border-slate-300 dark:border-slate-600 text-center text-sm text-slate-400 dark:text-slate-500">
        {message}
    </div>
);

// ---------- Capital card ----------

const CapitalRow = ({ label, value, sub, warn }) => (
    <div className="flex items-baseline justify-between py-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
        <div className="text-right">
            <span className={`font-mono font-semibold ${warn ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200'}`}>{value}</span>
            {sub && <div className="text-xs text-slate-400 dark:text-slate-500">{sub}</div>}
        </div>
    </div>
);

const CapitalCard = ({ snapshot, updatedAt }) => {
    if (!snapshot) return <EmptyState message="Capital snapshot will appear after the next engine run." />;

    const riskUsed = snapshot.riskUsed ?? 0;
    const riskCap = snapshot.riskCap ?? 90000;
    const riskPct = riskCap > 0 ? Math.min(100, (riskUsed / riskCap) * 100) : 0;
    const optionsBp = snapshot.optionsBuyingPower ?? 0;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">Capital &amp; Collateral</span>
                <Freshness updatedAt={updatedAt} />
            </div>
            <div className="p-4 space-y-3">
                <div>
                    <div className="flex items-baseline justify-between mb-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Risk deployed</span>
                        <span className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-200">
                            {formatCurrency(riskUsed)} / {formatCurrency(riskCap)}
                        </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                        <div
                            className={`h-full rounded-full ${riskPct > 80 ? 'bg-red-500' : riskPct > 55 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${riskPct}%` }}
                        />
                    </div>
                </div>
                <div className="divide-y divide-slate-50 dark:divide-slate-700">
                    <CapitalRow label="Cash" value={formatCurrency(snapshot.cash ?? 0)} />
                    <CapitalRow
                        label="Options BP"
                        value={formatCurrency(optionsBp)}
                        sub="cash collateral available for new CSPs"
                        warn={optionsBp < 2000}
                    />
                    <CapitalRow
                        label="SGOV sweep"
                        value={formatCurrency(snapshot.sgovValue ?? 0)}
                        sub={snapshot.sgovShares != null
                            ? `${snapshot.sgovShares} sh${snapshot.sgovMonthlyYield ? ` · ~${formatCurrency(snapshot.sgovMonthlyYield)}/mo` : ''}`
                            : undefined}
                    />
                    <CapitalRow label="Equity" value={formatCurrency(snapshot.equity ?? 0)} />
                </div>
                {(snapshot.regime || snapshot.vix != null) && (
                    <div className="flex gap-2 pt-1">
                        {snapshot.regime && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium">
                                {snapshot.regime}
                            </span>
                        )}
                        {snapshot.vix != null && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                                VIX {Number(snapshot.vix).toFixed(1)}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ---------- Scan funnel ----------

const ACTION_STYLE = {
    sold: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
    skipped: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
    blocked: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    none: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
};

const actionBadge = (sym) => {
    if (sym.action === 'sold') return { cls: ACTION_STYLE.sold, label: `Sold ${sym.detail || ''}`.trim() };
    if (sym.dropReason) return { cls: ACTION_STYLE.blocked, label: sym.dropReason };
    if (sym.action === 'skipped') return { cls: ACTION_STYLE.skipped, label: sym.detail || 'skipped' };
    return { cls: ACTION_STYLE.none, label: sym.detail || 'no candidates' };
};

const ScanFunnel = ({ scanRun, updatedAt }) => {
    if (!scanRun || !Array.isArray(scanRun.symbols) || scanRun.symbols.length === 0) {
        return <EmptyState message="Scan funnel will appear after the next engine run." />;
    }

    const symbols = scanRun.symbols;
    const passed = symbols.filter(s => !s.dropReason).length;
    const sold = symbols.filter(s => s.action === 'sold').length;
    const considered = scanRun.contractsConsidered ??
        symbols.reduce((n, s) => n + (s.contractsConsidered || 0), 0);

    // Aggregate reject reasons across surviving symbols (or run-level aggregate)
    const rejectTotals = {};
    const rejectSource = scanRun.aggregateRejects
        ? [scanRun.aggregateRejects]
        : symbols.map(s => s.rejects || {});
    for (const rej of rejectSource) {
        for (const [k, v] of Object.entries(rej)) {
            rejectTotals[k] = (rejectTotals[k] || 0) + v;
        }
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">
                    Scan funnel{scanRun.slot ? ` · ${scanRun.slot}` : ''}
                </span>
                <Freshness updatedAt={updatedAt} />
            </div>
            <div className="p-4 space-y-3">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
                    <span><span className="font-mono font-semibold">{symbols.length}</span> in watchlist</span>
                    <span>→ <span className="font-mono font-semibold">{passed}</span> passed filters</span>
                    <span>→ <span className="font-mono font-semibold">{considered}</span> contracts considered</span>
                    <span>→ <span className={`font-mono font-semibold ${sold > 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>{sold}</span> sold</span>
                </div>

                {Object.keys(rejectTotals).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {Object.entries(rejectTotals).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                            <span key={reason} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-mono">
                                {reason}: {count}
                            </span>
                        ))}
                    </div>
                )}

                {scanRun.note && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">{scanRun.note}</div>
                )}

                <div className="overflow-y-auto max-h-64">
                    <table className="w-full text-sm">
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                            {symbols.map((s) => {
                                const badge = actionBadge(s);
                                return (
                                    <tr key={s.symbol} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        <td className="px-2 py-1.5 font-semibold text-slate-700 dark:text-slate-200 w-16">{s.symbol}</td>
                                        <td className="px-2 py-1.5 text-right font-mono text-xs text-slate-400 dark:text-slate-500 w-24">
                                            {!s.dropReason && s.contractsConsidered != null ? `${s.contractsConsidered} ctr` : ''}
                                        </td>
                                        <td className="px-2 py-1.5 text-right">
                                            <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                                                {badge.label}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export const EnginePanels = () => {
    const { data, failed } = useEngineDashboard();
    if (failed && !data) return null; // endpoint not deployed yet — stay invisible
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CapitalCard snapshot={data?.snapshot} updatedAt={data?.updatedAt} />
            <ScanFunnel scanRun={data?.scanRun} updatedAt={data?.updatedAt} />
        </div>
    );
};
