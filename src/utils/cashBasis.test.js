import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tradeCashEvents, bookedPnL, finalizedPnL, monthlyCashPnL, dailyCumulativeSeries } from './cashBasis.js';

const csp = (over) => ({
    type: 'CSP', ticker: 'X', strike: 100, quantity: 1,
    entryPrice: 1, closePrice: 0, commission: 0,
    openedDate: '2026-08-01', closedDate: null, status: 'Open',
    ...over
});

test('open sell-side premium is booked at open', () => {
    const t = csp({ entryPrice: 2.7, openedDate: '2026-08-13' });
    assert.deepEqual(tradeCashEvents(t).map(e => [e.date, e.delta]), [['2026-08-13', 270]]);
    assert.equal(bookedPnL([t]), 270);
    assert.equal(finalizedPnL([t]), 0); // nothing finalized while open
});

test('closed sell: premium booked at open, buy-back cost booked at close', () => {
    const t = csp({ entryPrice: 2.7, closePrice: 5.2, status: 'Closed', closedDate: '2026-08-27' });
    assert.deepEqual(tradeCashEvents(t).map(e => [e.date, e.delta]), [['2026-08-01', 270], ['2026-08-27', -520]]);
    assert.equal(bookedPnL([t]), -250);
    assert.equal(finalizedPnL([t]), -250);
});

test('roll sequence: net credit booked immediately (INTC 2026-08-27)', () => {
    const oldLeg = csp({ entryPrice: 2.7, closePrice: 5.2, status: 'Closed', openedDate: '2026-08-13', closedDate: '2026-08-27' });
    const newLeg = csp({ entryPrice: 6.3, openedDate: '2026-08-27' });
    // Booked: +270 - 520 + 630 = +380, even though the new put is still open
    assert.equal(bookedPnL([oldLeg, newLeg]), 380);
    // Finalized: only the closed old leg counts
    assert.equal(finalizedPnL([oldLeg, newLeg]), -250);
});

test('buy-back above premium pushes booked P/L down on the buy-back day', () => {
    const t = csp({ entryPrice: 1.0, closePrice: 2.5, status: 'Closed', openedDate: '2026-08-10', closedDate: '2026-08-20' });
    const series = dailyCumulativeSeries([t]);
    assert.deepEqual(series.map(p => [p.fullDate, p.booked]), [['2026-08-10', 100], ['2026-08-20', -150]]);
    assert.ok(series[1].booked < series[0].booked);
});

test('buy-side long option: premium paid at open, proceeds at close', () => {
    const call = csp({ type: 'CALL', entryPrice: 3, closePrice: 4.5, status: 'Closed', closedDate: '2026-08-15' });
    assert.deepEqual(tradeCashEvents(call).map(e => [e.date, e.delta]), [['2026-08-01', -300], ['2026-08-15', 450]]);
    assert.equal(bookedPnL([call]), 150);
    assert.equal(finalizedPnL([call]), 150);
    const openCall = csp({ type: 'CALL', entryPrice: 3 });
    assert.equal(bookedPnL([openCall]), -300);
    assert.equal(finalizedPnL([openCall]), 0);
});

test('commission booked once at open', () => {
    const t = csp({ entryPrice: 1, commission: 0.65 });
    assert.equal(bookedPnL([t]), 99.35); // $100 premium - $0.65 commission
});

test('expired worthless sell keeps full premium', () => {
    const t = csp({ entryPrice: 1.3, closePrice: 0, status: 'Expired', closedDate: '2026-08-21' });
    assert.equal(bookedPnL([t]), 130);
    assert.equal(finalizedPnL([t]), 130);
});

test('monthly cash P/L lands premium in open month and cost in close month', () => {
    const t = csp({ entryPrice: 2, closePrice: 0.5, status: 'Closed', openedDate: '2026-08-20', closedDate: '2026-09-03' });
    assert.deepEqual(monthlyCashPnL([t]), { '2026-08': 200, '2026-09': -50 });
});
