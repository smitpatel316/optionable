import React, { useEffect, useState } from 'react';
import { Landmark, TrendingUp, Scale, BarChart3 } from 'lucide-react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell
} from 'recharts';
import { API_URL } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatters';
import { Card as UICard } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const Card = ({ title, icon: Icon, children }) => (
    <UICard className="p-5">
        <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
            <Icon className="w-4 h-4 text-muted-foreground" />
            {title}
        </h3>
        {children}
    </UICard>
);

const PremiumTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const v = payload[0].value;
        return (
            <div className="bg-popover p-3 rounded-md shadow-md border border-border text-sm text-popover-foreground">
                <p className="text-muted-foreground mb-1">{label}</p>
                <p className={`font-mono font-medium ${v >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {formatCurrency(v)}
                </p>
            </div>
        );
    }
    return null;
};

const BenchmarkTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-popover p-3 rounded-md shadow-md border border-border text-sm text-popover-foreground">
                <p className="text-muted-foreground mb-1">{label}</p>
                {payload.map(p => (
                    <p key={p.dataKey} className="font-mono font-medium" style={{ color: p.color }}>
                        {p.name}: {formatCurrency(p.value)}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

export const IncomeView = ({ accountId, darkMode }) => {
    const [income, setIncome] = useState(null);
    const [benchmark, setBenchmark] = useState(null);
    const [premiumMonthly, setPremiumMonthly] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const acct = accountId ? `?accountId=${accountId}` : '';
        fetch(`${API_URL}/income/income${acct}`)
            .then(r => r.json())
            .then(j => j.success ? setIncome(j.data) : setError(j.error?.message))
            .catch(e => setError(e.message));
        fetch(`${API_URL}/income/benchmark`)
            .then(r => r.json())
            .then(j => j.success ? setBenchmark(j.data) : setError(j.error?.message))
            .catch(e => setError(e.message));
        fetch(`${API_URL}/income/premium-monthly${acct}`)
            .then(r => r.json())
            .then(j => j.success ? setPremiumMonthly(j.data.months) : setError(j.error?.message))
            .catch(e => setError(e.message));
    }, [accountId]);

    if (error) {
        return (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 px-4 py-3 rounded-lg">
                {error}
            </div>
        );
    }

    const sgovAmount = income ? (income.sgov.recorded > 0 ? income.sgov.recorded : income.sgov.estimated) : 0;
    const total = income ? income.total : 0;
    const optionsPct = total > 0 ? (income.optionsRealized / total) * 100 : 0;
    const sgovPct = total > 0 ? (sgovAmount / total) * 100 : 0;
    const ahead = benchmark?.ready ? benchmark.diffDollars >= 0 : true;

    return (
        <>
            <Card title="Income Breakdown" icon={Landmark}>
                {!income ? (
                    <Skeleton className="h-24" />
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Options premium (realized)</p>
                                <p className={`text-2xl font-mono font-bold ${income.optionsRealized >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    {formatCurrency(income.optionsRealized)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">
                                    SGOV treasury yield{income.sgov.recorded > 0 ? '' : ' (est.)'}
                                </p>
                                <p className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                    {formatCurrency(sgovAmount)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total income</p>
                                <p className={`text-2xl font-mono font-bold ${total >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    {formatCurrency(total)}
                                </p>
                            </div>
                        </div>
                        {total > 0 && (
                            <div>
                                <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                                    <div className="bg-foreground/80" style={{ width: `${optionsPct}%` }} title={`Options ${optionsPct.toFixed(0)}%`}></div>
                                    <div className="bg-foreground/30" style={{ width: `${sgovPct}%` }} title={`SGOV ${sgovPct.toFixed(0)}%`}></div>
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                    <span>Options {optionsPct.toFixed(0)}%</span>
                                    <span>SGOV {sgovPct.toFixed(0)}%</span>
                                </div>
                            </div>
                        )}
                        {income.sgov.recorded === 0 && (
                            <p className="text-xs text-muted-foreground">
                                SGOV income is estimated from the 30-day SEC yield ({(income.sgov.yieldUsed * 100).toFixed(2)}%) on shares held.
                                Price drift is not counted — it reverses when the monthly dividend pays out.
                            </p>
                        )}
                    </div>
                )}
            </Card>

            <Card title="Premium by Month" icon={BarChart3}>
                {!premiumMonthly ? (
                    <Skeleton className="h-48" />
                ) : premiumMonthly.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No closed option trades yet.</p>
                ) : (
                    <>
                        <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={premiumMonthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                    <XAxis
                                        dataKey="month"
                                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                        tickLine={{ stroke: 'hsl(var(--border))' }}
                                        axisLine={{ stroke: 'hsl(var(--border))' }}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                        tickLine={{ stroke: 'hsl(var(--border))' }}
                                        axisLine={{ stroke: 'hsl(var(--border))' }}
                                        tickFormatter={(v) => `$${v}`}
                                    />
                                    <Tooltip content={<PremiumTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                                    <Bar dataKey="premium" radius={[4, 4, 0, 0]}>
                                        {premiumMonthly.map((m) => (
                                            <Cell key={m.month} fill={m.premium >= 0 ? '#10b981' : '#f43f5e'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            Net premium realized per month on closed option legs (after buy-backs and commissions). Bars sum to the options figure above.
                        </p>
                    </>
                )}
            </Card>

            <Card title={benchmark?.ticker ? `Wheel vs ${benchmark.ticker} Buy & Hold` : 'Wheel vs S&P 500'} icon={Scale}>
                {!benchmark ? (
                    <Skeleton className="h-64" />
                ) : !benchmark.ready ? (
                    <p className="text-sm text-muted-foreground">{benchmark.message || 'Not enough history yet.'}</p>
                ) : (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Since {benchmark.baseDate}: wheel{' '}
                            <span className={`font-mono font-semibold ${benchmark.wheelReturnPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {benchmark.wheelReturnPct >= 0 ? '+' : ''}{benchmark.wheelReturnPct}%
                            </span>
                            {' '}vs {benchmark.ticker}{' '}
                            <span className={`font-mono font-semibold ${benchmark.spyReturnPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {benchmark.spyReturnPct >= 0 ? '+' : ''}{benchmark.spyReturnPct}%
                            </span>
                            {' '}— {ahead ? 'ahead of' : 'behind'} the index by{' '}
                            <span className={`font-mono font-semibold ${ahead ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {formatCurrency(Math.abs(benchmark.diffDollars))}
                            </span>
                        </p>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={benchmark.points} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                        tickLine={{ stroke: 'hsl(var(--border))' }}
                                        axisLine={{ stroke: 'hsl(var(--border))' }}
                                    />
                                    <YAxis
                                        domain={['auto', 'auto']}
                                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                        tickLine={{ stroke: 'hsl(var(--border))' }}
                                        axisLine={{ stroke: 'hsl(var(--border))' }}
                                        tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                                    />
                                    <Tooltip content={<BenchmarkTooltip />} />
                                    <Legend />
                                    <Line type="monotone" dataKey="wheel" name="Wheel" stroke="hsl(var(--foreground))" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="spy" name={benchmark.ticker} stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 3" dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Shadow portfolio: same starting dollars invested in {benchmark.ticker} on {benchmark.baseDate}. Short history — this gets more meaningful over time.
                        </p>
                    </div>
                )}
            </Card>
        </>
    );
};
