// ============================================================================
// CRON JOB — Schedules automatic /api/update calls
// ----------------------------------------------------------------------------
// This replaces the previous update-today.js which had its own scraping logic
// (3 games only, no Lotto 5/35, separate DB connection). Now we just hit the
// Next.js API which:
//   - handles all 4 games consistently
//   - uses the shared db.js (auto-migration, dedupe)
//   - sends Telegram notifications via env vars
//
// To run: `node scripts/cron.js` — typically spawned alongside `next start`
// via the `start` npm script.
// ============================================================================

const cron = require('node-cron');
const axios = require('axios');

const PORT = process.env.PORT || 3000;
const API_BASE = process.env.INTERNAL_API_BASE || `http://localhost:${PORT}`;
const TIMEZONE = 'Asia/Ho_Chi_Minh';

console.log('=========================================');
console.log('VIETLOTT CRON SCHEDULER');
console.log(`API target: ${API_BASE}`);
console.log(`Timezone:   ${TIMEZONE}`);
console.log('Schedule:   18:30, 18:45, 19:00 (Vietnam time)');
console.log('=========================================');

async function triggerUpdate(label) {
    const ts = new Date().toLocaleString('vi-VN', { timeZone: TIMEZONE });
    console.log(`\n[CRON ${label} | ${ts}] Triggering /api/update...`);
    try {
        const res = await axios.get(`${API_BASE}/api/update`, { timeout: 90000 });
        const r = res.data?.results;
        if (r) {
            console.log(`[CRON ${label}] Updated: ${r.updated.length}, Skipped: ${r.skipped.length}, Failed: ${r.failed.length}`);
            if (r.updated.length > 0) {
                console.log('[CRON]  New draws:', r.updated.map(u => `${u.game}#${u.drawId}`).join(', '));
            }
        }
    } catch (e) {
        console.error(`[CRON ${label}] Failed:`, e.message);
    }
}

// 18:30 — Mega + Max 3D usually published by now
cron.schedule('30 18 * * *', () => triggerUpdate('18:30'), { scheduled: true, timezone: TIMEZONE });
// 18:45 — Power 6/55 typically slightly later
cron.schedule('45 18 * * *', () => triggerUpdate('18:45'), { scheduled: true, timezone: TIMEZONE });
// 19:00 — final safety retry
cron.schedule('0 19 * * *', () => triggerUpdate('19:00'), { scheduled: true, timezone: TIMEZONE });

// Boot-time check — catches any missed draws after a deploy/restart
setTimeout(() => triggerUpdate('boot'), 12000);
