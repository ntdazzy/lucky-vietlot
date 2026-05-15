// ============================================================================
// PRIZE TIERS — Map match counts to Vietlott prize tiers (per game)
// ----------------------------------------------------------------------------
// Each tier has:
//   - id:      stable key used in notifications, URLs, CSS classes
//   - label:   Vietnamese label shown in UI
//   - emoji:   for Telegram + push notification
//   - color:   primary accent color
//   - amount:  approximate prize value (display only; jackpots vary)
//   - rank:    1 = highest tier (used to order notifications)
// ============================================================================

export const PRIZE_TIERS = {
    jackpot:   { id: 'jackpot',   label: 'JACKPOT',        emoji: '🏆', color: '#eab308', amount: '12+ tỷ',   rank: 1 },
    jackpot2:  { id: 'jackpot2',  label: 'JACKPOT 2',      emoji: '💎', color: '#a855f7', amount: '3+ tỷ',    rank: 2 },
    first:     { id: 'first',     label: 'Giải Nhất',      emoji: '🥇', color: '#ef4444', amount: '40 triệu', rank: 3 },
    second:    { id: 'second',    label: 'Giải Nhì',       emoji: '🥈', color: '#f59e0b', amount: '500 nghìn',rank: 4 },
    third:     { id: 'third',     label: 'Giải Ba',        emoji: '🥉', color: '#10b981', amount: '50 nghìn', rank: 5 },
    none:      { id: 'none',      label: 'Không trúng',    emoji: '➖', color: '#64748b', amount: '—',        rank: 99 },
};

// Per-game prize rules (ordered by priority — first match wins)
const PRIZE_RULES = {
    '645': [
        { match: 6, tier: 'jackpot' },
        { match: 5, tier: 'first' },
        { match: 4, tier: 'second' },
        { match: 3, tier: 'third' },
    ],
    '655': [
        { match: 6, tier: 'jackpot' },
        { match: 5, requireSpecial: true, tier: 'jackpot2' },
        { match: 5, tier: 'first' },
        { match: 4, tier: 'second' },
        { match: 3, tier: 'third' },
    ],
    '535': [
        // Lotto 5/35 — only top 3 tiers
        { match: 5, tier: 'jackpot' },
        { match: 4, tier: 'second' },
        { match: 3, tier: 'third' },
    ],
};

/**
 * Compute prize tier for a ticket given match outcome.
 *
 * @param {string} game             '645' | '655' | '535'
 * @param {number} matchCount       0..ballCount
 * @param {boolean} specialMatch    true if special_ball also matches
 * @returns {Object} tier object (always non-null; "none" if no prize)
 */
export function computePrize(game, matchCount, specialMatch) {
    const rules = PRIZE_RULES[game];
    if (!rules) return PRIZE_TIERS.none;

    for (const rule of rules) {
        if (rule.match !== matchCount) continue;
        if (rule.requireSpecial && !specialMatch) continue;
        return PRIZE_TIERS[rule.tier];
    }
    return PRIZE_TIERS.none;
}

export function getPrizeTier(id) {
    return PRIZE_TIERS[id] || PRIZE_TIERS.none;
}

/**
 * Notification severity for UI: bigger prizes get more dramatic display.
 */
export function notificationStyle(tierId) {
    switch (tierId) {
        case 'jackpot':  return { variant: 'fullscreen-celebration', sound: 'jackpot', confetti: true };
        case 'jackpot2': return { variant: 'fullscreen-celebration', sound: 'big',     confetti: true };
        case 'first':    return { variant: 'banner-large',           sound: 'cheer',   confetti: false };
        case 'second':   return { variant: 'banner-medium',          sound: 'beep',    confetti: false };
        case 'third':    return { variant: 'toast',                  sound: null,      confetti: false };
        default:         return { variant: 'silent',                 sound: null,      confetti: false };
    }
}
