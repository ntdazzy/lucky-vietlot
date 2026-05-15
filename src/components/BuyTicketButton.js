'use client';

import { useState, useCallback } from 'react';
import { ExternalLink, Copy, Check, ShoppingCart } from 'lucide-react';

// Official Vietlott channels
const CHANNELS = {
    '645': {
        appName: 'Vietlott SMS',
        webUrl: 'https://www.vietlott.vn/vi/dien-toan/mua-online',
        // Custom URI scheme of the Vietlott app (best-effort; falls back to web)
        deepLink: 'vietlottsms://mua/mega645',
    },
    '655': {
        appName: 'Vietlott SMS',
        webUrl: 'https://www.vietlott.vn/vi/dien-toan/mua-online',
        deepLink: 'vietlottsms://mua/power655',
    },
    '535': {
        appName: 'Vietlott SMS',
        webUrl: 'https://www.vietlott.vn/vi/dien-toan/mua-online',
        deepLink: 'vietlottsms://mua/lotto535',
    },
};

/**
 * Button that helps the user purchase the ticket on Vietlott's official
 * channel. Since third-party sites cannot sell official tickets, we:
 *   1) copy the numbers to clipboard so they can paste in the app
 *   2) try to open the app via deep link
 *   3) fall back to the official web purchase page
 *
 * @param {Object} props
 * @param {string} props.game        '645' | '655' | '535'
 * @param {string[]} props.mainBalls e.g. ['07','11','19','24','35','42']
 * @param {string=} props.specialBall
 * @param {'compact'|'full'} props.variant
 */
export default function BuyTicketButton({ game, mainBalls, specialBall, variant = 'full' }) {
    const [copied, setCopied] = useState(false);
    const ch = CHANNELS[game];
    if (!ch || !mainBalls || mainBalls.length === 0) return null;

    const ballString = mainBalls.join(' ') + (specialBall ? ` (ĐB ${specialBall})` : '');
    const fullText = `Vietlott ${game === '645' ? 'Mega 6/45' : game === '655' ? 'Power 6/55' : 'Lotto 5/35'} — ${ballString}`;

    const copyToClipboard = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(fullText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch (e) {
            // Fallback: select the text
            alert(`Hãy copy thủ công: ${fullText}`);
        }
    }, [fullText]);

    const openVietlott = useCallback(() => {
        // Try deep link first; if app not installed, browser opens web fallback after timeout
        const start = Date.now();
        window.location.href = ch.deepLink;
        setTimeout(() => {
            // If we're still here ~1s later, deep link probably failed
            if (Date.now() - start < 2000 && !document.hidden) {
                window.open(ch.webUrl, '_blank', 'noopener');
            }
        }, 800);
    }, [ch]);

    if (variant === 'compact') {
        return (
            <button
                onClick={async () => { await copyToClipboard(); openVietlott(); }}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: 'inherit',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    padding: '6px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                }}
                title="Copy số rồi mở Vietlott để mua thật"
            >
                {copied ? <Check size={14} /> : <ShoppingCart size={14} />}
                {copied ? 'Đã copy!' : 'Mua trên Vietlott'}
            </button>
        );
    }

    return (
        <div style={{
            background: 'var(--surface-strong)',
            border: '1px solid var(--surface-border)',
            borderRadius: '12px',
            padding: '14px',
            marginTop: '12px',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <ShoppingCart size={18} color="var(--primary)" />
                <strong style={{ fontSize: '0.95rem' }}>Muốn mua bộ số này thật?</strong>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
                Web này chỉ là công cụ phân tích — không bán vé. Để mua thật, dùng <strong>app Vietlott SMS</strong> hoặc website chính thức:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button
                    onClick={copyToClipboard}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '10px 14px',
                        background: copied ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        border: `1px solid ${copied ? '#10b981' : '#3b82f6'}66`,
                        color: copied ? '#10b981' : '#3b82f6',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                    }}
                >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Đã copy số!' : 'Copy số'}
                </button>
                <a
                    href={ch.webUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => copyToClipboard()}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '10px 14px',
                        background: 'linear-gradient(135deg, #dc2626, #ef4444)',
                        color: 'white',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                    }}
                >
                    <ExternalLink size={16} />
                    Mở Vietlott chính thức
                </a>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '10px 0 0', lineHeight: 1.5 }}>
                💡 Sau khi copy: mở app Vietlott SMS → chọn {game === '645' ? 'Mega 6/45' : game === '655' ? 'Power 6/55' : 'Lotto 5/35'} → "Tự chọn" → paste hoặc nhập số.
            </p>
        </div>
    );
}
