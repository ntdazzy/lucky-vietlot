import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { getDbWritable } from '@/lib/db';

const GAMES = [
    { code: '645', name: 'Mega 6/45', endpoint: 'winning-number-645' },
    { code: '655', name: 'Power 6/55', endpoint: 'winning-number-655' },
    { code: 'max-3dpro', name: 'Max 3D Pro', endpoint: 'winning-number-max-3dpro' }
];

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
    } catch (e) {
        console.error("- Lỗi khi sửa tin nhắn Telegram:", e.message);
    }
}

async function sendTelegramNotification(message) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;
    try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        await axios.post(url, {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
        });
    } catch (e) {
        console.error("- Lỗi khi gửi Telegram:", e.message);
    }
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chat_id');
    const messageId = searchParams.get('message_id');

    if (!chatId || !messageId) {
        return NextResponse.json({ error: 'Missing chat_id or message_id' }, { status: 400 });
    }

        try {
            const db = getDbWritable();
            let progressText = `🔄 <b>Đang khởi động bộ cào dữ liệu... [0%]</b>\n`;
            await editTelegramMessage(chatId, messageId, progressText);

            const headers = { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
            };

            // xskt.com.vn có tất cả kết quả trên cùng 1 trang
            progressText += `\nĐang tải dữ liệu từ XSKT...`;
            await editTelegramMessage(chatId, messageId, progressText);

            const url = `https://xskt.com.vn/vietlott/mega-6-45`;
            const res = await axios.get(url, { headers, timeout: 15000 });
            const $ = cheerio.load(res.data);

            const gamesToParse = [
                {
                    code: '645', name: 'Mega 6/45',
                    parse: () => {
                        const table = $('table:has(a[href*="xsmega645/ngay"])').first();
                        if (!table.length) return null;
                        const drawId = table.find('a[href*="xsmega645/ngay"] b').text().replace('#', '').trim();
                        const dateStr = table.find('a[href*="xsmega645/ngay"]').attr('href').match(/ngay-(.+)/)[1].replace(/-/g, '/');
                        const balls = table.find('.megaresult em').text().trim().split(/\s+/).join(', ');
                        return { drawId, dateStr, balls };
                    }
                },
                {
                    code: '655', name: 'Power 6/55',
                    parse: () => {
                        const table = $('table:has(a[href*="xspower/ngay"])').first();
                        if (!table.length) return null;
                        const drawId = table.find('a[href*="xspower/ngay"] b').text().replace('#', '').trim();
                        const dateStr = table.find('a[href*="xspower/ngay"]').attr('href').match(/ngay-(.+)/)[1].replace(/-/g, '/');
                        const balls = table.find('.megaresult').eq(0).find('em').text().trim().split(/\s+/).join(', ');
                        const special_ball = table.find('.jp2 .megaresult').text().trim();
                        return { drawId, dateStr, balls, special_ball };
                    }
                },
                {
                    code: 'max-3dpro', name: 'Max 3D Pro',
                    parse: () => {
                        const table = $('table:has(a[href*="xsmax3dpro/ngay"])').first();
                        if (!table.length) return null;
                        const drawId = table.find('a[href*="xsmax3dpro/ngay"] b').text().replace('#', '').trim();
                        const dateStr = table.find('a[href*="xsmax3dpro/ngay"]').attr('href').match(/ngay-(.+)/)[1].replace(/-/g, '/');
                        const extractMax = (trIndex) => table.find('tr').eq(trIndex).find('b').map((i, el) => $(el).text().trim().replace(/\s+/, ', ')).get().join(', ');
                        return { 
                            drawId, dateStr, 
                            dac_biet: extractMax(1), nhat: extractMax(3), nhi: extractMax(4), ba: extractMax(5) 
                        };
                    }
                }
            ];

            let completed = 0;
            const totalGames = gamesToParse.length;

            for (const game of gamesToParse) {
                progressText += `\nĐang quét ${game.name}...`;
                await editTelegramMessage(chatId, messageId, progressText);

                try {
                    const data = game.parse();
                    if (!data || !data.drawId) {
                        progressText += ` Không có KQ`;
                    } else {
                        const tableName = game.code === 'max-3dpro' ? 'draws_max3dpro' : `draws_${game.code}`;
                        const checkStmt = db.prepare(`SELECT 1 FROM ${tableName} WHERE draw_id = ?`);
                        const exists = checkStmt.get(data.drawId);

                        if (exists) {
                            progressText += ` Bỏ qua (#${data.drawId})`;
                        } else {
                            if (game.code === '645') {
                                const insert = db.prepare(`INSERT OR IGNORE INTO draws_645 (date, draw_id, balls) VALUES (?, ?, ?)`);
                                insert.run(data.dateStr, data.drawId, data.balls);
                                await sendTelegramNotification(`🎉 <b>Đã có kết quả ${game.name} mới!</b>\nKỳ quay: #${data.drawId} ngày ${data.dateStr}\nBóng: ${data.balls}`);
                            } else if (game.code === '655') {
                                const insert = db.prepare(`INSERT OR IGNORE INTO draws_655 (date, draw_id, balls, special_ball) VALUES (?, ?, ?, ?)`);
                                insert.run(data.dateStr, data.drawId, data.balls, data.special_ball);
                                await sendTelegramNotification(`🎉 <b>Đã có kết quả ${game.name} mới!</b>\nKỳ quay: #${data.drawId} ngày ${data.dateStr}\nBóng: ${data.balls}`);
                            } else if (game.code === 'max-3dpro') {
                                const insert = db.prepare(`INSERT OR IGNORE INTO draws_max3dpro (date, draw_id, dac_biet, nhat, nhi, ba) VALUES (?, ?, ?, ?, ?, ?)`);
                                insert.run(data.dateStr, data.drawId, data.dac_biet, data.nhat, data.nhi, data.ba);
                                await sendTelegramNotification(`🎉 <b>Đã có kết quả ${game.name} mới!</b>\nKỳ quay: #${data.drawId} ngày ${data.dateStr}`);
                            }
                            progressText += ` Cập nhật mới (#${data.drawId})`;
                        }
                    }
                } catch (e) {
                    progressText += ` Lỗi: ${e.message}`;
                }

                completed++;
                const pct = Math.round((completed / totalGames) * 100);
                progressText = progressText.replace(/\[\d+%\]/, `[${pct}%]`);
                await editTelegramMessage(chatId, messageId, progressText);
            }

        progressText += `\n\n✅ <b>Hoàn tất toàn bộ!</b>`;
        await editTelegramMessage(chatId, messageId, progressText);

        return NextResponse.json({ success: true, message: 'Updated' });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
