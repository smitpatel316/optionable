import { Router } from 'express';
import { db } from '../db/connection.js';
import { apiResponse } from '../utils/response.js';

// Engine dashboard bridge: the wheel engine (wheel-stack) pushes an account
// snapshot + scan funnel summary at the end of each run. We store the latest
// of each as JSON blobs and the UI renders them. Read/display only.

const router = Router();

const upsertStmt = () => db.prepare(`
    INSERT INTO engine_dashboard (key, payload, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP
`);

// Per-leg break-even enrichment (fork addition 2026-08-28): derivations from
// the engine-pushed positions blob only. BE = strike − leg premium for puts,
// strike + leg premium for calls; entryPrice is the CURRENT leg's collected
// premium (the engine re-pushes fresh rows after any roll, so no roll-history
// math is needed). The blob carries the underlying's last price only as
// otmPct, so we invert the exact formula the engine used (see
// wheel-stack core/optionable_dashboard_sync.py):
//   CSP: otmPct = (u − strike)/u · 100  →  u = strike / (1 − otmPct/100)
//   CC : otmPct = (strike − u)/u · 100  →  u = strike / (1 + otmPct/100)
// Same vintage as every other value in the push (last engine run).
const round2 = (v) => Math.round(v * 100) / 100;

const enrichBreakEven = (p) => {
    if (!p || (p.type !== 'CSP' && p.type !== 'CC')) return p;
    const strike = Number(p.strike);
    const legPremium = Number(p.entryPrice);
    if (!(strike > 0) || !(legPremium > 0)) return p;
    const breakEven = p.type === 'CSP' ? strike - legPremium : strike + legPremium;

    let underlyingLast = null;
    let distToBePct = null;
    const x = Number(p.otmPct);
    if (p.otmPct != null && Number.isFinite(x)) {
        const u = p.type === 'CSP' ? strike / (1 - x / 100) : strike / (1 + x / 100);
        if (Number.isFinite(u) && u > 0) {
            underlyingLast = round2(u);
            // positive = still on the safe side of break-even, negative = past it
            distToBePct = round2(((p.type === 'CSP' ? u - breakEven : breakEven - u) / u) * 100);
        }
    }
    return { ...p, breakEven: round2(breakEven), distToBePct, underlyingLast };
};

// POST /api/engine/dashboard  { snapshot?: {...}, scanRun?: {...}, openPositions?: [...], fundingQueue?: [...], equityHistory?: [...], sgovHistory?: [...] }
router.post('/dashboard', (req, res) => {
    try {
        const { snapshot, scanRun, openPositions, fundingQueue, equityHistory, sgovHistory } = req.body || {};
        if (!snapshot && !scanRun && !Array.isArray(openPositions) && !Array.isArray(fundingQueue)
            && !Array.isArray(equityHistory) && !Array.isArray(sgovHistory)) {
            return apiResponse.error(res, 'Provide snapshot, scanRun, openPositions, fundingQueue, equityHistory and/or sgovHistory', 400);
        }
        const upsert = upsertStmt();
        if (snapshot) upsert.run('snapshot', JSON.stringify(snapshot));
        if (scanRun) upsert.run('scanRun', JSON.stringify(scanRun));
        // Arrays: replace wholesale each push (a closed position disappears by absence)
        if (Array.isArray(openPositions)) upsert.run('positions', JSON.stringify(openPositions));
        if (Array.isArray(fundingQueue)) upsert.run('fundingQueue', JSON.stringify(fundingQueue));
        // History arrays travel with the push so the dashboard works wherever
        // it is hosted (they used to live as files next to the engine only).
        if (Array.isArray(equityHistory)) upsert.run('equityHistory', JSON.stringify(equityHistory));
        if (Array.isArray(sgovHistory)) upsert.run('sgovHistory', JSON.stringify(sgovHistory));
        apiResponse.success(res, {
            stored: {
                snapshot: !!snapshot,
                scanRun: !!scanRun,
                positions: Array.isArray(openPositions),
                fundingQueue: Array.isArray(fundingQueue),
                equityHistory: Array.isArray(equityHistory),
                sgovHistory: Array.isArray(sgovHistory),
            },
        });
    } catch (error) {
        console.error('Engine dashboard push failed:', error);
        apiResponse.error(res, 'Failed to store engine dashboard data', 500);
    }
});

// GET /api/engine/dashboard
router.get('/dashboard', (req, res) => {
    try {
        const rows = db.prepare('SELECT key, payload, updated_at FROM engine_dashboard').all();
        const out = { snapshot: null, scanRun: null, positions: null, fundingQueue: null, updatedAt: null };
        for (const row of rows) {
            try { out[row.key] = JSON.parse(row.payload); } catch { out[row.key] = null; }
            if (!out.updatedAt || row.updated_at > out.updatedAt) out.updatedAt = row.updated_at;
        }
        if (Array.isArray(out.positions)) out.positions = out.positions.map(enrichBreakEven);
        apiResponse.success(res, out);
    } catch (error) {
        console.error('Engine dashboard read failed:', error);
        apiResponse.error(res, 'Failed to read engine dashboard data', 500);
    }
});

export default router;
