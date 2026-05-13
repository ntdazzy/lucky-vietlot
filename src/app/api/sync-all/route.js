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
    const href = $(el).find('a[href*="/ngay-"]').attr('href');
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
        const db = getDbWritable();
        try {
            let progressText = `⚡ <b>Bắt đầu đồng bộ hóa TOÀN BỘ dữ liệu...</b>\n`;
            await editTelegramMessage(chatId, messageId, progressText);

            const configs = [
                { 
                    name: 'Mega 6/45', 
                    path: 'xsmega645',
                    type: 'mega',
                    maxPages: 50, // Đồng bộ 50 trang (~250 kỳ) cho nhanh, có thể tăng nếu cần
                },
                { 
                    name: 'Power 6/55', 
                    path: 'xspower',
                    type: 'power',
                    maxPages: 50,
                },
                { 
                    name: 'Lotto 5/35', 
                    path: 'xslotto-5-35',
                    type: 'lotto535',
                    maxPages: 50,
                },
                { 
                    name: 'Max 3D Pro', 
                    path: 'xsmax3dpro',
                    type: 'max3d',
                    maxPages: 50,
                }
            ];

            for (const cfg of configs) {
                progressText += `\n📦 <b>Đang đồng bộ ${cfg.name}...</b>`;
                await editTelegramMessage(chatId, messageId, progressText);

                let insertedCount = 0;
                let totalChecked = 0;

                for (let page = 1; page <= cfg.maxPages; page++) {
                    try {
                        const url = `https://xskt.com.vn/${cfg.path}/trang-${page}`;
                        const res = await axios.get(url, { headers: XSKT_HEADERS, timeout: 20000 });
                        const $ = cheerio.load(res.data);
                        const tables = cfg.type === 'max3d' ? $('table.max3d') : $('table.result');
                        
                        if (tables.length === 0) break;

                        let foundInPage = 0;
                        tables.each((i, el) => {
                            const drawIdText = $(el).find('a[href*="/ngay-"] b').text().replace('#', '').trim();
                            if (!drawIdText) return;
                            
                            const dateStr = parseDateFromHref($, el);
                            if (!dateStr) return;

                            let result;
                            if (cfg.type === 'mega') {
                                const balls = $(el).find('.megaresult em').text().trim().split(/\s+/).join(', ');
                                if (balls) {
                                    result = db.prepare(`INSERT OR IGNORE INTO draws_645 (date, draw_id, balls) VALUES (?, ?, ?)`).run(dateStr, drawIdText, balls);
                                }
                            } else if (cfg.type === 'power') {
                                const balls = $(el).find('.megaresult').eq(0).find('em').text().trim().split(/\s+/).join(', ');
                                const special = $(el).find('.jp2 .megaresult').text().trim();
                                if (balls) {
                                    result = db.prepare(`INSERT OR IGNORE INTO draws_655 (date, draw_id, balls, special_ball) VALUES (?, ?, ?, ?)`).run(dateStr, drawIdText, balls, special);
                                }
                            } else if (cfg.type === 'lotto535') {
                                const balls = $(el).find('.megaresult em').text().trim().split(/\s+/).join(', ');
                                if (balls) {
                                    const id = `${dateStr.replace(/\//g, '')}_${drawIdText.replace(/\s+/g, '')}`;
                                    result = db.prepare(`INSERT OR IGNORE INTO draws_535 (id, date, draw_id, balls) VALUES (?, ?, ?, ?)`).run(id, dateStr, drawIdText, balls);
                                }
                            } else {
                                const extractMax = (idx) => $(el).find('tr').eq(idx).find('b').map((j, b) => $(b).text().trim().replace(/\s+/, ', ')).get().join(', ');
                                result = db.prepare(`INSERT OR IGNORE INTO draws_max3dpro (date, draw_id, dac_biet, nhat, nhi, ba) VALUES (?, ?, ?, ?, ?, ?)`).run(dateStr, drawIdText, extractMax(1), extractMax(3), extractMax(4), extractMax(5));
                            }

                            if (result && result.changes > 0) {
                                insertedCount++;
                                foundInPage++;
                            }
                            totalChecked++;
                        });

                        // Cập nhật tiến độ sau mỗi 5 trang
                        if (page % 5 === 0) {
                            await editTelegramMessage(chatId, messageId, progressText + ` (Trang ${page}, +${insertedCount})`);
                        }

                        if (foundInPage === 0 && page > 3) {
                            // Nếu không có gì mới sau vài trang, có thể là đã bắt kịp dữ liệu cũ
                            // Tuy nhiên để an toàn trong "Sync All", ta cứ chạy tiếp hoặc dừng nếu muốn.
                        }
                        
                        await new Promise(r => setTimeout(r, 300));
                    } catch (e) {
                        console.error(`Error page ${page}:`, e.message);
                        break;
                    }
                }

                progressText += ` ✅ (+${insertedCount} mới)`;
                await editTelegramMessage(chatId, messageId, progressText);
            }

            progressText += `\n\n✅ <b>HOÀN TẤT ĐỒNG BỘ TOÀN BỘ!</b>`;
            await editTelegramMessage(chatId, messageId, progressText);

        } catch (e) {
            console.error(e);
            await editTelegramMessage(chatId, messageId, `❌ Lỗi đồng bộ: ${e.message}`);
        } finally {
            db.close();
        }
    })();

    return NextResponse.json({ success: true, message: 'Full sync started' });
}
