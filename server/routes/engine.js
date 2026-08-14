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

// POST /api/engine/dashboard  { snapshot?: {...}, scanRun?: {...} }
router.post('/dashboard', (req, res) => {
    try {
        const { snapshot, scanRun } = req.body || {};
        if (!snapshot && !scanRun) {
            return apiResponse.error(res, 'Provide snapshot and/or scanRun', 400);
        }
        const upsert = upsertStmt();
        if (snapshot) upsert.run('snapshot', JSON.stringify(snapshot));
        if (scanRun) upsert.run('scanRun', JSON.stringify(scanRun));
        apiResponse.success(res, { stored: { snapshot: !!snapshot, scanRun: !!scanRun } });
    } catch (error) {
        console.error('Engine dashboard push failed:', error);
        apiResponse.error(res, 'Failed to store engine dashboard data', 500);
    }
});

// GET /api/engine/dashboard
router.get('/dashboard', (req, res) => {
    try {
        const rows = db.prepare('SELECT key, payload, updated_at FROM engine_dashboard').all();
        const out = { snapshot: null, scanRun: null, updatedAt: null };
        for (const row of rows) {
            try { out[row.key] = JSON.parse(row.payload); } catch { out[row.key] = null; }
            if (!out.updatedAt || row.updated_at > out.updatedAt) out.updatedAt = row.updated_at;
        }
        apiResponse.success(res, out);
    } catch (error) {
        console.error('Engine dashboard read failed:', error);
        apiResponse.error(res, 'Failed to read engine dashboard data', 500);
    }
});

export default router;
