import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isValidGame, getGame } from '@/lib/games';

export const dynamic = 'force-dynamic';

const MAX_LOCK_DRAWS = 20;

/**
 * POST /api/tickets/confirm
 * Body: { game, mainBalls, specialBall?, algorithm?, breakdown?, note?, lockForDraws? }
 *
 * lockForDraws (default 1): how many UPCOMING draws this ticket commits to.
 *   If 3, the ticket auto-checks against the next 3 draws of this game.
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { game, mainBalls, specialBall, algorithm, breakdown, note, lockForDraws, parentTicketId } = body;

        if (!isValidGame(game)) {
            return NextResponse.json({ error: 'Game không hợp lệ' }, { status: 400 });
        }
        const cfg = getGame(game);
        if (!cfg.ballCount) {
            return NextResponse.json({ error: 'Game này chưa hỗ trợ chốt số' }, { status: 400 });
        }
        if (!Array.isArray(mainBalls) || mainBalls.length < cfg.ballCount) {
            return NextResponse.json({ error: `Cần ít nhất ${cfg.ballCount} số` }, { status: 400 });
        }

        const lockN = Math.max(1, Math.min(parseInt(lockForDraws, 10) || 1, MAX_LOCK_DRAWS));

        const normalized = Array.from(new Set(
            mainBalls.map(b => String(b).trim().padStart(2, '0'))
        )).sort();

        const sb = specialBall ? String(specialBall).trim().padStart(2, '0') : null;

        const info = getDb().prepare(`
            INSERT INTO confirmed_tickets
              (game, main_balls, special_ball, algorithm, breakdown_json, note,
               lock_for_draws, draws_checked, parent_ticket_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
        `).run(
            game,
            normalized.join(', '),
            sb,
            algorithm || null,
            breakdown ? JSON.stringify(breakdown) : null,
            note || null,
            lockN,
            parentTicketId || null
        );

        return NextResponse.json({
            success: true,
            ticketId: info.lastInsertRowid,
            ticket: {
                id: info.lastInsertRowid,
                game,
                main_balls: normalized.join(', '),
                special_ball: sb,
                lock_for_draws: lockN,
                parent_ticket_id: parentTicketId || null,
            },
        });
    } catch (e) {
        console.error('[tickets/confirm]', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
