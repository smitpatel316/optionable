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
            <div className="bg-card p-3 rounded-md shadow-sm border border-border text-sm">
                <p className="font-semibold text-foreground">{data.tickers}</p>
                <p className="text-muted-foreground">{formatDate(data.fullDate)}</p>
                {data.dayBooked !== 0 && (
                    <p className={`font-mono font-medium ${data.dayBooked >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        Day cash: {formatCurrency(data.dayBooked)}
                    </p>
                )}
                <p className={`font-mono font-bold ${data.booked >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
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

    const chartColor = totalPnL >= 0 ? "#10b981" : "#ef4444";

    return (
        <div className="bg-card rounded-lg shadow-sm border border-border p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                    Cumulative P/L
                </h3>
                <div className="flex items-center gap-3">
                    {/* Time Period Selector */}
                    <div className="flex bg-muted rounded-lg p-0.5">
                        {PERIODS.map(period => (
                            <button
                                key={period.key}
                                onClick={() => onPeriodChange(period.key)}
                                className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                                    chartPeriod === period.key
                                        ? 'bg-card dark:bg-secondary text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground'
                                }`}
                            >
                                {period.label}
                            </button>
                        ))}
                    </div>
                    <span className={`text-sm font-mono font-bold ${totalPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
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
                        <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#e2e8f0'} />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11, fill: darkMode ? '#64748b' : '#94a3b8' }}
                            tickLine={{ stroke: darkMode ? '#334155' : '#e2e8f0' }}
                            axisLine={{ stroke: darkMode ? '#334155' : '#e2e8f0' }}
                        />
                        <YAxis
                            tick={{ fontSize: 11, fill: darkMode ? '#64748b' : '#94a3b8' }}
                            tickLine={{ stroke: darkMode ? '#334155' : '#e2e8f0' }}
                            axisLine={{ stroke: darkMode ? '#334155' : '#e2e8f0' }}
                            tickFormatter={(value) => `$${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
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
                            stroke={darkMode ? '#94a3b8' : '#64748b'}
                            strokeWidth={2}
                            strokeDasharray="6 4"
                            dot={false}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
