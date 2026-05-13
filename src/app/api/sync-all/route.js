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
            let progressText = `⚡ <b>Bắt đầu đồng bộ hóa toàn bộ dữ liệu lịch sử...</b>\n`;
            await editTelegramMessage(chatId, messageId, progressText);

            const headers = { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
            };

            const configs = [
                { name: 'Mega 6/45', path: 'xsmega645', table: 'draws_645', pages: 30 },
                { name: 'Power 6/55', path: 'xspower', table: 'draws_655', pages: 30 },
                { name: 'Max 3D Pro', path: 'xsmax3dpro', table: 'draws_max3dpro', pages: 20 }
            ];

            for (const cfg of configs) {
                progressText += `\n📦 <b>Đang đồng bộ ${cfg.name}...</b>`;
                await editTelegramMessage(chatId, messageId, progressText);

                for (let p = 1; p <= cfg.pages; p++) {
                    const res = await axios.get(`https://xskt.com.vn/${cfg.path}/p/${p}`, { headers });
                    const $ = cheerio.load(res.data);
                    
                    if (cfg.path === 'xsmax3dpro') {
                        const tables = $('table.max3d');
                        if (tables.length === 0) break;
                        tables.each((i, el) => {
                            const drawId = $(el).find('.kmt b').text().replace('#', '').trim();
                            const dateStr = $(el).find('.kmt a').attr('href').match(/ngay-(.+)/)[1].replace(/-/g, '/');
                            const extractMax = (idx) => $(el).find('tr').eq(idx).find('b').map((i, b) => $(b).text().trim().replace(/\s+/, ', ')).get().join(', ');
                            if (drawId) {
                                const insert = db.prepare(`INSERT OR IGNORE INTO draws_max3dpro (date, draw_id, dac_biet, nhat, nhi, ba) VALUES (?, ?, ?, ?, ?, ?)`);
                                insert.run(dateStr, drawId, extractMax(1), extractMax(3), extractMax(4), extractMax(5));
                            }
                        });
                    } else {
                        const tables = $('table.result');
                        if (tables.length === 0) break;
                        tables.each((i, el) => {
                            const drawId = $(el).find('.kmt b').text().replace('#', '').trim();
                            const dateStr = $(el).find('.kmt a').attr('href').match(/ngay-(.+)/)[1].replace(/-/g, '/');
                            if (cfg.path === 'xsmega645') {
                                const balls = $(el).find('.megaresult em').text().trim().split(/\s+/).join(', ');
                                if (drawId && balls) {
                                    const insert = db.prepare(`INSERT OR IGNORE INTO draws_645 (date, draw_id, balls) VALUES (?, ?, ?)`);
                                    insert.run(dateStr, drawId, balls);
                                }
                            } else {
                                const balls = $(el).find('.megaresult').eq(0).find('em').text().trim().split(/\s+/).join(', ');
                                const special = $(el).find('.jp2 .megaresult').text().trim();
                                if (drawId && balls) {
                                    const insert = db.prepare(`INSERT OR IGNORE INTO draws_655 (date, draw_id, balls, special_ball) VALUES (?, ?, ?, ?)`);
                                    insert.run(dateStr, drawId, balls, special);
                                }
                            }
                        });
                    }
                    if (p % 5 === 0) {
                        await editTelegramMessage(chatId, messageId, progressText + ` (Trang ${p}/${cfg.pages})`);
                    }
                    await new Promise(r => setTimeout(r, 800));
                }
                progressText += ` OK!`;
                await editTelegramMessage(chatId, messageId, progressText);
            }

            progressText += `\n\n✅ <b>HOÀN TẤT ĐỒNG BỘ LỊCH SỬ!</b>`;
            await editTelegramMessage(chatId, messageId, progressText);

        } catch (e) {
            console.error(e);
            await editTelegramMessage(chatId, messageId, `❌ Lỗi đồng bộ: ${e.message}`);
        }
    })();

    return NextResponse.json({ success: true, message: 'Sync started' });
}
