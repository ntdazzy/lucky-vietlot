const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'vietlott.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS draws_535 (
    id TEXT PRIMARY KEY,
    date TEXT,
    draw_id TEXT,
    balls TEXT
  )
`);

console.log('Table draws_535 created/verified');

// Check if data exists
const count = db.prepare('SELECT COUNT(*) as n FROM draws_535').get();
console.log(`Existing 5/35 draws: ${count.n}`);

db.close();
