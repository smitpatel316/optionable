import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, AlertTriangle, X } from 'lucide-react';
import { API_URL } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatters';
import { PayoffModal } from '../analytics/PayoffModal';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { pnlTone } from '@/lib/pnl';
import { cn } from '@/lib/utils';

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

// Monochrome type badges: hue carries P/L only. Filled = put leg, outline =
// call leg, muted = stock/cash positions.
const TYPE_VARIANT = {
    CSP: 'secondary',
    CC: 'outline',
    SGOV: 'muted',
    STOCK: 'muted',
    OPT: 'muted',
};

const fmtPct = (value, goodWhenPositive = true) => {
    if (value == null) return <span className="text-muted-foreground">—</span>;
    const v = Number(value);
    const good = goodWhenPositive ? v >= 0 : v > 0;
    return (
        <span className={cn('font-mono', pnlTone(good ? 1 : -1))}>
            {v > 0 ? '+' : ''}{v.toFixed(1)}%
        </span>
    );
};

// Indicative roll credits (agamotto-inspired): sell the same strike ~1/2
// weeks further out at bid, buy the live leg back at ask (Yahoo chains,
// server-cached 10 min). Green = roll pays you, red = roll costs you.
// The table's P/L column is the "close now" answer; these answer "+1/+2wk?".
const RollChips = ({ whatIf }) => {
    if (!whatIf) return <span className="text-muted-foreground">—</span>;
    if (whatIf.error) return <span className="text-muted-foreground" title={whatIf.error}>—</span>;
    const chip = (label, roll, weeks) => {
        if (!roll) {
            return (
                <span key={label} className="inline-block text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                    title={`No listed ${weeks}wk-out expiry to roll into on Yahoo chains`}>
                    {label} —
                </span>
            );
        }
        const v = roll.netCredit;
        const good = v > 0;
        return (
            <span
                key={label}
                className={`inline-block text-[11px] font-mono px-1.5 py-0.5 rounded ${good ? 'bg-emerald-500/10 dark:bg-emerald-400/15 text-emerald-700 dark:text-emerald-400' : 'bg-rose-500/10 dark:bg-rose-400/15 text-rose-600 dark:text-rose-400'}`}
                title={`Roll to ${roll.to}: indicative ${good ? 'credit' : 'debit'} (sell new at bid − buy back at ask)`}
            >
                {label} {good ? '+' : '−'}{formatCurrency(Math.abs(v))}
            </span>
        );
    };
    return (
        <div className="flex flex-wrap gap-1 justify-end">
            {chip('+1wk', whatIf.roll1wk, '1')}
            {chip('+2wk', whatIf.roll2wk, '2')}
        </div>
    );
};

const PositionRow = ({ p, onPayoff, whatIfs }) => {
    const optType = p.type === 'CSP' ? 'P' : p.type === 'CC' ? 'C' : '';
    const rollKey = (p.type === 'CSP' || p.type === 'CC')
        ? `${p.underlying}|${p.strike}|${p.expiry}|${p.type}` : null;
    const label = p.type === 'SGOV' || p.type === 'STOCK'
        ? `${p.underlying}${p.contracts ? ` ×${p.contracts}` : ''}`
        : `${p.underlying} ${fmtStrike(p.strike, optType)}${p.expiry ? ` ${fmtExpiry(p.expiry)}` : ''}`;
    const dteHot = p.dte != null && p.dte < 7;
    const plDollars = p.unrealizedPL != null ? Number(p.unrealizedPL) : null;
    return (
        <TableRow>
            <TableCell className="font-semibold text-foreground">
                {label}
                {p.rollsUsed != null && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-muted text-foreground font-mono"
                        title={`Rolled ${p.rollsUsed} of ${p.rollsMax ?? 2} allowed times`}>
                        {p.rollsUsed}/{p.rollsMax ?? 2}
                    </span>
                )}
                {(p.type === 'CSP' || p.type === 'CC') && p.breakEven != null && (
                    <div className="text-xs font-normal font-mono text-muted-foreground mt-0.5">
                        BE {formatCurrency(p.breakEven)}
                        {p.distToBePct != null && (
                            <span className={Number(p.distToBePct) < 0 ? 'text-rose-500 dark:text-rose-400' : ''}
                                title={`Underlying last ~${formatCurrency(p.underlyingLast)} at push time — ${Number(p.distToBePct) < 0 ? 'past' : 'away from'} break-even`}>
                                {` · ${Number(p.distToBePct) > 0 ? '+' : ''}${Number(p.distToBePct).toFixed(1)}% to BE`}
                            </span>
                        )}
                    </div>
                )}
            </TableCell>
            <TableCell className="text-center">
                <Badge variant={TYPE_VARIANT[p.type] || 'muted'}>
                    {p.type === 'SGOV' ? 'SGOV · cash sweep' : p.type}
                </Badge>
            </TableCell>
            <TableCell className={`text-center font-mono ${dteHot ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                {p.dte != null ? `${p.dte}d` : '—'}
            </TableCell>
            <TableCell className="text-right font-mono text-muted-foreground">
                {p.entryPrice != null ? formatCurrency(p.entryPrice) : '—'}
            </TableCell>
            <TableCell className="text-right font-mono text-muted-foreground">
                {p.currentPrice != null ? formatCurrency(p.currentPrice) : '—'}
            </TableCell>
            <TableCell className="text-right">
                {plDollars == null ? <span className="text-muted-foreground">—</span> : (
                    <span className={cn('font-mono', pnlTone(plDollars))}>
                        {plDollars < 0 ? '-' : '+'}{formatCurrency(Math.abs(plDollars))}
                    </span>
                )}
            </TableCell>
            <TableCell className="text-right">{fmtPct(p.unrealizedPLpct)}</TableCell>
            <TableCell className="text-right">
                {p.otmPct == null
                    ? <span className="text-muted-foreground">—</span>
                    : <span className={`font-mono ${Number(p.otmPct) < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'}`}>
                        {Number(p.otmPct) < 0 ? 'ITM ' : ''}{Math.abs(Number(p.otmPct)).toFixed(1)}%
                    </span>}
            </TableCell>
            <TableCell className="text-right">
                {(p.type === 'CSP' || p.type === 'CC') && (
                    <RollChips whatIf={rollKey ? whatIfs[rollKey] : undefined} />
                )}
            </TableCell>
            <TableCell className="text-center px-2">
                {(p.type === 'CSP' || p.type === 'CC') && (
                    <button
                        onClick={() => onPayoff(p)}
                        className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-accent transition-colors"
                        title="Payoff at expiry"
                    >
                        <BarChart3 className="w-4 h-4" />
                    </button>
                )}
            </TableCell>
        </TableRow>
    );
};

export const OpenPositionsTable = () => {
    const [data, setData] = useState(null);
    const [failed, setFailed] = useState(false);
    const [payoffPosition, setPayoffPosition] = useState(null);
    const [whatIfs, setWhatIfs] = useState({});
    const [dismissedKey, setDismissedKey] = useState(() => {
        try { return localStorage.getItem('opt-expiring-dismiss'); } catch { return null; }
    });

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

    // Roll what-ifs live behind live option-chain quotes, so they load in the
    // background without blocking the table (first call can take seconds).
    const fetchWhatIfs = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/analytics/roll-whatif`);
            if (!res.ok) throw new Error('fetch failed');
            const json = await res.json();
            const rows = json.data?.rows || [];
            const map = {};
            for (const r of rows) map[r.key] = r;
            setWhatIfs(map);
        } catch { /* chips just stay empty */ }
    }, []);

    useEffect(() => {
        fetchData();
        fetchWhatIfs();
        const t = setInterval(fetchData, 60000);
        const t2 = setInterval(fetchWhatIfs, 5 * 60000);
        return () => { clearInterval(t); clearInterval(t2); };
    }, [fetchData, fetchWhatIfs]);

    if (failed && !data) return null; // endpoint not deployed yet — stay invisible

    const positions = Array.isArray(data?.positions) ? data.positions : [];
    const queue = Array.isArray(data?.fundingQueue) ? data.fundingQueue : [];
    const asOf = fmtAsOf(data?.updatedAt);

    // Expiring-soon strip: server pre-filters legs with DTE <= 7. The dismiss
    // is keyed on the exact set + DTEs, so it reappears when the set changes
    // (new position, or a day ticks by) rather than staying hidden forever.
    const expiring = Array.isArray(data?.expiringSoon) ? data.expiringSoon : [];
    const expiringKey = expiring.length ? expiring.map((e) => `${e.underlying}|${e.strike}|${e.expiry}|${e.dte}`).sort().join(';') : null;
    const showExpiring = expiringKey && dismissedKey !== expiringKey;
    const dismissExpiring = () => {
        setDismissedKey(expiringKey);
        try { localStorage.setItem('opt-expiring-dismiss', expiringKey); } catch { /* private mode */ }
    };

    return (
        <Card className="overflow-hidden">
            <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-muted/50">
                <h3 className="font-semibold text-foreground">Open Positions</h3>
                {asOf && (
                    <span className="text-xs text-muted-foreground">as of {asOf}</span>
                )}
            </div>

            {showExpiring && (
                <div className="px-4 py-2 border-b border-border/60 bg-muted flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-foreground shrink-0" />
                    <div className="text-xs text-foreground font-medium">
                        Expiring ≤7d: {expiring.map((e) => `${e.underlying} ${fmtStrike(e.strike, e.type === 'CSP' ? 'P' : 'C')}${e.expiry ? ` ${fmtExpiry(e.expiry)}` : ''} (${e.dte}d)`).join(' · ')}
                    </div>
                    <button onClick={dismissExpiring} aria-label="Dismiss expiring notice"
                        className="ml-auto text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {queue.length > 0 && (
                <div className="px-4 py-2 border-b border-border space-y-0.5">
                    {queue.map((q, i) => (
                        <div key={q.symbol || i} className="text-xs text-muted-foreground">
                            Queued: {q.underlying} {fmtStrike(q.strike, 'P')}{q.expiry ? ` ${fmtExpiry(q.expiry)}` : ''}
                            {q.need != null ? ` — waiting on funding (${formatCurrency(q.need)})` : ' — waiting on funding'}
                        </div>
                    ))}
                </div>
            )}

            {positions.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground border-dashed">
                    No open positions reported yet — updates at 10:05 / 1:05 / 3:05 ET on trading days.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <Table className="min-w-[720px]">
                        <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableHead>Position</TableHead>
                                <TableHead className="text-center">Type</TableHead>
                                <TableHead className="text-center">DTE</TableHead>
                                <TableHead className="text-right">Entry</TableHead>
                                <TableHead className="text-right">Current</TableHead>
                                <TableHead className="text-right">P/L</TableHead>
                                <TableHead className="text-right">P/L %</TableHead>
                                <TableHead className="text-right">OTM</TableHead>
                                <TableHead className="text-right" title="Indicative net credit for rolling the same strike out ~1/+2 weeks (Yahoo quotes)">Roll?</TableHead>
                                <TableHead className="text-center px-2"><span className="sr-only">Payoff</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {positions.map((p) => <PositionRow key={p.symbol} p={p} onPayoff={setPayoffPosition} whatIfs={whatIfs} />)}
                        </TableBody>
                    </Table>
                </div>
            )}
            {payoffPosition && (
                <PayoffModal position={payoffPosition} onClose={() => setPayoffPosition(null)} />
            )}
        </Card>
    );
};
