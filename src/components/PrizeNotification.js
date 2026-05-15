'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, Star, Sparkles, Award, Medal, X } from 'lucide-react';

// Visual config per prize tier
const TIER_VISUAL = {
    jackpot: {
        Icon: Trophy,
        title: '🏆 JACKPOT! 🏆',
        gradient: 'linear-gradient(135deg, #fbbf24, #f59e0b, #ef4444)',
        glow: '0 0 60px rgba(251, 191, 36, 0.7)',
        confetti: true,
        fullscreen: true,
        sound: 'jackpot',
    },
    jackpot2: {
        Icon: Sparkles,
        title: '💎 JACKPOT 2! 💎',
        gradient: 'linear-gradient(135deg, #a855f7, #ec4899, #fbbf24)',
        glow: '0 0 50px rgba(168, 85, 247, 0.7)',
        confetti: true,
        fullscreen: true,
        sound: 'big',
    },
    first: {
        Icon: Award,
        title: 'GIẢI NHẤT!',
        gradient: 'linear-gradient(135deg, #ef4444, #f59e0b)',
        glow: '0 0 30px rgba(239, 68, 68, 0.5)',
        confetti: false,
        fullscreen: false,
        sound: 'cheer',
    },
    second: {
        Icon: Medal,
        title: 'GIẢI NHÌ',
        gradient: 'linear-gradient(135deg, #f59e0b, #eab308)',
        glow: '0 0 20px rgba(245, 158, 11, 0.4)',
        confetti: false,
        fullscreen: false,
        sound: 'beep',
    },
    third: {
        Icon: Star,
        title: 'Giải Ba',
        gradient: 'linear-gradient(135deg, #10b981, #06b6d4)',
        glow: '0 0 15px rgba(16, 185, 129, 0.3)',
        confetti: false,
        fullscreen: false,
        sound: null,
    },
};

const GAME_DISPLAY = {
    '645': 'Mega 6/45',
    '655': 'Power 6/55',
    '535': 'Lotto 5/35',
};

export default function PrizeNotification({ ticket, onDismiss }) {
    const [closing, setClosing] = useState(false);
    const tierId = ticket.prize_tier;
    const visual = TIER_VISUAL[tierId];
    if (!visual) return null;

    const Icon = visual.Icon;

    const handleClose = (e) => {
        e?.stopPropagation();
        setClosing(true);
        setTimeout(() => onDismiss?.(ticket.id), 350);
    };

    // Play sound on mount (browser will respect autoplay policy)
    useEffect(() => {
        // For now skip — autoplay restrictions make this unreliable.
        // Could add later with user opt-in.
    }, []);

    if (visual.fullscreen) {
        return (
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9999,
                    background: 'rgba(0, 0, 0, 0.85)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    opacity: closing ? 0 : 1,
                    transition: 'opacity 0.35s ease',
                    animation: 'fadeIn 0.4s ease',
                }}
            >
                {visual.confetti && <ConfettiBurst />}
                <div
                    style={{
                        background: visual.gradient,
                        borderRadius: '24px',
                        padding: 'clamp(24px, 6vw, 48px)',
                        maxWidth: '480px',
                        width: '100%',
                        textAlign: 'center',
                        boxShadow: visual.glow,
                        position: 'relative',
                        animation: 'fadeInUp 0.5s ease',
                    }}
                >
                    <button
                        onClick={handleClose}
                        aria-label="Đóng"
                        style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            background: 'rgba(0,0,0,0.3)',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            padding: '8px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <X size={20} />
                    </button>

                    <div style={{
                        animation: 'pulse 1.2s ease infinite',
                        display: 'inline-flex',
                        marginBottom: '16px',
                    }}>
                        <Icon size={72} color="white" strokeWidth={2.5} />
                    </div>

                    <h1 style={{
                        fontSize: 'clamp(2rem, 7vw, 3rem)',
                        margin: '0 0 12px',
                        color: 'white',
                        fontWeight: 900,
                        textShadow: '0 4px 12px rgba(0,0,0,0.4)',
                        letterSpacing: '-1px',
                    }}>
                        {visual.title}
                    </h1>
                    <p style={{
                        fontSize: 'clamp(1rem, 3.5vw, 1.25rem)',
                        color: 'rgba(255,255,255,0.95)',
                        margin: '0 0 20px',
                        fontWeight: 600,
                    }}>
                        {GAME_DISPLAY[ticket.game]} · Kỳ #{ticket.checked_against_draw_id}
                    </p>

                    <div style={{
                        background: 'rgba(0,0,0,0.25)',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '20px',
                    }}>
                        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', marginBottom: '8px' }}>
                            Bộ số chốt
                        </div>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            {ticket.main_balls.split(',').map((b, i) => {
                                const trimmed = b.trim();
                                const isMatched = ticket.matched_balls?.split(',').map(x => x.trim()).includes(trimmed);
                                return (
                                    <span key={i} style={{
                                        width: '42px',
                                        height: '42px',
                                        borderRadius: '50%',
                                        background: isMatched ? 'white' : 'rgba(255,255,255,0.25)',
                                        color: isMatched ? '#0f172a' : 'white',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 900,
                                        fontSize: '1rem',
                                        boxShadow: isMatched ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
                                    }}>{trimmed}</span>
                                );
                            })}
                        </div>
                        <div style={{ marginTop: '12px', color: 'rgba(255,255,255,0.95)', fontSize: '0.9rem' }}>
                            Trúng <strong>{ticket.match_count}</strong> số
                            {ticket.special_match ? ' + Đặc biệt' : ''}
                        </div>
                    </div>

                    <Link
                        href={`/ket-qua/${ticket.id}`}
                        onClick={handleClose}
                        style={{
                            display: 'inline-block',
                            background: 'white',
                            color: '#0f172a',
                            padding: '14px 28px',
                            borderRadius: '12px',
                            fontWeight: 700,
                            textDecoration: 'none',
                            fontSize: '1rem',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                        }}
                    >
                        Xem chi tiết đối chiếu →
                    </Link>
                </div>
            </div>
        );
    }

    // Compact banner (first/second/third)
    return (
        <Link
            href={`/ket-qua/${ticket.id}`}
            onClick={handleClose}
            style={{
                display: 'block',
                background: visual.gradient,
                borderRadius: '16px',
                padding: '14px 16px',
                color: 'white',
                textDecoration: 'none',
                boxShadow: visual.glow,
                position: 'relative',
                marginBottom: '10px',
                opacity: closing ? 0 : 1,
                transform: closing ? 'translateY(-10px)' : 'none',
                transition: 'all 0.35s ease',
                animation: 'fadeInUp 0.4s ease',
            }}
        >
            <button
                onClick={handleClose}
                aria-label="Đóng"
                style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'rgba(0,0,0,0.25)',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '50%',
                    display: 'flex',
                }}
            >
                <X size={14} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingRight: '24px' }}>
                <Icon size={32} strokeWidth={2.5} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '1rem' }}>{visual.title}</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                        {GAME_DISPLAY[ticket.game]} #{ticket.checked_against_draw_id} ·
                        Trúng {ticket.match_count} số → bấm xem chi tiết
                    </div>
                </div>
            </div>
        </Link>
    );
}

function ConfettiBurst() {
    // Lightweight confetti: 40 randomly positioned colored particles
    const particles = Array.from({ length: 40 }, (_, i) => {
        const colors = ['#fbbf24', '#ef4444', '#10b981', '#06b6d4', '#a855f7', '#ec4899'];
        const left = Math.random() * 100;
        const delay = Math.random() * 0.6;
        const duration = 2 + Math.random() * 1.5;
        return (
            <span
                key={i}
                style={{
                    position: 'absolute',
                    top: '-20px',
                    left: `${left}%`,
                    width: '10px',
                    height: '14px',
                    background: colors[i % colors.length],
                    borderRadius: '2px',
                    animation: `confetti-fall ${duration}s ease-in ${delay}s forwards`,
                    transform: `rotate(${Math.random() * 360}deg)`,
                }}
            />
        );
    });
    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            {particles}
        </div>
    );
}
