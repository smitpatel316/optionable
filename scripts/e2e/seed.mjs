#!/usr/bin/env node
// E2E sandbox seeder (fork addition 2026-08-28): fills a SCRATCH Optionable
// instance with a realistic wheel book via its HTTP API. Never point BASE at
// production — this script only creates cheap synthetic rows, but the sandbox
// convention keeps even that impossible.
//
// Usage: PORT=8296 node scripts/e2e/seed.mjs
const BASE = `http://127.0.0.1:${process.env.PORT || 8296}/api`;

if (process.env.PORT === '8096' || !process.env.PORT) {
    console.error('REFUSING: seeding is sandbox-only, PORT must be the scratch port (8296)');
    process.exit(1);
}

const req = async (method, path, body) => {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    if (!json.success) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
    return json.data;
};

const trade = (t) => req('POST', '/trades', { quantity: 1, closePrice: 0, ...t });

const account = (await req('GET', '/accounts'))[0];
console.log('using account', account.id, account.name);

// The server demo-seeds an empty DB on first boot; wipe those rows so sandbox
// numbers are deterministic (sandbox only, never production).
const existing = await req('GET', '/trades?status=all');
for (const t of existing) {
    await req('DELETE', `/trades/${t.id}`).catch((e) => console.log(`warn: delete trade ${t.id}: ${e.message}`));
}
console.log(`wiped ${existing.length} demo trade(s)`);

// enable the tab bar (portfolio mode) so TabBar/Analytics render
await req('PUT', '/settings/portfolio_mode_enabled', { value: 'true' }).catch(() => {});

// 1. Open book (mirrors the live shape: CSPs + a CC)
const t1 = await trade({ ticker: 'AAPL', type: 'CSP', strike: 300, entryPrice: 2.05, delta: 0.30, openedDate: '2026-08-10', expirationDate: '2026-09-11', status: 'Open', notes: 'OCC:AAPL260911P00300000 syncId:e2e', accountId: account.id });
const t2 = await trade({ ticker: 'NEE', type: 'CSP', strike: 82.5, entryPrice: 2.18, delta: 0.28, openedDate: '2026-08-27', expirationDate: '2026-10-16', status: 'Open', notes: 'OCC:NEE261016P00082500 syncId:e2e', accountId: account.id });
const t3 = await trade({ ticker: 'XOM', type: 'CC', strike: 100, entryPrice: 1.50, delta: 0.35, openedDate: '2026-08-20', expirationDate: '2026-09-18', status: 'Open', notes: 'OCC:XOM260918C00100000 syncId:e2e', accountId: account.id });

// 2. A roll chain, child still open
const parent = await trade({ ticker: 'INTC', type: 'CSP', strike: 40, entryPrice: 0.80, closePrice: 1.10, openedDate: '2026-07-15', expirationDate: '2026-08-21', closedDate: '2026-08-14', status: 'Rolled', accountId: account.id });
await trade({ ticker: 'INTC', type: 'CSP', strike: 38, entryPrice: 1.20, delta: 0.32, openedDate: '2026-08-14', expirationDate: '2026-09-26', status: 'Open', parentTradeId: parent.id, notes: 'roll 1 of 2', accountId: account.id });

// 3. Closed winners/losers for attribution + cycles
await trade({ ticker: 'F', type: 'CSP', strike: 13, entryPrice: 0.45, closePrice: 0.10, openedDate: '2026-07-01', expirationDate: '2026-08-07', closedDate: '2026-08-01', status: 'Closed', accountId: account.id });
await trade({ ticker: 'F', type: 'CSP', strike: 12.5, entryPrice: 0.40, closePrice: 0.0, openedDate: '2026-06-01', expirationDate: '2026-06-20', closedDate: '2026-06-20', status: 'Expired', accountId: account.id });
await trade({ ticker: 'AAPL', type: 'CSP', strike: 290, entryPrice: 1.90, closePrice: 0.25, openedDate: '2026-06-15', expirationDate: '2026-07-18', closedDate: '2026-07-10', status: 'Closed', accountId: account.id });
await trade({ ticker: 'JNJ', type: 'CSP', strike: 160, entryPrice: 1.10, closePrice: 4.20, openedDate: '2026-07-20', expirationDate: '2026-08-15', closedDate: '2026-08-10', status: 'Closed', accountId: account.id });

// 4. Engine push: same shape wheel-stack POSTs to /api/engine/dashboard
await req('POST', '/engine/dashboard', {
    snapshot: { regime: 'neutral', vix: 14.5, equity: 100798, cash: 102097, optionsBuyingPower: 3119, riskUsed: 52050, riskCap: 101597 },
    openPositions: [
        { symbol: 'AAPL260911P00300000', underlying: 'AAPL', type: 'CSP', strike: 300, expiry: '2026-09-11', dte: 6, contracts: 1, entryPrice: 2.05, currentPrice: 1.50, marketValue: -150, unrealizedPL: 55, unrealizedPLpct: 26.8, otmPct: 4.62, rollsUsed: 0, rollsMax: 2 },
        { symbol: 'NEE261016P00082500', underlying: 'NEE', type: 'CSP', strike: 82.5, expiry: '2026-10-16', dte: 50, contracts: 1, entryPrice: 2.18, currentPrice: 2.40, marketValue: -240, unrealizedPL: -22, unrealizedPLpct: -10.1, otmPct: -2.1, rollsUsed: 1, rollsMax: 2 },
        { symbol: 'XOM260918C00100000', underlying: 'XOM', type: 'CC', strike: 100, expiry: '2026-09-18', dte: 22, contracts: 1, entryPrice: 1.50, currentPrice: 0.80, marketValue: -80, unrealizedPL: 70, unrealizedPLpct: 46.7, otmPct: 6.0 },
        { symbol: 'INTC260926P00038000', underlying: 'INTC', type: 'CSP', strike: 38, expiry: '2026-09-26', dte: 29, contracts: 1, entryPrice: 1.20, currentPrice: 0.90, marketValue: -90, unrealizedPL: 30, unrealizedPLpct: 25.0, otmPct: 3.0, rollsUsed: 1, rollsMax: 2 },
        { symbol: 'SGOV', underlying: 'SGOV', type: 'SGOV', contracts: 0, marketValue: 0 },
    ],
    fundingQueue: [
        { symbol: 'BAC260911P00059000', underlying: 'BAC', strike: 59, expiry: '2026-09-11', need: 5900, queued_at: '2026-08-27T14:07:53+00:00', valid_for: '2026-08-28' },
    ],
});

console.log('seeded: 4 open (3 CSP + 1 CC), 1 roll chain, 4 closed, engine dashboard push');
