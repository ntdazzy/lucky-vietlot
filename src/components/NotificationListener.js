'use client';

// ============================================================================
// NOTIFICATION LISTENER — Polls unseen prizes + plays sound + browser notif
// ----------------------------------------------------------------------------
// Three notification channels:
//   1. In-app banner (PrizeNotification component)
//   2. Web Audio sound effect (if soundEnabled)
//   3. Browser Notification API (if browserNotifications + permission granted)
// ============================================================================

import { useEffect, useState, useCallback, useRef } from 'react';
import PrizeNotification from './PrizeNotification';
import { getSettings } from '@/lib/user-settings';
import { playPrizeSound } from '@/lib/sound-fx';

const TIER_LABEL = {
    jackpot:  { emoji: '🏆', label: 'JACKPOT' },
    jackpot2: { emoji: '💎', label: 'JACKPOT 2' },
    first:    { emoji: '🥇', label: 'Giải Nhất' },
    second:   { emoji: '🥈', label: 'Giải Nhì' },
    third:    { emoji: '🥉', label: 'Giải Ba' },
};

const GAME_LABEL = { '645': 'Mega 6/45', '655': 'Power 6/55', '535': 'Lotto 5/35' };

export default function NotificationListener() {
    const [unseen, setUnseen] = useState([]);
    const lastFetchRef = useRef(0);
    const playedSoundsRef = useRef(new Set()); // track per-check to avoid replaying
    const shownNotifsRef = useRef(new Set());

    const fetchUnseen = useCallback(async () => {
        try {
            const r = await fetch('/api/tickets/check?unseen=1', { cache: 'no-store' });
            if (!r.ok) return;
            const data = await r.json();
            if (data.success && Array.isArray(data.unseen)) {
                const settings = getSettings();
                const newPrizes = data.unseen.filter(p => !playedSoundsRef.current.has(p.check_id));

                // Play sound for the BEST new prize only (avoid spam)
                if (newPrizes.length > 0 && settings.soundEnabled) {
                    const tierOrder = { jackpot: 1, jackpot2: 2, first: 3, second: 4, third: 5 };
                    const best = [...newPrizes].sort((a, b) =>
                        (tierOrder[a.prize_tier] || 99) - (tierOrder[b.prize_tier] || 99)
                    )[0];
                    try { playPrizeSound(best.prize_tier, settings.soundVolume || 0.5); } catch {}
                }

                // Browser notification for each new prize (system tray)
                if (settings.browserNotifications && typeof Notification !== 'undefined'
                    && Notification.permission === 'granted') {
                    for (const p of newPrizes) {
                        if (shownNotifsRef.current.has(p.check_id)) continue;
                        const meta = TIER_LABEL[p.prize_tier];
                        if (!meta) continue;
                        try {
                            const n = new Notification(`${meta.emoji} TRÚNG ${meta.label}!`, {
                                body: `${GAME_LABEL[p.game] || p.game} kỳ #${p.checked_against_draw_id}\nBộ số: ${p.main_balls}`,
                                icon: '/icon-192x192.png',
                                badge: '/icon-192x192.png',
                                tag: `prize-${p.check_id}`,
                                requireInteraction: p.prize_tier === 'jackpot' || p.prize_tier === 'jackpot2',
                            });
                            n.onclick = () => {
                                window.focus();
                                window.location.href = `/ket-qua/${p.id}`;
                                n.close();
                            };
                            shownNotifsRef.current.add(p.check_id);
                        } catch {}
                    }
                }

                newPrizes.forEach(p => playedSoundsRef.current.add(p.check_id));
                setUnseen(data.unseen);
            }
        } catch {}
        lastFetchRef.current = Date.now();
    }, []);

    useEffect(() => {
        const settings = getSettings();
        const intervalMs = (settings.pollIntervalSec || 25) * 1000;
        const initial = setTimeout(fetchUnseen, 1500);
        const id = setInterval(fetchUnseen, intervalMs);

        const onVis = () => {
            if (document.visibilityState === 'visible' && Date.now() - lastFetchRef.current > 5000) {
                fetchUnseen();
            }
        };
        document.addEventListener('visibilitychange', onVis);

        return () => {
            clearTimeout(initial);
            clearInterval(id);
            document.removeEventListener('visibilitychange', onVis);
        };
    }, [fetchUnseen]);

    const dismiss = useCallback(async (checkId) => {
        setUnseen(prev => prev.filter(t => t.check_id !== checkId));
        try {
            await fetch('/api/tickets/check', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ checkIds: [checkId] }),
            });
        } catch {}
    }, []);

    if (unseen.length === 0) return null;

    const tierOrder = { jackpot: 1, jackpot2: 2, first: 3, second: 4, third: 5 };
    const sorted = [...unseen].sort((a, b) =>
        (tierOrder[a.prize_tier] || 99) - (tierOrder[b.prize_tier] || 99)
    );

    const bigPrize = sorted.find(t => t.prize_tier === 'jackpot' || t.prize_tier === 'jackpot2');
    if (bigPrize) {
        return <PrizeNotification ticket={bigPrize} onDismiss={() => dismiss(bigPrize.check_id)} />;
    }

    return (
        <div
            style={{
                position: 'fixed',
                top: '80px',
                right: '12px',
                left: '12px',
                maxWidth: '420px',
                marginLeft: 'auto',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                pointerEvents: 'auto',
            }}
        >
            {sorted.slice(0, 3).map(t => (
                <PrizeNotification key={t.check_id} ticket={t} onDismiss={() => dismiss(t.check_id)} />
            ))}
        </div>
    );
}
