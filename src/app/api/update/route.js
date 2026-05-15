import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { getDb, upsertDraw, countDraws } from '@/lib/db';
import { checkPendingTicketsForGame } from '@/lib/ticket-checker';
import { getPrizeTier } from '@/lib/prize-tiers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ============================================================================
// CONFIG
// ============================================================================

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
};

const GAMES = [
    { code: '645', name: 'Mega 6/45' },
    { code: '655', name: 'Power 6/55' },
    { code: '535', name: 'Lotto 5/35' },
    { code: 'max3dpro', name: 'Max 3D Pro' },
];

// ============================================================================
// TELEGRAM
// ============================================================================

async function tgEdit(chatId, messageId, text) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token || !chatId || !messageId) return;
    try {
        await axios.post(
            `https://api.telegram.org/bot${token}/editMessageText`,
            { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML' },
            { timeout: 8000 }
        );
    } catch (e) {
        console.warn(`[telegram] edit failed: ${e.response?.data?.description || e.message}`);
    }
}

async function tgSend(message) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;
    try {
        await axios.post(
            `https://api.telegram.org/bot${token}/sendMessage`,
            { chat_id: chatId, text: message, parse_mode: 'HTML' },
            { timeout: 8000 }
        );
    } catch (e) {
        console.warn(`[telegram] send failed: ${e.response?.data?.description || e.message}`);
    }
}

// ============================================================================
// FETCH WITH RETRY
// ============================================================================

async function fetchWithRetry(url, options = {}, maxRetries = 3) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const res = await axios.get(url, {
                headers: BROWSER_HEADERS,
                timeout: 20000,
                validateStatus: s => s < 500,
                ...options,
            });
            if (res.status === 200) return res;
            lastError = new Error(`HTTP ${res.status}`);
        } catch (e) {
            lastError = e;
        }
        if (attempt < maxRetries) await new Promise(r => setTimeout(r, 1000 * attempt));
    }
    throw lastError;
}

// ============================================================================
// SOURCE: xskt.com.vn
// ============================================================================

async function fetchFromXskt(game) {
    const urls = {
        '645': 'https://xskt.com.vn/vietlott/mega-6-45',
        '655': 'https://xskt.com.vn/vietlott/power-6-55',
        '535': 'https://xskt.com.vn/vietlott/535',
        'max3dpro': 'https://xskt.com.vn/vietlott/max-3d-pro',
    };
    const url = urls[game.code];
    if (!url) return null;

    const res = await fetchWithRetry(url, { headers: { ...BROWSER_HEADERS, Referer: 'https://xskt.com.vn/' } });
    const $ = cheerio.load(res.data);

    const pickFirstWithLink = (linkPattern) => $(`table:has(a[href*="${linkPattern}"])`).first();

    if (game.code === '645') {
        const table = pickFirstWithLink('xsmega645/ngay');
        if (!table.length) return null;
        const drawId = table.find('a[href*="xsmega645/ngay"] b').text().replace('#', '').trim();
        const link = table.find('a[href*="xsmega645/ngay"]').attr('href');
        const date = link?.match(/ngay-(.+)/)?.[1].replace(/-/g, '/');
        const balls = table.find('.megaresult em').text().trim().split(/\s+/).join(', ');
        if (!drawId || !balls) return null;
        return { drawId, date, balls };
    }
    if (game.code === '655') {
        const table = pickFirstWithLink('xspower/ngay');
        if (!table.length) return null;
        const drawId = table.find('a[href*="xspower/ngay"] b').text().replace('#', '').trim();
        const link = table.find('a[href*="xspower/ngay"]').attr('href');
        const date = link?.match(/ngay-(.+)/)?.[1].replace(/-/g, '/');
        const balls = table.find('.megaresult').eq(0).find('em').text().trim().split(/\s+/).join(', ');
        const special_ball = table.find('.jp2 .megaresult').text().trim();
        if (!drawId || !balls) return null;
        return { drawId, date, balls, special_ball };
    }
    if (game.code === '535') {
        const table = pickFirstWithLink('xs535');
        if (!table.length) return null;
        const drawId = table.find('a[href*="xs535"] b').first().text().replace('#', '').trim();
        const link = table.find('a[href*="xs535"]').attr('href');
        const date = link?.match(/ngay-(.+)/)?.[1].replace(/-/g, '/');
        const balls = table.find('.megaresult em').text().trim().split(/\s+/).join(', ');
        if (!drawId || !balls) return null;
        return { drawId, date, balls };
    }
    if (game.code === 'max3dpro') {
        const table = pickFirstWithLink('xsmax3dpro/ngay');
        if (!table.length) return null;
        const drawId = table.find('a[href*="xsmax3dpro/ngay"] b').text().replace('#', '').trim();
        const link = table.find('a[href*="xsmax3dpro/ngay"]').attr('href');
        const date = link?.match(/ngay-(.+)/)?.[1].replace(/-/g, '/');
        if (!drawId) return null;
        const extract = (idx) => table.find('tr').eq(idx).find('b').map((i, el) => $(el).text().trim().replace(/\s+/, ', ')).get().join(', ');
        return { drawId, date, dac_biet: extract(1), nhat: extract(3), nhi: extract(4), ba: extract(5) };
    }
    return null;
}

// ============================================================================
// SOURCE: minhngoc.net.vn (fallback)
// ============================================================================

async function fetchFromMinhngoc(game) {
    const urls = {
        '645': 'https://www.minhngoc.net.vn/ket-qua-xo-so/vietlott/mega-6-45.html',
        '655': 'https://www.minhngoc.net.vn/ket-qua-xo-so/vietlott/power-6-55.html',
    };
    const url = urls[game.code];
    if (!url) return null;

    const res = await fetchWithRetry(url, { headers: { ...BROWSER_HEADERS, Referer: 'https://www.minhngoc.net.vn/' } });
    const $ = cheerio.load(res.data);

    if (game.code === '645') {
        const balls = [];
        $('.bong_tron_vietlott').slice(0, 6).each((i, el) => balls.push($(el).text().trim()));
        if (balls.length !== 6) return null;
        const drawId = $('.kqxs_vietlott_left .info .row span').filter((i, el) => $(el).text().includes('#')).text().match(/#(\d+)/)?.[1];
        const date = $('.kqxs_vietlott_left .info .date').text().trim();
        if (!drawId) return null;
        return { drawId, date, balls: balls.join(', ') };
    }
    if (game.code === '655') {
        const balls = [];
        $('.bong_tron_vietlott').slice(0, 6).each((i, el) => balls.push($(el).text().trim()));
        const special_ball = $('.bong_tron_vietlott').eq(6).text().trim();
        if (balls.length !== 6 || !special_ball) return null;
        const drawId = $('.kqxs_vietlott_left .info .row span').filter((i, el) => $(el).text().includes('#')).text().match(/#(\d+)/)?.[1];
        const date = $('.kqxs_vietlott_left .info .date').text().trim();
        if (!drawId) return null;
        return { drawId, date, balls: balls.join(', '), special_ball };
    }
    return null;
}

const SOURCES = [fetchFromXskt, fetchFromMinhngoc];

async function fetchGameResult(game) {
    const errors = [];
    for (const fetcher of SOURCES) {
        try {
            const data = await fetcher(game);
            if (data) return { data, source: fetcher.name };
        } catch (e) {
            errors.push(`${fetcher.name}: ${e.message}`);
            console.warn(`[update] ${fetcher.name} for ${game.code}: ${e.message}`);
        }
    }
    return { data: null, errors };
}

// ============================================================================
// GET — Telegram-triggered update
// ============================================================================

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chat_id');
    const messageId = searchParams.get('message_id');

    // Ensure DB is initialized before any reporting
    try {
        getDb();
    } catch (e) {
        console.error('[update] DB init failed:', e);
        if (chatId && messageId) {
            await tgEdit(chatId, messageId, `❌ <b>Lỗi DB:</b> ${e.message}`);
        }
        return NextResponse.json({ success: false, error: 'DB init failed' }, { status: 500 });
    }

    const lines = ['🔄 <b>Đang cập nhật dữ liệu...</b>'];
    await tgEdit(chatId, messageId, lines.join('\n'));

    const results = { updated: [], skipped: [], failed: [] };

    for (let i = 0; i < GAMES.length; i++) {
        const game = GAMES[i];
        const linePrefix = `\n⏳ <b>${game.name}</b>:`;
        lines.push(`${linePrefix} đang quét…`);
        await tgEdit(chatId, messageId, lines.join(''));

        try {
            const { data, errors } = await fetchGameResult(game);
            const lineIdx = lines.length - 1;

            if (!data) {
                const errMsg = errors?.[0] || 'không có dữ liệu';
                lines[lineIdx] = `${linePrefix} ❌ ${errMsg}`;
                results.failed.push({ game: game.name, errors });
            } else {
                const info = upsertDraw(game.code, data);
                if (info.changes === 0) {
                    lines[lineIdx] = `${linePrefix} ✓ đã có #${data.drawId}`;
                    results.skipped.push({ game: game.name, drawId: data.drawId });
                } else {
                    lines[lineIdx] = `${linePrefix} 🎉 kỳ mới #${data.drawId}`;
                    results.updated.push({ game: game.name, drawId: data.drawId, date: data.date });
                    const ballsText = data.balls
                        ? `\nKết quả: ${data.balls}${data.special_ball ? ` | ĐB: ${data.special_ball}` : ''}`
                        : '';
                    await tgSend(`🎉 <b>Có kết quả ${game.name} mới!</b>\nKỳ #${data.drawId} - ${data.date}${ballsText}`);

                    // Auto-check pending tickets against this new draw
                    if (game.code !== 'max3dpro') {
                        try {
                            const ticketResults = checkPendingTicketsForGame(game.code);
                            const winners = ticketResults.filter(t => t.prize?.id && t.prize.id !== 'none');
                            if (winners.length > 0) {
                                results.winners = (results.winners || []).concat(winners);
                                // Bot notification per winner
                                for (const w of winners) {
                                    const t = getPrizeTier(w.prize.id);
                                    const banner = w.prize.id === 'jackpot' || w.prize.id === 'jackpot2'
                                        ? '🎊🎊🎊\n'
                                        : '';
                                    await tgSend(
                                        `${banner}${t.emoji} <b>${t.label}!</b> ${t.amount}\n` +
                                        `${game.name} #${data.drawId} (${data.date})\n` +
                                        `Bộ chốt: <code>${w.mainBalls.join(', ')}</code>${w.ticketSpecial ? ` | ĐB: ${w.ticketSpecial}` : ''}\n` +
                                        `Trúng: <b>${w.matched.join(', ')}</b> (${w.matchCount}/${w.mainBalls.length})${w.specialMatch ? ' + ĐB' : ''}`
                                    );
                                }
                            }
                        } catch (e) {
                            console.error(`[update] ticket check failed for ${game.code}:`, e);
                        }
                    }
                }
            }
        } catch (e) {
            const lineIdx = lines.length - 1;
            lines[lineIdx] = `${linePrefix} ❌ ${e.message}`;
            results.failed.push({ game: game.name, error: e.message });
            console.error(`[update] ${game.name}:`, e);
        }

        await tgEdit(chatId, messageId, lines.join(''));
    }

    const summary = `\n\n📊 <b>Tổng kết:</b>\n` +
        `✅ Mới: ${results.updated.length}\n` +
        `⏭ Đã có: ${results.skipped.length}\n` +
        `❌ Lỗi: ${results.failed.length}`;

    let final = lines.join('') + summary;
    if (results.failed.length > 0) {
        final += `\n\n💡 <i>Nếu 403 trên Railway → dùng /them để nhập tay.</i>`;
    }
    await tgEdit(chatId, messageId, final);

    return NextResponse.json({ success: true, results });
}

// ============================================================================
// POST — Manual data entry (Telegram /them command)
// ============================================================================

export async function POST(request) {
    try {
        const body = await request.json();
        const { game, drawId, dateStr, balls, special_ball, dac_biet, nhat, nhi, ba, secret } = body;

        if (!process.env.UPDATE_SECRET || secret !== process.env.UPDATE_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const VALID = ['645', '655', '535', 'max3dpro'];
        if (!VALID.includes(game)) {
            return NextResponse.json({ error: `Invalid game. Allowed: ${VALID.join(', ')}` }, { status: 400 });
        }
        if (!drawId || !dateStr) {
            return NextResponse.json({ error: 'Missing drawId or dateStr' }, { status: 400 });
        }

        const result = upsertDraw(game, {
            drawId, date: dateStr, balls, special_ball, dac_biet, nhat, nhi, ba,
        });

        const status = result.changes > 0 ? 'inserted' : 'already-exists';
        const total = countDraws(game);

        if (result.changes > 0) {
            await tgSend(`📝 <b>Đã thêm thủ công:</b>\n${game} #${drawId} - ${dateStr}` +
                (balls ? `\nKết quả: ${balls}` : '') +
                (special_ball ? ` | ĐB: ${special_ball}` : ''));
        }

        return NextResponse.json({ success: true, status, game, drawId, total });
    } catch (e) {
        console.error('[update POST]', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
