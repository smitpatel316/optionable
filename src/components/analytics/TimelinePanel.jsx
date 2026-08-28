import React, { useEffect, useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { tradesApi } from '../../services/api';

// Wheel-cycle timeline (fork addition 2026-08-28): one Gantt lane per wheel
// cycle (a put chain root and everyone attached to it), bars from open to
// close (or today when live). Assignment / called-away markers at the date the
// shares changed hands. Derived client-side from the trades table — no new
// endpoint, no external data.

const DAY = 86400000;
const dayMs = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00Z`).getTime() : null);

const rootOf = (trade, byId) => {
    let cur = trade;
    const seen = new Set();
    while (cur.parentTradeId && byId.has(cur.parentTradeId) && !seen.has(cur.id)) {
        seen.add(cur.id);
        cur = byId.get(cur.parentTradeId);
    }
    return cur.id;
};

const buildLanes = (trades) => {
    const byId = new Map(trades.map((t) => [t.id, t]));
    const roots = new Map();
    for (const t of trades) {
        if (t.type !== 'CSP' && t.type !== 'CC') continue;
        const rid = rootOf(t, byId);
        if (!roots.has(rid)) roots.set(rid, { ticker: t.ticker, legs: [] });
        roots.get(rid).legs.push(t);
    }
    const lanes = [];
    let minDay = null;
    let maxDay = null;
    for (const [rid, lane] of roots) {
        lane.legs.sort((a, b) => dayMs(a.openedDate || a.createdAt) - dayMs(b.openedDate || b.createdAt));
        lane.id = rid;
        for (const l of lane.legs) {
            const s = dayMs(l.openedDate || l.createdAt);
            const e = dayMs(l.closedDate) || dayMs(l.expirationDate) || Date.now();
            if (s == null) continue;
            minDay = minDay == null ? s : Math.min(minDay, s);
            maxDay = maxDay == null ? e : Math.max(maxDay, e);
        }
        lanes.push(lane);
    }
    // End the scale at today so open bars visibly meet "now"
    const todayStart = dayMs(new Date().toISOString().slice(0, 10));
    if (todayStart != null) maxDay = maxDay == null ? todayStart : Math.max(maxDay, todayStart);
    lanes.sort((a, b) => dayMs(a.legs[0].openedDate || a.legs[0].createdAt) - dayMs(b.legs[0].openedDate || b.legs[0].createdAt));
    return { lanes, minDay, maxDay };
};

const statusLabel = { Closed: 'closed', Expired: 'expired', Assigned: 'assigned', Rolled: 'rolled', Open: 'live' };

export const TimelinePanel = ({ accountId }) => {
    const [lanes, setLanes] = useState(null);
    const [scale, setScale] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const all = [];
                let page = 1;
                for (;;) { // trades endpoint pages at 100 — chase until a short page
                    const res = await tradesApi.getAll({ accountId, limit: 100, page });
                    const rows = res.data || [];
                    all.push(...rows);
                    if (rows.length < 100 || page >= 50) break;
                    page += 1;
                }
                if (cancelled) return;
                const { lanes: l, minDay, maxDay } = buildLanes(all);
                setLanes(l);
                setScale({ minDay, maxDay });
            } catch (e) {
                if (!cancelled) setError(e.message);
            }
        })();
        return () => { cancelled = true; };
    }, [accountId]);

    if (error) {
        return <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-5 text-sm text-red-500">Timeline unavailable: {error}</div>;
    }

    const span = scale && scale.maxDay > scale.minDay ? scale.maxDay - scale.minDay : 1;
    const pct = (ms) => ((ms - scale.minDay) / span) * 100;
    const todayMs = dayMs(new Date().toISOString().slice(0, 10));
    const ticks = scale ? Array.from({ length: 5 }, (_, i) => scale.minDay + (span * i) / 4) : [];
    const fmtDay = (ms) => new Date(ms).toISOString().slice(0, 10).slice(5);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-5">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-1">
                <CalendarRange className="w-4 h-4 text-slate-400" />
                Wheel Timeline
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">One lane per cycle; bars run open → close, open bars stretch to today.</p>
            {!lanes ? (
                <div className="h-32 bg-slate-100 dark:bg-slate-700 rounded animate-pulse"></div>
            ) : lanes.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No option trades yet.</p>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <div style={{ minWidth: '480px' }}>
                            {lanes.map((lane) => {
                                const start = dayMs(lane.legs[0].openedDate || lane.legs[0].createdAt);
                                const open = lane.legs.some((l) => l.status === 'Open');
                                return (
                                    <div key={lane.id} className="flex items-center gap-2 mb-1.5">
                                        <div className="w-14 shrink-0 text-xs font-mono font-medium text-slate-600 dark:text-slate-300 text-right">
                                            {lane.ticker}
                                            <span className="text-slate-400 dark:text-slate-500"> ×{lane.legs.length}</span>
                                        </div>
                                        <div className="relative flex-1 h-5">
                                            {lane.legs.map((leg) => {
                                                const s = dayMs(leg.openedDate || leg.createdAt);
                                                if (s == null) return null;
                                                const live = leg.status === 'Open';
                                                const e = live ? todayMs : (dayMs(leg.closedDate) || dayMs(leg.expirationDate) || todayMs);
                                                const left = pct(s);
                                                const width = Math.max(pct(Math.max(e, s)) - left, 0.8);
                                                const isCC = leg.type === 'CC';
                                                return (
                                                    <div
                                                        key={leg.id}
                                                        className={`absolute top-1 h-3 rounded-sm ${isCC ? 'bg-emerald-500/80' : 'bg-indigo-500/80'} ${live ? 'ring-1 ring-offset-1 ring-indigo-300 dark:ring-indigo-600 dark:ring-offset-slate-800' : ''}`}
                                                        style={{ left: `${left}%`, width: `${width}%` }}
                                                        title={`${leg.type} $${leg.strike / 100} · ${(leg.openedDate || '').slice(0, 10)} → ${live ? 'today' : (leg.closedDate || leg.expirationDate || '').slice(0, 10)} (${statusLabel[leg.status] || leg.status})`}
                                                    />
                                                );
                                            })}
                                            {lane.legs.filter((l) => l.status === 'Assigned' || l.status === 'CalledAway').map((leg) => {
                                                const m = dayMs(leg.closedDate);
                                                if (m == null) return null;
                                                return (
                                                    <div
                                                        key={`mark-${leg.id}`}
                                                        className="absolute w-2 h-2 rotate-45 bg-amber-500 -top-0.5"
                                                        style={{ left: `calc(${pct(m)}% - 4px)` }}
                                                        title={`${leg.status === 'Assigned' ? 'Assigned shares' : 'Called away'} ${(leg.closedDate || '').slice(0, 10)}`}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-14 shrink-0"></div>
                                <div className="relative flex-1 h-4 text-[10px] text-slate-400 dark:text-slate-500">
                                    {ticks.map((t, i) => (
                                        <span key={i} className="absolute" style={{ left: `${pct(t)}%`, transform: i === 0 ? 'none' : 'translateX(-50%)' }}>
                                            {fmtDay(t)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-indigo-500/80"></span>Put leg</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-emerald-500/80"></span>Call leg</span>
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rotate-45 bg-amber-500"></span>Shares change hands</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-indigo-500/80 ring-1 ring-indigo-300 dark:ring-indigo-600"></span>Live</span>
                    </div>
                </>
            )}
        </div>
    );
};
