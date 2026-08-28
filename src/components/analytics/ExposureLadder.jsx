import React from 'react';
import { formatCurrency } from '../../utils/formatters';
import { Card } from '@/components/ui/card';

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
            <Card><div className="p-6 text-center text-sm text-muted-foreground">
                No upcoming expirations — nothing deployed right now.
            </div></Card>
        );
    }

    const maxCollateral = Math.max(...exposure.expirations.map((e) => e.collateral));
    const thisWeek = exposure.expirations.filter((e) => e.dte != null && e.dte <= 7);

    return (
        <Card className="overflow-hidden">
            <div className="p-3 border-b border-border bg-muted/50 flex items-baseline justify-between">
                <h3 className="font-semibold text-sm text-foreground">Collateral Release Schedule</h3>
                <span className="text-xs text-muted-foreground">
                    {formatCurrency(exposure.totalCollateral)} across {exposure.expirationCount} expiration{exposure.expirationCount !== 1 ? 's' : ''}
                    {thisWeek.length > 0 && ` · ${formatCurrency(thisWeek.reduce((s, e) => s + e.collateral, 0))} frees within 7d`}
                </span>
            </div>
            <div className="divide-y divide-border">
                {exposure.expirations.map((e) => {
                    const hot = e.dte != null && e.dte <= 7;
                    const width = Math.max((e.collateral / maxCollateral) * 100, 8);
                    return (
                        <div key={e.date} className="px-4 py-3 hover:bg-accent dark:hover:bg-accent/50">
                            <div className="flex items-center gap-3">
                                <div className={`w-16 shrink-0 font-mono text-sm ${hot ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                                    {fmtDate(e.date)}
                                </div>
                                <div className="flex-1">
                                    <div className="h-5 rounded bg-muted overflow-hidden">
                                        <div
                                            className={`h-full rounded transition-all ${hot ? 'bg-foreground/70' : 'bg-muted-foreground/50'}`}
                                            style={{ width: `${width}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="w-24 shrink-0 text-right font-mono text-sm text-foreground">
                                    {formatCurrency(e.collateral)}
                                </div>
                            </div>
                            <div className="mt-1 ml-[76px] flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                <span>{e.dte != null ? `${e.dte}d` : ''}</span>
                                <span>{e.count} position{e.count !== 1 ? 's' : ''} ({e.tickers.join(', ')})</span>
                                <span>premium left: {formatCurrency(e.premiumRemaining)}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
            {exposure.fundingQueue.length > 0 && (
                <div className="p-3 bg-muted/60 border-t border-border">
                    <div className="text-xs font-semibold text-muted-foreground mb-1.5">Engine funding queue — cash reserved for queued trades</div>
                    <div className="flex flex-wrap gap-2">
                        {exposure.fundingQueue.map((q, i) => (
                            <span key={i} className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground font-mono">
                                {q.underlying} ${q.strike}P {fmtDate(q.expiry)} needs {formatCurrency(q.need)}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </Card>
    );
};
