const axios = require('axios');
const cheerio = require('cheerio');
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH 
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'vietlott.db')
    : path.join(process.cwd(), 'vietlott.db');

const db = new Database(dbPath);

const headers = { 
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
};

let totalInserted = { mega: 0, power: 0, max3d: 0 };

function parseDateFromHref($el) {
    const href = $el.find('a[href*="/ngay-"]').attr('href');
    if (!href) return null;
    const match = href.match(/ngay-(.+)/);
    if (!match) return null;
    return match[1].replace(/-/g, '/');
}

async function syncGame(gameCode, type = 'mega') {
    console.log(`\n=== Đồng bộ ${gameCode.toUpperCase()} ===`);
    let page = 1;
    let consecutiveExists = 0;
    const maxPages = 300; // An toàn
    const maxConsecutive = 10; // Nếu gặp 10 kỳ đã tồn tại liên tiếp thì dừng (trừ khi là full sync)
    
    let tableName, stmt;
    if (type === 'mega') {
        tableName = 'draws_645';
        stmt = db.prepare(`INSERT OR IGNORE INTO draws_645 (date, draw_id, balls) VALUES (?, ?, ?)`);
    } else if (type === 'power') {
        tableName = 'draws_655';
        stmt = db.prepare(`INSERT OR IGNORE INTO draws_655 (date, draw_id, balls, special_ball) VALUES (?, ?, ?, ?)`);
    } else {
        tableName = 'draws_max3dpro';
        stmt = db.prepare(`INSERT OR IGNORE INTO draws_max3dpro (date, draw_id, dac_biet, nhat, nhi, ba) VALUES (?, ?, ?, ?, ?, ?)`);
    }

    const gameUrl = type === 'mega' ? 'xsmega645' : type === 'power' ? 'xspower' : 'xsmax3dpro';

    while (page <= maxPages) {
        console.log(`Đang tải trang ${page}...`);
        try {
            const res = await axios.get(`https://xskt.com.vn/${gameUrl}/trang-${page}`, { headers, timeout: 15000 });
            const $ = cheerio.load(res.data);
            const tables = type === 'max3d' ? $('table.max3d') : $('table.result');
            
            if (tables.length === 0) {
                console.log(`- Không còn dữ liệu ở trang ${page}. Dừng.`);
                break;
            }

            let foundInPage = 0;
            tables.each((i, el) => {
                const drawIdText = $(el).find('a[href*="/ngay-"] b').text().replace('#', '').trim();
                if (!drawIdText) return;
                
                // Tránh lấy nhầm kết quả game khác (thường drawId của Mega/Power > 500)
                const drawId = parseInt(drawIdText);
                if (isNaN(drawId)) return;

                const dateStr = parseDateFromHref($(el));
                if (!dateStr) return;

                let result;
                if (type === 'mega') {
                    const balls = $(el).find('.megaresult em').text().trim().split(/\s+/).join(', ');
                    if (balls) {
                        result = stmt.run(dateStr, drawIdText, balls);
                    }
                } else if (type === 'power') {
                    const balls = $(el).find('.megaresult').eq(0).find('em').text().trim().split(/\s+/).join(', ');
                    const special_ball = $(el).find('.jp2 .megaresult').text().trim();
                    if (balls) {
                        result = stmt.run(dateStr, drawIdText, balls, special_ball);
                    }
                } else {
                    const extractMax = (trIndex) => $(el).find('tr').eq(trIndex).find('b').map((i, b) => $(b).text().trim().replace(/\s+/, ', ')).get().join(', ');
                    result = stmt.run(dateStr, drawIdText, extractMax(1), extractMax(3), extractMax(4), extractMax(5));
                }

                if (result && result.changes > 0) {
                    totalInserted[type]++;
                    foundInPage++;
                    consecutiveExists = 0;
                } else {
                    consecutiveExists++;
                }
            });

            console.log(`- Trang ${page}: Thêm mới ${foundInPage} kỳ.`);
            
            // Nếu trang này không có gì mới và trang trước cũng thế, có thể dừng (tùy nhu cầu)
            // Tuy nhiên với "Sync All", ta nên đi hết hoặc đến khi gặp quá nhiều kỳ cũ
            if (foundInPage === 0 && page > 5) {
                 // Nếu đã qua vài trang đầu mà không có gì mới, có thể dừng
                 // console.log("- Không có dữ liệu mới ở trang này. Dừng sync game này.");
                 // break;
            }

            page++;
            // Tránh spam server quá nhanh
            await new Promise(resolve => setTimeout(resolve, 500));
            
        } catch (e) {
            console.error(`Lỗi trang ${page}:`, e.message);
            break;
        }
    }
}

async function main() {
    console.log('🚀 Bắt đầu đồng bộ TOÀN BỘ dữ liệu từ XSKT (sử dụng pagination)...');
    console.log(`📁 DB: ${dbPath}`);
    
    const startTime = Date.now();
    
    await syncGame('Mega 6/45', 'mega');
    await syncGame('Power 6/55', 'power');
    await syncGame('Max 3D Pro', 'max3d');
    
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n📊 Tổng kết:`);
    console.log(`  Mega 6/45:    +${totalInserted.mega}`);
    console.log(`  Power 6/55:   +${totalInserted.power}`);
    console.log(`  Max 3D Pro:   +${totalInserted.max3d}`);
    console.log(`\n✅ Hoàn tất! Thời gian: ${elapsed}s`);
    
    db.close();
}

if (require.main === module) {
    main().catch(e => { console.error('Lỗi nghiêm trọng:', e); process.exit(1); });
}

module.exports = { main };
