import React from 'react';
import { formatCurrency } from '../../utils/formatters';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { pnlTone } from '@/lib/pnl';
import { cn } from '@/lib/utils';

// P/L attribution by underlying (fork addition 2026-08-28): which names
// actually make the wheel money. Realized totals are capital-weighted ROI
// style (per Smit's total-ROI preference); open exposure sits alongside.

const Pnl = ({ v }) => (
    <span className={cn('font-mono', v !== 0 ? pnlTone(v) : 'text-muted-foreground')}>
        {v > 0 ? '+' : ''}{formatCurrency(v)}
    </span>
);

export const AttributionPanel = ({ attribution }) => {
    if (!attribution || attribution.rows.length === 0) return null;
    const { rows } = attribution;

    return (
        <Card className="overflow-hidden">
            <div className="p-3 border-b border-border bg-muted/50 flex items-baseline justify-between">
                <h3 className="font-semibold text-sm text-foreground">P/L Attribution by Underlying</h3>
                <span className="text-xs text-muted-foreground">
                    realized <Pnl v={attribution.totalRealized} /> · open unrealized <Pnl v={attribution.totalOpenUnrealized} />
                </span>
            </div>
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <TableHead>Underlying</TableHead>
                        <TableHead className="text-right">Realized P/L</TableHead>
                        <TableHead className="text-center">W/L</TableHead>
                        <TableHead className="text-right">Win Rate</TableHead>
                        <TableHead className="text-right">ROI (wt.)</TableHead>
                        <TableHead className="text-right">Open Collat.</TableHead>
                        <TableHead className="text-right">Open Unreal.</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((r) => (
                        <TableRow key={r.ticker}>
                            <TableCell className="font-mono font-semibold text-foreground">{r.ticker}</TableCell>
                            <TableCell className="text-right"><Pnl v={r.realized} /></TableCell>
                            <TableCell className="text-center font-mono text-xs text-muted-foreground">{r.wins}W/{r.losses}L</TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">{r.winRate != null ? `${r.winRate}%` : '—'}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">{r.weightedRoi != null ? `${r.weightedRoi}%` : '—'}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">{r.openCount > 0 ? formatCurrency(r.openCollateral) : '—'}</TableCell>
                            <TableCell className="text-right text-xs">{r.openCount > 0 ? <Pnl v={r.openUnrealized} /> : '—'}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <p className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border">
                Realized = closed option trades only (rolls carry into the final leg). ROI (wt.) is capital-weighted: realized P/L ÷ closed collateral.
            </p>
        </Card>
    );
};
