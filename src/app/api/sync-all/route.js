import { NextResponse } from 'next/server';
const axios = require('axios');
const cheerio = require('cheerio');
const Database = require('better-sqlite3');
const path = require('path');

export const dynamic = 'force-dynamic';

function getDbWritable() {
    const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH 
        ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'vietlott.db')
        : path.join(process.cwd(), 'vietlott.db');
    return new Database(dbPath);
}

async function editTelegramMessage(chatId, messageId, text) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token || !chatId || !messageId) return;
    try {
        const url = `https://api.telegram.org/bot${token}/editMessageText`;
        await axios.post(url, {
            chat_id: chatId,
            message_id: messageId,
            text: text,
            parse_mode: 'HTML'
        });
    } catch (e) {}
}

const XSKT_HEADERS = { 
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
};

function parseDateFromHref($, el) {
    const href = $(el).find('.kmt a').attr('href');
    if (!href) return null;
    const match = href.match(/ngay-(.+)/);
    if (!match) return null;
    return match[1].replace(/-/g, '/');
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chat_id');
    const messageId = searchParams.get('message_id');

    if (!chatId || !messageId) {
        return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    // Chạy ngầm việc đồng bộ
    (async () => {
        try {
            const db = getDbWritable();
            let progressText = `⚡ <b>Bắt đầu đồng bộ hóa dữ liệu...</b>\n`;
            await editTelegramMessage(chatId, messageId, progressText);

            const configs = [
                { 
                    name: 'Mega 6/45', 
                    url: 'https://xskt.com.vn/xsmega645/200-ngay',
                    tableSelector: 'table.result',
                    parse: ($, el) => {
                        const drawId = $(el).find('.kmt b').text().replace('#', '').trim();
                        const dateStr = parseDateFromHref($, el);
                        const balls = $(el).find('.megaresult em').text().trim().split(/\s+/).join(', ');
                        return drawId && balls && dateStr ? { drawId, dateStr, balls } : null;
                    },
                    insert: (db, d) => db.prepare(`INSERT OR IGNORE INTO draws_645 (date, draw_id, balls) VALUES (?, ?, ?)`).run(d.dateStr, d.drawId, d.balls)
                },
                { 
                    name: 'Power 6/55', 
                    url: 'https://xskt.com.vn/xspower/200-ngay',
                    tableSelector: 'table.result',
                    parse: ($, el) => {
                        const drawId = $(el).find('.kmt b').text().replace('#', '').trim();
                        const dateStr = parseDateFromHref($, el);
                        const balls = $(el).find('.megaresult').eq(0).find('em').text().trim().split(/\s+/).join(', ');
                        const special = $(el).find('.jp2 .megaresult').text().trim();
                        return drawId && balls && dateStr ? { drawId, dateStr, balls, special } : null;
                    },
                    insert: (db, d) => db.prepare(`INSERT OR IGNORE INTO draws_655 (date, draw_id, balls, special_ball) VALUES (?, ?, ?, ?)`).run(d.dateStr, d.drawId, d.balls, d.special)
                },
                { 
                    name: 'Max 3D Pro', 
                    url: 'https://xskt.com.vn/xsmax3dpro/200-ngay',
                    tableSelector: 'table.max3d',
                    parse: ($, el) => {
                        const drawId = $(el).find('.kmt b').text().replace('#', '').trim();
                        const dateStr = parseDateFromHref($, el);
                        const extractMax = (idx) => $(el).find('tr').eq(idx).find('b').map((i, b) => $(b).text().trim().replace(/\s+/, ', ')).get().join(', ');
                        return drawId && dateStr ? { drawId, dateStr, dac_biet: extractMax(1), nhat: extractMax(3), nhi: extractMax(4), ba: extractMax(5) } : null;
                    },
                    insert: (db, d) => db.prepare(`INSERT OR IGNORE INTO draws_max3dpro (date, draw_id, dac_biet, nhat, nhi, ba) VALUES (?, ?, ?, ?, ?, ?)`).run(d.dateStr, d.drawId, d.dac_biet, d.nhat, d.nhi, d.ba)
                }
            ];

            for (const cfg of configs) {
                progressText += `\n📦 <b>Đang đồng bộ ${cfg.name}...</b>`;
                await editTelegramMessage(chatId, messageId, progressText);

                try {
                    const res = await axios.get(cfg.url, { headers: XSKT_HEADERS, timeout: 30000 });
                    const $ = cheerio.load(res.data);
                    const tables = $(cfg.tableSelector);
                    let inserted = 0;

                    tables.each((i, el) => {
                        const data = cfg.parse($, el);
                        if (data) {
                            const result = cfg.insert(db, data);
                            if (result.changes > 0) inserted++;
                        }
                    });

                    progressText += ` ✅ (${tables.length} kỳ, +${inserted} mới)`;
                } catch (e) {
                    progressText += ` ❌ ${e.message}`;
                }
                await editTelegramMessage(chatId, messageId, progressText);
            }

            progressText += `\n\n✅ <b>HOÀN TẤT ĐỒNG BỘ!</b>`;
            await editTelegramMessage(chatId, messageId, progressText);

        } catch (e) {
            console.error(e);
            await editTelegramMessage(chatId, messageId, `❌ Lỗi đồng bộ: ${e.message}`);
        }
    })();

    return NextResponse.json({ success: true, message: 'Sync started' });
}
