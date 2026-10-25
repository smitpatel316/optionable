import React, { useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, CalendarDayButton } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { formatCurrency } from '../../utils/formatters';

// Daily booked P/L (cash-basis): option premium booked on the day a trade
// closed/expired. Matches the income route formula:
//   CALL/PUT (long):  (close - entry)  * qty * 100 - commission
//   CSP/CC  (short):  (entry - close)  * qty * 100 - commission
// Prices are stored in dollars per share; * 100 * qty converts to dollars.
const dayKey = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const tradePnlDollars = (t) => {
    const entry = Number(t.entryPrice) || 0;
    const close = Number(t.closePrice) || 0;
    const qty = Number(t.quantity) || 0;
    const comm = Number(t.commission) || 0;
    const long = (t.type || '').toUpperCase() === 'CALL' || (t.type || '').toUpperCase() === 'PUT';
    return (long ? close - entry : entry - close) * qty * 100 - comm;
};

const fmt = (v) => {
    const sign = v >= 0 ? '+' : '-';
    const abs = Math.abs(v);
    if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
    return `${sign}$${abs.toFixed(0)}`;
};

export const PnLCalendar = ({ trades = [] }) => {
    const [month, setMonth] = useState(() => new Date());

    const byDate = useMemo(() => {
        const map = new Map();
        for (const t of trades) {
            if (!t || t.status === 'Open' || !t.closedDate) continue;
            const key = String(t.closedDate).slice(0, 10);
            map.set(key, (map.get(key) || 0) + tradePnlDollars(t));
        }
        return map;
    }, [trades]);

    const monthTotal = useMemo(() => {
        const prefix = dayKey(month).slice(0, 7);
        let sum = 0;
        for (const [k, v] of byDate) if (k.startsWith(prefix)) sum += v;
        return sum;
    }, [byDate, month]);

    const hasAny = byDate.size > 0;

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    Daily P/L
                </CardTitle>
                <span className={cn('font-mono text-sm font-semibold', monthTotal >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                    {monthTotal >= 0 ? '+' : ''}{formatCurrency(monthTotal)} this month
                </span>
            </CardHeader>
            <CardContent>
                {!hasAny ? (
                    <div className="text-sm text-muted-foreground py-6 text-center">No closed trades yet — daily P/L will appear here.</div>
                ) : (
                    <Calendar
                        month={month}
                        onMonthChange={setMonth}
                        className="mx-auto w-full max-w-[440px] [--cell-size:2.6rem] md:[--cell-size:3.4rem] [&_.bg-background]:bg-transparent"
                        classNames={{
                            weekday: 'flex-1 text-[0.7rem] text-muted-foreground select-none',
                        }}
                        components={{
                            DayButton: ({ day, modifiers, locale, children, ...rest }) => {
                                const v = byDate.get(dayKey(day.date));
                                return (
                                    <CalendarDayButton day={day} modifiers={modifiers} locale={locale} {...rest}>
                                        <span className="text-xs">{day.date.getDate()}</span>
                                        {v != null && (
                                            <span className={cn('font-mono text-[10px] leading-none', v >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                                                {fmt(v)}
                                            </span>
                                        )}
                                    </CalendarDayButton>
                                );
                            },
                        }}
                    />
                )}
            </CardContent>
        </Card>
    );
};
