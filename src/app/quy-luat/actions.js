'use server';
import { getLatestDraws, getStats } from '@/lib/db';

export async function analyzePatterns(game) {
  const allDraws = getLatestDraws(game, 5000);
  if (allDraws.length === 0) return null;

  const maxBall = game === '645' ? 45 : 55;
  const totalDraws = allDraws.length;
  const ballsPerDraw = 6;
  const expectedPairFreq = totalDraws * (ballsPerDraw * (ballsPerDraw - 1) / 2) / (maxBall * (maxBall - 1) / 2);

  const pairCounts = {};
  let drawsWithConsecutives = 0;
  let drawsWithRepeats = 0;
  let totalRepeatCount = 0;
  let totalRepeatDraws = 0;

  const recentWindow = Math.min(100, totalDraws);
  let recentConsecutives = 0;
  let recentRepeats = 0;
  let recentRepeatDraws = 0;

  for (let i = 0; i < totalDraws; i++) {
    const draw = allDraws[i];
    if (!draw.balls) continue;
    const balls = draw.balls.split(',').map(b => parseInt(b.trim(), 10)).sort((a, b) => a - b);

    for (let j = 0; j < balls.length; j++) {
      for (let k = j + 1; k < balls.length; k++) {
        const pair = `${balls[j].toString().padStart(2, '0')}-${balls[k].toString().padStart(2, '0')}`;
        pairCounts[pair] = (pairCounts[pair] || 0) + 1;
      }
    }

    let hasConsecutive = false;
    for (let j = 1; j < balls.length; j++) {
      if (balls[j] === balls[j - 1] + 1) {
        hasConsecutive = true;
        break;
      }
    }
    if (hasConsecutive) {
      drawsWithConsecutives++;
      if (i < recentWindow) recentConsecutives++;
    }

    if (i < totalDraws - 1) {
      const prevDraw = allDraws[i + 1];
      if (!prevDraw.balls) continue;
      const prevBalls = new Set(prevDraw.balls.split(',').map(b => parseInt(b.trim(), 10)));

      let repeatCount = 0;
      for (const b of balls) {
        if (prevBalls.has(b)) repeatCount++;
      }
      if (repeatCount > 0) {
        drawsWithRepeats++;
        totalRepeatCount += repeatCount;
        if (i < recentWindow) recentRepeats++;
      }
      totalRepeatDraws++;
      if (i < recentWindow) recentRepeatDraws++;
    }
  }

  const sortedPairs = Object.keys(pairCounts)
    .map(pair => {
      const count = pairCounts[pair];
      const zScore = (count - expectedPairFreq) / Math.sqrt(expectedPairFreq * (1 - expectedPairFreq / totalDraws));
      return { pair, count, zScore: Math.round(zScore * 100) / 100 };
    })
    .sort((a, b) => b.zScore - a.zScore)
    .slice(0, 10);

  const avgRepeatPerDraw = totalRepeatDraws > 0
    ? Math.round((totalRepeatCount / totalRepeatDraws) * 100) / 100
    : 0;

  const stats = getStats(game);
  const topGap = [...stats]
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 10)
    .map(s => ({ number: s.number, gap: s.gap, count: s.count }));

  return {
    totalDraws,
    topPairs: sortedPairs,
    consecutiveProb: Math.round((drawsWithConsecutives / totalDraws) * 100),
    consecutiveProbRecent: recentWindow > 0 ? Math.round((recentConsecutives / recentWindow) * 100) : 0,
    repeatProb: totalRepeatDraws > 0 ? Math.round((drawsWithRepeats / totalRepeatDraws) * 100) : 0,
    repeatProbRecent: recentRepeatDraws > 0 ? Math.round((recentRepeats / recentRepeatDraws) * 100) : 0,
    avgRepeatPerDraw,
    topGap,
    lastDrawBalls: allDraws[0].balls.split(',').map(b => b.trim())
  };
}
