import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isValidGame } from '@/lib/games';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tickets/import
 * Body: { version, tickets: [...], checks: [...] }
 * Inserts tickets that don't already exist (by main_balls + game + confirmed_at).
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const tickets = Array.isArray(body.tickets) ? body.tickets : [];
        const checks  = Array.isArray(body.checks)  ? body.checks  : [];

        if (tickets.length === 0) {
            return NextResponse.json({ error: 'Không có vé nào để nhập' }, { status: 400 });
        }

        const db = getDb();

        // Map oldTicketId → newTicketId so we can re-link checks
        const idMap = {};
        let imported = 0, skipped = 0, errors = 0;

        const insertTicket = db.prepare(`
            INSERT INTO confirmed_tickets
              (game, main_balls, special_ball, algorithm, breakdown_json, note,
               confirmed_at, lock_for_draws, draws_checked, parent_ticket_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        // Only consider non-expired tickets as duplicates — soft-deleted tickets
        // can be re-imported (user explicitly asked to restore).
        const findDup = db.prepare(`
            SELECT id FROM confirmed_tickets
            WHERE game = ? AND main_balls = ? AND confirmed_at = ? AND expired = 0
            LIMIT 1
        `);

        const tx = db.transaction(() => {
            for (const t of tickets) {
                if (!t || !isValidGame(t.game) || !t.main_balls) { errors++; continue; }
                const dup = findDup.get(t.game, t.main_balls, t.confirmed_at);
                if (dup) {
                    idMap[t.id] = dup.id;
                    skipped++;
                    continue;
                }
                const info = insertTicket.run(
                    t.game,
                    t.main_balls,
                    t.special_ball || null,
                    t.algorithm || null,
                    t.breakdown_json || null,
                    t.note || null,
                    t.confirmed_at || null,
                    t.lock_for_draws || 1,
                    0, // start with 0 checks; will be re-inserted below
                    null // parent link reset (cross-import isn't preserved)
                );
                idMap[t.id] = info.lastInsertRowid;
                imported++;
            }
        });
        tx();

        // Re-insert checks
        const insertCheck = db.prepare(`
            INSERT INTO ticket_checks
              (ticket_id, draw_id, draw_date, draw_balls, draw_special,
               match_count, matched_balls, special_match,
               prize_tier, prize_label, seen, simulated, checked_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        let checkCount = 0;
        const findCheckDup = db.prepare(`
            SELECT id FROM ticket_checks WHERE ticket_id = ? AND draw_id = ? LIMIT 1
        `);
        const checkTx = db.transaction(() => {
            for (const c of checks) {
                const newTicketId = idMap[c.ticket_id];
                if (!newTicketId) continue;
                if (findCheckDup.get(newTicketId, c.draw_id)) continue;
                insertCheck.run(
                    newTicketId,
                    c.draw_id, c.draw_date,
                    c.draw_balls || '', c.draw_special || null,
                    c.match_count || 0,
                    c.matched_balls || '',
                    c.special_match || 0,
                    c.prize_tier || null, c.prize_label || null,
                    c.seen || 0, c.simulated || 0,
                    c.checked_at || null
                );
                checkCount++;
            }
            // Update draws_checked counter
            db.prepare(`
                UPDATE confirmed_tickets SET draws_checked = (
                    SELECT COUNT(*) FROM ticket_checks WHERE ticket_id = confirmed_tickets.id
                )
            `).run();
        });
        checkTx();

        return NextResponse.json({
            success: true,
            imported,
            skipped,
            errors,
            checksRestored: checkCount,
        });
    } catch (e) {
        console.error('[tickets/import]', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
