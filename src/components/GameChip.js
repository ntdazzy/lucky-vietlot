// ============================================================================
// GAME CHIP — visual identifier for each Vietlott game
// ----------------------------------------------------------------------------
// Use anywhere a game is referenced. Three sizes (sm/md/lg) and optional
// "outline" variant. Colors match Vietlott's real brand palette where
// possible so users instantly recognize each game.
// ============================================================================

const GAME_META = {
    '645': {
        name: 'Mega 6/45',
        short: 'MEGA',
        emoji: '🎲',
        // Vietlott Mega brand red
        bg: 'linear-gradient(135deg, #dc2626, #ef4444)',
        bgSoft: 'rgba(220, 38, 38, 0.12)',
        color: '#fca5a5',
        borderColor: '#dc2626',
        solidColor: 'white',
    },
    '655': {
        name: 'Power 6/55',
        short: 'POWER',
        emoji: '⚡',
        // Power brand red-purple
        bg: 'linear-gradient(135deg, #9d174d, #be185d)',
        bgSoft: 'rgba(190, 24, 93, 0.14)',
        color: '#f9a8d4',
        borderColor: '#be185d',
        solidColor: 'white',
    },
    '535': {
        name: 'Lotto 5/35',
        short: 'LOTTO',
        emoji: '🎰',
        bg: 'linear-gradient(135deg, #16a34a, #22c55e)',
        bgSoft: 'rgba(22, 163, 74, 0.14)',
        color: '#86efac',
        borderColor: '#16a34a',
        solidColor: 'white',
    },
    'max3dpro': {
        name: 'Max 3D Pro',
        short: 'MAX3D',
        emoji: '🎯',
        bg: 'linear-gradient(135deg, #2563eb, #3b82f6)',
        bgSoft: 'rgba(37, 99, 235, 0.14)',
        color: '#93c5fd',
        borderColor: '#2563eb',
        solidColor: 'white',
    },
};

const SIZES = {
    sm: { padding: '2px 8px', fontSize: '0.68rem', height: '20px',  gap: '4px' },
    md: { padding: '4px 10px', fontSize: '0.78rem', height: '26px', gap: '5px' },
    lg: { padding: '6px 14px', fontSize: '0.88rem', height: '32px', gap: '6px' },
};

export default function GameChip({
    game,
    size = 'md',
    variant = 'solid',  // 'solid' | 'soft' | 'outline'
    showEmoji = true,
    showFullName = true,
    style: extraStyle = {},
}) {
    const meta = GAME_META[game];
    if (!meta) return null;
    const s = SIZES[size] || SIZES.md;

    let style = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: s.gap,
        padding: s.padding,
        fontSize: s.fontSize,
        minHeight: s.height,
        borderRadius: '999px',
        fontWeight: 700,
        letterSpacing: '0.2px',
        whiteSpace: 'nowrap',
        lineHeight: 1,
        ...extraStyle,
    };

    if (variant === 'solid') {
        style = { ...style, background: meta.bg, color: meta.solidColor, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' };
    } else if (variant === 'soft') {
        style = { ...style, background: meta.bgSoft, color: meta.color, border: `1px solid ${meta.borderColor}55` };
    } else if (variant === 'outline') {
        style = { ...style, background: 'transparent', color: meta.color, border: `1px solid ${meta.borderColor}` };
    }

    return (
        <span style={style}>
            {showEmoji && <span aria-hidden="true">{meta.emoji}</span>}
            <span>{showFullName ? meta.name : meta.short}</span>
        </span>
    );
}

// Export the meta for callers that need raw colors (e.g. background of a page)
export function getGameMeta(game) {
    return GAME_META[game] || null;
}
