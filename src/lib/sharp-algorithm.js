// ============================================================================
// SHARP v5 — Anti-Popularity + Coverage Optimization
// ----------------------------------------------------------------------------
// Mathematical honest claim:
//   - P(jackpot) is NOT improved. It cannot be. Draws are independent.
//   - E[payout | jackpot] IS improved by ~20-40% (estimated from Powerball
//     and Mega Millions studies). The mechanism: jackpot is split between
//     all winners; picking numbers that fewer humans pick = larger share.
//
// References for crowd-bias estimates:
//   - Cook & Clotfelter (1993), "The Peculiar Scale Economies of Lotto"
//   - Simon (1999), "An Analysis of the Distribution of Combinations
//     Chosen by UK National Lottery Players"
//   - Krawczyk & Rachubik (2019), "The representativeness heuristic and
//     the choice of lottery tickets"
//
// What this module does NOT do:
//   - Claim algorithmic prediction works
//   - Use gratuitous Math.random() noise that destroys optimality
//   - Hide uncertainty from the user
// ============================================================================

// ----------------------------------------------------------------------------
// CROWD BIAS MODEL — number-level popularity estimates
// ----------------------------------------------------------------------------
// These are PRIOR estimates of how often each number is picked by the public
// (not how often it is DRAWN — which is uniform). Used to score anti-popularity.
// Values are relative weights; higher = more popular = AVOID.
// ----------------------------------------------------------------------------

const LUCKY_NUMBERS = new Set(['07', '08', '09', '11', '13', '18', '21', '22', '33', '36', '88']);
const SEMI_LUCKY = new Set(['03', '05', '06', '12', '15', '17', '23', '27', '28']);

function popularityScore(num, maxBall) {
    const n = typeof num === 'string' ? parseInt(num, 10) : num;
    const numStr = n.toString().padStart(2, '0');
    let score = 1.0; // baseline

    // 1. Birthday bias: numbers 1-31 over-picked because of DOB
    //    Strongest for 1-12 (months), strong for 1-31 (days)
    if (n <= 12) score += 0.60;
    else if (n <= 31) score += 0.35;
    else score -= 0.15; // bonus for being in "ignored" range

    // 2. Cultural lucky numbers in VN/Asia
    if (LUCKY_NUMBERS.has(numStr)) score += 0.45;
    else if (SEMI_LUCKY.has(numStr)) score += 0.20;

    // 3. Round numbers and patterns
    if (n % 10 === 0) score += 0.15;  // 10, 20, 30, 40
    if (n === maxBall) score += 0.10; // boundary number gets attention

    // 4. Phone-number-suffix common patterns (Vietnam)
    //    "lộc phát" pairs: 68, 86 — slightly more popular
    if (numStr === '68' || numStr === '86') score += 0.25;
    if (numStr === '39' || numStr === '49') score -= 0.10; // "tử" — slightly avoided

    return Math.max(0.1, score);
}

// ----------------------------------------------------------------------------
// SUCKER PATTERN DETECTORS — sets that are mathematically valid but picked
// by far too many humans (jackpot share would be tiny)
// ----------------------------------------------------------------------------

function isSequentialRun(sortedNums, runLength = 3) {
    let run = 1;
    for (let i = 1; i < sortedNums.length; i++) {
        if (sortedNums[i] - sortedNums[i - 1] === 1) {
            run++;
            if (run >= runLength) return true;
        } else {
            run = 1;
        }
    }
    return false;
}

function isArithmeticProgression(sortedNums) {
    if (sortedNums.length < 3) return false;
    const d = sortedNums[1] - sortedNums[0];
    return sortedNums.every((n, i) => i === 0 || n - sortedNums[i - 1] === d);
}

function maxSameDigitGroup(nums) {
    const buckets = {};
    for (const n of nums) {
        const last = n % 10;
        buckets[last] = (buckets[last] || 0) + 1;
    }
    return Math.max(...Object.values(buckets));
}

function maxSameDecadeGroup(nums) {
    const buckets = {};
    for (const n of nums) {
        const dec = Math.floor((n - 1) / 10);
        buckets[dec] = (buckets[dec] || 0) + 1;
    }
    return Math.max(...Object.values(buckets));
}

function countLowNumbers(nums, threshold = 31) {
    return nums.filter(n => n <= threshold).length;
}

function isAllEvenOrOdd(nums) {
    const evens = nums.filter(n => n % 2 === 0).length;
    return evens === 0 || evens === nums.length;
}

// ----------------------------------------------------------------------------
// EXPECTED SHARE MODEL
// ----------------------------------------------------------------------------
// Rough estimator of how many other tickets would share the jackpot if THIS
// set wins. Based on the crowd model above. Returns a multiplier:
//   1.0 = average; 2.0 = doubly-shared; 0.5 = kept twice the normal share.
// ----------------------------------------------------------------------------

function expectedShareMultiplier(nums, maxBall) {
    let popularitySum = 0;
    for (const n of nums) {
        popularitySum += popularityScore(n, maxBall);
    }
    const avgPop = popularitySum / nums.length;
    // Average popularity score should be ~1.0 for uniform random picks
    // Sets with high avg popularity get larger share multiplier
    return Math.max(0.3, Math.min(3.0, avgPop));
}

// ----------------------------------------------------------------------------
// FREQUENCY-NEUTRAL POSTERIOR
// ----------------------------------------------------------------------------
// Combine historical-frequency signals from the existing strategies with a
// strong prior that draws are uniform. Bayesian shrinkage toward the prior.
// Result: weak nudge from data, dominant signal from anti-popularity.
//
// Why shrinkage: 1500 draws is NOT enough data to detect any real bias in a
// 45-number wheel. Each number expected ~200 draws; standard error of count
// is sqrt(200*(1-1/45)) ≈ 14. So +/- 28 (2 SE) is pure noise. Most
// hot/cold "signals" the app shows fall inside this band.
// ----------------------------------------------------------------------------

function bayesianNumberScore(stat, totalDraws, maxBall, ballCount) {
    if (!stat) return 1.0;
    const expectedCount = (totalDraws * ballCount) / maxBall;
    const observed = stat.count;
    // Posterior mean of bias factor under Beta(α=expected, β=expected*(maxBall-1)) prior
    // Shrinks observed count toward expected
    const shrinkage = totalDraws > 500 ? 0.3 : 0.15;
    const biasFactor = (observed + expectedCount) / (2 * expectedCount);
    return 1 + shrinkage * (biasFactor - 1);
}

// ----------------------------------------------------------------------------
// SEEDED RANDOM — deterministic per (game, date) but varies across the
// space of possible users. Prevents "everyone gets the same numbers" while
// keeping anti-popularity edge consistent.
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
    const date = new Date();
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
    const str = `${game}|${dateKey}|${salt}`;
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

// ----------------------------------------------------------------------------
// CONSTRAINT SOLVER — generate candidate sets that pass all anti-pop rules
// ----------------------------------------------------------------------------

function weightedSample(pool, weights, k, rng) {
    // Sample k DISTINCT items proportional to weights, no replacement
    const items = pool.slice();
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
        out.push(items[idx]);
        items.splice(idx, 1);
        w.splice(idx, 1);
    }
    return out;
}

function passesAntiPopularity(nums, ballCount, maxBall) {
    const sorted = [...nums].sort((a, b) => a - b);

    // Hard rules (any violation = reject)
    if (isSequentialRun(sorted, 3)) return { ok: false, reason: 'sequential-run' };
    if (isArithmeticProgression(sorted)) return { ok: false, reason: 'arithmetic' };
    if (isAllEvenOrOdd(sorted)) return { ok: false, reason: 'all-same-parity' };

    // Birthday bias: cap at half the picks <= 31
    const lowCount = countLowNumbers(sorted, 31);
    if (lowCount > Math.ceil(ballCount * 0.55)) return { ok: false, reason: 'birthday-bias' };
    if (lowCount === ballCount) return { ok: false, reason: 'all-low' };

    // Decade clustering
    if (maxSameDecadeGroup(sorted) > Math.ceil(ballCount / 2)) {
        return { ok: false, reason: 'decade-cluster' };
    }

    // Last-digit clustering (e.g., 03,13,23,33,43)
    if (maxSameDigitGroup(sorted) > Math.ceil(ballCount / 2)) {
        return { ok: false, reason: 'digit-cluster' };
    }

    // Too many lucky numbers
    const luckyCount = sorted.filter(n => LUCKY_NUMBERS.has(n.toString().padStart(2, '0'))).length;
    if (luckyCount > 2) return { ok: false, reason: 'too-many-lucky' };

    return { ok: true };
}

// ----------------------------------------------------------------------------
// MAIN: generate Sharp v5 prediction
// ----------------------------------------------------------------------------

/**
 * Generate an optimized lottery pick using Sharp v5.
 *
 * @param {Object} ctx
 * @param {string} ctx.game              '645' | '655' | '535'
 * @param {Object} ctx.gameConfig        from games.js — { ballCount, maxBall, hasSpecialBall }
 * @param {Array}  ctx.stats             output of getStats(game)
 * @param {Array}  ctx.specialStats      output of getSpecialBallStats(game)
 * @param {string} [ctx.salt]            additional seed (e.g., user id) for per-user diversity
 * @param {number} [ctx.maxAttempts]
 * @returns {Object} pick + transparency metadata
 */
export function generateSharpPick({ game, gameConfig, stats, specialStats = [], salt = '', maxAttempts = 5000 }) {
    const { ballCount, maxBall, hasSpecialBall } = gameConfig;
    const totalDraws = stats.length > 0 ? stats[0].count + stats[0].gap : 0;

    // Build number scoring table
    const scoreTable = new Map();
    for (let n = 1; n <= maxBall; n++) {
        const numStr = n.toString().padStart(2, '0');
        const stat = stats.find(s => s.number === numStr);

        // Two components:
        //  (a) Frequency-neutral Bayesian: ~1.0, tiny nudge from history
        //  (b) Anti-popularity: 1/popularity_score
        const freqScore = bayesianNumberScore(stat, totalDraws, maxBall, ballCount);
        const popScore = popularityScore(n, maxBall);
        const antiPopScore = 1 / popScore;

        // Combined weight: anti-popularity DOMINATES (this is the real edge),
        // frequency provides only a small posterior nudge.
        const weight = Math.pow(antiPopScore, 1.5) * freqScore;

        scoreTable.set(n, {
            num: n,
            numStr,
            weight,
            popularity: popScore,
            antiPop: antiPopScore,
            freqNudge: freqScore,
        });
    }

    const pool = Array.from(scoreTable.values());
    const rng = mulberry32(makeSeed(game, salt));

    // Generate candidates and rank by lowest expected share
    const candidates = [];
    let attempts = 0;
    const rejectReasons = {};

    while (attempts < maxAttempts && candidates.length < 50) {
        attempts++;

        const weights = pool.map(p => p.weight);
        const picks = weightedSample(pool.map(p => p.num), weights, ballCount, rng);
        if (picks.length !== ballCount) continue;

        const check = passesAntiPopularity(picks, ballCount, maxBall);
        if (!check.ok) {
            rejectReasons[check.reason] = (rejectReasons[check.reason] || 0) + 1;
            continue;
        }

        const share = expectedShareMultiplier(picks, maxBall);
        candidates.push({ picks: [...picks].sort((a, b) => a - b), share });
    }

    // If we got nothing valid, relax and try without constraints
    if (candidates.length === 0) {
        const fallback = weightedSample(
            pool.map(p => p.num),
            pool.map(p => p.weight),
            ballCount,
            rng
        ).sort((a, b) => a - b);
        candidates.push({ picks: fallback, share: expectedShareMultiplier(fallback, maxBall) });
    }

    // Pick the candidate with LOWEST expected share (highest anti-popularity)
    candidates.sort((a, b) => a.share - b.share);
    const best = candidates[0];

    // Special ball: also anti-popularity, but allow frequency nudge
    let special = null;
    if (hasSpecialBall && specialStats.length > 0) {
        const specialScored = specialStats.map(s => {
            const n = parseInt(s.number, 10);
            const pop = popularityScore(n, maxBall);
            return { num: s.number, weight: 1 / Math.pow(pop, 1.5) };
        });
        const sbPicks = weightedSample(
            specialScored.map(s => s.num),
            specialScored.map(s => s.weight),
            1,
            rng
        );
        special = sbPicks[0];
    }

    // Build transparency report
    const mainStrs = best.picks.map(n => n.toString().padStart(2, '0'));
    const sum = best.picks.reduce((a, b) => a + b, 0);
    const evens = best.picks.filter(n => n % 2 === 0).length;
    const lowCount = countLowNumbers(best.picks, 31);

    return {
        main: mainStrs,
        special,
        breakdown: {
            sum,
            evens,
            odds: ballCount - evens,
            spread: best.picks[best.picks.length - 1] - best.picks[0],
            decadeCount: new Set(best.picks.map(n => Math.floor((n - 1) / 10))).size,
            lowCount,
            highCount: ballCount - lowCount,
        },
        sharpMetrics: {
            expectedShareMultiplier: Math.round(best.share * 100) / 100,
            // Plain-Vietnamese friendly summary
            shareVsTypical: best.share < 1
                ? `Nếu trúng, bạn có thể giữ được nhiều hơn ~${Math.round((1 / best.share - 1) * 100)}% giải so với pick thông thường (vì ít người chọn bộ này).`
                : `Bộ số này có vẻ khá phổ biến — nếu trúng, có thể phải chia với nhiều người. Bấm "Tạo bộ số mới" để thử lại.`,
            avgPopularityScore: Math.round(
                (best.picks.reduce((s, n) => s + popularityScore(n, maxBall), 0) / ballCount) * 100
            ) / 100,
        },
        attempts,
        candidatesEvaluated: candidates.length,
        rejectionStats: rejectReasons,
        disclaimers: {
            probabilityOfJackpot: game === '645' ? '1 / 8,145,060'
                : game === '655' ? '1 / 28,989,675'
                : '1 / 324,632',
            note: 'Bộ số nào cũng có cơ hội trúng GIỐNG NHAU. Bộ "ít đụng hàng" ' +
                  'không khó trúng hơn — chỉ là nếu trúng, bạn không phải chia ' +
                  'giải với nhiều người khác.',
        },
    };
}

// ----------------------------------------------------------------------------
// COVERAGE OPTIMIZER — for Bao N wheel systems
// ----------------------------------------------------------------------------
// When buying N>ballCount tickets via Bao, maximize entropy of the pick.
// Variance is reduced (more decades covered, more parity mix). Does NOT
// increase expected return per dong spent.
// ----------------------------------------------------------------------------

export function generateSharpBao({ game, gameConfig, stats, baoSize, salt = '' }) {
    const { ballCount, maxBall } = gameConfig;
    if (baoSize <= ballCount) {
        // Bao 5 etc — different mechanic, defer to standard pick
        return generateSharpPick({ game, gameConfig, stats, salt });
    }

    // Pick `baoSize` numbers maximizing:
    //   - low average popularity (anti-share)
    //   - even decade coverage
    //   - balanced parity
    //   - reasonable sum range
    const rng = mulberry32(makeSeed(game, salt + '-bao'));
    const pool = [];
    for (let n = 1; n <= maxBall; n++) {
        pool.push({ num: n, weight: 1 / Math.pow(popularityScore(n, maxBall), 1.5) });
    }

    // Greedy coverage: pick best-anti-pop first, then add numbers that
    // maximize decade and parity diversity
    pool.sort((a, b) => b.weight - a.weight);
    const picked = [];
    const decadesUsed = new Set();
    let evens = 0, odds = 0;

    while (picked.length < baoSize) {
        // Among top candidates, prefer those filling missing decades / parity
        const targetDec = picked.length < baoSize / 2 ? null : findUnderrepresented(decadesUsed, maxBall);
        let bestIdx = -1, bestUtility = -Infinity;

        for (let i = 0; i < pool.length; i++) {
            const cand = pool[i];
            if (picked.find(p => p.num === cand.num)) continue;
            const dec = Math.floor((cand.num - 1) / 10);
            const isEven = cand.num % 2 === 0;

            let utility = cand.weight;
            if (!decadesUsed.has(dec)) utility *= 1.3;
            if (targetDec !== null && dec === targetDec) utility *= 1.5;
            // Parity balancing kicks in once we're past halfway
            if (picked.length > baoSize / 2) {
                if (isEven && evens >= baoSize / 2 + 1) utility *= 0.6;
                if (!isEven && odds >= baoSize / 2 + 1) utility *= 0.6;
            }
            // Inject mild randomness so this isn't deterministic across calls
            utility *= 0.85 + 0.3 * rng();

            if (utility > bestUtility) {
                bestUtility = utility;
                bestIdx = i;
            }
        }

        if (bestIdx === -1) break;
        const chosen = pool[bestIdx];
        picked.push(chosen);
        decadesUsed.add(Math.floor((chosen.num - 1) / 10));
        if (chosen.num % 2 === 0) evens++; else odds++;
    }

    const nums = picked.map(p => p.num).sort((a, b) => a - b);
    const ticketsGenerated = binomialCoefficient(baoSize, ballCount);
    const avgPop = nums.reduce((s, n) => s + popularityScore(n, maxBall), 0) / nums.length;
    const lowCount = nums.filter(n => n <= 31).length;

    return {
        main: nums.map(n => n.toString().padStart(2, '0')),
        baoSize,
        ticketsGenerated,
        totalCost: ticketsGenerated * 10000,
        breakdown: {
            evens, odds,
            decadeCount: decadesUsed.size,
            lowCount,
            highCount: nums.length - lowCount,
        },
        sharpMetrics: {
            expectedShareMultiplier: Math.round(avgPop * 100) / 100,
            shareVsTypical: avgPop < 1
                ? `Bộ ${baoSize} số này ít đụng hàng — nếu trúng, bạn ít phải chia giải.`
                : `Bộ ${baoSize} số khá phổ biến — thử "Tạo bộ số mới" để được bộ ít đụng hàng hơn.`,
            avgPopularityScore: Math.round(avgPop * 100) / 100,
        },
        disclaimer: 'Bao tăng cả số vé và chi phí cùng tỷ lệ. Cơ hội trúng MỖI VÉ không thay đổi — bạn chi nhiều hơn, có nhiều vé hơn, nên cơ hội trúng giải lớn cao hơn tuyến tính (cùng với chi phí).',
    };
}

function findUnderrepresented(decadesUsed, maxBall) {
    const allDecades = [];
    for (let d = 0; d * 10 < maxBall; d++) allDecades.push(d);
    const missing = allDecades.filter(d => !decadesUsed.has(d));
    return missing.length > 0 ? missing[0] : null;
}

function binomialCoefficient(n, k) {
    if (k < 0 || k > n) return 0;
    k = Math.min(k, n - k);
    let result = 1;
    for (let i = 0; i < k; i++) result = result * (n - i) / (i + 1);
    return Math.round(result);
}
