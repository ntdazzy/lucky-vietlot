import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { getDb, upsertDraw } from '@/lib/db';
import { acquireSyncToken, releaseSyncToken, isCancelled } from '@/lib/sync-status';

export const dynamic = 'force-dynamic';
export const maxDuration = 800; // Tell platform: this can be long-running

// ============================================================================
// CONFIG
// ============================================================================

const XSKT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://xskt.com.vn/',
};

const GAMES_CONFIG = [
    { code: '645', name: 'Mega 6/45', path: 'xsmega645', type: 'mega' },
    { code: '655', name: 'Power 6/55', path: 'xspower', type: 'power' },
    { code: '535', name: 'Lotto 5/35', path: 'xslotto-5-35', type: 'lotto535' },
    { code: 'max3dpro', name: 'Max 3D Pro', path: 'xsmax3dpro', type: 'max3d' },
];

const PAGE_DELAY_MS = 200;        // reduced from 500 — xskt tolerates this fine
const MAX_PAGES = 500;
const REQUEST_TIMEOUT_MS = 20000;
const TELEGRAM_EDIT_DEBOUNCE_MS = 2000; // 4 games × N edits → must stay under 1 edit/sec/chat (safety margin)
const PAGE_CONCURRENCY = 2;       // fetch 2 pages of same game in parallel (politeness for xskt)

// ============================================================================
// TELEGRAM PROGRESS REPORTER
// ----------------------------------------------------------------------------
// Truncates and rate-limits message edits. Logs every failure so silent
// failures don't hide stuck syncs.
// ============================================================================

class TelegramReporter {
    constructor(chatId, messageId) {
        this.chatId = chatId;
        this.messageId = messageId;
        this.token = process.env.TELEGRAM_BOT_TOKEN;
        this.lastEditAt = 0;
        this.pendingText = null;
        this.timer = null;
    }

    canSend() {
        return Boolean(this.token && this.chatId && this.messageId);
    }

    async edit(text) {
        if (!this.canSend()) return;
        // Telegram hard limit: 4096 chars. Keep buffer for safety.
        const safe = text.length > 3900 ? text.slice(0, 100) + '\n...(rút gọn)...\n' + text.slice(-3700) : text;

        this.pendingText = safe;
        const now = Date.now();
        const elapsed = now - this.lastEditAt;

        if (elapsed >= TELEGRAM_EDIT_DEBOUNCE_MS) {
            await this._flush();
        } else if (!this.timer) {
            this.timer = setTimeout(() => this._flush(), TELEGRAM_EDIT_DEBOUNCE_MS - elapsed);
        }
    }

    async flush(finalText) {
        if (this.timer) { clearTimeout(this.timer); this.timer = null; }
        if (finalText) this.pendingText = finalText;
        await this._flush();
    }

    async _flush() {
        if (!this.pendingText || !this.canSend()) return;
        const text = this.pendingText;
        this.pendingText = null;
        this.timer = null;
        this.lastEditAt = Date.now();

        try {
            await axios.post(
                `https://api.telegram.org/bot${this.token}/editMessageText`,
                { chat_id: this.chatId, message_id: this.messageId, text, parse_mode: 'HTML' },
                { timeout: 8000 }
            );
        } catch (e) {
            // Don't kill the sync over a Telegram error, but DO log it
            const status = e.response?.status;
            const desc = e.response?.data?.description || e.message;
            console.warn(`[telegram] editMessageText failed (${status}): ${desc}`);
        }
    }
}

// ============================================================================
// SCRAPE LOGIC
// ============================================================================

function parseDateFromHref($, el) {
    const href = $(el).find('a[href*="/ngay-"]').attr('href');
    if (!href) return null;
    const m = href.match(/ngay-(.+)/);
    return m ? m[1].replace(/-/g, '/') : null;
}

function parseDrawElement($, el, type) {
    const drawIdText = $(el).find('a[href*="/ngay-"]').text().replace('#', '').trim();
    if (!drawIdText) return null;
    const date = parseDateFromHref($, el);
    if (!date) return null;

    if (type === 'mega') {
        const balls = $(el).find('.megaresult em').text().trim().split(/\s+/).join(', ');
        if (!balls) return null;
        return { drawId: drawIdText, date, balls };
    }
    if (type === 'power') {
        const balls = $(el).find('.megaresult').eq(0).find('em').text().trim().split(/\s+/).join(', ');
        const special = $(el).find('.jp2 .megaresult').text().trim();
        if (!balls) return null;
        return { drawId: drawIdText, date, balls, special_ball: special };
    }
    if (type === 'lotto535') {
        const balls = $(el).find('.megaresult em').text().trim().split(/\s+/).join(', ');
        if (!balls) return null;
        return { drawId: drawIdText, date, balls };
    }
    if (type === 'max3d') {
        const extract = (idx) => $(el).find('tr').eq(idx).find('b').map((j, b) => $(b).text().trim().replace(/\s+/, ', ')).get().join(', ');
        return {
            drawId: drawIdText, date,
            dac_biet: extract(1), nhat: extract(3), nhi: extract(4), ba: extract(5),
        };
    }
    return null;
}

async function fetchPage(url, retries = 2) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await axios.get(url, { headers: XSKT_HEADERS, timeout: REQUEST_TIMEOUT_MS });
            return res.data;
        } catch (e) {
            lastErr = e;
            if (e.response?.status === 404) throw e; // Don't retry 404
            if (attempt < retries) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
    }
    throw lastErr;
}

/**
 * Sync one game. Tracks:
 *   - latestDrawId  = the highest draw_id found on page 1 (= total kỳ in real life)
 *   - lowestProcessedDrawId = lowest draw_id seen so far (= "how far back" we've gone)
 *
 * Progress format: "Lotto 5/35: 240 / 2000 kỳ (+15 mới)"
 *   240 = latestDrawId - lowestProcessedDrawId + 1 (rows scanned, top-down)
 *   2000 = latestDrawId (real total in lotterie history)
 */
async function syncGame(cfg, reporter, token, gameStates, lineIdx) {
    const state = gameStates[lineIdx];
    state.status = 'starting';
    state.name = cfg.name;
    let pagesScanned = 0;
    let latestDrawId = 0;
    let lowestProcessedId = Infinity;

    const flush = () => reporter.edit(buildProgressMessage(gameStates));

    // Process pages in batches of PAGE_CONCURRENCY for higher throughput
    for (let startPage = 1; startPage <= MAX_PAGES; startPage += PAGE_CONCURRENCY) {
        if (isCancelled(token)) {
            state.status = 'cancelled';
            await flush();
            return { inserted: state.inserted, cancelled: true };
        }

        const pageNums = [];
        for (let p = startPage; p < startPage + PAGE_CONCURRENCY && p <= MAX_PAGES; p++) pageNums.push(p);

        const fetched = await Promise.allSettled(
            pageNums.map(p => fetchPage(`https://xskt.com.vn/${cfg.path}/trang-${p}`))
        );

        let emptyPageHit = false;
        const allDraws = [];

        for (let i = 0; i < fetched.length; i++) {
            const page = pageNums[i];
            const result = fetched[i];
            if (result.status === 'rejected') {
                if (result.reason?.response?.status === 404) { emptyPageHit = true; continue; }
                console.warn(`[sync-all] ${cfg.name} page ${page} failed: ${result.reason?.message}`);
                continue;
            }
            const $ = cheerio.load(result.value);
            const tables = cfg.type === 'max3d' ? $('table.max3d') : $('table.result');
            if (tables.length === 0) { emptyPageHit = true; continue; }
            tables.each((idx, el) => {
                const parsed = parseDrawElement($, el, cfg.type);
                if (parsed) {
                    allDraws.push(parsed);
                    const idNum = parseInt(parsed.drawId.match(/\d+/)?.[0] || '0', 10);
                    if (idNum > latestDrawId) latestDrawId = idNum;
                    if (idNum < lowestProcessedId) lowestProcessedId = idNum;
                }
            });
            pagesScanned = page;
        }

        // Bulk insert in single transaction
        if (allDraws.length > 0) {
            const db = getDb();
            const tx = db.transaction((rows) => {
                let added = 0;
                for (const row of rows) {
                    const r = upsertDraw(cfg.code, row);
                    if (r.changes > 0) added++;
                }
                return added;
            });
            const added = tx(allDraws);
            state.inserted += added;
            state.scanned += allDraws.length;
        }

        // Update state for progress display
        state.latestDrawId = latestDrawId;
        state.currentDrawId = lowestProcessedId === Infinity ? null : lowestProcessedId;
        state.pagesScanned = pagesScanned;
        state.status = 'running';
        await flush();

        if (emptyPageHit) break;

        // Early stop: if last batch added 0 new rows AND we already have data, we've caught up
        if (state.scanned > 0 && state.inserted > 0) {
            const lastBatchAdded = state.scanned - (state.scannedAtLastCheck || 0);
            const lastBatchNew = state.inserted - (state.insertedAtLastCheck || 0);
            state.scannedAtLastCheck = state.scanned;
            state.insertedAtLastCheck = state.inserted;
            if (lastBatchAdded > 0 && lastBatchNew === 0 && startPage > 1) {
                state.status = 'caught-up';
                await flush();
                return { inserted: state.inserted, cancelled: false };
            }
        }

        await new Promise(r => setTimeout(r, PAGE_DELAY_MS));
    }

    state.status = 'done';
    await flush();
    return { inserted: state.inserted, cancelled: false };
}

function buildProgressMessage(gameStates) {
    const lines = ['⚡ <b>Đang đồng bộ dữ liệu...</b>', ''];
    for (const s of gameStates) {
        if (!s.name) continue;
        const icon = s.status === 'done' || s.status === 'caught-up' ? '✅'
                   : s.status === 'cancelled' ? '🛑'
                   : s.status === 'error' ? '❌'
                   : '⏳';
        let progress = '';
        if (s.latestDrawId > 0 && s.currentDrawId != null) {
            // "240 / 2000 kỳ" — số kỳ đã quét / tổng số kỳ trong lịch sử
            const processed = s.latestDrawId - s.currentDrawId + 1;
            progress = `${processed.toLocaleString('vi-VN')} / ${s.latestDrawId.toLocaleString('vi-VN')} kỳ`;
        } else if (s.scanned > 0) {
            progress = `${s.scanned} kỳ đã quét`;
        } else {
            progress = 'đang khởi tạo…';
        }
        const newCount = s.inserted > 0 ? ` <i>(+${s.inserted} mới)</i>` : '';
        const statusNote = s.status === 'caught-up' ? ' — đã cập nhật đủ'
                        : s.status === 'cancelled' ? ' — đã hủy'
                        : s.status === 'done' ? ' — hoàn tất'
                        : '';
        lines.push(`${icon} <b>${s.name}</b>: ${progress}${newCount}${statusNote}`);
    }
    return lines.join('\n');
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chat_id');
    const messageId = searchParams.get('message_id');
    const fullResync = searchParams.get('full') === '1';

    const reporter = new TelegramReporter(chatId, messageId);

    // Acquire exclusive token — refuses concurrent syncs
    const token = acquireSyncToken();
    if (token === null) {
        const msg = '⚠️ Đang có tiến trình đồng bộ khác chạy. Dùng /cancel để hủy nó trước.';
        if (reporter.canSend()) await reporter.flush(msg);
        return NextResponse.json({ success: false, error: 'Sync already running' }, { status: 409 });
    }

    console.log(`[sync-all] Started (token=${token}, full=${fullResync})`);

    // Respond to caller immediately. Run sync in background.
    (async () => {
        const startedAt = Date.now();

        // Pre-build state slots for each game so progress message has stable ordering
        const gameStates = GAMES_CONFIG.map(cfg => ({
            name: cfg.name,
            status: 'pending',
            inserted: 0,
            scanned: 0,
            latestDrawId: 0,
            currentDrawId: null,
            pagesScanned: 0,
            scannedAtLastCheck: 0,
            insertedAtLastCheck: 0,
        }));

        try {
            await reporter.edit(buildProgressMessage(gameStates));

            // PARALLEL: sync all 4 games concurrently. Each game has its own
            // page-fetch loop. This ~4x speedup vs sequential since each game
            // hits a different xskt.com.vn endpoint, no resource contention.
            const results = await Promise.allSettled(
                GAMES_CONFIG.map((cfg, idx) => syncGame(cfg, reporter, token, gameStates, idx))
            );

            const summary = { total: 0 };
            results.forEach((r, idx) => {
                if (r.status === 'fulfilled') summary.total += r.value.inserted;
                else {
                    console.error(`[sync-all] ${GAMES_CONFIG[idx].name} fatal:`, r.reason);
                    gameStates[idx].status = 'error';
                }
            });

            const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
            const elapsedStr = elapsedSec >= 60
                ? `${Math.floor(elapsedSec / 60)} phút ${elapsedSec % 60} giây`
                : `${elapsedSec} giây`;
            const cancelled = isCancelled(token);

            const finalMsg = buildProgressMessage(gameStates) + '\n\n' +
                (cancelled
                    ? `🛑 <b>ĐÃ HỦY</b> sau ${elapsedStr}. Đã thêm <b>${summary.total}</b> kỳ mới.`
                    : `✅ <b>HOÀN TẤT</b> sau ${elapsedStr}. Đã thêm <b>${summary.total}</b> kỳ mới.`);
            await reporter.flush(finalMsg);
            console.log(`[sync-all] Done (token=${token}, inserted=${summary.total}, elapsed=${elapsedSec}s, cancelled=${cancelled})`);
        } catch (e) {
            console.error('[sync-all] Unhandled:', e);
            await reporter.flush(buildProgressMessage(gameStates) + `\n\n❌ <b>Lỗi:</b> ${e.message}`);
        } finally {
            releaseSyncToken(token);
        }
    })().catch(e => {
        console.error('[sync-all] Background task crashed:', e);
        releaseSyncToken(token);
    });

    return NextResponse.json({ success: true, message: 'Sync started', token });
}
