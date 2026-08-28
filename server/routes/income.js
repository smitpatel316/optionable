import { Router } from 'express';
import { readFileSync, existsSync } from 'fs';
import YahooFinance from 'yahoo-finance2';
import { db } from '../db/connection.js';
import { toDollars } from '../utils/conversions.js';
import { apiResponse } from '../utils/response.js';

const router = Router();
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// Wheel-stack equity history, written by run_strategy.py on every run
const EQUITY_HISTORY_PATH = process.env.EQUITY_HISTORY_PATH
    || '/home/hatch/workspace/wheel-stack/logs/equity_history.json';
// Wheel-stack SGOV holding history (accrual-accurate); optional
const SGOV_HISTORY_PATH = process.env.SGOV_HISTORY_PATH
    || '/home/hatch/workspace/wheel-stack/logs/sgov_history.json';
const BENCHMARK_TICKER = process.env.BENCHMARK_TICKER || 'SPY';
// SGOV yield is approximated from its 30-day SEC yield; price drift is NOT counted
// (on ex-div day price drops by the payout, so counting both would double-count).
const SGOV_SEC_YIELD = Number(process.env.SGOV_SEC_YIELD || 0.0506);

const PRICE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let spyPriceCache = new Map(); // date -> { price, fetchedAt }

// Engine may push history with its dashboard snapshot (post-migration the
// dashboard lives on a different host than the engine, so the on-disk file
// path is Hatch-only). Prefer the pushed blob; fall back to the file for the
// legacy co-located deployment.
function readEngineBlob(key) {
    try {
        const row = db.prepare('SELECT payload FROM engine_dashboard WHERE key = ?').get(key);
        if (!row) return null;
        const parsed = JSON.parse(row.payload);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function readEquityHistory() {
    try {
        const raw = readEngineBlob('equityHistory')
            || (existsSync(EQUITY_HISTORY_PATH) ? JSON.parse(readFileSync(EQUITY_HISTORY_PATH, 'utf8')) : []);
        return raw
            .filter(e => e && e.t && typeof e.equity === 'number')
            .map(e => ({ t: e.t, date: e.t.slice(0, 10), equity: e.equity }));
    } catch {
        return [];
    }
}

async function getSpyClose(dateStr) {
    const cached = spyPriceCache.get(dateStr);
    if (cached && Date.now() - cached.fetchedAt < PRICE_CACHE_TTL_MS) return cached.price;
    try {
        const d = new Date(dateStr + 'T00:00:00Z');
        const period2 = new Date(d.getTime() + 5 * 86400000);
        const rows = await yahooFinance.chart(BENCHMARK_TICKER, {
            period1: d, period2, interval: '1d'
        });
        const quotes = rows?.quotes || [];
        if (!quotes.length) return null;
        const price = quotes[0].adjclose ?? quotes[0].close ?? null;
        if (price) spyPriceCache.set(dateStr, { price, fetchedAt: Date.now() });
        return price;
    } catch {
        return null;
    }
}

async function getSpyLatest() {
    try {
        const q = await yahooFinance.quote(BENCHMARK_TICKER);
        return q?.regularMarketPrice ?? null;
    } catch {
        return null;
    }
}

function readSgovHistory() {
    try {
        const raw = readEngineBlob('sgovHistory')
            || (existsSync(SGOV_HISTORY_PATH) ? JSON.parse(readFileSync(SGOV_HISTORY_PATH, 'utf8')) : []);
        return raw
            .filter(e => e && e.t && typeof e.shares === 'number')
            .map(e => ({ t: e.t, date: e.t.slice(0, 10), shares: e.shares, avg: e.avg }));
    } catch {
        return [];
    }
}

function computeSgovIncome() {
    const secYield = SGOV_SEC_YIELD;
    const today = new Date().toISOString().slice(0, 10);
    let income = 0;
    const history = readSgovHistory();
    if (history.length) {
        // Accrue on end-of-day shares × ~$100.50 per share for each calendar day
        const byDay = new Map();
        for (const e of history) byDay.set(e.date, e); // last snapshot of the day
        const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        for (const [, snap] of days) {
            const px = snap.avg || 100.5;
            income += snap.shares * px * secYield / 365;
        }
    } else {
        // Fallback: current lots (acquiredDate is reset by the sync, so this undercounts)
        const lots = db.prepare(`SELECT shares, costBasis, acquiredDate, soldDate FROM stocks WHERE ticker = 'SGOV'`).all();
        for (const lot of lots) {
            const end = lot.soldDate || today;
            const days = Math.max(0, (new Date(end) - new Date(lot.acquiredDate)) / 86400000);
            income += toDollars(lot.costBasis) * lot.shares * secYield * days / 365;
        }
    }
    let valueNow = 0;
    const curLots = db.prepare(`SELECT shares, costBasis FROM stocks WHERE ticker = 'SGOV' AND soldDate IS NULL`).all();
    for (const lot of curLots) valueNow += toDollars(lot.costBasis) * lot.shares;
    // Recorded dividend fund transactions, if any — once real dividends are logged
    // they replace the estimate going forward
    const divs = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total FROM fund_transactions
        WHERE type = 'dividend' AND (description LIKE '%SGOV%' OR description LIKE '%sgov%')
    `).get();
    return {
        estimated: Math.round(income * 100) / 100,
        recorded: toDollars(divs.total || 0),
        yieldUsed: secYield,
        sgovValue: Math.round(valueNow * 100) / 100
    };
}

function computeOptionsIncome(accountId) {
    const acctWhere = accountId ? 'AND accountId = ?' : '';
    const params = accountId ? [Number(accountId)] : [];
    const row = db.prepare(`
        SELECT COALESCE(SUM(
            CASE WHEN status != 'Open' THEN
                CASE WHEN type IN ('CALL', 'PUT') THEN (closePrice - entryPrice) * quantity * 100 - commission
                     ELSE (entryPrice - closePrice) * quantity * 100 - commission END
            ELSE 0 END), 0) as realized
        FROM trades WHERE 1=1 ${acctWhere}
    `).get(...params);
    return toDollars(row.realized || 0);
}

// GET /api/income — breakdown of income: options premium vs SGOV treasury yield
router.get('/income', (req, res) => {
    try {
        const { accountId } = req.query;
        const sgov = computeSgovIncome();
        const options = computeOptionsIncome(accountId);
        const sgovTotal = sgov.recorded > 0 ? sgov.recorded : sgov.estimated;
        apiResponse.success(res, {
            optionsRealized: Math.round(options * 100) / 100,
            sgov,
            total: Math.round((options + sgovTotal) * 100) / 100
        });
    } catch (err) {
        apiResponse.error(res, err.message);
    }
});

// GET /api/income/premium-monthly — options premium realized per calendar month.
// Same formula as computeOptionsIncome ((entry-close)*qty*100 - commission for
// shorts, mirrored for longs), applied to the resolved legs closed in each
// month, so the bars sum to the Income Breakdown's options number.
router.get('/premium-monthly', (req, res) => {
    try {
        const { accountId } = req.query;
        const acctAnd = accountId ? 'AND accountId = ?' : '';
        const params = accountId ? [Number(accountId)] : [];
        const rows = db.prepare(`
            SELECT strftime('%Y-%m', closedDate) as month,
                   SUM(CASE WHEN type IN ('CALL', 'PUT') THEN (closePrice - entryPrice) * quantity * 100 - commission
                            ELSE (entryPrice - closePrice) * quantity * 100 - commission END) as premium
            FROM trades
            WHERE status != 'Open' AND closedDate IS NOT NULL ${acctAnd}
            GROUP BY month
            ORDER BY month
        `).all(...params);
        apiResponse.success(res, {
            months: rows.map((r) => ({ month: r.month, premium: Math.round(toDollars(r.premium || 0) * 100) / 100 }))
        });
    } catch (err) {
        apiResponse.error(res, err.message);
    }
});

// GET /api/benchmark — wheel equity curve vs an SPY buy-and-hold shadow portfolio
router.get('/benchmark', async (req, res) => {
    try {
        const history = readEquityHistory();
        if (history.length < 2) {
            return apiResponse.success(res, {
                ready: false,
                message: 'Equity history not available yet — snapshots are recorded on each strategy run.',
                points: []
            });
        }
        // Collapse to last snapshot per day
        const byDay = new Map();
        for (const e of history) byDay.set(e.date, e.equity);
        const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));

        const baseDate = days[0][0];
        const baseEquity = days[0][1];
        const spyBase = await getSpyClose(baseDate);
        if (!spyBase) {
            return apiResponse.success(res, {
                ready: false,
                message: `Could not fetch ${BENCHMARK_TICKER} prices right now.`,
                points: []
            });
        }
        const spyLatest = await getSpyLatest();

        const points = [];
        for (let i = 0; i < days.length; i++) {
            const [date, equity] = days[i];
            let spyClose;
            if (i === days.length - 1 && spyLatest) {
                spyClose = spyLatest;
            } else {
                spyClose = await getSpyClose(date);
            }
            if (!spyClose) continue;
            points.push({
                date,
                wheel: Math.round(equity * 100) / 100,
                spy: Math.round(baseEquity * (spyClose / spyBase) * 100) / 100
            });
        }
        const last = points[points.length - 1];
        apiResponse.success(res, {
            ready: points.length >= 2,
            ticker: BENCHMARK_TICKER,
            baseDate,
            baseEquity: Math.round(baseEquity * 100) / 100,
            points,
            wheelReturnPct: Math.round((last.wheel / baseEquity - 1) * 10000) / 100,
            spyReturnPct: Math.round((last.spy / baseEquity - 1) * 10000) / 100,
            diffDollars: Math.round((last.wheel - last.spy) * 100) / 100
        });
    } catch (err) {
        apiResponse.error(res, err.message);
    }
});

export default router;
