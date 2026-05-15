import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getPrizeTier } from '@/lib/prize-tiers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tickets/list?game=&status=pending|checked|won|all&limit=
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const game = searchParams.get('game');
        const status = searchParams.get('status') || 'all';
        const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);

        let sql = `SELECT * FROM confirmed_tickets WHERE expired = 0`;
        const params = [];

        if (game) { sql += ` AND game = ?`; params.push(game); }
        if (status === 'pending') sql += ` AND draws_checked < COALESCE(lock_for_draws, 1)`;
        if (status === 'checked') sql += ` AND draws_checked >= COALESCE(lock_for_draws, 1)`;
        if (status === 'won')     sql += ` AND id IN (SELECT ticket_id FROM ticket_checks WHERE prize_tier IS NOT NULL AND prize_tier != 'none')`;

        sql += ` ORDER BY id DESC LIMIT ?`;
        params.push(limit);

        const tickets = getDb().prepare(sql).all(...params);
        if (tickets.length === 0) return NextResponse.json({ success: true, count: 0, tickets: [] });

        // Bulk fetch checks for all tickets
        const ticketIds = tickets.map(t => t.id);
        const placeholders = ticketIds.map(() => '?').join(',');
        const allChecks = getDb().prepare(`
            SELECT * FROM ticket_checks WHERE ticket_id IN (${placeholders})
            ORDER BY CAST(draw_id AS INTEGER) ASC
        `).all(...ticketIds);

        const checksByTicket = {};
        for (const c of allChecks) {
            (checksByTicket[c.ticket_id] = checksByTicket[c.ticket_id] || []).push(c);
        }

        const out = tickets.map(t => {
            const checks = (checksByTicket[t.id] || []).map(c => ({
                checkId: c.id,
                drawId: c.draw_id,
                date: c.draw_date,
                drawBalls: (c.draw_balls || '').split(',').map(b => b.trim()).filter(Boolean),
                drawSpecial: c.draw_special,
                matchCount: c.match_count,
                matched: (c.matched_balls || '').split(',').filter(Boolean),
                specialMatch: !!c.special_match,
                prize: c.prize_tier ? getPrizeTier(c.prize_tier) : null,
                simulated: !!c.simulated,
                seen: !!c.seen,
                checkedAt: c.checked_at,
            }));
            const wins = checks.filter(c => c.prize && c.prize.id !== 'none');
            const bestPrize = wins.length > 0
                ? wins.reduce((best, c) => (c.prize.rank < (best?.prize?.rank ?? 99) ? c : best), null)
                : null;
            return {
                id: t.id,
                game: t.game,
                mainBalls: t.main_balls.split(',').map(b => b.trim()),
                specialBall: t.special_ball,
                algorithm: t.algorithm,
                note: t.note,
                confirmedAt: t.confirmed_at,
                lockForDraws: t.lock_for_draws || 1,
                drawsChecked: t.draws_checked || 0,
                drawsRemaining: Math.max(0, (t.lock_for_draws || 1) - (t.draws_checked || 0)),
                status: (t.draws_checked || 0) >= (t.lock_for_draws || 1) ? 'completed' : 'pending',
                parentTicketId: t.parent_ticket_id,
                checks,
                winCount: wins.length,
                bestPrize: bestPrize?.prize || null,
            };
        });

        return NextResponse.json({ success: true, count: out.length, tickets: out });
    } catch (e) {
        console.error('[tickets/list]', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const clearAll = searchParams.get('clearAll');
        const clearSimulated = searchParams.get('clearSimulated');

        const db = getDb();

        if (clearSimulated) {
            // Wipe simulated checks (test data cleanup)
            const r = db.prepare(`DELETE FROM ticket_checks WHERE simulated = 1`).run();
            return NextResponse.json({ success: true, deletedChecks: r.changes });
        }
        if (clearAll) {
            const r = db.prepare(`UPDATE confirmed_tickets SET expired = 1`).run();
            return NextResponse.json({ success: true, deleted: r.changes });
        }
        if (id) {
            const r = db.prepare(`UPDATE confirmed_tickets SET expired = 1 WHERE id = ?`).run(id);
            return NextResponse.json({ success: r.changes > 0 });
        }
        return NextResponse.json({ error: 'Missing id, clearAll, or clearSimulated' }, { status: 400 });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
