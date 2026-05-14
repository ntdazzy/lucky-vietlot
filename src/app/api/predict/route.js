import { NextResponse } from 'next/server';
import { generatePrediction } from '@/app/du-doan/actions';
import { isValidGame } from '@/lib/games';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALLOWED_GAMES = ['645', '655', '535'];

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const game = searchParams.get('game');
    const bao = searchParams.get('bao') || 'standard';

    if (!game || !ALLOWED_GAMES.includes(game)) {
        return NextResponse.json(
            { success: false, error: `Invalid game. Allowed: ${ALLOWED_GAMES.join(', ')}` },
            { status: 400 }
        );
    }
    if (!isValidGame(game)) {
        return NextResponse.json({ success: false, error: 'Game not configured' }, { status: 400 });
    }

    try {
        const prediction = await generatePrediction(game, false, bao);
        if (!prediction) {
            return NextResponse.json(
                { success: false, error: 'Không đủ dữ liệu để dự đoán' },
                { status: 404 }
            );
        }

        // Normalize confidence: raw can be wildly variable (0-50+). Map to 0.70-0.99
        // so the bot can display it as a friendly percentage.
        const rawConf = prediction.confidence ?? 0;
        prediction.confidence = Math.min(0.99, Math.max(0.70, (rawConf / 30) + 0.5));

        return NextResponse.json({ success: true, prediction });
    } catch (e) {
        console.error('[predict] error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
