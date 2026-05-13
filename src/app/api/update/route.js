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

        let totalGames = GAMES.length;
        let completed = 0;

        for (const game of GAMES) {
            progressText += `\nĐang quét ${game.name}...`;
            await editTelegramMessage(chatId, messageId, progressText);

            try {
                const headers = { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
                };
                const url = `https://www.vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/${game.endpoint}`;
                const res = await axios.get(url, { headers });
                const $ = cheerio.load(res.data);
                
                let validOption = null;
                $('#drpSelectGameDraw option').each((i, el) => {
                    if ($(el).attr('value') && !validOption) {
                        validOption = $(el);
                    }
                });
                
                if (validOption) {
                    const text = validOption.text();
                    const match = text.match(/(\d{2}\/\d{2}\/\d{4})\s*\((.+?)\)/);
                    if (match) {
                        const dateStr = match[1];
                        const drawId = match[2];
                        
                        const tableName = game.code === 'max-3dpro' ? 'draws_max3dpro' : `draws_${game.code}`;
                        const checkStmt = db.prepare(`SELECT 1 FROM ${tableName} WHERE draw_id = ?`);
                        const exists = checkStmt.get(drawId);
                        
                        if (exists) {
                            progressText += ` Bỏ qua (Đã có sẵn #${drawId})`;
                        } else {
                            // Fetch chi tiết
                            const detailUrl = `https://www.vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/${game.code}?id=${drawId}&nocatche=1`;
                            const detailRes = await axios.get(detailUrl, { headers });
                            const $d = cheerio.load(detailRes.data);
                            
                            let found = false;
                            if (game.code === '645' || game.code === '655') {
                                const balls = [];
                                $d('.day_so_ket_qua_v2 span').each((i, el) => balls.push($d(el).text().trim()));
                                if (balls.length === 0) {
                                    $d('.day_so_ket_qua span').each((i, el) => balls.push($d(el).text().trim()));
                                }
                                
                                if (balls.length > 0) {
                                    if (game.code === '645') {
                                        const insert = db.prepare(`INSERT OR IGNORE INTO draws_645 (date, draw_id, balls) VALUES (?, ?, ?)`);
                                        insert.run(dateStr, drawId, balls.join(', '));
                                    } else {
                                        const insert = db.prepare(`INSERT OR IGNORE INTO draws_655 (date, draw_id, balls, special_ball) VALUES (?, ?, ?, ?)`);
                                        insert.run(dateStr, drawId, balls.slice(0, 6).join(', '), balls[6] || '');
                                    }
                                    found = true;
                                    await sendTelegramNotification(`🎉 <b>Đã có kết quả ${game.name} mới!</b>\nKỳ quay: #${drawId} ngày ${dateStr}\nBóng: ${balls.join(', ')}\n\n👉 Nhắn /on để truy cập Web xem chi tiết!`);
                                }
                            } else if (game.code === 'max-3dpro') {
                                const rows = $d('table tbody tr');
                                const extractNumbers = (rowIndex) => {
                                    const nums = [];
                                    $d(rows[rowIndex]).find('span.red').each((i, el) => nums.push($d(el).text().trim()));
                                    return nums.join(', ');
                                };
                                const dacBiet = extractNumbers(0);
                                const nhat = extractNumbers(2);
                                const nhi = extractNumbers(3);
                                const ba = extractNumbers(4);
                                
                                if (dacBiet) {
                                    const insert = db.prepare(`INSERT OR IGNORE INTO draws_max3dpro (date, draw_id, dac_biet, nhat, nhi, ba) VALUES (?, ?, ?, ?, ?, ?)`);
                                    insert.run(dateStr, drawId, dacBiet, nhat, nhi, ba);
                                    found = true;
                                    await sendTelegramNotification(`🎉 <b>Đã có kết quả ${game.name} mới!</b>\nKỳ quay: #${drawId} ngày ${dateStr}\n\n👉 Nhắn /on để truy cập Web xem chi tiết!`);
                                }
                            }
                            
                            if (found) {
                                progressText += ` Cập nhật mới (#${drawId})`;
                            } else {
                                progressText += ` Không có KQ (Lỗi web VN)`;
                            }
                        }
                    } else {
                        progressText += ` Lỗi Format Ngày`;
                    }
                } else {
                    progressText += ` Web bảo trì`;
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
