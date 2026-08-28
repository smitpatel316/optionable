import React from 'react';
import { TrendingUp } from 'lucide-react';
import {
    ComposedChart,
    Area,
    Line,
    Legend,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Card, CardContent } from '@/components/ui/card';
import { pnlTone } from '@/lib/pnl';
import { cn } from '@/lib/utils';

const PERIODS = [
    { key: '1m', label: '1M' },
    { key: '3m', label: '3M' },
    { key: '6m', label: '6M' },
    { key: 'ytd', label: 'YTD' },
    { key: 'all', label: 'All' }
];

const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-popover p-3 rounded-md shadow-md border border-border text-sm text-popover-foreground">
                <p className="font-semibold text-foreground">{data.tickers}</p>
                <p className="text-muted-foreground">{formatDate(data.fullDate)}</p>
                {data.dayBooked !== 0 && (
                    <p className={cn('font-mono font-medium', pnlTone(data.dayBooked))}>
                        Day cash: {formatCurrency(data.dayBooked)}
                    </p>
                )}
                <p className={cn('font-mono font-bold', pnlTone(data.booked))}>
                    Booked (cash): {formatCurrency(data.booked)}
                </p>
                <p className="font-mono font-medium text-muted-foreground">
                    Finalized: {formatCurrency(data.finalized)}
                </p>
            </div>
        );
    }
    return null;
};

export const PnLChart = ({
    chartData,
    chartPeriod,
    onPeriodChange,
    totalPnL,
    darkMode
}) => {
    if (chartData.length === 0) return null;

    const chartColor = totalPnL >= 0 ? "#10b981" : "#f43f5e";

    return (
        <Card>
            <CardContent className="p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-4 min-w-0">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                    Cumulative P/L
                </h3>
                <div className="flex items-center gap-3 min-w-0">
                    {/* Time Period Selector */}
                    <div className="flex bg-muted rounded-md p-1 gap-0.5">
                        {PERIODS.map(period => (
                            <button
                                key={period.key}
                                onClick={() => onPeriodChange(period.key)}
                                className={cn(
                                    'px-2 py-1 text-xs font-medium rounded-sm transition-colors',
                                    chartPeriod === period.key
                                        ? 'bg-background text-foreground shadow'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                {period.label}
                            </button>
                        ))}
                    </div>
                    <span className={cn('text-sm font-mono font-bold', pnlTone(totalPnL))}>
                        {formatCurrency(totalPnL)}
                    </span>
                </div>
            </div>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                            tickLine={{ stroke: 'hsl(var(--border))' }}
                            axisLine={{ stroke: 'hsl(var(--border))' }}
                        />
                        <YAxis
                            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                            tickLine={{ stroke: 'hsl(var(--border))' }}
                            axisLine={{ stroke: 'hsl(var(--border))' }}
                            tickFormatter={(value) => `$${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }} />
                        <Area
                            type="monotone"
                            dataKey="booked"
                            name="Booked (cash)"
                            stroke={chartColor}
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorPnl)"
                        />
                        <Line
                            type="monotone"
                            dataKey="finalized"
                            name="Finalized"
                            stroke="hsl(var(--muted-foreground))"
                            strokeWidth={2}
                            strokeDasharray="6 4"
                            dot={false}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
            </CardContent>
        </Card>
    );
};
