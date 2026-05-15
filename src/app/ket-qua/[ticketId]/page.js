import Link from 'next/link';
import { getDb } from '@/lib/db';
import { getPrizeTier } from '@/lib/prize-tiers';
import { getGame } from '@/lib/games';
import { getTicketChecks } from '@/lib/ticket-checker';
import GameChip from '@/components/GameChip';
import BuyTicketButton from '@/components/BuyTicketButton';
import { ChevronLeft, Trophy, Sparkles, Award, Medal, Star, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';

function fetchTicket(ticketId) {
    try {
        return getDb().prepare(`SELECT * FROM confirmed_tickets WHERE id = ?`).get(parseInt(ticketId, 10));
    } catch {
        return null;
    }
}

const TIER_ICON = {
    jackpot: Trophy,
    jackpot2: Sparkles,
    first: Award,
    second: Medal,
    third: Star,
    none: Clock,
};

export default async function KetQuaPage({ params }) {
    const resolved = await params;
    const ticket = fetchTicket(resolved.ticketId);

    if (!ticket) {
        return (
            <div className="glass-panel" style={{ maxWidth: '500px', margin: '40px auto', textAlign: 'center' }}>
                <h2 style={{ marginBottom: '12px' }}>Không tìm thấy vé</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Vé này có thể đã bị xoá.</p>
                <Link href="/du-doan" className="btn-primary" style={{ display: 'inline-block' }}>← Quay lại</Link>
            </div>
        );
    }

    const ticketBalls = ticket.main_balls.split(',').map(b => b.trim());
    const ticketSpecial = ticket.special_ball;
    const checks = getTicketChecks(ticket.id);
    const lockN = ticket.lock_for_draws || 1;
    const drawsRemaining = Math.max(0, lockN - (ticket.draws_checked || 0));

    // Best prize across all checks
    const winningChecks = checks.filter(c => c.prize_tier && c.prize_tier !== 'none');
    let bestCheck = null;
    if (winningChecks.length > 0) {
        bestCheck = winningChecks.reduce((best, c) => {
            const bt = best ? getPrizeTier(best.prize_tier) : null;
            const ct = getPrizeTier(c.prize_tier);
            return !bt || ct.rank < bt.rank ? c : best;
        }, null);
    }
    const bestTier = bestCheck ? getPrizeTier(bestCheck.prize_tier) : null;
    const TierIcon = bestTier ? TIER_ICON[bestTier.id] || Star : Clock;
    const cfg = getGame(ticket.game);
    const gameName = cfg?.name || ticket.game;
    const isBigWin = bestTier && (bestTier.id === 'jackpot' || bestTier.id === 'jackpot2');
    const isWin = bestTier && bestTier.id !== 'none';

    return (
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
            <Link href="/du-doan" style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                color: 'var(--text-muted)', textDecoration: 'none', marginBottom: '20px',
                fontSize: '0.9rem',
            }}>
                <ChevronLeft size={16} /> Quay lại Tạo Số
            </Link>

            {/* HEADER — biggest win OR pending status */}
            <div className="glass-panel" style={{
                marginBottom: '20px',
                background: isBigWin
                    ? 'linear-gradient(135deg, #fbbf24, #ef4444, #a855f7)'
                    : isWin
                        ? `linear-gradient(135deg, ${bestTier.color}, ${bestTier.color}aa)`
                        : 'var(--surface)',
                color: isWin ? 'white' : 'var(--text-main)',
                textAlign: 'center',
            }}>
                <div style={{ marginBottom: '12px' }}>
                    <TierIcon size={56} color={isWin ? 'white' : 'var(--text-muted)'} strokeWidth={2.2} />
                </div>
                <h1 style={{ margin: 0, fontSize: 'clamp(1.5rem, 5vw, 2.5rem)', fontWeight: 800 }}>
                    {isWin ? `${bestTier.emoji} ${bestTier.label}!`
                        : drawsRemaining > 0 ? 'Đang chờ kết quả'
                            : 'Kỳ này chưa trúng'
                    }
                </h1>
                {isWin && (
                    <p style={{ margin: '8px 0 0', fontSize: '1rem', opacity: 0.9 }}>
                        Tiền thưởng ước tính: <strong>{bestTier.amount}</strong>
                    </p>
                )}
                <div style={{ margin: '12px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.9rem', opacity: 0.85 }}>
                    <GameChip game={ticket.game} size="md" variant={isWin ? 'outline' : 'solid'} />
                    <span>· Chốt cho <strong>{lockN}</strong> kỳ · Đã đối chiếu <strong>{checks.length}</strong>{drawsRemaining > 0 && `, còn ${drawsRemaining} kỳ`}</span>
                </div>
                {checks.some(c => c.simulated) && (
                    <p style={{
                        margin: '12px 0 0',
                        padding: '6px 14px',
                        display: 'inline-block',
                        background: 'rgba(0,0,0,0.35)',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        letterSpacing: '1px',
                    }}>
                        🧪 Có kết quả mô phỏng trong lịch sử
                    </p>
                )}
            </div>

            {/* TICKET INFO */}
            <div className="glass-panel" style={{ marginBottom: '20px' }}>
                <h3 style={{ marginBottom: '14px', fontSize: '1.05rem' }}>Bộ số đã chốt</h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {ticketBalls.map((b, i) => (
                        <span key={i} className="ball" style={{ width: '44px', height: '44px', fontSize: '1rem' }}>{b}</span>
                    ))}
                    {ticketSpecial && (
                        <span className="ball gold" style={{ width: '44px', height: '44px', fontSize: '1rem' }}>{ticketSpecial}</span>
                    )}
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                    Chốt lúc: {ticket.confirmed_at}
                    {ticket.algorithm && ` · Thuật toán: ${ticket.algorithm}`}
                    {ticket.parent_ticket_id && (
                        <> · 🔁 Chốt lại từ <Link href={`/ket-qua/${ticket.parent_ticket_id}`} style={{ color: '#06b6d4' }}>vé #{ticket.parent_ticket_id}</Link></>
                    )}
                </p>
                {drawsRemaining > 0 && ticket.game !== 'max3dpro' && (
                    <BuyTicketButton
                        game={ticket.game}
                        mainBalls={ticketBalls}
                        specialBall={ticketSpecial}
                    />
                )}
            </div>

            {/* CHECK TIMELINE */}
            {checks.length === 0 ? (
                <div className="glass-panel" style={{ marginBottom: '20px', textAlign: 'center', padding: '24px' }}>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                        ⏳ Chưa có kỳ quay nào sau lúc bạn chốt. Hệ thống sẽ tự đối chiếu khi có.
                    </p>
                </div>
            ) : (
                <div className="glass-panel" style={{ marginBottom: '20px' }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '1.05rem' }}>
                        Đối chiếu các kỳ ({checks.length}/{lockN})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {checks.map((c, i) => {
                            const drawBalls = (c.draw_balls || '').split(',').map(b => b.trim()).filter(Boolean);
                            const matched = new Set((c.matched_balls || '').split(',').filter(Boolean));
                            const tier = c.prize_tier ? getPrizeTier(c.prize_tier) : null;
                            const isWinning = tier && tier.id !== 'none';
                            const color = tier?.color || '#64748b';
                            return (
                                <div key={c.id} style={{
                                    background: 'var(--surface-strong)',
                                    padding: '12px 14px',
                                    borderRadius: '12px',
                                    borderLeft: `3px solid ${color}`,
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
                                        <div style={{ fontSize: '0.85rem' }}>
                                            <strong>Kỳ #{c.draw_id}</strong>
                                            <span style={{ color: 'var(--text-muted)' }}> · {c.draw_date}</span>
                                            {c.simulated ? <span style={{ color: '#06b6d4', marginLeft: '8px', fontSize: '0.75rem' }}>🧪 mô phỏng</span> : null}
                                        </div>
                                        <span style={{
                                            fontSize: '0.78rem', fontWeight: 700,
                                            color, background: `${color}22`,
                                            padding: '4px 12px', borderRadius: '20px',
                                        }}>
                                            {isWinning ? `${tier.emoji} ${tier.label}` : `${c.match_count}/${ticketBalls.length} — không trúng`}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                        {drawBalls.map((b, bi) => (
                                            <span key={bi} className={`ball${matched.has(b) ? ' ball-hot' : ''}`} style={{
                                                opacity: matched.has(b) ? 1 : 0.55,
                                                width: '36px', height: '36px', fontSize: '0.85rem',
                                            }}>{b}</span>
                                        ))}
                                        {c.draw_special && (
                                            <span className="ball gold" style={{
                                                opacity: c.special_match ? 1 : 0.5,
                                                width: '36px', height: '36px', fontSize: '0.85rem',
                                            }}>{c.draw_special}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
                <Link href="/du-doan" className="btn-primary" style={{ flex: '1 1 200px', textAlign: 'center', textDecoration: 'none' }}>
                    Tạo bộ số mới
                </Link>
                <Link href="/" className="btn-ghost" style={{ flex: '0 0 auto', textDecoration: 'none', padding: '12px 20px', borderRadius: '8px' }}>
                    Về trang chủ
                </Link>
            </div>
        </div>
    );
}
