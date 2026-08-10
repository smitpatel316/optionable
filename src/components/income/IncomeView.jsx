import React, { useEffect, useState } from 'react';
import { Landmark, TrendingUp, Scale } from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { API_URL } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatters';

const Card = ({ title, icon: Icon, children }) => (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-4">
            <Icon className="w-4 h-4 text-slate-400" />
            {title}
        </h3>
        {children}
    </div>
);

const BenchmarkTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-slate-800 p-3 rounded-md shadow-sm border border-slate-200 dark:border-slate-700 text-sm">
                <p className="text-slate-500 dark:text-slate-400 mb-1">{label}</p>
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
    }, [accountId]);

    if (error) {
        return (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
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
                    <div className="h-24 bg-slate-100 dark:bg-slate-700 rounded animate-pulse"></div>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Options premium (realized)</p>
                                <p className={`text-2xl font-mono font-bold ${income.optionsRealized >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {formatCurrency(income.optionsRealized)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    SGOV treasury yield{income.sgov.recorded > 0 ? '' : ' (est.)'}
                                </p>
                                <p className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                    {formatCurrency(sgovAmount)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Total income</p>
                                <p className={`text-2xl font-mono font-bold ${total >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {formatCurrency(total)}
                                </p>
                            </div>
                        </div>
                        {total > 0 && (
                            <div>
                                <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700">
                                    <div className="bg-indigo-500" style={{ width: `${optionsPct}%` }} title={`Options ${optionsPct.toFixed(0)}%`}></div>
                                    <div className="bg-emerald-500" style={{ width: `${sgovPct}%` }} title={`SGOV ${sgovPct.toFixed(0)}%`}></div>
                                </div>
                                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    <span>Options {optionsPct.toFixed(0)}%</span>
                                    <span>SGOV {sgovPct.toFixed(0)}%</span>
                                </div>
                            </div>
                        )}
                        {income.sgov.recorded === 0 && (
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                                SGOV income is estimated from the 30-day SEC yield ({(income.sgov.yieldUsed * 100).toFixed(2)}%) on shares held.
                                Price drift is not counted — it reverses when the monthly dividend pays out.
                            </p>
                        )}
                    </div>
                )}
            </Card>

            <Card title={benchmark?.ticker ? `Wheel vs ${benchmark.ticker} Buy & Hold` : 'Wheel vs S&P 500'} icon={Scale}>
                {!benchmark ? (
                    <div className="h-64 bg-slate-100 dark:bg-slate-700 rounded animate-pulse"></div>
                ) : !benchmark.ready ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">{benchmark.message || 'Not enough history yet.'}</p>
                ) : (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            Since {benchmark.baseDate}: wheel{' '}
                            <span className={`font-mono font-semibold ${benchmark.wheelReturnPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {benchmark.wheelReturnPct >= 0 ? '+' : ''}{benchmark.wheelReturnPct}%
                            </span>
                            {' '}vs {benchmark.ticker}{' '}
                            <span className={`font-mono font-semibold ${benchmark.spyReturnPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {benchmark.spyReturnPct >= 0 ? '+' : ''}{benchmark.spyReturnPct}%
                            </span>
                            {' '}— {ahead ? 'ahead of' : 'behind'} the index by{' '}
                            <span className={`font-mono font-semibold ${ahead ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {formatCurrency(Math.abs(benchmark.diffDollars))}
                            </span>
                        </p>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={benchmark.points} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#e2e8f0'} />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 11, fill: darkMode ? '#64748b' : '#94a3b8' }}
                                        tickLine={{ stroke: darkMode ? '#334155' : '#e2e8f0' }}
                                        axisLine={{ stroke: darkMode ? '#334155' : '#e2e8f0' }}
                                    />
                                    <YAxis
                                        domain={['auto', 'auto']}
                                        tick={{ fontSize: 11, fill: darkMode ? '#64748b' : '#94a3b8' }}
                                        tickLine={{ stroke: darkMode ? '#334155' : '#e2e8f0' }}
                                        axisLine={{ stroke: darkMode ? '#334155' : '#e2e8f0' }}
                                        tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                                    />
                                    <Tooltip content={<BenchmarkTooltip />} />
                                    <Legend />
                                    <Line type="monotone" dataKey="wheel" name="Wheel" stroke="#6366f1" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="spy" name={benchmark.ticker} stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 3" dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                            Shadow portfolio: same starting dollars invested in {benchmark.ticker} on {benchmark.baseDate}. Short history — this gets more meaningful over time.
                        </p>
                    </div>
                )}
            </Card>
        </>
    );
};
