// ============================================================================
// TICKET CHECKER — Match locked-in tickets against upcoming draws
// ----------------------------------------------------------------------------
// Multi-draw lock model:
//   - confirmed_tickets.lock_for_draws  = how many future draws this ticket
//                                          should be checked against
//   - confirmed_tickets.draws_checked   = how many we've already checked
//   - ticket_checks                     = one row per check result
//
// A ticket is "pending" when draws_checked < lock_for_draws and at least one
// new draw exists after the last check (or after confirmed_at if never
// checked).
// ============================================================================

import { getDb } from './db.js';
import { computePrize } from './prize-tiers.js';
import { getGame } from './games.js';

function parseVietDate(s) {
    if (!s) return 0;
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return 0;
    return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10)).getTime();
}

function parseConfirmedAt(s) {
    if (!s) return 0;
    const t = Date.parse(s.replace(' ', 'T'));
    return isFinite(t) ? t : 0;
}

/**
 * Get the next draw(s) for `game` that happened AFTER `afterTime` (epoch ms)
 * and weren't already checked by `ticketId`. Returns sorted by date ASC.
 */
function findUnseenDrawsForTicket(game, ticketId, afterTime, maxResults = 10) {
    const cfg = getGame(game);
    if (!cfg) return [];
    const cols = `draw_id, date, balls${game === '655' ? ', special_ball' : ''}`;
    const rows = getDb()
        .prepare(`SELECT ${cols} FROM ${cfg.tableName} ORDER BY CAST(draw_id AS INTEGER) ASC`)
        .all();

    const alreadyChecked = new Set(
        getDb().prepare(`SELECT draw_id FROM ticket_checks WHERE ticket_id = ?`)
            .all(ticketId).map(r => r.draw_id)
    );

    const out = [];
    for (const row of rows) {
        const drawTime = parseVietDate(row.date);
        // Allow same-day-or-after (some timezone slack)
        if (drawTime + 86400000 < afterTime) continue;
        if (alreadyChecked.has(row.draw_id)) continue;
        out.push(row);
        if (out.length >= maxResults) break;
    }
    return out;
}

/**
 * Pure function — match a ticket against one draw.
 */
export function matchTicketAgainstDraw(ticket, draw, game) {
    const ticketMain = ticket.main_balls.split(',').map(b => b.trim());
    const ticketSpecial = ticket.special_ball?.trim() || null;
    const drawMain = (draw.balls || '').split(',').map(b => b.trim()).filter(Boolean);
    const drawSpecial = draw.special_ball?.trim() || null;

    const drawSet = new Set(drawMain);
    const matched = ticketMain.filter(b => drawSet.has(b));
    const matchCount = matched.length;
    const specialMatch = !!(ticketSpecial && drawSpecial && ticketSpecial === drawSpecial);
    const prize = computePrize(game, matchCount, specialMatch);

    return { matchCount, matched, specialMatch, prize, drawMain, drawSpecial };
}

const INSERT_CHECK = `
    INSERT INTO ticket_checks
      (ticket_id, draw_id, draw_date, draw_balls, draw_special,
       match_count, matched_balls, special_match,
       prize_tier, prize_label, seen, simulated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
`;

const UPDATE_TICKET_PROGRESS = `
    UPDATE confirmed_tickets
    SET draws_checked = draws_checked + 1
    WHERE id = ?
`;

/**
 * Run checks for all PENDING tickets in a game. A ticket is pending when:
 *   - draws_checked < lock_for_draws
 *   - and there's at least one new draw it hasn't seen
 *
 * Returns array of new check records created (one per new check).
 */
export function checkPendingTicketsForGame(game) {
    const db = getDb();

    const pendingTickets = db.prepare(`
        SELECT * FROM confirmed_tickets
        WHERE game = ?
          AND expired = 0
          AND draws_checked < COALESCE(lock_for_draws, 1)
    `).all(game);

    if (pendingTickets.length === 0) return [];

    const newChecks = [];
    const insertStmt = db.prepare(INSERT_CHECK);
    const progressStmt = db.prepare(UPDATE_TICKET_PROGRESS);

    for (const ticket of pendingTickets) {
        const remaining = (ticket.lock_for_draws || 1) - (ticket.draws_checked || 0);
        if (remaining <= 0) continue;

        const confirmTime = parseConfirmedAt(ticket.confirmed_at);
        const draws = findUnseenDrawsForTicket(game, ticket.id, confirmTime, remaining);
        if (draws.length === 0) continue;

        for (const draw of draws) {
            const m = matchTicketAgainstDraw(ticket, draw, game);
            const info = insertStmt.run(
                ticket.id,
                draw.draw_id, draw.date, draw.balls || '', draw.special_ball || null,
                m.matchCount, m.matched.join(','), m.specialMatch ? 1 : 0,
                m.prize.id, m.prize.label,
                0 // not simulated
            );
            progressStmt.run(ticket.id);

            newChecks.push({
                checkId: info.lastInsertRowid,
                ticketId: ticket.id,
                game,
                drawId: draw.draw_id,
                drawDate: draw.date,
                drawBalls: m.drawMain,
                drawSpecial: m.drawSpecial,
                mainBalls: ticket.main_balls.split(',').map(b => b.trim()),
                ticketSpecial: ticket.special_ball,
                matchCount: m.matchCount,
                matched: m.matched,
                specialMatch: m.specialMatch,
                prize: m.prize,
            });
        }
    }
    return newChecks;
}

export function checkAllPendingTickets() {
    const games = ['645', '655', '535'];
    const all = [];
    for (const g of games) {
        try { all.push(...checkPendingTicketsForGame(g)); }
        catch (e) { console.error(`[ticket-checker] ${g}:`, e.message); }
    }
    return all;
}

/**
 * Tickets that still have draws_remaining > 0 (no new check this round).
 */
export function getPendingTickets(game = null) {
    let sql = `
        SELECT * FROM confirmed_tickets
        WHERE expired = 0 AND draws_checked < COALESCE(lock_for_draws, 1)
    `;
    const params = [];
    if (game) { sql += ` AND game = ?`; params.push(game); }
    sql += ` ORDER BY id DESC`;
    return getDb().prepare(sql).all(...params);
}

/**
 * Returns checks that have a prize and haven't been seen yet by the user.
 * Used by NotificationListener.
 */
export function getUnseenPrizes() {
    return getDb().prepare(`
        SELECT
            c.id          AS check_id,
            c.ticket_id   AS id,
            c.draw_id     AS checked_against_draw_id,
            c.draw_date   AS checked_against_date,
            c.draw_balls  AS checked_against_balls,
            c.draw_special AS checked_against_special,
            c.match_count, c.matched_balls, c.special_match,
            c.prize_tier, c.prize_label, c.simulated,
            t.game, t.main_balls, t.special_ball, t.confirmed_at, t.algorithm
        FROM ticket_checks c
        JOIN confirmed_tickets t ON t.id = c.ticket_id
        WHERE c.prize_tier IS NOT NULL
          AND c.prize_tier != 'none'
          AND c.seen = 0
          AND t.expired = 0
        ORDER BY c.id DESC
    `).all();
}

export function markPrizesSeen(checkIds) {
    if (!checkIds || checkIds.length === 0) return 0;
    const placeholders = checkIds.map(() => '?').join(',');
    const r = getDb().prepare(
        `UPDATE ticket_checks SET seen = 1 WHERE id IN (${placeholders})`
    ).run(...checkIds);
    return r.changes;
}

/**
 * Get all check history for one ticket (used by /ket-qua/[id])
 */
export function getTicketChecks(ticketId) {
    return getDb().prepare(`
        SELECT * FROM ticket_checks
        WHERE ticket_id = ?
        ORDER BY CAST(draw_id AS INTEGER) ASC
    `).all(ticketId);
}

/**
 * SIMULATOR — does not require a real draw to exist. Writes a check row
 * (simulated=1) when persist=true.
 */
export function simulateDrawAgainstTickets(game, fakeDraw, options = {}) {
    const cfg = getGame(game);
    if (!cfg) throw new Error(`Invalid game: ${game}`);

    const db = getDb();
    const tickets = db.prepare(`
        SELECT * FROM confirmed_tickets
        WHERE game = ? AND expired = 0
        ORDER BY id DESC LIMIT 100
    `).all(game);

    const results = [];
    const fakeId = fakeDraw.drawId || 'SIM-' + Date.now();
    const fakeDate = fakeDraw.date || new Date().toLocaleDateString('vi-VN');
    const insertStmt = db.prepare(INSERT_CHECK);
    const progressStmt = db.prepare(UPDATE_TICKET_PROGRESS);

    for (const t of tickets) {
        const m = matchTicketAgainstDraw(t, fakeDraw, game);
        const out = {
            ticketId: t.id, game, drawId: fakeId, drawDate: fakeDate,
            mainBalls: t.main_balls.split(',').map(b => b.trim()),
            ticketSpecial: t.special_ball,
            drawBalls: m.drawMain,
            drawSpecial: m.drawSpecial,
            matchCount: m.matchCount, matched: m.matched, specialMatch: m.specialMatch,
            prize: m.prize, simulated: true,
        };
        results.push(out);

        if (options.persist) {
            const info = insertStmt.run(
                t.id, fakeId, fakeDate, fakeDraw.balls || '', fakeDraw.special_ball || null,
                m.matchCount, m.matched.join(','), m.specialMatch ? 1 : 0,
                m.prize.id, m.prize.label, 1
            );
            progressStmt.run(t.id);
            out.checkId = info.lastInsertRowid;
        }
    }
    return results;
}
