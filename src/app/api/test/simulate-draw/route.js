import { NextResponse } from 'next/server';
import { simulateDrawAgainstTickets } from '@/lib/ticket-checker';
import { isValidGame, getGame } from '@/lib/games';

export const dynamic = 'force-dynamic';

/**
 * POST /api/test/simulate-draw
 *
 * Body: {
 *   game: '645' | '655' | '535',
 *   balls: "01, 12, 25, 33, 41, 45",   // or array
 *   specialBall?: "07",                  // for 6/55
 *   drawId?: "TEST-123",
 *   date?: "14/05/2026",
 *   persist?: boolean                    // default false: dry-run, don't update tickets
 * }
 *
 * Returns: { success, results: [...] } — what would happen to each pending ticket.
 *
 * Use cases:
 *   - Verify prize-tier logic
 *   - Trigger notifications for a specific tier (e.g., fake a jackpot)
 *   - QA the match-detail page rendering
 *
 * Set persist=true to write the simulated result into the tickets table
 * (the UI will then show the notification banners). Useful for end-to-end
 * testing of the notification flow.
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { game, balls, specialBall, drawId, date, persist } = body;

        if (!isValidGame(game)) {
            return NextResponse.json({ error: 'Invalid game' }, { status: 400 });
        }
        const cfg = getGame(game);
        if (!cfg.ballCount) {
            return NextResponse.json({ error: 'Game này không hỗ trợ chốt số' }, { status: 400 });
        }

        // Normalize balls input
        let ballsStr;
        if (Array.isArray(balls)) {
            ballsStr = balls.map(b => String(b).padStart(2, '0')).join(', ');
        } else if (typeof balls === 'string') {
            const nums = balls.match(/\d{1,2}/g) || [];
            if (nums.length < cfg.ballCount) {
                return NextResponse.json({ error: `Cần ít nhất ${cfg.ballCount} số trong balls` }, { status: 400 });
            }
            ballsStr = nums.slice(0, cfg.ballCount).map(b => b.padStart(2, '0')).join(', ');
        } else {
            return NextResponse.json({ error: 'balls phải là array hoặc string' }, { status: 400 });
        }

        const fakeDraw = {
            drawId: drawId || `SIM-${Date.now()}`,
            date: date || new Date().toLocaleDateString('vi-VN'),
            balls: ballsStr,
            special_ball: specialBall ? String(specialBall).padStart(2, '0') : null,
        };

        const results = simulateDrawAgainstTickets(game, fakeDraw, { persist: !!persist });
        const winners = results.filter(r => r.prize?.id && r.prize.id !== 'none');

        return NextResponse.json({
            success: true,
            persisted: !!persist,
            fakeDraw,
            ticketsChecked: results.length,
            winners,
            results,
            hint: persist
                ? 'Đã lưu vào DB — vào /du-doan để thấy thông báo trúng giải hiện ra.'
                : 'Dry-run (chưa lưu). Thêm "persist": true vào body để lưu và xem thông báo trong UI.',
        });
    } catch (e) {
        console.error('[test/simulate-draw]', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

/**
 * GET /api/test/simulate-draw  — quick docs
 */
export async function GET() {
    return NextResponse.json({
        usage: 'POST with { game, balls, specialBall?, drawId?, date?, persist? }',
        examples: [
            {
                description: 'Test jackpot for Mega 6/45',
                body: {
                    game: '645',
                    balls: '01, 12, 25, 33, 41, 45',
                    persist: true,
                },
            },
            {
                description: 'Test JP2 for Power 6/55',
                body: {
                    game: '655',
                    balls: '02, 14, 23, 31, 42, 50',
                    specialBall: '07',
                    persist: true,
                },
            },
        ],
    });
}
