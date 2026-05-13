const axios = require('axios');
const cheerio = require('cheerio');
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH 
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'vietlott.db')
    : path.join(__dirname, '..', 'vietlott.db');
const db = new Database(dbPath);

const GAMES = [
    { code: '645', name: 'Mega 6/45', endpoint: 'winning-number-645' },
    { code: '655', name: 'Power 6/55', endpoint: 'winning-number-655' },
    { code: 'max-3dpro', name: 'Max 3D Pro', endpoint: 'winning-number-max-3dpro' }
];

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
        console.log("- Đã gửi thông báo qua Telegram thành công.");
    } catch (e) {
        console.error("- Lỗi khi gửi Telegram:", e.message);
    }
}

async function updateLatestDraw() {
    console.log(`[${new Date().toLocaleString()}] Bắt đầu cập nhật tự động...`);
    
    try {
        const url = `https://xskt.com.vn/vietlott/mega-6-45`;
        const headers = { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
        };
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

        for (const game of gamesToParse) {
            console.log(`Checking latest draw for ${game.name}...`);
            try {
                const data = game.parse();
                if (!data || !data.drawId) {
                    console.log(`- Không tìm thấy dữ liệu cho ${game.name}`);
                    continue;
                }

                const tableName = game.code === 'max-3dpro' ? 'draws_max3dpro' : `draws_${game.code}`;
                const checkStmt = db.prepare(`SELECT 1 FROM ${tableName} WHERE draw_id = ?`);
                const exists = checkStmt.get(data.drawId);

                if (exists) {
                    console.log(`- ${game.name} kỳ #${data.drawId} đã có trong DB. Bỏ qua.`);
                } else {
                    console.log(`- Phát hiện kỳ mới #${data.drawId} cho ${game.name}. Đang lưu...`);
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
                    console.log(`- Đã lưu kỳ #${data.drawId} (${data.dateStr}) thành công.`);
                }
            } catch (e) {
                console.error(`Error processing ${game.name}:`, e.message);
            }
        }
    } catch (e) {
        console.error("Lỗi khi tải trang XSKT:", e.message);
    }
    console.log(`Hoàn tất!\n`);
}

updateLatestDraw();
