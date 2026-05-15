import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const MAX_LOCK_DRAWS = 20;

/**
 * POST /api/tickets/clone
 * Body: { sourceTicketId, lockForDraws? }
 *
 * Creates a NEW ticket with the same numbers as `sourceTicketId`, locked
 * for the next `lockForDraws` upcoming draws. The new ticket tracks its
 * source via parent_ticket_id.
 *
 * Useful for: "I want to lock my old bộ số again for next draw(s)."
 */
export async function POST(request) {
    try {
        const { sourceTicketId, lockForDraws } = await request.json();
        if (!sourceTicketId) {
            return NextResponse.json({ error: 'sourceTicketId required' }, { status: 400 });
        }

        const db = getDb();
        const source = db.prepare(`SELECT * FROM confirmed_tickets WHERE id = ?`).get(sourceTicketId);
        if (!source) {
            return NextResponse.json({ error: 'Source ticket not found' }, { status: 404 });
        }

        const lockN = Math.max(1, Math.min(parseInt(lockForDraws, 10) || 1, MAX_LOCK_DRAWS));

        const info = db.prepare(`
            INSERT INTO confirmed_tickets
              (game, main_balls, special_ball, algorithm, breakdown_json, note,
               lock_for_draws, draws_checked, parent_ticket_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
        `).run(
            source.game,
            source.main_balls,
            source.special_ball,
            source.algorithm,
            source.breakdown_json,
            `Chốt lại từ vé #${sourceTicketId}`,
            lockN,
            sourceTicketId
        );

        return NextResponse.json({
            success: true,
            ticketId: info.lastInsertRowid,
            ticket: {
                id: info.lastInsertRowid,
                game: source.game,
                main_balls: source.main_balls,
                special_ball: source.special_ball,
                lock_for_draws: lockN,
                parent_ticket_id: sourceTicketId,
            },
        });
    } catch (e) {
        console.error('[tickets/clone]', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
