import { Router } from 'express';
import { db } from '../db/connection.js';
import { apiResponse } from '../utils/response.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const router = Router();

// Version must come from package.json on disk: npm_package_version is only set
// under `npm/bun run`, not under direct `bun server.js` (systemd), and a
// hardcoded fallback silently reported a stale release (0.18.0 during 0.19).
const APP_VERSION = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../package.json'), 'utf8')
).version || 'unknown';

router.get('/', (req, res) => {
    try {
        const dbCheck = db.prepare('SELECT COUNT(*) as count FROM trades').get();
        apiResponse.success(res, {
            status: 'healthy',
            database: { connected: true, tradeCount: dbCheck.count },
            version: APP_VERSION
        });
    } catch (error) {
        console.error('Health check failed:', error);
        apiResponse.error(res, 'Service unhealthy', 503);
    }
});

export default router;
