import { NextResponse } from 'next/server';
import { getLatestDraws } from '@/lib/db';
import { getGame, isValidGame } from '@/lib/games';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const game = searchParams.get('game') || '645';
    const rawLimit = parseInt(searchParams.get('limit') || '1', 10);
    const limit = Math.min(Math.max(rawLimit, 1), 20);

    if (!isValidGame(game)) {
        return NextResponse.json({ success: false, error: 'Invalid game' }, { status: 400 });
    }

    try {
        const gameConfig = getGame(game);
        const draws = getLatestDraws(game, limit);

        if (draws.length === 0) {
            return NextResponse.json({ success: false, error: 'Chưa có dữ liệu' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            game: gameConfig.name,
            count: draws.length,
            results: draws.map(d => ({
                drawId: d.draw_id,
                date: d.date,
                balls: d.balls || null,
                specialBall: d.special_ball || null,
                dacBiet: d.dac_biet || null,
                nhat: d.nhat || null,
                nhi: d.nhi || null,
                ba: d.ba || null,
            })),
        });
    } catch (e) {
        console.error('[results]', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
