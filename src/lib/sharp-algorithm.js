// ============================================================================
// SCIENTIFIC v6 — Data-Driven Constraint Solver + Anti-Popularity
// ----------------------------------------------------------------------------
// Pipeline:
//   1. Build "typical winner profile" from ALL historical data (sum range,
//      even/odd split, spread, decade coverage, consecutive pair frequency)
//   2. Score every number 1..N by:
//      - Anti-popularity (low crowd-pick = high score)
//      - Bayesian-shrunk historical frequency (very small nudge)
//   3. Generate 5000+ candidates via weighted sampling
//   4. REJECT candidates that violate the profile (sum out-of-band,
//      decade-clustered, unusual even/odd, etc.)
//   5. REJECT literal duplicates of past winners
//   6. REJECT near-duplicates (≥5 overlap with a single past draw)
//   7. Rank survivors by combined score:
//      - Low expected jackpot-share (anti-popularity)
//      - Profile typicality (close to mean)
//      - Match-history novelty (fewer past 3+ overlaps = more novel)
//   8. Return best + FULL match history for transparency
//
// Honest claim: P(jackpot) is UNCHANGED. We optimize for:
//   - E[payout | jackpot] (share less)
//   - "Plausibility" — set looks like a real winner statistically
//   - Transparency — user sees evidence of past overlaps
// ============================================================================

import { buildWinnerProfile, checkProfile, profileTypicality } from './historical-profile.js';
import { findMatchingDraws, summarizeMatches, isDuplicateOfPastWinner } from './match-history.js';

// ----------------------------------------------------------------------------
// CROWD POPULARITY MODEL — relative weights
// ----------------------------------------------------------------------------

const LUCKY_NUMBERS = new Set(['07', '08', '09', '11', '13', '18', '21', '22', '33', '36', '88']);
const SEMI_LUCKY = new Set(['03', '05', '06', '12', '15', '17', '23', '27', '28']);

function popularityScore(num, maxBall) {
    const n = typeof num === 'string' ? parseInt(num, 10) : num;
    const numStr = n.toString().padStart(2, '0');
    let score = 1.0;

    // Birthday bias: 1-12 strongest, 1-31 medium
    if (n <= 12) score += 0.60;
    else if (n <= 31) score += 0.35;
    else score -= 0.15;

    if (LUCKY_NUMBERS.has(numStr)) score += 0.45;
    else if (SEMI_LUCKY.has(numStr)) score += 0.20;

    if (n % 10 === 0) score += 0.15;
    if (n === maxBall) score += 0.10;
    if (numStr === '68' || numStr === '86') score += 0.25;
    if (numStr === '39' || numStr === '49') score -= 0.10;

    return Math.max(0.1, score);
}

// ----------------------------------------------------------------------------
// SEEDED RANDOM — deterministic per session, varies across users
// ----------------------------------------------------------------------------

function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
        t = (t + 0x6D2B79F5) >>> 0;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

function makeSeed(game, salt = '') {
    const str = `${game}|${salt}|${Date.now()}`;
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

// ----------------------------------------------------------------------------
// WEIGHTED SAMPLING — no replacement
// ----------------------------------------------------------------------------

function weightedSample(items, weights, k, rng) {
    const pool = items.slice();
    const w = weights.slice();
    const out = [];
    for (let s = 0; s < k; s++) {
        const total = w.reduce((a, b) => a + b, 0);
        if (total <= 0) break;
        let r = rng() * total;
        let idx = 0;
        for (; idx < w.length - 1; idx++) {
            r -= w[idx];
            if (r <= 0) break;
        }
        out.push(pool[idx]);
        pool.splice(idx, 1);
        w.splice(idx, 1);
    }
    return out;
}

// ----------------------------------------------------------------------------
// BAYESIAN SHRINKAGE — historical frequency nudge
// ----------------------------------------------------------------------------

function bayesianFrequencyFactor(stat, totalDraws, maxBall, ballCount) {
    if (!stat || totalDraws === 0) return 1.0;
    const expectedCount = (totalDraws * ballCount) / maxBall;
    const observed = stat.count || 0;
    // Strong shrinkage — 1500 draws not enough to detect real bias in 45-ball wheel
    const shrinkage = 0.15;
    const biasFactor = (observed + expectedCount) / (2 * expectedCount);
    return 1 + shrinkage * (biasFactor - 1);
}

// ----------------------------------------------------------------------------
// MAIN: Generate Scientific Pick (v6)
// ----------------------------------------------------------------------------

/**
 * Generate one optimized lottery pick using v6 algorithm.
 *
 * @param {Object} ctx
 * @param {string} ctx.game
 * @param {Object} ctx.gameConfig — from games.js
 * @param {Array}  ctx.stats — getStats(game) output
 * @param {Array}  ctx.allDraws — ALL historical draws (with .balls)
 * @param {Array}  [ctx.specialStats] — for 6/55 only
 * @param {string} [ctx.salt]
 * @returns {Object} pick + full diagnostics
 */
export function generateScientificPick({ game, gameConfig, stats, allDraws, specialStats = [], salt = '' }) {
    const { ballCount, maxBall, hasSpecialBall } = gameConfig;
    const totalDraws = allDraws.length;

    if (totalDraws === 0) {
        return { error: 'Không đủ dữ liệu lịch sử để phân tích' };
    }

    const profile = buildWinnerProfile(allDraws, ballCount);
    const rng = mulberry32(makeSeed(game, salt));

    // Build per-number scoring
    const pool = [];
    for (let n = 1; n <= maxBall; n++) {
        const numStr = n.toString().padStart(2, '0');
        const stat = stats.find(s => s.number === numStr);

        const popScore = popularityScore(n, maxBall);
        const antiPopScore = 1 / popScore;
        const freqNudge = bayesianFrequencyFactor(stat, totalDraws, maxBall, ballCount);

        // Anti-popularity DOMINATES — that's the real edge.
        // Frequency nudge is tiny because 1500 draws can't detect real bias.
        const weight = Math.pow(antiPopScore, 1.5) * freqNudge;

        pool.push({ num: n, numStr, weight, popularity: popScore, antiPop: antiPopScore });
    }

    // Generate candidates
    const MAX_ATTEMPTS = 6000;
    const TARGET_CANDIDATES = 200;
    const candidates = [];
    const rejectReasons = {};
    let attempts = 0;

    while (attempts < MAX_ATTEMPTS && candidates.length < TARGET_CANDIDATES) {
        attempts++;

        const picks = weightedSample(
            pool.map(p => p.num),
            pool.map(p => p.weight),
            ballCount,
            rng
        );
        if (picks.length !== ballCount) continue;

        // Hard filter 1: profile fit
        const profileCheck = checkProfile(picks, profile);
        if (!profileCheck.ok) {
            rejectReasons[profileCheck.reason] = (rejectReasons[profileCheck.reason] || 0) + 1;
            continue;
        }

        // Hard filter 2: not an exact duplicate of a past winner
        const dupe = isDuplicateOfPastWinner(picks, allDraws);
        if (dupe) {
            rejectReasons['duplicate-of-past'] = (rejectReasons['duplicate-of-past'] || 0) + 1;
            continue;
        }

        // Compute match-history for this candidate
        const matches = findMatchingDraws(picks, allDraws, 3);

        // Hard filter 3: not near-identical to any past winner (≥ ballCount-1 overlap)
        const maxOverlap = matches[0]?.matchCount || 0;
        if (maxOverlap >= ballCount - 1) {
            rejectReasons['near-duplicate-of-past'] = (rejectReasons['near-duplicate-of-past'] || 0) + 1;
            continue;
        }

        // Soft scoring metrics
        const avgPop = picks.reduce((s, n) => s + popularityScore(n, maxBall), 0) / ballCount;
        const typicality = profileTypicality(picks, profile);

        // Composite score (LOWER is better):
        //   0.5 × avgPopularity  — anti-share (most important)
        //   0.3 × profileTypicality — fit historical shape
        //   0.2 × normalized match-count — fewer overlapping past draws = more novel
        const matchNorm = matches.length / Math.max(1, totalDraws);
        const compositeScore = 0.5 * avgPop + 0.3 * typicality.avgZ + 0.2 * matchNorm;

        candidates.push({
            picks: [...picks].sort((a, b) => a - b),
            avgPop,
            typicality,
            matches,
            matchCount: matches.length,
            compositeScore,
        });
    }

    if (candidates.length === 0) {
        // Fallback: relax profile, just pick by anti-popularity
        const fallback = weightedSample(
            pool.map(p => p.num),
            pool.map(p => p.weight),
            ballCount,
            rng
        ).sort((a, b) => a - b);
        const matches = findMatchingDraws(fallback, allDraws, 3);
        candidates.push({
            picks: fallback,
            avgPop: fallback.reduce((s, n) => s + popularityScore(n, maxBall), 0) / ballCount,
            typicality: profileTypicality(fallback, profile),
            matches,
            matchCount: matches.length,
            compositeScore: 999,
            relaxed: true,
        });
    }

    // Pick best by composite score
    candidates.sort((a, b) => a.compositeScore - b.compositeScore);
    const best = candidates[0];

    // Special ball (for 6/55)
    let special = null;
    if (hasSpecialBall && specialStats.length > 0) {
        const sbWeights = specialStats.map(s => {
            const n = parseInt(s.number, 10);
            return 1 / Math.pow(popularityScore(n, maxBall), 1.5);
        });
        const sbPicks = weightedSample(
            specialStats.map(s => s.number),
            sbWeights,
            1,
            rng
        );
        special = sbPicks[0];
    }

    const matchSummary = summarizeMatches(best.matches, totalDraws, ballCount);
    const lowCount = best.picks.filter(n => n <= 31).length;

    return {
        main: best.picks.map(n => n.toString().padStart(2, '0')),
        special,
        breakdown: {
            sum: best.typicality.sum,
            evens: best.typicality.evens,
            odds: ballCount - best.typicality.evens,
            spread: best.typicality.spread,
            decadeCount: best.typicality.decades,
            consecutive: best.typicality.consecutivePairs,
            lowCount,
            highCount: ballCount - lowCount,
        },
        // Scientific diagnostics — for the UI
        scientific: {
            profile: {
                sumMean: profile.sum.mean,
                sumStd: profile.sum.std,
                sumRange: [profile.sum.acceptMin, profile.sum.acceptMax],
                spreadMean: profile.spread.mean,
                spreadRange: [profile.spread.acceptMin, profile.spread.acceptMax],
                decadeRange: [profile.decadeCount.acceptMin, profile.decadeCount.acceptMax],
                evenOddDist: profile.evenOdd.distribution,
                basedOnDraws: profile.totalDraws,
            },
            typicality: {
                zSum: best.typicality.zSum,
                zSpread: best.typicality.zSpread,
                zDecade: best.typicality.zDecade,
                avgZ: Math.round(best.typicality.avgZ * 100) / 100,
                verdict: best.typicality.avgZ < 1
                    ? 'Rất gần với mẫu các kỳ trúng trong quá khứ'
                    : best.typicality.avgZ < 2
                        ? 'Phù hợp với mẫu các kỳ trúng trong quá khứ'
                        : 'Hơi khác lạ so với mẫu quá khứ',
            },
            antiShare: {
                avgPopularity: Math.round(best.avgPop * 100) / 100,
                verdict: best.avgPop < 0.95
                    ? 'Ít người chọn — nếu trúng, giải lớn hơn (ít chia)'
                    : best.avgPop < 1.1
                        ? 'Mức độ phổ biến trung bình'
                        : 'Khá nhiều người chọn — nếu trúng có thể phải chia',
            },
            matchHistory: best.matches,
            matchSummary,
            engineStats: {
                attempts,
                candidatesAccepted: candidates.length,
                rejectReasons,
            },
        },
        jackpotOdds: game === '645' ? '1 / 8,145,060'
            : game === '655' ? '1 / 28,989,675'
            : '1 / 324,632',
    };
}

// Backward-compat alias — existing callers still work
export { generateScientificPick as generateSharpPick };

// ----------------------------------------------------------------------------
// BAO MODE — wheel system optimization
// ----------------------------------------------------------------------------

function binomialCoefficient(n, k) {
    if (k < 0 || k > n) return 0;
    k = Math.min(k, n - k);
    let result = 1;
    for (let i = 0; i < k; i++) result = result * (n - i) / (i + 1);
    return Math.round(result);
}

export function generateSharpBao({ game, gameConfig, stats, allDraws, baoSize, salt = '' }) {
    const { ballCount, maxBall } = gameConfig;
    if (baoSize <= ballCount) {
        return generateScientificPick({ game, gameConfig, stats, allDraws, salt });
    }

    const rng = mulberry32(makeSeed(game, salt + '-bao'));
    const pool = [];
    for (let n = 1; n <= maxBall; n++) {
        pool.push({ num: n, weight: 1 / Math.pow(popularityScore(n, maxBall), 1.5) });
    }
    pool.sort((a, b) => b.weight - a.weight);

    const picked = [];
    const decadesUsed = new Set();
    let evens = 0, odds = 0;

    while (picked.length < baoSize) {
        let bestIdx = -1, bestUtility = -Infinity;
        for (let i = 0; i < pool.length; i++) {
            const cand = pool[i];
            if (picked.find(p => p.num === cand.num)) continue;
            const dec = Math.floor((cand.num - 1) / 10);
            const isEven = cand.num % 2 === 0;
            let utility = cand.weight;
            if (!decadesUsed.has(dec)) utility *= 1.3;
            if (picked.length > baoSize / 2) {
                if (isEven && evens >= baoSize / 2 + 1) utility *= 0.6;
                if (!isEven && odds >= baoSize / 2 + 1) utility *= 0.6;
            }
            utility *= 0.85 + 0.3 * rng();
            if (utility > bestUtility) { bestUtility = utility; bestIdx = i; }
        }
        if (bestIdx === -1) break;
        const chosen = pool[bestIdx];
        picked.push(chosen);
        decadesUsed.add(Math.floor((chosen.num - 1) / 10));
        if (chosen.num % 2 === 0) evens++; else odds++;
    }

    const nums = picked.map(p => p.num).sort((a, b) => a - b);
    const ticketsGenerated = binomialCoefficient(baoSize, ballCount);
    const lowCount = nums.filter(n => n <= 31).length;
    const avgPop = nums.reduce((s, n) => s + popularityScore(n, maxBall), 0) / nums.length;

    // Match history for the bao wheel
    const matches = findMatchingDraws(nums, allDraws, 3);
    const matchSummary = summarizeMatches(matches, allDraws.length, ballCount);

    return {
        main: nums.map(n => n.toString().padStart(2, '0')),
        baoSize,
        ticketsGenerated,
        totalCost: ticketsGenerated * 10000,
        breakdown: { evens, odds, decadeCount: decadesUsed.size, lowCount, highCount: nums.length - lowCount },
        scientific: {
            antiShare: {
                avgPopularity: Math.round(avgPop * 100) / 100,
                verdict: avgPop < 0.95
                    ? 'Bộ Bao này ít người trùng — nếu trúng ít phải chia giải'
                    : 'Mức độ phổ biến trung bình',
            },
            matchHistory: matches,
            matchSummary,
        },
        jackpotOdds: game === '645' ? '1 / 8,145,060'
            : game === '655' ? '1 / 28,989,675'
            : '1 / 324,632',
    };
}
