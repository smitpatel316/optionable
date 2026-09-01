import React from 'react';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { Card, CardContent } from '@/components/ui/card';
import { pnlTone } from '@/lib/pnl';
import { cn } from '@/lib/utils';

const KpiCard = ({ label, value, subtext, valueClassName = '' }) => (
    <Card className="min-h-[88px]">
        <CardContent className="p-4 flex flex-col justify-between h-full">
            <span className="text-sm font-medium text-muted-foreground">{label}</span>
            <div className={cn('text-2xl font-bold font-mono mt-1', valueClassName)}>
                {value}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{subtext}</div>
        </CardContent>
    </Card>
);

export const Dashboard = ({ stats }) => {
    // Cash-basis headline (Smit's rule 2026-08-27): premium booked when cash
    // lands, costs when paid. Finalized = closed/expired trades only.
    const booked = stats.bookedPnL ?? stats.totalPnL;
    const finalized = stats.finalizedPnL ?? stats.totalPnL;
    const totalPnLWithCapitalGains = stats.bookedWithCapitalGains ?? stats.totalPnLWithCapitalGains ?? stats.totalPnL;
    const realizedCapitalGL = stats.realizedCapitalGL ?? 0;
    const closedPositions = stats.closedPositions ?? 0;
    const totalCommissions = stats.totalCommissions ?? 0;
    const openPremium = stats.openPremium ?? 0;
    const realizedReconciled = stats.realizedPlusReconciled ?? finalized;

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <KpiCard
                label="Booked P/L (cash)"
                value={formatCurrency(booked)}
                valueClassName={pnlTone(booked)}
                subtext={`Open premium ${formatCurrency(openPremium)} · Realized + reconciled ${formatCurrency(realizedReconciled)}`}
            />

            <KpiCard
                label="ROI on Deployed"
                value={formatPercent(stats.roiDeployed ?? 0)}
                valueClassName={pnlTone(stats.roiDeployed ?? 0)}
                subtext={(
                    <>
                        <span className="block">
                            ≈{formatPercent(stats.roiDeployedMonthly ?? 0)}/mo · ≈{formatPercent(stats.roiDeployedAnnualized ?? 0)}/yr
                        </span>
                        <span className="block">
                            {formatCurrency(realizedReconciled)} realized · {stats.closedTradesCount} closed trades · {stats.daysActive}d active
                        </span>
                    </>
                )}
            />

            <KpiCard
                label="Stock Gains"
                value={formatCurrency(realizedCapitalGL)}
                valueClassName={pnlTone(realizedCapitalGL)}
                subtext={`${closedPositions} closed positions`}
            />

            <KpiCard
                label="Total P/L"
                value={formatCurrency(totalPnLWithCapitalGains)}
                valueClassName={pnlTone(totalPnLWithCapitalGains)}
                subtext={totalCommissions > 0 ? `Incl. ${formatCurrency(totalCommissions)} commissions` : 'Booked premiums + Stock Gains'}
            />

            <KpiCard
                label="Deployed Capital"
                value={formatCurrency(stats.capitalAtRisk)}
                valueClassName="text-foreground"
                subtext={`${stats.openTradesCount} open trade${stats.openTradesCount !== 1 ? 's' : ''}`}
            />
        </div>
    );
};
