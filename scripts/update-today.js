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

async function updateLatestDraw() {
    console.log(`[${new Date().toLocaleString()}] Bắt đầu cập nhật tự động (Cronjob)...`);
    
    for (const game of GAMES) {
        console.log(`Checking latest draw for ${game.name}...`);
        try {
            const url = `https://www.vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/${game.endpoint}`;
            const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const $ = cheerio.load(res.data);
            
            // Lấy draw đầu tiên có value (bỏ qua option "Chọn kỳ quay")
            let validOption = null;
            $('#drpSelectGameDraw option').each((i, el) => {
                if ($(el).attr('value') && !validOption) {
                    validOption = $(el);
                }
            });
            
            if (!validOption) continue;
            
            const val = validOption.attr('value');
            const text = validOption.text();
            
            if (!val || !text) continue;
            
            const match = text.match(/(\d{2}\/\d{2}\/\d{4})\s*\((.+?)\)/);
            if (!match) continue;
            
            const dateStr = match[1];
            const drawId = match[2];
            
            // Check if exist in DB
            const tableName = game.code === 'max-3dpro' ? 'draws_max3dpro' : `draws_${game.code}`;
            const checkStmt = db.prepare(`SELECT 1 FROM ${tableName} WHERE draw_id = ?`);
            const exists = checkStmt.get(drawId);
            
            if (exists) {
                console.log(`- ${game.name} kỳ #${drawId} đã có trong DB. Bỏ qua.`);
                continue;
            }
            
            console.log(`- Phát hiện kỳ mới #${drawId} cho ${game.name}. Đang tải dữ liệu...`);
            
            // Fetch chi tiết
            const detailUrl = `https://www.vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/${game.code}?id=${drawId}&nocatche=1`;
            const detailRes = await axios.get(detailUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const $d = cheerio.load(detailRes.data);
            
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
                    console.log(`- Đã lưu kỳ #${drawId} (${dateStr}) vào DB thành công.`);
                } else {
                    console.log(`- Không tìm thấy bóng cho kỳ #${drawId}. Lỗi Cloudflare?`);
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
                    console.log(`- Đã lưu kỳ #${drawId} (${dateStr}) vào DB thành công.`);
                }
            }
        } catch (e) {
            console.error(`Error updating ${game.name}:`, e.message);
        }
    }
    console.log(`Hoàn tất Cronjob!\n`);
}

updateLatestDraw();
