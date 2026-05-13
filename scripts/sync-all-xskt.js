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
    const href = $el.find('.kmt a').attr('href');
    if (!href) return null;
    const match = href.match(/ngay-(.+)/);
    if (!match) return null;
    return match[1].replace(/-/g, '/');
}

async function syncMega() {
    console.log('\n=== Đồng bộ Mega 6/45 ===');
    const stmt = db.prepare(`INSERT OR IGNORE INTO draws_645 (date, draw_id, balls) VALUES (?, ?, ?)`);

    try {
        console.log('Đang tải 200 kỳ gần nhất...');
        const res = await axios.get('https://xskt.com.vn/xsmega645/200-ngay', { headers, timeout: 30000 });
        const $ = cheerio.load(res.data);
        const tables = $('table.result');
        console.log(`Tìm thấy ${tables.length} kỳ quay.`);

        tables.each((i, el) => {
            const drawId = $(el).find('.kmt b').text().replace('#', '').trim();
            const dateStr = parseDateFromHref($(el));
            if (!dateStr) return;
            const balls = $(el).find('.megaresult em').text().trim().split(/\s+/).join(', ');
            
            if (drawId && balls) {
                const result = stmt.run(dateStr, drawId, balls);
                if (result.changes > 0) totalInserted.mega++;
            }
        });
        console.log(`✅ Mega 6/45 xong. Thêm mới: ${totalInserted.mega} kỳ.`);
    } catch (e) {
        console.error('Lỗi Mega:', e.message);
    }
}

async function syncPower() {
    console.log('\n=== Đồng bộ Power 6/55 ===');
    const stmt = db.prepare(`INSERT OR IGNORE INTO draws_655 (date, draw_id, balls, special_ball) VALUES (?, ?, ?, ?)`);

    try {
        console.log('Đang tải 200 kỳ gần nhất...');
        const res = await axios.get('https://xskt.com.vn/xspower/200-ngay', { headers, timeout: 30000 });
        const $ = cheerio.load(res.data);
        const tables = $('table.result');
        console.log(`Tìm thấy ${tables.length} kỳ quay.`);

        tables.each((i, el) => {
            const drawId = $(el).find('.kmt b').text().replace('#', '').trim();
            const dateStr = parseDateFromHref($(el));
            if (!dateStr) return;
            const balls = $(el).find('.megaresult').eq(0).find('em').text().trim().split(/\s+/).join(', ');
            const special_ball = $(el).find('.jp2 .megaresult').text().trim();
            
            if (drawId && balls) {
                const result = stmt.run(dateStr, drawId, balls, special_ball);
                if (result.changes > 0) totalInserted.power++;
            }
        });
        console.log(`✅ Power 6/55 xong. Thêm mới: ${totalInserted.power} kỳ.`);
    } catch (e) {
        console.error('Lỗi Power:', e.message);
    }
}

async function syncMax3DPro() {
    console.log('\n=== Đồng bộ Max 3D Pro ===');
    const stmt = db.prepare(`INSERT OR IGNORE INTO draws_max3dpro (date, draw_id, dac_biet, nhat, nhi, ba) VALUES (?, ?, ?, ?, ?, ?)`);

    try {
        console.log('Đang tải 200 kỳ gần nhất...');
        const res = await axios.get('https://xskt.com.vn/xsmax3dpro/200-ngay', { headers, timeout: 30000 });
        const $ = cheerio.load(res.data);
        const tables = $('table.max3d');
        console.log(`Tìm thấy ${tables.length} kỳ quay.`);

        tables.each((i, el) => {
            const drawId = $(el).find('.kmt b').text().replace('#', '').trim();
            const dateStr = parseDateFromHref($(el));
            if (!dateStr) return;
            const extractMax = (trIndex) => $(el).find('tr').eq(trIndex).find('b').map((i, b) => $(b).text().trim().replace(/\s+/, ', ')).get().join(', ');
            
            if (drawId) {
                const result = stmt.run(dateStr, drawId, extractMax(1), extractMax(3), extractMax(4), extractMax(5));
                if (result.changes > 0) totalInserted.max3d++;
            }
        });
        console.log(`✅ Max 3D Pro xong. Thêm mới: ${totalInserted.max3d} kỳ.`);
    } catch (e) {
        console.error('Lỗi Max3D:', e.message);
    }
}

async function main() {
    console.log('🚀 Bắt đầu đồng bộ dữ liệu từ XSKT (200 kỳ gần nhất)...');
    console.log(`📁 DB: ${dbPath}`);
    
    const before645 = db.prepare('SELECT COUNT(*) as c FROM draws_645').get();
    const before655 = db.prepare('SELECT COUNT(*) as c FROM draws_655').get();
    const beforeMax = db.prepare('SELECT COUNT(*) as c FROM draws_max3dpro').get();
    console.log(`\n📊 DB hiện tại: Mega=${before645.c} | Power=${before655.c} | Max3D=${beforeMax.c}`);

    const startTime = Date.now();
    await syncMega();
    await syncPower();
    await syncMax3DPro();
    
    const after645 = db.prepare('SELECT COUNT(*) as c FROM draws_645').get();
    const after655 = db.prepare('SELECT COUNT(*) as c FROM draws_655').get();
    const afterMax = db.prepare('SELECT COUNT(*) as c FROM draws_max3dpro').get();
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    console.log(`\n📊 DB sau khi sync:`);
    console.log(`  Mega 6/45:    ${after645.c} kỳ (+${totalInserted.mega})`);
    console.log(`  Power 6/55:   ${after655.c} kỳ (+${totalInserted.power})`);
    console.log(`  Max 3D Pro:   ${afterMax.c} kỳ (+${totalInserted.max3d})`);
    console.log(`\n✅ Hoàn tất! Thời gian: ${elapsed}s`);
    
    db.close();
}

module.exports = { main, syncMega, syncPower, syncMax3DPro };

// Chạy trực tiếp nếu gọi bằng `node sync-all-xskt.js`
if (require.main === module) {
    main().catch(e => { console.error('Lỗi nghiêm trọng:', e); process.exit(1); });
}
