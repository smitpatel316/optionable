import React, { useMemo, useState, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip } from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { API_URL } from '../../utils/constants';
import { shortOptionPayoff, coveredCallCombinedPayoff, estimateUnderlying } from '../../utils/payoff';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Payoff-at-expiry modal (fork addition 2026-08-28): OptionStrat-style P&L
// curve for an open wheel position. CSPs show the short-put curve; CCs switch
// between the option leg and the combined view (shares + call) when the
// underlying lot is recorded in Stock Positions. All math from src/utils/payoff.
// Monochrome chrome; profit zone emerald, loss zone rose.

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
        <div className="bg-popover border border-border text-popover-foreground rounded-md px-2 py-1 text-xs font-mono shadow-md">
            <div>underlying ${s}</div>
            <div className={pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
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
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>
                        Payoff at Expiry — {position.underlying} ${position.strike}{optType} {fmtDate(position.expiry)}
                    </DialogTitle>
                    <DialogDescription>
                        {contracts} contract{contracts !== 1 ? 's' : ''} · entry {formatCurrency(position.entryPrice)} · {isCSP ? 'short put' : useCombined ? 'shares + short call' : 'short call leg'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-wrap gap-2 mb-3">
                    <Badge variant="secondary" className="font-mono font-normal">breakeven: ${model.breakeven}</Badge>
                    <Badge variant="success" className="font-mono font-normal">max profit: {formatCurrency(model.maxProfit)}</Badge>
                    <Badge variant="destructive" className="font-mono font-normal">
                        max loss: {model.maxLoss == null ? 'unbounded' : formatCurrency(model.maxLoss)}
                    </Badge>
                    {spot != null && (
                        <Badge variant="outline" className="font-mono font-normal">underlying ≈ ${spot}</Badge>
                    )}
                    {!isCSP && costBasis != null && (
                        <Button variant="secondary" size="sm" className="font-mono text-xs h-6 px-2" onClick={() => setCombined((c) => !c)}>
                            {combined ? 'view: shares + call' : 'view: option leg only'}
                        </Button>
                    )}
                </div>

                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="s" tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} domain={['dataMin', 'dataMax']} type="number" stroke="hsl(var(--border))" />
                            <YAxis tickFormatter={(v) => (Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`)} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={60} stroke="hsl(var(--border))" />
                            <Tooltip content={<PayoffTooltip />} />
                            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                            <ReferenceLine x={model.breakeven} stroke="hsl(var(--foreground))" strokeDasharray="6 3" label={{ value: 'BE', position: 'top', fontSize: 10, fill: 'hsl(var(--foreground))' }} />
                            {spot != null && (
                                <ReferenceLine x={spot} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" label={{ value: 'now', position: 'insideTopRight', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                            )}
                            <Area type="monotone" dataKey="above" stroke="#10b981" fill="#10b981" fillOpacity={0.25} strokeWidth={2} connectNulls={false} isAnimationActive={false} />
                            <Area type="monotone" dataKey="zeroA" stroke="none" fill="#10b981" fillOpacity={0.25} connectNulls={false} isAnimationActive={false} legendType="none" tooltipType="none" />
                            <Area type="monotone" dataKey="below" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.25} strokeWidth={2} connectNulls={false} isAnimationActive={false} />
                            <Area type="monotone" dataKey="zeroB" stroke="none" fill="#f43f5e" fillOpacity={0.25} connectNulls={false} isAnimationActive={false} legendType="none" tooltipType="none" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                    X axis: underlying price at expiry. Held-to-expiry value; ignores assignment mechanics and further rolls.
                    {isCSP ? ' Max loss assumes the assigned stock goes to zero.' : useCombined ? ` Shares cost basis ${formatCurrency(costBasis)} from Stock Positions.` : ' Short call loss beyond the strike is unbounded.'}
                </p>
            </DialogContent>
        </Dialog>
    );
};
