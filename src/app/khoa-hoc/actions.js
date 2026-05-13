'use server';
import { getLatestDraws } from '@/lib/db';
import { getGame } from '@/lib/games';

// ============================================================================
// STRATEGY DEFINITIONS — Each strategy returns N predicted ball numbers
// ============================================================================

function strategyPureHot(trainData, game) {
  const cfg = getGame(game);
  const freq = {};
  for (const d of trainData) {
    if (!d.balls) continue;
    d.balls.split(',').map(b => b.trim()).forEach(b => {
      freq[b] = (freq[b] || 0) + 1;
    });
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, cfg.ballCount)
    .map(([n]) => n);
}

function strategyPureCold(trainData, game) {
  const cfg = getGame(game);
  const lastSeen = {};
  for (let i = 1; i <= cfg.maxBall; i++) {
    lastSeen[i.toString().padStart(2, '0')] = -1;
  }
  trainData.forEach((d, idx) => {
    if (!d.balls) return;
    d.balls.split(',').map(b => b.trim()).forEach(b => {
      lastSeen[b] = idx;
    });
  });
  return Object.entries(lastSeen)
    .sort((a, b) => a[1] - b[1])
    .slice(0, cfg.ballCount)
    .map(([n]) => n);
}

function strategyRecencyDecay(trainData, game) {
  const cfg = getGame(game);
  const DECAY = 0.997;
  const total = trainData.length;
  const scores = {};
  for (let i = 0; i < total; i++) {
    if (!trainData[i].balls) continue;
    const weight = Math.pow(DECAY, total - 1 - i);
    trainData[i].balls.split(',').map(b => b.trim()).forEach(b => {
      scores[b] = (scores[b] || 0) + weight;
    });
  }
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, cfg.ballCount)
    .map(([n]) => n);
}

function strategyMarkov(trainData, game) {
  const cfg = getGame(game);
  if (trainData.length < 5) return strategyPureHot(trainData, game);
  const lastBalls = trainData[trainData.length - 1].balls?.split(',').map(b => b.trim()) || [];
  const transitions = {};
  for (let i = 1; i < trainData.length; i++) {
    if (!trainData[i - 1].balls || !trainData[i].balls) continue;
    const prev = trainData[i - 1].balls.split(',').map(b => b.trim());
    const curr = trainData[i].balls.split(',').map(b => b.trim());
    for (const p of prev) {
      for (const c of curr) {
        if (!transitions[c]) transitions[c] = 0;
        if (lastBalls.includes(p)) transitions[c]++;
      }
    }
  }
  return Object.entries(transitions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, cfg.ballCount)
    .map(([n]) => n);
}

function strategyHotColdMix(trainData, game) {
  const cfg = getGame(game);
  const hot = strategyPureHot(trainData, game);
  const cold = strategyPureCold(trainData, game);
  const selected = new Set();
  const hotCount = Math.ceil(cfg.ballCount / 2);
  const coldCount = Math.floor(cfg.ballCount / 2);
  for (const h of hot) {
    if (selected.size >= hotCount) break;
    selected.add(h);
  }
  for (const c of cold) {
    if (selected.size >= cfg.ballCount) break;
    selected.add(c);
  }
  return Array.from(selected).slice(0, cfg.ballCount);
}

function strategyGapBased(trainData, game) {
  const cfg = getGame(game);
  const lastSeen = {};
  for (let i = 1; i <= cfg.maxBall; i++) {
    lastSeen[i.toString().padStart(2, '0')] = -1;
  }
  trainData.forEach((d, idx) => {
    if (!d.balls) return;
    d.balls.split(',').map(b => b.trim()).forEach(b => {
      lastSeen[b] = idx;
    });
  });
  // Score = gap (longer gap = higher score)
  const scores = {};
  const total = trainData.length;
  for (const [num, seen] of Object.entries(lastSeen)) {
    scores[num] = total - seen;
  }
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, cfg.ballCount)
    .map(([n]) => n);
}

function strategyEnsembleV4(trainData, game) {
  const cfg = getGame(game);
  const hot = strategyRecencyDecay(trainData, game);
  const cold = strategyGapBased(trainData, game);
  const markov = strategyMarkov(trainData, game);

  // Weighted vote
  const votes = {};
  hot.forEach(n => { votes[n] = (votes[n] || 0) + 3; });
  cold.forEach(n => { votes[n] = (votes[n] || 0) + 1.5; });
  markov.forEach(n => { votes[n] = (votes[n] || 0) + 2; });

  return Object.entries(votes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, cfg.ballCount)
    .map(([n]) => n);
}

function strategyRandom(trainData, game) {
  const cfg = getGame(game);
  const picked = new Set();
  while (picked.size < cfg.ballCount) {
    const n = Math.floor(Math.random() * cfg.maxBall) + 1;
    picked.add(n.toString().padStart(2, '0'));
  }
  return Array.from(picked);
}

const STRATEGIES = [
  { id: 'random', name: 'Chọn ngẫu nhiên', emoji: '🎲', desc: 'Baseline — chọn 6 số bất kỳ, không dùng dữ liệu', fn: strategyRandom },
  { id: 'pure_hot', name: 'Số nóng nhất', emoji: '🔥', desc: 'Top 6 số xuất hiện nhiều nhất trong lịch sử', fn: strategyPureHot },
  { id: 'pure_cold', name: 'Số lạnh nhất', emoji: '❄️', desc: 'Top 6 số lâu chưa xuất hiện', fn: strategyPureCold },
  { id: 'gap', name: 'Lô Gan', emoji: '⏳', desc: 'Số có khoảng cách vắng dài nhất tính tới hiện tại', fn: strategyGapBased },
  { id: 'recency', name: 'Trọng số gần đây', emoji: '📈', desc: 'Số xuất hiện gần đây được tính điểm cao hơn (decay 0.997)', fn: strategyRecencyDecay },
  { id: 'markov', name: 'Chuỗi Markov', emoji: '🔗', desc: 'Xác suất chuyển từ các số kỳ liền trước', fn: strategyMarkov },
  { id: 'hot_cold_mix', name: 'Trộn Nóng Lạnh', emoji: '🌗', desc: 'Một nửa số nóng + một nửa số lạnh', fn: strategyHotColdMix },
  { id: 'ensemble', name: 'Tổng hợp V4', emoji: '🎯', desc: 'Vote-based ensemble: Recency + Gap + Markov', fn: strategyEnsembleV4 },
];

// ============================================================================
// BACKTEST ENGINE
// ============================================================================

function countMatches(predicted, actual) {
  const actualSet = new Set(actual);
  let count = 0;
  for (const p of predicted) {
    if (actualSet.has(p)) count++;
  }
  return count;
}

function backtestStrategy(strategy, allDraws, testWindow, gameConfig) {
  const trainEnd = allDraws.length - testWindow;
  if (trainEnd < 50) return null;

  const hits = { match0: 0, match1: 0, match2: 0, match3: 0, match4: 0, match5: 0, match6: 0 };
  let totalMatched = 0;

  for (let i = trainEnd; i < allDraws.length; i++) {
    const trainData = allDraws.slice(0, i);
    const actual = allDraws[i].balls?.split(',').map(b => b.trim()) || [];
    if (actual.length === 0) continue;

    const predicted = strategy.fn(trainData, gameConfig.code);
    const m = countMatches(predicted, actual);
    hits[`match${m}`] = (hits[`match${m}`] || 0) + 1;
    if (m >= 3) hits.match3++;
    if (m >= 4) hits.match4++;
    if (m >= 5) hits.match5++;
    if (m >= 6) hits.match6++;
    totalMatched += m;
  }

  const avgMatch = totalMatched / testWindow;
  // Expected random match rate for 6-ball lottery from N pool: 6*6/N
  const expectedRandom = (gameConfig.ballCount * gameConfig.ballCount) / gameConfig.maxBall;
  const liftOverRandom = ((avgMatch - expectedRandom) / expectedRandom) * 100;

  return {
    id: strategy.id,
    name: strategy.name,
    emoji: strategy.emoji,
    desc: strategy.desc,
    avgMatch: Math.round(avgMatch * 100) / 100,
    expectedRandom: Math.round(expectedRandom * 100) / 100,
    liftOverRandom: Math.round(liftOverRandom * 10) / 10,
    match3Rate: Math.round((hits.match3 / testWindow) * 1000) / 10,
    match4Rate: Math.round((hits.match4 / testWindow) * 1000) / 10,
    match5Rate: Math.round((hits.match5 / testWindow) * 1000) / 10,
    match6Rate: Math.round((hits.match6 / testWindow) * 1000) / 10,
    totalMatched,
    testedDraws: testWindow,
  };
}

export async function runFullBacktest(game, testWindow = 100, useAllDraws = false) {
  const gameConfig = getGame(game);
  if (!gameConfig || !gameConfig.ballCount) {
    return { error: 'Game không hỗ trợ backtest' };
  }

  const allDraws = getLatestDraws(game, useAllDraws ? 99999 : 500)
    .filter(d => d.balls)
    .sort((a, b) => parseInt(a.draw_id) - parseInt(b.draw_id));

  if (allDraws.length < testWindow + 50) {
    return { error: `Cần ít nhất ${testWindow + 50} kỳ. Hiện có ${allDraws.length}.` };
  }

  const results = [];
  for (const strategy of STRATEGIES) {
    const result = backtestStrategy(strategy, allDraws, testWindow, gameConfig);
    if (result) results.push(result);
  }

  // Sort by avgMatch DESC
  results.sort((a, b) => b.avgMatch - a.avgMatch);

  return {
    game: gameConfig.name,
    totalDraws: allDraws.length,
    testWindow,
    trainSize: allDraws.length - testWindow,
    results,
    winner: results[0],
  };
}

export async function generateWithWinner(game, strategyId, useAllDraws = false) {
  const gameConfig = getGame(game);
  if (!gameConfig || !gameConfig.ballCount) return null;

  const strategy = STRATEGIES.find(s => s.id === strategyId);
  if (!strategy) return null;

  const allDraws = getLatestDraws(game, useAllDraws ? 99999 : 500)
    .filter(d => d.balls)
    .sort((a, b) => parseInt(a.draw_id) - parseInt(b.draw_id));

  if (allDraws.length === 0) return null;

  const predicted = strategy.fn(allDraws, game);
  return {
    main: predicted.sort((a, b) => parseInt(a) - parseInt(b)),
    strategy: { id: strategy.id, name: strategy.name, emoji: strategy.emoji },
  };
}
