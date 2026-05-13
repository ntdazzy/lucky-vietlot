const axios = require('axios');
const cheerio = require('cheerio');
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH 
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'vietlott.db')
    : path.join(process.cwd(), 'vietlott.db');

const db = new Database(dbPath);

const GAMES = [
    { code: '645', name: 'Mega 6/45', endpoint: 'winning-number-645', concurrency: 5, table: 'draws_645' },
    { code: '655', name: 'Power 6/55', endpoint: 'winning-number-655', concurrency: 5, table: 'draws_655' },
    { code: '535', name: 'Lotto 5/35', endpoint: 'winning-number-lotto-5-35', concurrency: 5, table: 'draws_535' },
    { code: 'max-3dpro', name: 'Max 3D Pro', endpoint: 'winning-number-max-3dpro', concurrency: 5, table: 'draws_max3dpro' }
];

function setupTables() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS draws_645 (
            id TEXT PRIMARY KEY,
            date TEXT,
            draw_id TEXT,
            balls TEXT
        );
        CREATE TABLE IF NOT EXISTS draws_655 (
            id TEXT PRIMARY KEY,
            date TEXT,
            draw_id TEXT,
            balls TEXT,
            special_ball TEXT
        );
        CREATE TABLE IF NOT EXISTS draws_535 (
            id TEXT PRIMARY KEY,
            date TEXT,
            draw_id TEXT,
            balls TEXT
        );
        CREATE TABLE IF NOT EXISTS draws_max3dpro (
            id TEXT PRIMARY KEY,
            date TEXT,
            draw_id TEXT,
            dac_biet TEXT,
            nhat TEXT,
            nhi TEXT,
            ba TEXT
        );
        CREATE TABLE IF NOT EXISTS prediction_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game TEXT NOT NULL,
            main TEXT NOT NULL,
            special TEXT,
            breakdown_sum INTEGER,
            breakdown_evens INTEGER,
            breakdown_spread INTEGER,
            breakdown_decades INTEGER,
            confidence REAL,
            attempts INTEGER,
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        );
    `);
}

function getMaxDrawId(table) {
    try {
        const stmt = db.prepare(`SELECT draw_id FROM ${table} ORDER BY CAST(draw_id AS INTEGER) DESC LIMIT 1`);
        const row = stmt.get();
        return row ? parseInt(row.draw_id) : 0;
    } catch (e) {
        return 0;
    }
}

async function fetchDrawList(game) {
    console.log(`Fetching list of draws for ${game.name}...`);
    try {
        const res = await axios.get(`https://www.vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/${game.endpoint}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(res.data);
        const options = $('#drpSelectGameDraw option');
        const draws = [];
        options.each((i, el) => {
            const val = $(el).attr('value');
            if (val) {
                const text = $(el).text();
                const match = text.match(/(\d{2}\/\d{2}\/\d{4})\s*\((.+?)\)/);
                if (match) {
                    draws.push({ uuid: val, date: match[1], id: match[2] });
                }
            }
        });
        console.log(`Found ${draws.length} total draws on website for ${game.name}`);
        return draws;
    } catch (e) {
        console.error(`Error fetching draw list for ${game.name}:`, e.message);
        return [];
    }
}

async function fetchDrawDetail(game, draw) {
    if (draw.id === '00000') return null;
    
    const url = `https://www.vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/${game.code}?id=${draw.id}&nocatche=1`;
    try {
        const res = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
        });
        const $ = cheerio.load(res.data);
        
        let result = { id: draw.uuid, date: draw.date, draw_id: draw.id };

        if (game.code === '645' || game.code === '655' || game.code === '535') {
            const balls = [];
            $('.day_so_ket_qua_v2 span').each((i, el) => {
                balls.push($(el).text().trim());
            });
            if (balls.length === 0) {
                $('.day_so_ket_qua span').each((i, el) => {
                    balls.push($(el).text().trim());
                });
            }
            if (balls.length === 0) {
                throw new Error("No balls found in response");
            }
            if (game.code === '645') {
                result.balls = balls.join(', ');
            } else if (game.code === '655') {
                result.balls = balls.slice(0, 6).join(', ');
                result.special_ball = balls[6] || '';
            } else if (game.code === '535') {
                result.balls = balls.slice(0, 5).join(', ');
            }
        } else if (game.code === 'max-3dpro') {
            const rows = $('table tbody tr');
            const extractNumbers = (rowIndex) => {
                const nums = [];
                $(rows[rowIndex]).find('span.red').each((i, el) => nums.push($(el).text().trim()));
                return nums.join(', ');
            };
            result.dac_biet = extractNumbers(0);
            result.nhat = extractNumbers(2);
            result.nhi = extractNumbers(3);
            result.ba = extractNumbers(4);
            if (!result.dac_biet) {
                throw new Error("No numbers found in response");
            }
        }

        return result;
    } catch (e) {
        throw e;
    }
}

async function scrapeGame(game) {
    let draws = await fetchDrawList(game);
    if (draws.length === 0) return;

    // Get the max draw_id from DB to only fetch NEW draws
    const maxDbId = getMaxDrawId(game.table);
    console.log(`Latest draw in DB for ${game.name}: #${maxDbId}`);

    // Filter to only new draws
    draws = draws.filter(d => parseInt(d.id) > maxDbId);
    
    if (draws.length === 0) {
        console.log(`✅ ${game.name} is already up to date. No new draws to fetch.\n`);
        return;
    }

    console.log(`Found ${draws.length} NEW draws to fetch for ${game.name}.`);

    // Sort ascending
    draws.sort((a, b) => parseInt(a.id) - parseInt(b.id));

    // Prepare SQLite insert statements
    let insertStmt;
    if (game.code === '645') {
        insertStmt = db.prepare(`INSERT OR REPLACE INTO draws_645 (id, date, draw_id, balls) VALUES (?, ?, ?, ?)`);
    } else if (game.code === '655') {
        insertStmt = db.prepare(`INSERT OR REPLACE INTO draws_655 (id, date, draw_id, balls, special_ball) VALUES (?, ?, ?, ?, ?)`);
    } else if (game.code === '535') {
        insertStmt = db.prepare(`INSERT OR REPLACE INTO draws_535 (id, date, draw_id, balls) VALUES (?, ?, ?, ?)`);
    } else {
        insertStmt = db.prepare(`INSERT OR REPLACE INTO draws_max3dpro (id, date, draw_id, dac_biet, nhat, nhi, ba) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    }

    const chunks = [];
    for (let i = 0; i < draws.length; i += game.concurrency) {
        chunks.push(draws.slice(i, i + game.concurrency));
    }

    let totalProcessed = 0;
    for (let chunk of chunks) {
        const promises = chunk.map(async draw => {
            let res = null;
            let retries = 5;
            while (retries > 0) {
                try {
                    res = await fetchDrawDetail(game, draw);
                    break;
                } catch (e) {
                    retries--;
                    if (retries > 0) await new Promise(r => setTimeout(r, 2000));
                }
            }
            await new Promise(r => setTimeout(r, 500));
            return res;
        });

        const results = await Promise.all(promises);
        
        // Write to DB
        const insertMany = db.transaction((rows) => {
            for (const r of rows) {
                if (!r) continue;
                if (game.code === '645' && r.balls) {
                    insertStmt.run(r.id, r.date, r.draw_id, r.balls);
                } else if (game.code === '655' && r.balls) {
                    insertStmt.run(r.id, r.date, r.draw_id, r.balls, r.special_ball);
                } else if (game.code === '535' && r.balls) {
                    insertStmt.run(r.id, r.date, r.draw_id, r.balls);
                } else if (game.code === 'max-3dpro' && r.dac_biet) {
                    insertStmt.run(r.id, r.date, r.draw_id, r.dac_biet, r.nhat, r.nhi, r.ba);
                }
            }
        });
        
        insertMany(results);

        totalProcessed += chunk.length;
        console.log(`Progress [${game.name}]: Inserted ${totalProcessed} / ${draws.length} to DB`);
    }
    
    console.log(`✅ Finished ${game.name}! Database updated successfully.\n`);
}

async function main() {
    console.log("-----------------------------------------");
    console.log("   VIETLOTT AUTO-SCRAPER TO DATABASE");
    console.log("-----------------------------------------");
    setupTables();
    for (const game of GAMES) {
        await scrapeGame(game);
    }
    console.log("All games are fully synced with Database!\n");
}

module.exports = { main };
