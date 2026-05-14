import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { isValidGame, getGame } from './games.js';

// ============================================================================
// CONNECTION MANAGEMENT
// ----------------------------------------------------------------------------
// Strategy: ONE shared write-capable connection (WAL mode) for the whole
// Node process. Readonly endpoints reuse the same connection — better-sqlite3
// is synchronous and thread-safe within a single process. No more split
// readonly/write connections, which caused VACUUM lock failures.
// ============================================================================

let _db = null;
let _initialized = false;

function getDbPath() {
    if (process.env.RAILWAY_VOLUME_MOUNT_PATH) {
        const volumeDbPath = path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'vietlott.db');
        const localDbPath = path.join(process.cwd(), 'vietlott.db');
        // Bootstrap: copy bundled DB to persistent volume on first boot
        if (!fs.existsSync(volumeDbPath) && fs.existsSync(localDbPath)) {
            try {
                fs.copyFileSync(localDbPath, volumeDbPath);
                console.log('[db] Bootstrapped DB to volume');
            } catch (e) {
                console.error('[db] Bootstrap copy failed:', e.message);
            }
        }
        return volumeDbPath;
    }
    return path.join(process.cwd(), 'vietlott.db');
}

function hasUniqueOnDrawId(db, tableName) {
    // SQLite has no direct "is column UNIQUE" query — we read CREATE TABLE sql
    const row = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(tableName);
    if (!row?.sql) return false;
    // Looks for `draw_id <type> UNIQUE` (case-insensitive) in DDL
    return /draw_id\s+\w+\s+UNIQUE/i.test(row.sql);
}

/**
 * Rebuild table with proper schema (UNIQUE on draw_id) and dedupe in one shot.
 * SQLite cannot ALTER TABLE to add UNIQUE — we have to do the rename dance.
 */
function rebuildTableWithUniqueDrawId(db, tableName, columns, createDdl) {
    const tmpName = `${tableName}_new_${Date.now()}`;
    db.exec(createDdl.replace(tableName, tmpName));

    // Copy ONE row per draw_id (most-complete = longest balls string), preserving data
    const colList = columns.join(', ');
    const balls = columns.includes('balls') ? 'balls' : (columns.includes('dac_biet') ? 'dac_biet' : null);

    if (balls) {
        // Prefer rows with non-empty balls field
        db.exec(`
            INSERT INTO ${tmpName} (${colList})
            SELECT ${colList} FROM ${tableName} t1
            WHERE rowid = (
                SELECT t2.rowid FROM ${tableName} t2
                WHERE t2.draw_id = t1.draw_id
                ORDER BY LENGTH(COALESCE(t2.${balls}, '')) DESC, t2.rowid ASC
                LIMIT 1
            );
        `);
    } else {
        db.exec(`
            INSERT INTO ${tmpName} (${colList})
            SELECT ${colList} FROM ${tableName} t1
            WHERE rowid = (
                SELECT MIN(rowid) FROM ${tableName}
                WHERE draw_id = t1.draw_id
            );
        `);
    }

    db.exec(`DROP TABLE ${tableName};`);
    db.exec(`ALTER TABLE ${tmpName} RENAME TO ${tableName};`);
}

function migrateDuplicates(db) {
    const tables = [
        {
            name: 'draws_645',
            columns: ['date', 'draw_id', 'balls'],
            createDdl: `CREATE TABLE draws_645 (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT,
                draw_id TEXT UNIQUE,
                balls TEXT
            )`,
        },
        {
            name: 'draws_655',
            columns: ['date', 'draw_id', 'balls', 'special_ball'],
            createDdl: `CREATE TABLE draws_655 (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT,
                draw_id TEXT UNIQUE,
                balls TEXT,
                special_ball TEXT
            )`,
        },
        {
            name: 'draws_535',
            columns: ['date', 'draw_id', 'balls'],
            createDdl: `CREATE TABLE draws_535 (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT,
                draw_id TEXT UNIQUE,
                balls TEXT
            )`,
        },
        {
            name: 'draws_max3dpro',
            columns: ['date', 'draw_id', 'dac_biet', 'nhat', 'nhi', 'ba'],
            createDdl: `CREATE TABLE draws_max3dpro (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT,
                draw_id TEXT UNIQUE,
                dac_biet TEXT,
                nhat TEXT,
                nhi TEXT,
                ba TEXT
            )`,
        },
    ];

    for (const t of tables) {
        try {
            const exists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(t.name);
            if (!exists) continue;

            const total = db.prepare(`SELECT COUNT(*) AS n FROM ${t.name}`).get().n;
            const unique = db.prepare(`SELECT COUNT(DISTINCT draw_id) AS n FROM ${t.name}`).get().n;
            const hasUnique = hasUniqueOnDrawId(db, t.name);

            // Two trigger conditions: dupes exist, OR schema lacks UNIQUE (which would
            // let dupes re-accumulate on next sync)
            if (total > unique || !hasUnique) {
                console.log(`[db] Migrating ${t.name}: ${total} rows, ${unique} unique, hasUnique=${hasUnique}. Rebuilding...`);
                db.transaction(() => {
                    rebuildTableWithUniqueDrawId(db, t.name, t.columns, t.createDdl);
                })();
                const after = db.prepare(`SELECT COUNT(*) AS n FROM ${t.name}`).get().n;
                console.log(`[db] ${t.name}: now ${after} rows, UNIQUE constraint enforced.`);
            }
        } catch (e) {
            console.warn(`[db] Migration failed for ${t.name}:`, e.message);
        }
    }

    // Rebuild indexes (lost when tables rebuilt)
    try {
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_645_draw_id ON draws_645(draw_id);
            CREATE INDEX IF NOT EXISTS idx_655_draw_id ON draws_655(draw_id);
            CREATE INDEX IF NOT EXISTS idx_535_draw_id ON draws_535(draw_id);
            CREATE INDEX IF NOT EXISTS idx_max3dpro_draw_id ON draws_max3dpro(draw_id);
        `);
    } catch (e) {
        console.warn('[db] Index rebuild failed:', e.message);
    }
}

function ensureSchema(db) {
    // Idempotent. All tables use the same shape: integer PK + UNIQUE draw_id.
    db.exec(`
        CREATE TABLE IF NOT EXISTS draws_645 (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            draw_id TEXT UNIQUE,
            balls TEXT
        );
        CREATE TABLE IF NOT EXISTS draws_655 (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            draw_id TEXT UNIQUE,
            balls TEXT,
            special_ball TEXT
        );
        CREATE TABLE IF NOT EXISTS draws_535 (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            draw_id TEXT UNIQUE,
            balls TEXT
        );
        CREATE TABLE IF NOT EXISTS draws_max3dpro (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            draw_id TEXT UNIQUE,
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
        CREATE INDEX IF NOT EXISTS idx_645_draw_id ON draws_645(draw_id);
        CREATE INDEX IF NOT EXISTS idx_655_draw_id ON draws_655(draw_id);
        CREATE INDEX IF NOT EXISTS idx_535_draw_id ON draws_535(draw_id);
        CREATE INDEX IF NOT EXISTS idx_max3dpro_draw_id ON draws_max3dpro(draw_id);
        CREATE INDEX IF NOT EXISTS idx_history_game ON prediction_history(game, id DESC);
    `);
}

function openConnection() {
    const dbPath = getDbPath();
    // Always open read-write so we can create tables on fresh deploy.
    // fileMustExist: false allows creating new DB file if missing.
    const db = new Database(dbPath, { fileMustExist: false });

    // WAL mode = concurrent reads while writing, better throughput
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');     // Faster, still safe under WAL
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');      // Auto-retry on lock for 5s

    ensureSchema(db);
    migrateDuplicates(db);
    return db;
}

function getConnection() {
    if (!_db || !_db.open) {
        _db = openConnection();
        _initialized = true;
        console.log('[db] Connection opened:', getDbPath());
    }
    return _db;
}

// Public accessors — kept for backward-compat with callers
export function getDb() { return getConnection(); }
export function getDbWritable() { return getConnection(); }

// Close hook for graceful shutdown (Railway SIGTERM)
export function closeDb() {
    if (_db && _db.open) {
        try { _db.close(); } catch (e) { console.error('[db] Close error:', e.message); }
        _db = null;
        _initialized = false;
    }
}

if (typeof process !== 'undefined' && !process._dbHandlersRegistered) {
    process._dbHandlersRegistered = true;
    process.on('SIGTERM', closeDb);
    process.on('SIGINT', closeDb);
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

function validateGame(game) {
    if (!isValidGame(game)) throw new Error(`Invalid game: ${game}`);
    return getGame(game).tableName;
}

function safeQuery(fn, fallback) {
    try { return fn(); } catch (e) {
        console.error('[db] Query error:', e.message);
        return fallback;
    }
}

export function getLatestDraws(game, limit = 10) {
    const table = validateGame(game);
    return safeQuery(
        () => getDb().prepare(`SELECT * FROM ${table} ORDER BY CAST(draw_id AS INTEGER) DESC LIMIT ?`).all(limit),
        []
    );
}

export function getStats(game) {
    const table = validateGame(game);
    return safeQuery(() => {
        const allDraws = getDb().prepare(`SELECT balls FROM ${table} ORDER BY CAST(draw_id AS INTEGER) ASC`).all();
        const totalDraws = allDraws.length;
        if (totalDraws === 0) return [];

        const DECAY = 0.997;
        const frequencies = {};

        for (let i = 0; i < totalDraws; i++) {
            const balls = allDraws[i].balls;
            if (!balls) continue;
            const weight = Math.pow(DECAY, totalDraws - 1 - i);
            const parts = balls.split(',');
            for (let j = 0; j < parts.length; j++) {
                const p = parts[j].trim();
                if (!frequencies[p]) frequencies[p] = { number: p, count: 0, weightedScore: 0, lastSeen: -1 };
                frequencies[p].count++;
                frequencies[p].weightedScore += weight;
                frequencies[p].lastSeen = i;
            }
        }

        const result = Object.values(frequencies);
        for (const item of result) {
            item.gap = totalDraws - 1 - item.lastSeen;
            item.weightedScore = Math.round(item.weightedScore * 1000) / 1000;
        }
        return result.sort((a, b) => b.weightedScore - a.weightedScore);
    }, []);
}

export function getAdvancedStats(game) {
    const table = validateGame(game);
    const gameConfig = getGame(game);
    if (!gameConfig.ballCount) return null;

    return safeQuery(() => {
        const allDraws = getDb().prepare(`SELECT balls FROM ${table} ORDER BY CAST(draw_id AS INTEGER) DESC`).all();
        if (allDraws.length === 0) return null;

        const sums = [];
        const drawBalls = [];
        for (const draw of allDraws) {
            if (!draw.balls) continue;
            const balls = draw.balls.split(',').map(b => parseInt(b.trim(), 10));
            drawBalls.push(balls);
            sums.push(balls.reduce((a, b) => a + b, 0));
        }
        if (sums.length === 0) return null;

        const sumMean = sums.reduce((a, b) => a + b, 0) / sums.length;
        const sumVariance = sums.reduce((a, b) => a + Math.pow(b - sumMean, 2), 0) / sums.length;
        const sumStd = Math.sqrt(sumVariance);

        const ballCount = gameConfig.ballCount;
        const evenOddDist = {};
        for (const balls of drawBalls) {
            const evens = balls.filter(n => n % 2 === 0).length;
            const key = `${evens}/${ballCount - evens}`;
            evenOddDist[key] = (evenOddDist[key] || 0) + 1;
        }
        const totalForDist = drawBalls.length;
        for (const k of Object.keys(evenOddDist)) {
            evenOddDist[k] = Math.round((evenOddDist[k] / totalForDist) * 1000) / 10;
        }

        return {
            sumMin: Math.round(sumMean - sumStd),
            sumMax: Math.round(sumMean + sumStd),
            sumMean: Math.round(sumMean),
            sumStd: Math.round(sumStd),
            evenOddDist,
            totalDraws: allDraws.length,
            recentDrawBalls: drawBalls.slice(0, 5)
        };
    }, null);
}

export function getSpecialBallStats(game) {
    if (game !== '655') return [];
    return safeQuery(() => {
        const allDraws = getDb().prepare(`SELECT special_ball FROM draws_655 ORDER BY CAST(draw_id AS INTEGER) ASC`).all();
        const totalDraws = allDraws.length;
        if (totalDraws === 0) return [];

        const DECAY = 0.997;
        const frequencies = {};

        for (let i = 0; i < totalDraws; i++) {
            const sb = allDraws[i].special_ball?.trim();
            if (!sb) continue;
            const weight = Math.pow(DECAY, totalDraws - 1 - i);
            if (!frequencies[sb]) frequencies[sb] = { number: sb, count: 0, weightedScore: 0, lastSeen: -1 };
            frequencies[sb].count++;
            frequencies[sb].weightedScore += weight;
            frequencies[sb].lastSeen = i;
        }

        const result = Object.values(frequencies);
        for (const item of result) {
            item.gap = totalDraws - 1 - item.lastSeen;
            item.weightedScore = Math.round(item.weightedScore * 1000) / 1000;
        }
        return result.sort((a, b) => b.weightedScore - a.weightedScore);
    }, []);
}

export function getTransitionMatrix(game, windowSize = 3) {
    const table = validateGame(game);
    return safeQuery(() => {
        const allDraws = getDb().prepare(`SELECT balls FROM ${table} ORDER BY CAST(draw_id AS INTEGER) ASC`).all();
        if (allDraws.length < 2) return {};

        const transitions = {};
        for (let i = 1; i < allDraws.length; i++) {
            const prevBalls = new Set();
            for (let w = Math.max(0, i - windowSize); w < i; w++) {
                if (!allDraws[w].balls) continue;
                allDraws[w].balls.split(',').forEach(b => prevBalls.add(b.trim()));
            }
            if (!allDraws[i].balls) continue;
            const currBalls = allDraws[i].balls.split(',').map(b => b.trim());
            for (const prev of prevBalls) {
                if (!transitions[prev]) transitions[prev] = {};
                for (const curr of currBalls) {
                    transitions[prev][curr] = (transitions[prev][curr] || 0) + 1;
                }
            }
        }

        const normalized = {};
        for (const from of Object.keys(transitions)) {
            const total = Object.values(transitions[from]).reduce((s, v) => s + v, 0);
            normalized[from] = {};
            for (const to of Object.keys(transitions[from])) {
                normalized[from][to] = Math.round((transitions[from][to] / total) * 10000) / 10000;
            }
        }
        return normalized;
    }, {});
}

export function getDecadeDistribution(game) {
    const table = validateGame(game);
    const gameConfig = getGame(game);
    if (!gameConfig.maxBall) return null;

    return safeQuery(() => {
        const allDraws = getDb().prepare(`SELECT balls FROM ${table} ORDER BY CAST(draw_id AS INTEGER) DESC`).all();
        if (allDraws.length === 0) return null;

        const maxBall = gameConfig.maxBall;
        const ballCount = gameConfig.ballCount;
        const decades = {};
        for (let d = 0; d < maxBall; d += 10) {
            decades[`${d + 1}-${Math.min(d + 10, maxBall)}`] = { total: 0, draws: 0 };
        }

        const perDraw = [];
        for (const draw of allDraws) {
            if (!draw.balls) continue;
            const balls = draw.balls.split(',').map(b => parseInt(b.trim(), 10));
            const dist = {};
            for (const b of balls) {
                const dIdx = Math.floor((b - 1) / 10) * 10;
                const label = `${dIdx + 1}-${Math.min(dIdx + 10, maxBall)}`;
                decades[label].total++;
                dist[label] = (dist[label] || 0) + 1;
            }
            perDraw.push(dist);
            for (const label of Object.keys(dist)) decades[label].draws++;
        }

        const totalBalls = allDraws.length * ballCount;
        const result = {};
        for (const [label, data] of Object.entries(decades)) {
            result[label] = {
                avgPerDraw: Math.round((data.total / allDraws.length) * 100) / 100,
                pctTotal: Math.round((data.total / totalBalls) * 1000) / 10,
                appearsInPct: Math.round((data.draws / allDraws.length) * 1000) / 10
            };
        }

        const recentDist = perDraw.slice(0, 50);
        const recentResult = {};
        for (const label of Object.keys(decades)) {
            let rTotal = 0;
            for (const d of recentDist) rTotal += d[label] || 0;
            recentResult[label] = {
                avgPerDraw: recentDist.length > 0 ? Math.round((rTotal / recentDist.length) * 100) / 100 : 0
            };
        }

        return { overall: result, recent: recentResult };
    }, null);
}

export function getDeltaPatterns(game) {
    const table = validateGame(game);
    const gameConfig = getGame(game);
    if (!gameConfig.ballCount) return null;

    return safeQuery(() => {
        const allDraws = getDb().prepare(`SELECT balls FROM ${table} ORDER BY CAST(draw_id AS INTEGER) DESC`).all();
        if (allDraws.length === 0) return null;

        const deltas = [];
        for (const draw of allDraws) {
            if (!draw.balls) continue;
            const balls = draw.balls.split(',').map(b => parseInt(b.trim(), 10)).sort((a, b) => a - b);
            const d = [];
            for (let i = 1; i < balls.length; i++) d.push(balls[i] - balls[i - 1]);
            deltas.push(d);
        }

        if (deltas.length === 0) return null;

        const deltaCount = gameConfig.ballCount - 1;
        const avgDeltas = [];
        for (let pos = 0; pos < deltaCount; pos++) {
            const vals = deltas.map(d => d[pos]).filter(Boolean);
            if (vals.length === 0) continue;
            const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
            const std = Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length);
            avgDeltas.push({ position: pos, mean: Math.round(mean * 10) / 10, std: Math.round(std * 10) / 10 });
        }

        const spreadStats = deltas.map(d => d.reduce((a, b) => a + b, 0));
        const spreadMean = spreadStats.reduce((a, b) => a + b, 0) / spreadStats.length;
        const spreadStd = Math.sqrt(spreadStats.reduce((a, b) => a + Math.pow(b - spreadMean, 2), 0) / spreadStats.length);

        return {
            avgDeltas,
            spreadMean: Math.round(spreadMean * 10) / 10,
            spreadStd: Math.round(spreadStd * 10) / 10,
            spreadMin: Math.round(spreadMean - spreadStd),
            spreadMax: Math.round(spreadMean + spreadStd)
        };
    }, null);
}

export function findDuplicateSets(game, minOccurrences = 2) {
    const table = validateGame(game);
    return safeQuery(() => {
        const allDraws = getDb().prepare(`SELECT draw_id, date, balls FROM ${table} ORDER BY CAST(draw_id AS INTEGER) DESC`).all();
        const setMap = {};
        for (const draw of allDraws) {
            if (!draw.balls) continue;
            const key = draw.balls.split(',').map(b => b.trim()).sort((a, b) => parseInt(a) - parseInt(b)).join(',');
            if (!setMap[key]) setMap[key] = [];
            setMap[key].push({ draw_id: draw.draw_id, date: draw.date });
        }
        return Object.entries(setMap)
            .filter(([, v]) => v.length >= minOccurrences)
            .map(([balls, draws]) => ({ balls: balls.split(','), count: draws.length, draws }))
            .sort((a, b) => b.count - a.count);
    }, []);
}

export function searchExactSet(game, numbers) {
    const table = validateGame(game);
    return safeQuery(() => {
        const sorted = numbers.map(n => n.toString().padStart(2, '0')).sort((a, b) => parseInt(a) - parseInt(b));
        const allDraws = getDb().prepare(`SELECT * FROM ${table} ORDER BY CAST(draw_id AS INTEGER) DESC`).all();
        const matches = [];
        for (const draw of allDraws) {
            if (!draw.balls) continue;
            const drawBalls = draw.balls.split(',').map(b => b.trim()).sort((a, b) => parseInt(a) - parseInt(b));
            let matchCount = 0;
            for (const n of sorted) {
                if (drawBalls.includes(n)) matchCount++;
            }
            if (matchCount >= 3) {
                matches.push({ ...draw, matchCount, totalInput: sorted.length });
            }
        }
        return matches.sort((a, b) => b.matchCount - a.matchCount || parseInt(b.draw_id) - parseInt(a.draw_id));
    }, []);
}

export function backtestStrategy(game, strategyFn, testWindow = 100) {
    const table = validateGame(game);
    const gameConfig = getGame(game);
    if (!gameConfig.ballCount) return null;

    return safeQuery(() => {
        const allDraws = getDb().prepare(`SELECT balls FROM ${table} ORDER BY CAST(draw_id AS INTEGER) ASC`).all().filter(d => d.balls);
        if (allDraws.length < testWindow + 50) return null;

        const trainEnd = allDraws.length - testWindow;
        const ballCount = gameConfig.ballCount;
        const hits = {};
        for (let m = 3; m <= ballCount; m++) hits[`match${m}`] = 0;
        hits.totalMatched = 0;

        for (let i = trainEnd; i < allDraws.length; i++) {
            const actual = new Set(allDraws[i].balls.split(',').map(b => b.trim()));
            const predicted = strategyFn(allDraws.slice(0, i), game);
            let matchCount = 0;
            for (const p of predicted) { if (actual.has(p)) matchCount++; }
            for (let m = 3; m <= ballCount; m++) { if (matchCount >= m) hits[`match${m}`]++; }
            hits.totalMatched += matchCount;
        }

        const result = { tested: testWindow, avgMatch: Math.round((hits.totalMatched / testWindow) * 100) / 100 };
        for (let m = 3; m <= ballCount; m++) {
            result[`match${m}Rate`] = Math.round((hits[`match${m}`] / testWindow) * 1000) / 10;
        }
        return result;
    }, null);
}

// ============================================================================
// PREDICTION HISTORY
// ============================================================================

export function savePredictionHistory(game, prediction) {
    if (!isValidGame(game)) return null;
    try {
        const info = getDb().prepare(`
            INSERT INTO prediction_history (game, main, special, breakdown_sum, breakdown_evens, breakdown_spread, breakdown_decades, confidence, attempts)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            game,
            prediction.main.join(', '),
            prediction.special || null,
            prediction.breakdown?.sum || null,
            prediction.breakdown?.evens || null,
            prediction.breakdown?.spread || null,
            prediction.breakdown?.decadeCount || null,
            prediction.confidence || 0,
            prediction.attempts || 0
        );
        return info.lastInsertRowid;
    } catch (e) {
        console.error('[db] savePredictionHistory:', e.message);
        return null;
    }
}

export function getPredictionHistory(game, limit = 50) {
    if (!isValidGame(game)) return [];
    return safeQuery(
        () => getDb().prepare(`SELECT * FROM prediction_history WHERE game = ? ORDER BY id DESC LIMIT ?`).all(game, limit),
        []
    );
}

export function clearPredictionHistory(game) {
    if (!isValidGame(game)) return false;
    try {
        getDb().prepare(`DELETE FROM prediction_history WHERE game = ?`).run(game);
        return true;
    } catch (e) {
        console.error('[db] clearPredictionHistory:', e.message);
        return false;
    }
}

export function deletePredictionById(id) {
    try {
        getDb().prepare(`DELETE FROM prediction_history WHERE id = ?`).run(id);
        return true;
    } catch (e) {
        console.error('[db] deletePredictionById:', e.message);
        return false;
    }
}

// ============================================================================
// CHART DATA
// ============================================================================

export function getSumDistribution(game) {
    const table = validateGame(game);
    const gameConfig = getGame(game);
    if (!gameConfig.ballCount) return [];

    return safeQuery(() => {
        const allDraws = getDb().prepare(`SELECT balls FROM ${table} ORDER BY CAST(draw_id AS INTEGER) ASC`).all();
        const sums = [];
        for (const draw of allDraws) {
            if (!draw.balls) continue;
            const balls = draw.balls.split(',').map(b => parseInt(b.trim(), 10));
            sums.push(balls.reduce((a, b) => a + b, 0));
        }
        if (sums.length === 0) return [];

        const min = Math.floor(Math.min(...sums) / 10) * 10;
        const max = Math.ceil(Math.max(...sums) / 10) * 10;
        const buckets = {};
        for (let b = min; b <= max; b += 10) {
            buckets[`${b}-${b + 9}`] = 0;
        }
        for (const s of sums) {
            const bk = Math.floor(s / 10) * 10;
            const key = `${bk}-${bk + 9}`;
            if (buckets[key] !== undefined) buckets[key]++;
        }
        return Object.entries(buckets).map(([range, count]) => ({ range, count }));
    }, []);
}

export function getTrendData(game, windowSize = 50) {
    const table = validateGame(game);
    const gameConfig = getGame(game);
    if (!gameConfig.ballCount) return [];

    return safeQuery(() => {
        const allDraws = getDb().prepare(`SELECT draw_id, date, balls FROM ${table} ORDER BY CAST(draw_id AS INTEGER) ASC`).all();
        if (allDraws.length < windowSize) return [];

        const results = [];
        const step = Math.max(1, Math.floor(windowSize / 5));
        for (let i = windowSize; i <= allDraws.length; i += step) {
            const window = allDraws.slice(i - windowSize, i);
            const freq = {};
            let totalSum = 0;
            let totalEvens = 0;
            let drawCount = 0;

            for (const draw of window) {
                if (!draw.balls) continue;
                const balls = draw.balls.split(',').map(b => parseInt(b.trim(), 10));
                totalSum += balls.reduce((a, b) => a + b, 0);
                totalEvens += balls.filter(n => n % 2 === 0).length;
                drawCount++;
                for (const b of balls) {
                    const key = b.toString().padStart(2, '0');
                    freq[key] = (freq[key] || 0) + 1;
                }
            }
            if (drawCount === 0) continue;

            const sortedFreq = Object.entries(freq).sort((a, b) => b[1] - a[1]);
            results.push({
                drawId: allDraws[i - 1].draw_id,
                date: allDraws[i - 1].date,
                avgSum: Math.round(totalSum / drawCount),
                evenRatio: Math.round((totalEvens / (drawCount * gameConfig.ballCount)) * 100),
                hot1: sortedFreq[0]?.[0] || '',
                hot2: sortedFreq[1]?.[0] || '',
                hot3: sortedFreq[2]?.[0] || '',
            });
        }
        return results;
    }, []);
}

export function getEvenOddDistribution(game) {
    const table = validateGame(game);
    const gameConfig = getGame(game);
    if (!gameConfig.ballCount) return [];

    return safeQuery(() => {
        const allDraws = getDb().prepare(`SELECT balls FROM ${table}`).all();
        const ballCount = gameConfig.ballCount;
        const dist = {};

        for (const draw of allDraws) {
            if (!draw.balls) continue;
            const balls = draw.balls.split(',').map(b => parseInt(b.trim(), 10));
            const evens = balls.filter(n => n % 2 === 0).length;
            const key = `${evens}C/${ballCount - evens}L`;
            dist[key] = (dist[key] || 0) + 1;
        }

        const total = Object.values(dist).reduce((s, v) => s + v, 0);
        if (total === 0) return [];
        return Object.entries(dist)
            .map(([name, value]) => ({ name, value, pct: Math.round((value / total) * 1000) / 10 }))
            .sort((a, b) => b.value - a.value);
    }, []);
}

// ============================================================================
// SYNC HELPERS — used by /api/sync-all and /api/update
// ----------------------------------------------------------------------------
// Single-place INSERT logic. Always idempotent (INSERT OR IGNORE on
// UNIQUE draw_id). Never deletes existing data.
// ============================================================================

export function upsertDraw(game, data) {
    const db = getDb();
    switch (game) {
        case '645':
            return db.prepare(`INSERT OR IGNORE INTO draws_645 (date, draw_id, balls) VALUES (?, ?, ?)`)
                     .run(data.date, data.drawId, data.balls);
        case '655':
            return db.prepare(`INSERT OR IGNORE INTO draws_655 (date, draw_id, balls, special_ball) VALUES (?, ?, ?, ?)`)
                     .run(data.date, data.drawId, data.balls, data.special_ball);
        case '535':
            return db.prepare(`INSERT OR IGNORE INTO draws_535 (date, draw_id, balls) VALUES (?, ?, ?)`)
                     .run(data.date, data.drawId, data.balls);
        case 'max3dpro':
            return db.prepare(`INSERT OR IGNORE INTO draws_max3dpro (date, draw_id, dac_biet, nhat, nhi, ba) VALUES (?, ?, ?, ?, ?, ?)`)
                     .run(data.date, data.drawId, data.dac_biet, data.nhat, data.nhi, data.ba);
        default:
            throw new Error(`Unknown game: ${game}`);
    }
}

export function countDraws(game) {
    const table = validateGame(game);
    return safeQuery(
        () => getDb().prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n,
        0
    );
}
