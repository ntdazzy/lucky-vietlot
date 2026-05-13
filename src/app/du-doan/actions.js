'use server';
import {
  getStats, getAdvancedStats, getSpecialBallStats, getTransitionMatrix,
  getDeltaPatterns, getDecadeDistribution, savePredictionHistory,
  getPredictionHistory as dbGetHistory, clearPredictionHistory as dbClearHistory,
  deletePredictionById as dbDeleteById, getLatestDraws
} from '@/lib/db';
import { getGame } from '@/lib/games';

const TIER_CONFIGS = {
  6: [[3, 2, 1], [2, 3, 1], [2, 2, 2], [3, 1, 2], [1, 3, 2]],
  5: [[2, 2, 1], [2, 1, 2], [1, 2, 2], [3, 1, 1], [1, 3, 1]],
};

const DEFAULT_SUM_RANGES = {
  '645': [110, 170],
  '655': [130, 200],
  '535': [50, 120],
};

const DEFAULT_EVEN_ODD = {
  6: ['3/3', '4/2', '2/4'],
  5: ['3/2', '2/3'],
};

const POPULAR_PATTERNS = [
  '01,02,03,04,05,06', '01,02,03,04,05',
  '07,14,21,28,35,42', '07,14,21,28,35',
  '02,04,06,08,10,12', '01,03,05,07,09,11',
];

function weightedPick(pool, temperature = 0.5) {
  const adjusted = pool.map(item => ({ ...item, w: Math.pow(Math.max(item.w, 0.01), temperature) }));
  const total = adjusted.reduce((s, item) => s + item.w, 0);
  if (total <= 0) return pool[Math.floor(Math.random() * pool.length)].n;
  let rand = Math.random() * total;
  for (const item of adjusted) {
    rand -= item.w;
    if (rand <= 0) return item.n;
  }
  return adjusted[adjusted.length - 1].n;
}

function buildPairMatrix(allDraws) {
  const pairs = {};
  for (const d of allDraws) {
    if (!d.balls) continue;
    const balls = d.balls.split(',').map(b => b.trim());
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const key = balls[i] < balls[j] ? `${balls[i]}|${balls[j]}` : `${balls[j]}|${balls[i]}`;
        pairs[key] = (pairs[key] || 0) + 1;
      }
    }
  }
  return pairs;
}

function pairScore(numStr, selectedSet, pairs) {
  let score = 0;
  for (const s of selectedSet) {
    const key = numStr < s ? `${numStr}|${s}` : `${s}|${numStr}`;
    score += pairs[key] || 0;
  }
  return score;
}

function scoreNumber(num, stats, matrix, lastBalls, decadeDist, gameConfig, maxWeighted) {
  const { maxBall } = gameConfig;
  const numStr = num.toString().padStart(2, '0');
  const stat = stats.find(s => s.number === numStr);
  if (!stat) return 0;

  let score = 0;

  // 1. Recency Decay (25%) — số xuất hiện gần đây trọng số cao
  score += (stat.weightedScore / (maxWeighted || 1)) * 25;

  // 2. Gap Bonus (15%) — số lâu chưa ra có cơ hội "đến kỳ"
  score += Math.min(stat.gap / (maxBall * 1.5), 1) * 15;

  // 3. Markov Transition (20%) — xác suất chuyển từ kỳ trước
  let markovScore = 0;
  for (const prev of lastBalls) {
    const prevStr = prev.toString().padStart(2, '0');
    if (matrix[prevStr]?.[numStr]) markovScore += matrix[prevStr][numStr];
  }
  score += Math.min(markovScore, 1) * 20;

  // 4. Decade Balance (10%) — ưu tiên vùng số đang "thiếu"
  if (decadeDist) {
    const dIdx = Math.floor((num - 1) / 10) * 10;
    const label = `${dIdx + 1}-${Math.min(dIdx + 10, maxBall)}`;
    const recent = decadeDist.recent?.[label];
    const overall = decadeDist.overall?.[label];
    if (recent && overall) {
      const ratio = recent.avgPerDraw / (overall.avgPerDraw || 0.1);
      if (ratio < 0.7) score += 10;
      else if (ratio < 0.9) score += 5;
    }
  }

  // 5. Noise (±5) — tránh deterministic
  score += (Math.random() - 0.5) * 10;

  return Math.round(score * 100) / 100;
}

function isPopularPattern(sortedKey) {
  return POPULAR_PATTERNS.includes(sortedKey);
}

function countConsecutivePairs(sorted) {
  let count = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] === 1) count++;
  }
  return count;
}

function sameLastDigitCount(nums) {
  const digitCounts = {};
  for (const n of nums) {
    const d = n % 10;
    digitCounts[d] = (digitCounts[d] || 0) + 1;
  }
  return Math.max(...Object.values(digitCounts));
}

export async function generatePrediction(game) {
  const gameConfig = getGame(game);
  if (!gameConfig || !gameConfig.ballCount) return null;

  const { ballCount, maxBall, hasSpecialBall } = gameConfig;

  const stats = getStats(game);
  const advanced = getAdvancedStats(game);
  const specialStats = getSpecialBallStats(game);
  const matrix = getTransitionMatrix(game, 3);
  const deltaInfo = getDeltaPatterns(game);
  const decadeDist = getDecadeDistribution(game);
  const recentDraws = getLatestDraws(game, 200);

  if (stats.length === 0) return null;

  const pairs = buildPairMatrix(recentDraws);
  const lastDraw = advanced?.recentDrawBalls?.[0] || [];
  const maxWeighted = Math.max(...stats.map(s => s.weightedScore));

  // Score all numbers
  const allNumbers = [];
  for (let i = 1; i <= maxBall; i++) {
    const s = scoreNumber(i, stats, matrix, lastDraw, decadeDist, gameConfig, maxWeighted);
    allNumbers.push({ n: i.toString().padStart(2, '0'), w: Math.max(s, 0.01), score: s });
  }
  allNumbers.sort((a, b) => b.score - a.score);

  const [defaultSumMin, defaultSumMax] = DEFAULT_SUM_RANGES[game] || [50, 170];
  const targetSumMin = advanced?.sumMin ?? defaultSumMin;
  const targetSumMax = advanced?.sumMax ?? defaultSumMax;

  const validEvenOdd = new Set();
  if (advanced?.evenOddDist) {
    const entries = Object.entries(advanced.evenOddDist).sort((a, b) => b[1] - a[1]);
    let cumulative = 0;
    for (const [key, pct] of entries) {
      validEvenOdd.add(key);
      cumulative += pct;
      if (cumulative >= 80) break;
    }
  }
  if (validEvenOdd.size === 0) {
    for (const eo of DEFAULT_EVEN_ODD[ballCount] || []) validEvenOdd.add(eo);
  }

  const spreadMin = deltaInfo?.spreadMin ?? Math.round(maxBall * 0.4);
  const spreadMax = deltaInfo?.spreadMax ?? Math.round(maxBall * 0.9);
  const recentSets = (advanced?.recentDrawBalls || []).map(b => [...b].sort((a, c) => a - c).join(','));

  // Build 3 tiers: hot (top 33%), warm (mid), cold (bottom 33%)
  const tierSize = Math.round(maxBall / 3);
  const tierA = allNumbers.slice(0, tierSize);
  const tierB = allNumbers.slice(tierSize, tierSize * 2);
  const tierC = allNumbers.slice(tierSize * 2);

  const tierConfigs = TIER_CONFIGS[ballCount] || TIER_CONFIGS[6];
  const minDecades = Math.max(2, Math.ceil(ballCount / 2));
  const validCandidates = [];
  let attempts = 0;

  while (attempts < 5000) {
    attempts++;
    const selected = new Set();
    const config = tierConfigs[Math.floor(Math.random() * tierConfigs.length)];
    const temp = 0.3 + Math.random() * 0.5;

    while (selected.size < config[0]) selected.add(weightedPick(tierA, temp));
    while (selected.size < config[0] + config[1]) selected.add(weightedPick(tierB, temp));
    while (selected.size < ballCount) selected.add(weightedPick(tierC, temp));

    const candidate = Array.from(selected).sort((a, b) => parseInt(a) - parseInt(b));
    const nums = candidate.map(n => parseInt(n));
    const sum = nums.reduce((a, b) => a + b, 0);
    const evens = nums.filter(n => n % 2 === 0).length;
    const eoKey = `${evens}/${ballCount - evens}`;

    // Filter 1: Sum range
    if (sum < targetSumMin || sum > targetSumMax) continue;

    // Filter 2: Even/Odd common patterns
    if (!validEvenOdd.has(eoKey)) continue;

    const sorted = [...nums].sort((a, b) => a - b);
    const spread = sorted[ballCount - 1] - sorted[0];

    // Filter 3: Spread range
    if (spread < spreadMin || spread > spreadMax) continue;

    // Filter 4: Not a duplicate of recent draws
    if (recentSets.includes(sorted.join(','))) continue;

    // Filter 5: Decade diversity
    const decades = new Set(sorted.map(n => Math.floor((n - 1) / 10)));
    if (decades.size < minDecades) continue;

    // Filter 6: Max 1 consecutive pair (e.g., 12-13)
    if (countConsecutivePairs(sorted) > 1) continue;

    // Filter 7: No more than 3 numbers with same last digit
    if (sameLastDigitCount(nums) > Math.ceil(ballCount / 2)) continue;

    // Filter 8: Avoid popular patterns (anti-jackpot-split)
    if (isPopularPattern(sorted.map(n => n.toString().padStart(2, '0')).join(','))) continue;

    // Score the candidate using base score + pair correlation bonus
    const scoreMap = {};
    allNumbers.forEach(x => { scoreMap[x.n] = x.score; });
    const baseScore = candidate.reduce((s, n) => s + (scoreMap[n] || 0), 0);

    let pairBonus = 0;
    for (let i = 0; i < candidate.length; i++) {
      const others = candidate.filter((_, j) => j !== i);
      pairBonus += pairScore(candidate[i], others, pairs);
    }
    pairBonus = (pairBonus / (recentDraws.length || 1)) * 5;

    // Sum proximity bonus — gần mean được +5
    const sumMid = (targetSumMin + targetSumMax) / 2;
    const sumProximity = 1 - Math.abs(sum - sumMid) / ((targetSumMax - targetSumMin) / 2);
    const proximityBonus = sumProximity * 5;

    const totalScore = baseScore + pairBonus + proximityBonus;
    validCandidates.push({ candidate, totalScore, baseScore, pairBonus });

    if (validCandidates.length >= 30) break;
  }

  let best, bestScore;
  if (validCandidates.length > 0) {
    validCandidates.sort((a, b) => b.totalScore - a.totalScore);
    // Pick from top 5 randomly for diversity
    const topN = validCandidates.slice(0, Math.min(5, validCandidates.length));
    const pick = topN[Math.floor(Math.random() * topN.length)];
    best = pick.candidate;
    bestScore = pick.totalScore;
  } else {
    const selected = new Set();
    while (selected.size < ballCount) selected.add(weightedPick(allNumbers, 0.3));
    best = Array.from(selected).sort((a, b) => parseInt(a) - parseInt(b));
    bestScore = 0;
  }

  // Special ball: exclude last 3 special balls + use top-weighted with gap bonus
  let special = null;
  if (hasSpecialBall) {
    const recentSpecials = new Set(
      recentDraws.slice(0, 3).map(d => d.special_ball?.trim()).filter(Boolean)
    );
    const sbPool = specialStats.length > 0
      ? specialStats
          .filter(s => !recentSpecials.has(s.number))
          .map(s => ({ n: s.number, w: s.weightedScore + (s.gap * 0.15) }))
      : allNumbers.slice(0, 20);
    special = weightedPick(sbPool.length > 0 ? sbPool : specialStats.map(s => ({ n: s.number, w: s.weightedScore })), 0.4);
  }

  const topScored = allNumbers.slice(0, 10).map(x => ({ number: x.n, score: x.score }));
  const nums = best.map(n => parseInt(n));
  const sorted = [...nums].sort((a, b) => a - b);

  const result = {
    main: best,
    special,
    attempts,
    candidatesFound: validCandidates.length,
    sumRange: [targetSumMin, targetSumMax],
    confidence: Math.round(bestScore * 10) / 10,
    topScored,
    breakdown: {
      sum: nums.reduce((a, b) => a + b, 0),
      evens: nums.filter(n => n % 2 === 0).length,
      odds: nums.filter(n => n % 2 !== 0).length,
      spread: sorted[ballCount - 1] - sorted[0],
      decadeCount: new Set(sorted.map(n => Math.floor((n - 1) / 10))).size,
      consecutive: countConsecutivePairs(sorted),
    }
  };

  savePredictionHistory(game, result);
  return result;
}

export async function fetchHistory(game, limit = 50) {
  const rows = dbGetHistory(game, limit);
  return rows.map(r => ({
    id: r.id,
    game: r.game,
    main: r.main.split(', '),
    special: r.special,
    breakdown: { sum: r.breakdown_sum, evens: r.breakdown_evens, spread: r.breakdown_spread, decadeCount: r.breakdown_decades },
    confidence: r.confidence,
    date: r.created_at
  }));
}

export async function clearHistory(game) {
  return dbClearHistory(game);
}

export async function deleteHistoryItem(id) {
  return dbDeleteById(id);
}
