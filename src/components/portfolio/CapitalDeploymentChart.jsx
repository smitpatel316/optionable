import React from 'react';
import { Gauge } from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';

const formatCurrency = (value) => {
    const abs = Math.abs(value);
    if (abs >= 1000) return `$${(abs / 1000).toFixed(1)}k`;
    return `$${abs.toFixed(0)}`;
};

const formatDate = (d) => {
    const [, m, day] = d.split('-');
    return `${m}/${day}`;
};

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const day = payload[0].payload;
        return (
            <div className="bg-white dark:bg-slate-800 p-3 rounded-md shadow-sm border border-slate-200 dark:border-slate-700 text-sm">
                <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</p>
                <p className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#10b981' }} />
                    <span className="text-slate-500 dark:text-slate-400">Deployed:</span>
                    <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                        ${day.deployed.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                </p>
                <p className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#94a3b8' }} />
                    <span className="text-slate-500 dark:text-slate-400">Idle (cash + SGOV):</span>
                    <span className="font-mono font-medium text-slate-600 dark:text-slate-300">
                        ${day.idle.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                </p>
                <div className="border-t border-slate-200 dark:border-slate-600 mt-1.5 pt-1.5">
                    <p className="font-mono font-bold text-slate-700 dark:text-slate-200">
                        {day.pct}% deployed of ${day.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                </div>
            </div>
        );
    }
    return null;
};

export const CapitalDeploymentChart = ({ data, darkMode }) => {
    if (!data || data.length === 0) return null;

    const latest = data[data.length - 1];
    const gridColor = darkMode ? '#334155' : '#e2e8f0';
    const tickColor = darkMode ? '#94a3b8' : '#64748b';

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-slate-400" />
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Capital Deployment
                    </h3>
                </div>
                <div className="text-right">
                    <span className={`text-lg font-bold font-mono ${latest.pct >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {latest.pct}%
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5">deployed</span>
                </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        tick={{ fontSize: 11, fill: tickColor }}
                        stroke={gridColor}
                    />
                    <YAxis
                        tickFormatter={formatCurrency}
                        tick={{ fontSize: 11, fill: tickColor }}
                        stroke={gridColor}
                        width={55}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area
                        type="monotone"
                        dataKey="deployed"
                        name="Deployed (securing CSPs/CCs)"
                        stackId="1"
                        stroke="#10b981"
                        fill="#10b981"
                        fillOpacity={0.75}
                    />
                    <Area
                        type="monotone"
                        dataKey="idle"
                        name="Idle (cash + SGOV)"
                        stackId="1"
                        stroke="#94a3b8"
                        fill="#94a3b8"
                        fillOpacity={0.35}
                    />
                </AreaChart>
            </ResponsiveContainer>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                Deployed = capital securing open puts/calls plus stock held from assignments. Idle cash sits in SGOV earning yield until a trade needs it.
            </p>
        </div>
    );
};
