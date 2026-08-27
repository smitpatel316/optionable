// Cash-basis P/L accounting (Smit's rule, 2026-08-27):
// premium is booked when cash lands, costs are booked when paid.
// A roll's net credit shows up immediately; if an open short is later
// bought back for more than its premium, booked P/L goes DOWN that day.

export const isBuySide = (trade) => trade.type === 'CALL' || trade.type === 'PUT';

// The cash events of a single trade:
//   sell-side (CSP/CC) open  -> +premium at openedDate
//   sell-side close          -> -closeCost at closedDate
//   buy-side  (CALL/PUT) open -> -premium at openedDate
//   buy-side  close          -> +proceeds at closedDate
// Commission is booked at open (only one commission field exists).
export const tradeCashEvents = (trade) => {
    const quantity = parseFloat(trade.quantity) || 0;
    const entryPrice = parseFloat(trade.entryPrice) || 0;
    const closePrice = parseFloat(trade.closePrice) || 0;
    const commission = parseFloat(trade.commission) || 0;
    const premium = entryPrice * quantity * 100;
    const closeValue = closePrice * quantity * 100;

    const events = [];
    if (trade.openedDate) {
        events.push({
            date: String(trade.openedDate).slice(0, 10),
            delta: (isBuySide(trade) ? -premium : premium) - commission,
            kind: 'open',
            trade
        });
    }
    if (trade.status !== 'Open' && trade.closedDate) {
        events.push({
            date: String(trade.closedDate).slice(0, 10),
            delta: isBuySide(trade) ? closeValue : -closeValue,
            kind: 'close',
            trade
        });
    }
    return events;
};

// Booked (cash) P/L over a set of trades: every cash event that has happened.
export const bookedPnL = (trades) =>
    trades.reduce((acc, t) => acc + tradeCashEvents(t).reduce((a, e) => a + e.delta, 0), 0);

// Finalized P/L: only trades that are done (not Open). For a closed sell this
// equals premium - buyback - commission, i.e. the same total as its cash
// events — the difference vs booked is that open premiums aren't counted yet.
export const finalizedPnL = (trades) =>
    trades
        .filter(t => t.status !== 'Open')
        .reduce((acc, t) => {
            const quantity = parseFloat(t.quantity) || 0;
            const entryPrice = parseFloat(t.entryPrice) || 0;
            const closePrice = parseFloat(t.closePrice) || 0;
            const commission = parseFloat(t.commission) || 0;
            return acc + (isBuySide(t)
                ? (closePrice - entryPrice) * quantity * 100 - commission
                : (entryPrice - closePrice) * quantity * 100 - commission);
        }, 0);

// Cash-basis P/L grouped by calendar month (YYYY-MM): premiums land in the
// open month, buy-back costs in the close month.
export const monthlyCashPnL = (trades) => {
    const byMonth = {};
    trades.forEach(t => {
        tradeCashEvents(t).forEach(e => {
            const month = e.date.slice(0, 7);
            byMonth[month] = (byMonth[month] || 0) + e.delta;
        });
    });
    return byMonth;
};

// Cumulative daily series for the chart. Returns points sorted by date:
// { date, fullDate, booked, finalized, dayBooked, dayFinalized, tickers }
// Both series are cumulative over the FULL history passed in.
export const dailyCumulativeSeries = (trades) => {
    const bookedByDay = {};
    const finalizedByDay = {};
    const tickersByDay = {};

    trades.forEach(t => {
        tradeCashEvents(t).forEach(e => {
            bookedByDay[e.date] = (bookedByDay[e.date] || 0) + e.delta;
            if (!tickersByDay[e.date]) tickersByDay[e.date] = new Set();
            tickersByDay[e.date].add((t.ticker || '').toUpperCase());
        });
        if (t.status !== 'Open' && t.closedDate) {
            const quantity = parseFloat(t.quantity) || 0;
            const entryPrice = parseFloat(t.entryPrice) || 0;
            const closePrice = parseFloat(t.closePrice) || 0;
            const commission = parseFloat(t.commission) || 0;
            const pnl = isBuySide(t)
                ? (closePrice - entryPrice) * quantity * 100 - commission
                : (entryPrice - closePrice) * quantity * 100 - commission;
            const day = String(t.closedDate).slice(0, 10);
            finalizedByDay[day] = (finalizedByDay[day] || 0) + pnl;
            if (!tickersByDay[day]) tickersByDay[day] = new Set();
            tickersByDay[day].add((t.ticker || '').toUpperCase());
        }
    });

    const days = [...new Set([...Object.keys(bookedByDay), ...Object.keys(finalizedByDay)])].sort();
    const fmtLabel = d => new Date(d + 'T12:00:00Z')
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

    let booked = 0;
    let finalized = 0;
    return days.map(day => {
        const dayBooked = bookedByDay[day] || 0;
        const dayFinalized = finalizedByDay[day] || 0;
        booked += dayBooked;
        finalized += dayFinalized;
        return {
            date: fmtLabel(day),
            fullDate: day,
            booked,
            finalized,
            dayBooked,
            dayFinalized,
            tickers: tickersByDay[day] ? [...tickersByDay[day]].join(' / ') : ''
        };
    });
};
