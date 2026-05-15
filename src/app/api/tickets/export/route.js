import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tickets/export
 * Returns a JSON dump of all confirmed_tickets + ticket_checks.
 * Use as backup or to migrate between machines.
 */
export async function GET() {
    try {
        const db = getDb();
        const tickets = db.prepare(`SELECT * FROM confirmed_tickets WHERE expired = 0`).all();
        const checks  = db.prepare(`SELECT * FROM ticket_checks WHERE ticket_id IN (SELECT id FROM confirmed_tickets WHERE expired = 0)`).all();

        return NextResponse.json({
            version: 1,
            exportedAt: new Date().toISOString(),
            counts: { tickets: tickets.length, checks: checks.length },
            tickets,
            checks,
        });
    } catch (e) {
        console.error('[tickets/export]', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
