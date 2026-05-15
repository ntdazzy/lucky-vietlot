'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { CalendarDays, Clock } from 'lucide-react';
import GameChip from '@/components/GameChip';
import { getAllGames, getUpcomingDraws } from '@/lib/games';

const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function formatVN(date) {
    return `${DAY_NAMES[date.getDay()]} · ${date.getDate()}/${date.getMonth() + 1}`;
}

function formatTime(date) {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function timeUntil(date, now) {
    const ms = date.getTime() - now.getTime();
    if (ms < 0) return 'đã qua';
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    if (days > 0) return `${days} ngày ${hours} giờ`;
    if (hours > 0) return `${hours} giờ ${mins} phút`;
    return `${mins} phút`;
}

export default function LichQuayPage() {
    const [now, setNow] = useState(new Date());
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const t = setInterval(() => setNow(new Date()), 60000); // refresh every minute
        return () => clearInterval(t);
    }, []);

    // Build per-game upcoming list (next 14 days)
    const schedule = useMemo(() => {
        if (!mounted) return [];
        return getAllGames().map(g => ({
            game: g,
            upcoming: getUpcomingDraws(g.code, 14, now),
        })).filter(s => s.game.drawDays);
    }, [mounted, now]);

    // Merged timeline — all draws sorted by time
    const merged = useMemo(() => {
        const list = [];
        for (const s of schedule) {
            for (const d of s.upcoming) {
                list.push({ game: s.game, date: d });
            }
        }
        return list.sort((a, b) => a.date - b.date);
    }, [schedule]);

    // Group by day for the calendar view
    const byDay = useMemo(() => {
        const groups = {};
        for (const item of merged) {
            const key = item.date.toDateString();
            (groups[key] = groups[key] || []).push(item);
        }
        return groups;
    }, [merged]);

    if (!mounted) {
        return <div className="loading-center"><div className="spinner" /></div>;
    }

    const nextDraw = merged[0];

    return (
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
            <div className="page-header">
                <div className="page-badge" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#a855f7' }}>
                    <CalendarDays size={16} style={{ marginRight: 6 }} />
                    LỊCH QUAY THƯỞNG
                </div>
                <h1 className="page-title title-gradient">Lịch Kỳ Tiếp</h1>
                <p className="page-subtitle">Các kỳ quay đã lên lịch trong 14 ngày tới</p>
            </div>

            {/* COUNTDOWN TO NEXT DRAW */}
            {nextDraw && (
                <div className="glass-panel" style={{ marginBottom: '20px', textAlign: 'center', borderLeft: '3px solid #eab308' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                        Kỳ quay gần nhất
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <GameChip game={nextDraw.game.code} size="md" />
                        <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                            {formatVN(nextDraw.date)} · {formatTime(nextDraw.date)}
                        </span>
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#eab308' }}>
                        ⏰ {timeUntil(nextDraw.date, now)}
                    </div>
                </div>
            )}

            {/* SCHEDULE GROUPED BY DAY */}
            <div className="glass-panel" style={{ marginBottom: '20px' }}>
                <h3 style={{ marginBottom: '14px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={18} color="#06b6d4" /> 14 ngày tới
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {Object.entries(byDay).slice(0, 14).map(([dayKey, items]) => {
                        const sample = items[0].date;
                        const isToday = sample.toDateString() === now.toDateString();
                        return (
                            <div key={dayKey} style={{
                                background: 'var(--surface-strong)',
                                padding: '10px 12px',
                                borderRadius: '10px',
                                borderLeft: isToday ? '3px solid var(--primary)' : '3px solid transparent',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                                    <strong style={{ fontSize: '0.9rem' }}>
                                        {isToday && '🔴 '}{formatVN(sample)}
                                    </strong>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {items.length} kỳ
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    {items.map((it, i) => (
                                        <span key={i} style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                                            padding: '4px 10px',
                                            background: 'rgba(255,255,255,0.05)',
                                            borderRadius: '6px',
                                            fontSize: '0.78rem',
                                        }}>
                                            <GameChip game={it.game.code} size="sm" variant="soft" showFullName={false} />
                                            <span style={{ color: 'var(--text-muted)' }}>{formatTime(it.date)}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* PER-GAME SUMMARY */}
            <div className="glass-panel">
                <h3 style={{ marginBottom: '14px', fontSize: '1rem' }}>Lịch quay theo game</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {getAllGames().map(g => {
                        if (!g.drawDays) return null;
                        const dayLabels = g.drawDays.length === 7 ? 'hàng ngày' : g.drawDays.map(d => DAY_NAMES[d]).join(', ');
                        return (
                            <div key={g.code} style={{
                                display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                                padding: '10px 12px',
                                background: 'var(--surface-strong)',
                                borderRadius: '10px',
                            }}>
                                <GameChip game={g.code} size="sm" />
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    Quay {dayLabels} lúc <strong style={{ color: 'var(--text-main)' }}>{g.drawTime}</strong>
                                </span>
                            </div>
                        );
                    })}
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '12px', fontStyle: 'italic' }}>
                    💡 Lưu ý: Lịch trên là dự kiến theo lịch chính thức của Vietlott. Kết quả thực tế có thể chậm 15-30 phút sau giờ quay.
                </p>
            </div>

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <Link href="/du-doan" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Chuẩn bị bộ số cho kỳ tới →
                </Link>
            </div>
        </div>
    );
}
