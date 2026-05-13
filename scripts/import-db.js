const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '../vietlott.db');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
    CREATE TABLE IF NOT EXISTS draws_645 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        draw_id TEXT UNIQUE,
        balls TEXT
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS draws_655 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        draw_id TEXT UNIQUE,
        balls TEXT,
        special_ball TEXT
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS draws_max3dpro (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        draw_id TEXT UNIQUE,
        dac_biet TEXT,
        nhat TEXT,
        nhi TEXT,
        ba TEXT
    )
`);

const insert645 = db.prepare('INSERT OR IGNORE INTO draws_645 (date, draw_id, balls) VALUES (?, ?, ?)');
const insert655 = db.prepare('INSERT OR IGNORE INTO draws_655 (date, draw_id, balls, special_ball) VALUES (?, ?, ?, ?)');
const insertMax3dpro = db.prepare('INSERT OR IGNORE INTO draws_max3dpro (date, draw_id, dac_biet, nhat, nhi, ba) VALUES (?, ?, ?, ?, ?, ?)');

function formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
    }
    return dateStr;
}

function processCSV(filePath, processRow) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) {
            console.log(`File not found: ${filePath}`);
            resolve();
            return;
        }
        
        let count = 0;
        const processChunk = db.transaction((rows) => {
            for (const row of rows) {
                processRow(row);
                count++;
            }
        });

        const rows = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                rows.push(row);
                if (rows.length >= 100) {
                    processChunk(rows);
                    rows.length = 0;
                }
            })
            .on('end', () => {
                if (rows.length > 0) {
                    processChunk(rows);
                }
                console.log(`Finished processing ${filePath}. Total: ${count}`);
                resolve();
            })
            .on('error', reject);
    });
}

async function run() {
    console.log("Importing Mega 6/45...");
    await processCSV(path.join(__dirname, '../../vietlott_scraper/vietlott_645.csv'), (row) => {
        const date = formatDate(row['Ngày']);
        const draw_id = row['Kỳ quay'];
        if (draw_id) {
            insert645.run(date, draw_id, row['Bộ số trúng']);
        }
    });

    console.log("Importing Power 6/55...");
    await processCSV(path.join(__dirname, '../../vietlott_scraper/vietlott_655.csv'), (row) => {
        const date = formatDate(row['Ngày']);
        const draw_id = row['Kỳ quay'];
        if (draw_id) {
            insert655.run(date, draw_id, row['Bộ số trúng'], row['Số đặc biệt']);
        }
    });

    console.log("Importing Max 3D Pro...");
    await processCSV(path.join(__dirname, '../../vietlott_scraper/vietlott_max3dpro.csv'), (row) => {
        const date = formatDate(row['Ngày']);
        const draw_id = row['Kỳ quay'];
        if (draw_id) {
            insertMax3dpro.run(date, draw_id, row['Đặc biệt'], row['Nhất'], row['Nhì'], row['Ba']);
        }
    });

    console.log("Import complete.");
}

run().catch(console.error);
