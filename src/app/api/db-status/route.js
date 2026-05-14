import { NextResponse } from 'next/server';
import { countDraws } from '@/lib/db';
import { getAllGames } from '@/lib/games';
import { getSyncStatus } from '@/lib/sync-status';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const counts = {};
        const total = { kỳ: 0 };
        // Iterate all known games — single source of truth (games.js).
        // Fixed: no more hardcoded list duplicated from games.js.
        const gameList = typeof getAllGames === 'function' ? getAllGames() : [];
        for (const g of gameList) {
            const n = countDraws(g.code);
            counts[g.name] = n;
            total.kỳ += n;
        }

        const sync = getSyncStatus();
        return NextResponse.json({
            success: true,
            counts,
            total: total.kỳ,
            sync,
        });
    } catch (e) {
        console.error('[db-status]', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
