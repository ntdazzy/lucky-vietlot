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

const PAGE_DELAY_MS = 500;
const MAX_PAGES = 500;
const REQUEST_TIMEOUT_MS = 20000;
const TELEGRAM_EDIT_DEBOUNCE_MS = 1500; // Stay under Telegram rate limit (1 edit/sec/chat)

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

async function syncGame(cfg, reporter, token, progressLines) {
    let inserted = 0;
    let totalSeen = 0;
    let pagesScanned = 0;
    const lineIdx = progressLines.length;
    progressLines.push(`📦 <b>${cfg.name}</b>: bắt đầu…`);

    for (let page = 1; page <= MAX_PAGES; page++) {
        if (isCancelled(token)) {
            progressLines[lineIdx] = `📦 <b>${cfg.name}</b>: 🛑 đã hủy (+${inserted} mới, ${pagesScanned} trang)`;
            await reporter.edit(progressLines.join('\n'));
            return { inserted, cancelled: true };
        }

        const url = `https://xskt.com.vn/${cfg.path}/trang-${page}`;
        let html;
        try {
            html = await fetchPage(url);
        } catch (e) {
            if (e.response?.status === 404) break;
            progressLines[lineIdx] = `📦 <b>${cfg.name}</b>: ⚠️ lỗi trang ${page} (${e.message}), bỏ qua`;
            await reporter.edit(progressLines.join('\n'));
            continue;
        }

        const $ = cheerio.load(html);
        const tables = cfg.type === 'max3d' ? $('table.max3d') : $('table.result');
        if (tables.length === 0) break;

        const draws = [];
        tables.each((i, el) => {
            const parsed = parseDrawElement($, el, cfg.type);
            if (parsed) draws.push(parsed);
        });

        // Bulk insert in single transaction — much faster than row-by-row
        const db = getDb();
        const tx = db.transaction((rows) => {
            let added = 0;
            for (const row of rows) {
                const r = upsertDraw(cfg.code, row);
                if (r.changes > 0) added++;
            }
            return added;
        });

        const addedThisPage = tx(draws);
        inserted += addedThisPage;
        totalSeen += draws.length;
        pagesScanned = page;

        // Update progress every 2 pages
        if (page % 2 === 0 || page === 1) {
            progressLines[lineIdx] = `📦 <b>${cfg.name}</b>: ⏳ trang ${page} | +${inserted} mới / ${totalSeen} đã quét`;
            await reporter.edit(progressLines.join('\n'));
        }

        // If a full page returned 0 new inserts AFTER we already have data,
        // we've caught up — stop early.
        if (addedThisPage === 0 && page > 1 && inserted > 0) {
            const existingCount = totalSeen - inserted;
            if (existingCount === draws.length) {
                progressLines[lineIdx] = `📦 <b>${cfg.name}</b>: ✅ đã cập nhật (+${inserted} mới, ${pagesScanned} trang, dừng vì đã đủ)`;
                await reporter.edit(progressLines.join('\n'));
                return { inserted, cancelled: false };
            }
        }

        await new Promise(r => setTimeout(r, PAGE_DELAY_MS));
    }

    progressLines[lineIdx] = `📦 <b>${cfg.name}</b>: ✅ xong (+${inserted} mới, ${pagesScanned} trang)`;
    await reporter.edit(progressLines.join('\n'));
    return { inserted, cancelled: false };
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
    // We deliberately do NOT await — the caller (Vercel webhook) has a 10s
    // timeout and only needs to know we accepted the job.
    (async () => {
        const startedAt = Date.now();
        const progressLines = [
            `⚡ <b>Bắt đầu đồng bộ ${fullResync ? 'TOÀN BỘ' : 'tăng tiến'}</b>`,
        ];
        await reporter.edit(progressLines.join('\n'));

        const summary = { total: 0, perGame: {} };

        try {
            for (const cfg of GAMES_CONFIG) {
                if (isCancelled(token)) break;
                try {
                    const r = await syncGame(cfg, reporter, token, progressLines);
                    summary.total += r.inserted;
                    summary.perGame[cfg.name] = r.inserted;
                    if (r.cancelled) break;
                } catch (e) {
                    console.error(`[sync-all] ${cfg.name} fatal:`, e);
                    progressLines.push(`❌ <b>${cfg.name}</b>: ${e.message}`);
                    await reporter.edit(progressLines.join('\n'));
                }
            }

            const elapsedMin = Math.round((Date.now() - startedAt) / 60000 * 10) / 10;
            const cancelled = isCancelled(token);
            progressLines.push('');
            progressLines.push(cancelled
                ? `🛑 <b>ĐÃ HỦY</b> sau ${elapsedMin} phút — đã thêm <b>${summary.total}</b> kỳ.`
                : `✅ <b>HOÀN TẤT</b> sau ${elapsedMin} phút — đã thêm <b>${summary.total}</b> kỳ mới.`
            );
            await reporter.flush(progressLines.join('\n'));
            console.log(`[sync-all] Done (token=${token}, inserted=${summary.total}, cancelled=${cancelled})`);
        } catch (e) {
            console.error('[sync-all] Unhandled:', e);
            progressLines.push(`\n❌ <b>Lỗi không bắt được:</b> ${e.message}`);
            await reporter.flush(progressLines.join('\n'));
        } finally {
            releaseSyncToken(token);
        }
    })().catch(e => {
        console.error('[sync-all] Background task crashed:', e);
        releaseSyncToken(token);
    });

    return NextResponse.json({ success: true, message: 'Sync started', token });
}
