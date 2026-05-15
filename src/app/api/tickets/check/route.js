import { NextResponse } from 'next/server';
import { checkAllPendingTickets, checkPendingTicketsForGame, getUnseenPrizes, markPrizesSeen } from '@/lib/ticket-checker';
import { isValidGame } from '@/lib/games';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tickets/check
 * Body: { game?: string }   — if absent, checks all games
 * Triggers re-check of pending tickets against latest draws.
 * Returns: { success, results: [...], winners: [...] }
 */
export async function POST(request) {
    try {
        let body = {};
        try { body = await request.json(); } catch {}
        const { game } = body;

        const results = game && isValidGame(game)
            ? checkPendingTicketsForGame(game)
            : checkAllPendingTickets();

        const winners = results.filter(r => r.prize?.id && r.prize.id !== 'none');
        return NextResponse.json({
            success: true,
            checked: results.length,
            winners,
            allResults: results,
        });
    } catch (e) {
        console.error('[tickets/check]', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

/**
 * GET /api/tickets/check?unseen=1
 * Returns prizes that haven't been acknowledged yet (for polling-based notifications)
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        if (searchParams.get('unseen') === '1') {
            const prizes = getUnseenPrizes();
            return NextResponse.json({ success: true, unseen: prizes });
        }
        return NextResponse.json({ error: 'Use POST to trigger check, or ?unseen=1 to list unseen prizes' }, { status: 400 });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

/**
 * PUT /api/tickets/check  — mark prize-check rows as seen
 * Body: { checkIds: number[] }  (id from ticket_checks)
 */
export async function PUT(request) {
    try {
        const body = await request.json();
        const ids = body.checkIds || body.ticketIds; // backward compat
        if (!Array.isArray(ids)) {
            return NextResponse.json({ error: 'checkIds must be array' }, { status: 400 });
        }
        const updated = markPrizesSeen(ids);
        return NextResponse.json({ success: true, updated });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
