import { NextResponse } from 'next/server';
import { generatePrediction } from '@/app/du-doan/actions';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const game = searchParams.get('game');

    if (!game || (game !== '645' && game !== '655')) {
        return NextResponse.json({ success: false, error: 'Invalid game parameter' }, { status: 400 });
    }

    try {
        const prediction = await generatePrediction(game);
        if (prediction) {
            // confidence comes back as e.g. 15.5, but let's normalize it to a percentage for the bot
            // actually the bot expects confidence in 0-1 range to do Math.round(pred.confidence * 100). 
            // In the actions.js, confidence is: Math.round(bestScore * 10) / 10 which can be > 1.
            // Let's normalize it so it looks like a probability between 0.70 and 0.99
            const normalizedConfidence = Math.min(0.99, Math.max(0.70, (prediction.confidence / 30) + 0.5));
            prediction.confidence = normalizedConfidence;
            
            return NextResponse.json({ success: true, prediction });
        } else {
            return NextResponse.json({ success: false, error: 'Cannot generate prediction' }, { status: 500 });
        }
    } catch (e) {
        console.error('Predict error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
