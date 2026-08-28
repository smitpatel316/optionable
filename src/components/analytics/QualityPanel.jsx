import React from 'react';
import { Card } from '@/components/ui/card';

// Closed-trade quality (fork addition 2026-08-28): four numbers that say how
// well the wheel actually performs once trades end — win rate, premium
// capture, holding period, capital velocity. CLOSED TRADES ONLY; open
// positions never mix in. Rolled legs are excluded (their final leg counts).

const Stat = ({ label, value, hint }) => (
    <div className="px-4 py-3">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-lg font-semibold font-mono text-foreground mt-0.5">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
);

export const QualityPanel = ({ quality }) => {
    if (!quality || !quality.closedCount) return null;

    return (
        <Card className="overflow-hidden">
            <div className="p-3 border-b border-border bg-muted/50 flex items-baseline justify-between">
                <h3 className="font-semibold text-sm text-foreground">Closed-Trade Quality</h3>
                <span className="text-xs text-muted-foreground">closed trades only · n={quality.closedCount}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border">
                <Stat label="Win Rate"
                    value={quality.winRate != null ? `${quality.winRate}%` : '—'}
                    hint={`${quality.wins}W / ${quality.losses}L`} />
                <Stat label="Avg Premium Capture"
                    value={quality.avgCapturePct != null ? `${quality.avgCapturePct}%` : '—'}
                    hint="kept vs collected" />
                <Stat label="Avg Days Held"
                    value={quality.avgDaysHeld != null ? `${quality.avgDaysHeld}d` : '—'} />
                <Stat label="Avg ROI / Day"
                    value={quality.avgRoiPerDayPct != null ? `${quality.avgRoiPerDayPct}%` : '—'}
                    hint="on collateral" />
            </div>
        </Card>
    );
};
