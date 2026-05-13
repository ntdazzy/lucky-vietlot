'use server';
import { getStats, getAdvancedStats, getSpecialBallStats, getTransitionMatrix, getDeltaPatterns, getDecadeDistribution, savePredictionHistory, getPredictionHistory as dbGetHistory, clearPredictionHistory as dbClearHistory, deletePredictionById as dbDeleteById } from '@/lib/db';
import { getGame } from '@/lib/games';

function weightedPick(pool, temperature = 0.5) {
  const adjusted = pool.map(item => ({ ...item, w: Math.pow(item.w, temperature) }));
  const totalWeight = adjusted.reduce((s, item) => s + item.w, 0);
  if (totalWeight <= 0) return pool[Math.floor(Math.random() * pool.length)].n;
  let rand = Math.random() * totalWeight;
  for (const item of adjusted) {
    rand -= item.w;
    if (rand <= 0) return item.n;
  }
  return adjusted[adjusted.length - 1].n;
}

function scoreNumber(num, stats, matrix, lastBalls, decadeDist, gameConfig) {
  const { maxBall } = gameConfig;
  const numStr = num.toString().padStart(2, '0');
  const stat = stats.find(s => s.number === numStr);
  if (!stat) return 0;

  let score = 0;
  const maxWeighted = Math.max(...stats.map(s => s.weightedScore));
  score += (stat.weightedScore / (maxWeighted || 1)) * 30;
  score += Math.min(stat.gap / (maxBall * 2), 1) * 15;

  let markovScore = 0;
  for (const prev of lastBalls) {
    const prevStr = prev.toString().padStart(2, '0');
    if (matrix[prevStr]?.[numStr]) markovScore += matrix[prevStr][numStr];
  }
  score += markovScore * 25;

  if (decadeDist) {
    const dIdx = Math.floor((num - 1) / 10) * 10;
    const label = `${dIdx + 1}-${Math.min(dIdx + 10, maxBall)}`;
    const recent = decadeDist.recent?.[label];
    const overall = decadeDist.overall?.[label];
    if (recent && overall && recent.avgPerDraw < overall.avgPerDraw) score += 5;
  }

  score += (Math.random() - 0.5) * 10;
  return Math.round(score * 100) / 100;
}

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

  if (stats.length === 0) return null;

  const lastDraw = advanced?.recentDrawBalls?.[0] || [];

  const allNumbers = [];
  for (let i = 1; i <= maxBall; i++) {
    const s = scoreNumber(i, stats, matrix, lastDraw, decadeDist, gameConfig);
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

  const spreadMin = deltaInfo?.spreadMin ?? 20;
  const spreadMax = deltaInfo?.spreadMax ?? 40;
  const recentSets = (advanced?.recentDrawBalls || []).map(b => [...b].sort((a, c) => a - c).join(','));

  const tierSize = Math.round(maxBall / 3);
  const tierA = allNumbers.slice(0, tierSize);
  const tierB = allNumbers.slice(tierSize, tierSize * 2);
  const tierC = allNumbers.slice(tierSize * 2);

  const tierConfigs = TIER_CONFIGS[ballCount] || TIER_CONFIGS[6];
  const minDecades = Math.max(2, Math.ceil(ballCount / 2));
  const validCandidates = [];
  let attempts = 0;

  while (attempts < 3000) {
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

    if (sum < targetSumMin || sum > targetSumMax) { attempts++; continue; }
    if (!validEvenOdd.has(eoKey)) { attempts++; continue; }

    const sorted = [...nums].sort((a, b) => a - b);
    const spread = sorted[ballCount - 1] - sorted[0];
    if (spread < spreadMin || spread > spreadMax) { attempts++; continue; }
    if (recentSets.includes(sorted.join(','))) { attempts++; continue; }

    const decades = new Set(sorted.map(n => Math.floor((n - 1) / 10)));
    if (decades.size < minDecades) { attempts++; continue; }

    const scoreMap = {};
    allNumbers.forEach(x => { scoreMap[x.n] = x.score; });
    const totalScore = candidate.reduce((s, n) => s + (scoreMap[n] || 0), 0);
    validCandidates.push({ candidate, totalScore });
    if (validCandidates.length >= 20) break;
    attempts++;
  }

  let best, bestScore;
  if (validCandidates.length > 0) {
    validCandidates.sort((a, b) => b.totalScore - a.totalScore);
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

  let special = null;
  if (hasSpecialBall) {
    const sbPool = specialStats.length > 0
      ? specialStats.map(s => ({ n: s.number, w: s.weightedScore + (s.gap * 0.1) }))
      : allNumbers.slice(0, 20);
    special = weightedPick(sbPool, 0.4);
  }

  const topScored = allNumbers.slice(0, 10).map(x => ({ number: x.n, score: x.score }));
  const nums = best.map(n => parseInt(n));
  const sorted = [...nums].sort((a, b) => a - b);

  const result = {
    main: best,
    special,
    attempts,
    sumRange: [targetSumMin, targetSumMax],
    confidence: Math.round(bestScore * 10) / 10,
    topScored,
    breakdown: {
      sum: nums.reduce((a, b) => a + b, 0),
      evens: nums.filter(n => n % 2 === 0).length,
      odds: nums.filter(n => n % 2 !== 0).length,
      spread: sorted[ballCount - 1] - sorted[0],
      decadeCount: new Set(sorted.map(n => Math.floor((n - 1) / 10))).size
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
