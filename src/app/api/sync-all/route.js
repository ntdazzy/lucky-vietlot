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
    // linkPattern = array of href substrings that identify THIS game's date-link.
    // Multiple patterns needed for Lotto 5/35 which has TWO daily draws
    // (13h and 21h) on separate URLs but shown together on the date page.
    { code: '645',      name: 'Mega 6/45',  path: 'xsmega645',    type: 'mega',     linkPatterns: ['xsmega645/ngay-'] },
    { code: '655',      name: 'Power 6/55', path: 'xspower',      type: 'power',    linkPatterns: ['xspower/ngay-'] },
    { code: '535',      name: 'Lotto 5/35', path: 'xslotto-5-35', type: 'lotto535', linkPatterns: ['xslotto-13h/ngay-', 'xslotto-21h/ngay-'] },
    { code: 'max3dpro', name: 'Max 3D Pro', path: 'xsmax3dpro',   type: 'max3d',    linkPatterns: ['xsmax3dpro/ngay-'] },
];

// Build a Cheerio attribute selector that matches ANY of the patterns
function linkSelector(patterns) {
    return patterns.map(p => `a[href*="${p}"]`).join(', ');
}

const DATE_DELAY_MS = 150;          // delay between date-fetch batches
const DATE_CONCURRENCY = 5;         // fetch 5 dates per game in parallel
const MAX_CONSECUTIVE_EMPTY = 60;   // stop after this many consecutive empty days (covers Tet holiday + buffer)
const MAX_DAYS_TO_WALK = 4500;      // hard upper bound — ~12 years of daily walking
const REQUEST_TIMEOUT_MS = 12000;
const TELEGRAM_EDIT_DEBOUNCE_MS = 2000;

// Game schedules — used to skip non-draw days without HTTP calls
// dayOfWeek: 0=Sun, 1=Mon, ..., 6=Sat
const GAME_SCHEDULES = {
    '645':      [3, 5, 0],  // Wed, Fri, Sun
    '655':      [2, 4, 6],  // Tue, Thu, Sat
    'max3dpro': [2, 4, 6],  // Tue, Thu, Sat
    '535':      [0, 1, 2, 3, 4, 5, 6], // daily (will get 404s on non-draw days, that's OK)
};

function formatXsktDate(d) {
    // xskt uses non-zero-padded format: "13-5-2026", "8-5-2026"
    return `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;
}

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

/**
 * Parse one draw row from xskt.com.vn. CRITICAL: scope link selector to
 * THIS game's URL pattern(s), otherwise sidebar/cross-game links pollute
 * the result.
 *
 * For Lotto 5/35, multiple linkPatterns are checked (13h + 21h slots).
 */
function parseDrawElement($, el, cfg) {
    const dateLink = $(el).find(linkSelector(cfg.linkPatterns)).first();
    if (!dateLink.length) return null;

    // drawId text — extract digits only (e.g., "#00637 (13h)" → "00637")
    const rawText = dateLink.text().trim();
    const digitMatch = rawText.match(/\d+/);
    if (!digitMatch) return null;
    const drawIdText = digitMatch[0];

    // date from href
    const href = dateLink.attr('href') || '';
    const dateMatch = href.match(/ngay-(\d+-\d+-\d+)/);
    if (!dateMatch) return null;
    const date = dateMatch[1].replace(/-/g, '/');

    if (cfg.type === 'mega') {
        const ballsArr = $(el).find('.megaresult em').text().trim().split(/\s+/).filter(Boolean);
        if (ballsArr.length < 6) return null;
        return { drawId: drawIdText, date, balls: ballsArr.slice(0, 6).join(', ') };
    }
    if (cfg.type === 'power') {
        const mainArr = $(el).find('.megaresult').eq(0).find('em').text().trim().split(/\s+/).filter(Boolean);
        const special = $(el).find('.jp2 .megaresult').text().trim();
        if (mainArr.length < 6) return null;
        return { drawId: drawIdText, date, balls: mainArr.slice(0, 6).join(', '), special_ball: special };
    }
    if (cfg.type === 'lotto535') {
        // Lotto 5/35 = 5 main balls. xskt sometimes shows a 6th value (bonus),
        // strip it to match game spec.
        const ballsArr = $(el).find('.megaresult em').text().trim().split(/\s+/).filter(Boolean);
        if (ballsArr.length < 5) return null;
        return { drawId: drawIdText, date, balls: ballsArr.slice(0, 5).join(', ') };
    }
    if (cfg.type === 'max3d') {
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
 * Sync one game using DATE WALK strategy.
 *
 * Why date walk: xskt.com.vn `/trang-N` doesn't actually paginate (always
 * returns latest). The only way to get historical data is via specific date
 * URLs like `/xsmega645/ngay-13-5-2026`.
 *
 * Strategy:
 *   1. Find latest known date in DB (or use today)
 *   2. Walk BACKWARD day by day, checking only days matching game schedule
 *   3. Stop when N consecutive draw-days are empty (= reached game epoch)
 *   4. For full sync: walk backward from today regardless
 *
 * Progress: "240 / 1509 kỳ" where 1509 = latestDrawId (= total kỳ in history)
 */
async function syncGame(cfg, reporter, token, gameStates, lineIdx, fullResync) {
    const state = gameStates[lineIdx];
    state.status = 'starting';
    state.name = cfg.name;

    const flush = () => reporter.edit(buildProgressMessage(gameStates));

    // Step 1: fetch front page to get latest drawId (used as "total kỳ" in progress)
    let latestDrawId = 0;
    let latestDate = null;
    try {
        const frontHtml = await fetchPage(`https://xskt.com.vn/${cfg.path}`);
        const $ = cheerio.load(frontHtml);
        const tables = $('table').filter((i, el) =>
            $(el).find(linkSelector(cfg.linkPatterns)).length > 0
        );
        tables.each((i, el) => {
            const parsed = parseDrawElement($, el, cfg);
            if (parsed) {
                const idNum = parseInt(parsed.drawId.match(/\d+/)?.[0] || '0', 10);
                if (idNum > latestDrawId) {
                    latestDrawId = idNum;
                    latestDate = parsed.date;
                }
            }
        });
    } catch (e) {
        console.warn(`[sync-all] ${cfg.name} front-page probe failed: ${e.message}`);
    }
    state.latestDrawId = latestDrawId;
    state.currentDrawId = latestDrawId; // start: have only the latest
    await flush();

    // Step 2: walk backward day-by-day
    const schedule = new Set(GAME_SCHEDULES[cfg.code] || [0,1,2,3,4,5,6]);
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    let consecutiveEmpty = 0;
    let dateOffset = 0;
    let lowestSeenId = latestDrawId || Infinity;
    let consecutiveAlreadyHave = 0;
    const ALREADY_HAVE_THRESHOLD = fullResync ? Infinity : 5; // incremental: stop once we hit existing data

    while (dateOffset < MAX_DAYS_TO_WALK) {
        if (isCancelled(token)) {
            state.status = 'cancelled';
            await flush();
            return { inserted: state.inserted, cancelled: true };
        }

        // Collect next batch of draw-day dates
        const batchDates = [];
        while (batchDates.length < DATE_CONCURRENCY && dateOffset < MAX_DAYS_TO_WALK) {
            const d = new Date(startDate);
            d.setDate(d.getDate() - dateOffset);
            dateOffset++;
            if (schedule.has(d.getDay())) batchDates.push(d);
        }
        if (batchDates.length === 0) break;

        const urls = batchDates.map(d => ({
            url: `https://xskt.com.vn/${cfg.path}/ngay-${formatXsktDate(d)}`,
            date: d,
        }));

        const fetched = await Promise.allSettled(urls.map(u => fetchPage(u.url, 1)));

        const allDraws = [];
        for (let i = 0; i < fetched.length; i++) {
            const result = fetched[i];
            if (result.status === 'rejected') {
                consecutiveEmpty++;
                continue;
            }
            const $ = cheerio.load(result.value);
            const tables = $('table').filter((j, el) =>
                $(el).find(linkSelector(cfg.linkPatterns)).length > 0
            );
            let foundInThisDate = false;
            tables.each((j, el) => {
                const parsed = parseDrawElement($, el, cfg);
                if (parsed) {
                    allDraws.push(parsed);
                    const idNum = parseInt(parsed.drawId.match(/\d+/)?.[0] || '0', 10);
                    if (idNum > 0 && idNum < lowestSeenId) lowestSeenId = idNum;
                    foundInThisDate = true;
                }
            });
            if (foundInThisDate) {
                consecutiveEmpty = 0;
            } else {
                consecutiveEmpty++;
            }
        }

        // Bulk insert in one transaction
        let addedThisBatch = 0;
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
            addedThisBatch = tx(allDraws);
            state.inserted += addedThisBatch;
            state.scanned += allDraws.length;
        }

        // For incremental sync: stop once we've encountered enough already-existing rows in a row
        if (allDraws.length > 0 && addedThisBatch === 0) {
            consecutiveAlreadyHave += allDraws.length;
        } else {
            consecutiveAlreadyHave = 0;
        }

        state.currentDrawId = lowestSeenId === Infinity ? null : lowestSeenId;
        state.status = 'running';
        await flush();

        // Stop conditions
        if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) {
            // Reached game epoch (no more draws to find)
            state.status = 'done';
            await flush();
            return { inserted: state.inserted, cancelled: false };
        }
        if (consecutiveAlreadyHave >= ALREADY_HAVE_THRESHOLD) {
            state.status = 'caught-up';
            await flush();
            return { inserted: state.inserted, cancelled: false };
        }

        await new Promise(r => setTimeout(r, DATE_DELAY_MS));
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
            // date-walk loop. This ~4x speedup vs sequential since each game
            // hits a different xskt.com.vn endpoint.
            const results = await Promise.allSettled(
                GAMES_CONFIG.map((cfg, idx) => syncGame(cfg, reporter, token, gameStates, idx, fullResync))
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
