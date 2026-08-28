import React from 'react';
import { formatCurrency } from '../../utils/formatters';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { pnlTone } from '@/lib/pnl';
import { cn } from '@/lib/utils';

// Wheel-cycle tracker (fork addition 2026-08-28): trades grouped into cycles
// per ticker with realized premium, collateral-weighted ROI and annualized APY.
// The wheel's core question: how hard is each dollar working per cycle?

const Pnl = ({ v }) => (
    <span className={cn('font-mono', v !== 0 ? pnlTone(v) : 'text-muted-foreground')}>
        {v > 0 ? '+' : ''}{formatCurrency(v)}
    </span>
);

export const CyclesPanel = ({ cycles }) => {
    if (!cycles || cycles.length === 0) return null;

    return (
        <Card className="overflow-hidden">
            <div className="p-3 border-b border-border bg-muted/50 flex items-baseline justify-between">
                <h3 className="font-semibold text-sm text-foreground">Wheel Cycles</h3>
                <span className="text-xs text-muted-foreground">
                    {cycles.filter((c) => c.status === 'Open').length} running · {cycles.filter((c) => c.status === 'Closed').length} completed
                </span>
            </div>
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <TableHead>Cycle</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Legs</TableHead>
                        <TableHead className="text-right">Realized</TableHead>
                        <TableHead className="text-right">Days</TableHead>
                        <TableHead className="text-right">ROI</TableHead>
                        <TableHead className="text-right">APY</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {cycles.map((c, i) => (
                        <TableRow key={`${c.ticker}-${c.start}-${i}`}>
                            <TableCell className="font-mono text-xs text-foreground">
                                <span className="font-semibold">{c.ticker}</span>{' '}
                                <span className="text-muted-foreground">{c.style} · since {c.start}</span>
                            </TableCell>
                            <TableCell className="text-center">
                                <Badge variant="secondary" className="rounded-full">{c.status}</Badge>
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs text-muted-foreground">
                                {c.legs}{c.rolls > 0 ? ` (${c.rolls} roll${c.rolls !== 1 ? 's' : ''})` : ''}
                            </TableCell>
                            <TableCell className="text-right"><Pnl v={c.realized} /></TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">{c.daysHeld}d</TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">{c.roiPct != null ? `${c.roiPct}%` : '—'}</TableCell>
                            <TableCell className={cn('text-right font-mono text-xs', c.apyPct != null && c.apyPct >= 10 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                                {c.apyPct != null ? `${c.apyPct}%` : '—'}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <p className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border">
                ROI = realized premium ÷ collateral · APY annualizes by days held. Open cycles count days through today; roll chains fold into their root cycle.
            </p>
        </Card>
    );
};
