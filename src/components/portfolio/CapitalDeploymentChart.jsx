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
import { Card, CardContent } from '@/components/ui/card';

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
            <div className="bg-popover p-3 rounded-md shadow-md border border-border text-sm text-popover-foreground">
                <p className="font-semibold text-foreground mb-1">{label}</p>
                <p className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'hsl(var(--foreground))' }} />
                    <span className="text-muted-foreground">Deployed:</span>
                    <span className="font-mono font-medium text-foreground">
                        ${day.deployed.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                </p>
                <p className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'hsl(var(--muted-foreground))' }} />
                    <span className="text-muted-foreground">Idle (cash + SGOV):</span>
                    <span className="font-mono font-medium text-muted-foreground">
                        ${day.idle.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                </p>
                <div className="border-t border-border mt-1.5 pt-1.5">
                    <p className="font-mono font-bold text-foreground">
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

    return (
        <Card>
            <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">
                        Capital Deployment
                    </h3>
                </div>
                <div className="text-right">
                    <span className="text-lg font-bold font-mono text-foreground">
                        {latest.pct}%
                    </span>
                    <span className="text-xs text-muted-foreground ml-1.5">deployed</span>
                </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        stroke="hsl(var(--border))"
                    />
                    <YAxis
                        tickFormatter={formatCurrency}
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        stroke="hsl(var(--border))"
                        width={55}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area
                        type="monotone"
                        dataKey="deployed"
                        name="Deployed (securing CSPs/CCs)"
                        stackId="1"
                        stroke="hsl(var(--foreground))"
                        fill="hsl(var(--foreground))"
                        fillOpacity={0.55}
                    />
                    <Area
                        type="monotone"
                        dataKey="idle"
                        name="Idle (cash + SGOV)"
                        stackId="1"
                        stroke="hsl(var(--muted-foreground))"
                        fill="hsl(var(--muted-foreground))"
                        fillOpacity={0.3}
                    />
                </AreaChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-2">
                Deployed = capital securing open puts/calls plus stock held from assignments. Idle cash sits in SGOV earning yield until a trade needs it.
            </p>
            </CardContent>
        </Card>
    );
};
