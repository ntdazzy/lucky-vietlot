// ============================================================================
// HISTORICAL PROFILE — Extract the "typical winner shape" from past draws
// ----------------------------------------------------------------------------
// Every metric here is derived from real data. No assumptions, no priors.
// The result is a "profile" that captures what real winning sets LOOK LIKE
// (sum range, even/odd splits, spread, decade coverage, etc.).
//
// We then use this profile as a CONSTRAINT for picking new sets — not to
// predict future draws (impossible), but to ensure the generated set has
// the same statistical shape as historical winners. A set that violates
// the profile (sum way too low, all-even, single-decade cluster) is
// rejected because:
//   1. It looks "unnatural" to the data
//   2. Such sets are often what humans pick "creatively" (sucker bets)
// ============================================================================

function stats(arr) {
    const n = arr.length;
    if (n === 0) return { mean: 0, std: 0, min: 0, max: 0, median: 0, p10: 0, p90: 0 };
    const mean = arr.reduce((a, b) => a + b, 0) / n;
    const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);
    const sorted = [...arr].sort((a, b) => a - b);
    return {
        mean: Math.round(mean * 100) / 100,
        std: Math.round(std * 100) / 100,
        min: sorted[0],
        max: sorted[n - 1],
        median: sorted[Math.floor(n / 2)],
        p10: sorted[Math.floor(n * 0.10)],
        p90: sorted[Math.floor(n * 0.90)],
    };
}

/**
 * Build a "typical winner" profile from all historical draws.
 *
 * @param {Array<{balls: string}>} allDraws — rows from DB with .balls field
 * @param {number} ballCount — 5 for Lotto 5/35, 6 for Mega/Power
 * @returns {Object} profile
 */
export function buildWinnerProfile(allDraws, ballCount) {
    const sums = [];
    const spreads = [];
    const decadeCounts = [];
    const consecutivePairs = [];
    const evenOddCounts = {};
    const lastDigitMaxes = [];

    for (const draw of allDraws) {
        if (!draw.balls) continue;
        const balls = draw.balls.split(',').map(b => parseInt(b.trim(), 10)).sort((a, b) => a - b);
        if (balls.length !== ballCount) continue;

        sums.push(balls.reduce((a, b) => a + b, 0));
        spreads.push(balls[balls.length - 1] - balls[0]);
        decadeCounts.push(new Set(balls.map(n => Math.floor((n - 1) / 10))).size);

        let cp = 0;
        for (let i = 1; i < balls.length; i++) {
            if (balls[i] - balls[i - 1] === 1) cp++;
        }
        consecutivePairs.push(cp);

        const evens = balls.filter(n => n % 2 === 0).length;
        const eoKey = `${evens}/${ballCount - evens}`;
        evenOddCounts[eoKey] = (evenOddCounts[eoKey] || 0) + 1;

        const digitMap = {};
        for (const b of balls) {
            const d = b % 10;
            digitMap[d] = (digitMap[d] || 0) + 1;
        }
        lastDigitMaxes.push(Math.max(...Object.values(digitMap)));
    }

    const sumStats = stats(sums);
    const spreadStats = stats(spreads);
    const decadeStats = stats(decadeCounts);
    const cpStats = stats(consecutivePairs);
    const ldStats = stats(lastDigitMaxes);

    // For even/odd: pick splits covering top 80% of historical frequency
    const eoEntries = Object.entries(evenOddCounts).sort((a, b) => b[1] - a[1]);
    const totalDraws = eoEntries.reduce((s, [, c]) => s + c, 0);
    const validEvenOdd = new Set();
    const evenOddPct = {};
    let cum = 0;
    for (const [key, count] of eoEntries) {
        const pct = count / totalDraws;
        evenOddPct[key] = Math.round(pct * 1000) / 10;
        if (cum < 0.85) validEvenOdd.add(key);
        cum += pct;
    }

    return {
        // Hard bounds used for constraint solving (μ ± 2σ covers ~95% of past)
        sum: {
            ...sumStats,
            acceptMin: Math.round(sumStats.mean - 2 * sumStats.std),
            acceptMax: Math.round(sumStats.mean + 2 * sumStats.std),
        },
        spread: {
            ...spreadStats,
            acceptMin: Math.round(spreadStats.mean - 2 * spreadStats.std),
            acceptMax: Math.round(spreadStats.mean + 2 * spreadStats.std),
        },
        decadeCount: {
            ...decadeStats,
            acceptMin: Math.max(2, Math.round(decadeStats.mean - 2 * decadeStats.std)),
            acceptMax: Math.ceil(decadeStats.mean + 2 * decadeStats.std),
        },
        consecutivePairs: {
            ...cpStats,
            acceptMax: Math.max(1, Math.ceil(cpStats.mean + 2 * cpStats.std)),
        },
        lastDigitCluster: {
            ...ldStats,
            acceptMax: Math.max(2, Math.ceil(ldStats.mean + 2 * ldStats.std)),
        },
        evenOdd: {
            validKeys: validEvenOdd,
            distribution: evenOddPct,
        },
        totalDraws,
    };
}

/**
 * Check whether a candidate set fits the profile bounds.
 * Returns { ok: bool, reason: string|null, scores: Object }
 */
export function checkProfile(candidate, profile) {
    const sorted = [...candidate].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const evens = sorted.filter(n => n % 2 === 0).length;
    const eoKey = `${evens}/${sorted.length - evens}`;
    const spread = sorted[sorted.length - 1] - sorted[0];
    const decades = new Set(sorted.map(n => Math.floor((n - 1) / 10))).size;
    let cp = 0;
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - sorted[i - 1] === 1) cp++;
    }
    const digitMap = {};
    for (const b of sorted) {
        const d = b % 10;
        digitMap[d] = (digitMap[d] || 0) + 1;
    }
    const maxLastDigit = Math.max(...Object.values(digitMap));

    const scores = { sum, evens, eoKey, spread, decades, consecutivePairs: cp, maxLastDigit };

    if (sum < profile.sum.acceptMin) return { ok: false, reason: 'sum-too-low', scores };
    if (sum > profile.sum.acceptMax) return { ok: false, reason: 'sum-too-high', scores };
    if (!profile.evenOdd.validKeys.has(eoKey)) return { ok: false, reason: 'even-odd-unusual', scores };
    if (spread < profile.spread.acceptMin) return { ok: false, reason: 'spread-too-narrow', scores };
    if (spread > profile.spread.acceptMax) return { ok: false, reason: 'spread-too-wide', scores };
    if (decades < profile.decadeCount.acceptMin) return { ok: false, reason: 'decade-cluster', scores };
    if (cp > profile.consecutivePairs.acceptMax) return { ok: false, reason: 'too-consecutive', scores };
    if (maxLastDigit > profile.lastDigitCluster.acceptMax) return { ok: false, reason: 'digit-cluster', scores };

    return { ok: true, reason: null, scores };
}

/**
 * Calculate how "typical" a candidate is — z-distance from profile mean.
 * Lower = more typical (closer to mean of past winners).
 */
export function profileTypicality(candidate, profile) {
    const check = checkProfile(candidate, profile);
    const s = check.scores;
    const zSum = profile.sum.std > 0 ? Math.abs(s.sum - profile.sum.mean) / profile.sum.std : 0;
    const zSpread = profile.spread.std > 0 ? Math.abs(s.spread - profile.spread.mean) / profile.spread.std : 0;
    const zDecade = profile.decadeCount.std > 0 ? Math.abs(s.decades - profile.decadeCount.mean) / profile.decadeCount.std : 0;
    return {
        ok: check.ok,
        avgZ: (zSum + zSpread + zDecade) / 3,
        zSum: Math.round(zSum * 100) / 100,
        zSpread: Math.round(zSpread * 100) / 100,
        zDecade: Math.round(zDecade * 100) / 100,
        ...s,
    };
}
