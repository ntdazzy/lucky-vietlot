const axios = require('axios');
const cheerio = require('cheerio');
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH 
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'vietlott.db')
    : path.join(process.cwd(), 'vietlott.db');

const db = new Database(dbPath);

const headers = { 
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
};

async function syncMega() {
    console.log("--- Đồng bộ Mega 6/45 ---");
    for (let p = 1; p <= 30; p++) { // Lấy khoảng 30 trang (~600 kỳ)
        console.log(`Đang tải trang ${p}...`);
        try {
            const res = await axios.get(`https://xskt.com.vn/xsmega645/p/${p}`, { headers });
            const $ = cheerio.load(res.data);
            const tables = $('table.result');
            if (tables.length === 0) break;

            tables.each((i, el) => {
                const drawId = $(el).find('.kmt b').text().replace('#', '').trim();
                const dateStr = $(el).find('.kmt a').attr('href').match(/ngay-(.+)/)[1].replace(/-/g, '/');
                const balls = $(el).find('.megaresult em').text().trim().split(/\s+/).join(', ');
                
                if (drawId && balls) {
                    const insert = db.prepare(`INSERT OR IGNORE INTO draws_645 (date, draw_id, balls) VALUES (?, ?, ?)`);
                    insert.run(dateStr, drawId, balls);
                }
            });
            await new Promise(r => setTimeout(r, 1000));
        } catch (e) {
            console.error(`Lỗi trang ${p}:`, e.message);
            break;
        }
    }
}

async function syncPower() {
    console.log("--- Đồng bộ Power 6/55 ---");
    for (let p = 1; p <= 30; p++) {
        console.log(`Đang tải trang ${p}...`);
        try {
            const res = await axios.get(`https://xskt.com.vn/xspower/p/${p}`, { headers });
            const $ = cheerio.load(res.data);
            const tables = $('table.result');
            if (tables.length === 0) break;

            tables.each((i, el) => {
                const drawId = $(el).find('.kmt b').text().replace('#', '').trim();
                const dateStr = $(el).find('.kmt a').attr('href').match(/ngay-(.+)/)[1].replace(/-/g, '/');
                const balls = $(el).find('.megaresult').eq(0).find('em').text().trim().split(/\s+/).join(', ');
                const special_ball = $(el).find('.jp2 .megaresult').text().trim();
                
                if (drawId && balls) {
                    const insert = db.prepare(`INSERT OR IGNORE INTO draws_655 (date, draw_id, balls, special_ball) VALUES (?, ?, ?, ?)`);
                    insert.run(dateStr, drawId, balls, special_ball);
                }
            });
            await new Promise(r => setTimeout(r, 1000));
        } catch (e) {
            console.error(`Lỗi trang ${p}:`, e.message);
            break;
        }
    }
}

async function syncMax3DPro() {
    console.log("--- Đồng bộ Max 3D Pro ---");
    for (let p = 1; p <= 20; p++) {
        console.log(`Đang tải trang ${p}...`);
        try {
            const res = await axios.get(`https://xskt.com.vn/xsmax3dpro/p/${p}`, { headers });
            const $ = cheerio.load(res.data);
            const tables = $('table.max3d');
            if (tables.length === 0) break;

            tables.each((i, el) => {
                const drawId = $(el).find('.kmt b').text().replace('#', '').trim();
                const dateStr = $(el).find('.kmt a').attr('href').match(/ngay-(.+)/)[1].replace(/-/g, '/');
                const extractMax = (trIndex) => $(el).find('tr').eq(trIndex).find('b').map((i, b) => $(b).text().trim().replace(/\s+/, ', ')).get().join(', ');
                
                if (drawId) {
                    const insert = db.prepare(`INSERT OR IGNORE INTO draws_max3dpro (date, draw_id, dac_biet, nhat, nhi, ba) VALUES (?, ?, ?, ?, ?, ?)`);
                    insert.run(dateStr, drawId, extractMax(1), extractMax(3), extractMax(4), extractMax(5));
                }
            });
            await new Promise(r => setTimeout(r, 1000));
        } catch (e) {
            console.error(`Lỗi trang ${p}:`, e.message);
            break;
        }
    }
}

async function main() {
    console.log("Bắt đầu đồng bộ hóa toàn bộ dữ liệu lịch sử...");
    await syncMega();
    await syncPower();
    await syncMax3DPro();
    console.log("Hoàn tất đồng bộ hóa!");
}

main();
