// ============================================================================
// REALITY CHECK — Honest math about lottery odds
// ----------------------------------------------------------------------------
// Why this file exists: lottery prediction algorithms in this app can give
// users a false sense of edge. This module surfaces the actual mathematical
// odds and expected value of any bet so users make informed decisions.
//
// Every number here is verifiable — no probability is "boosted" by any
// algorithm. The math of independent draws is not negotiable.
// ============================================================================

function combinations(n, k) {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    k = Math.min(k, n - k);
    let result = 1;
    for (let i = 0; i < k; i++) {
        result = result * (n - i) / (i + 1);
    }
    return Math.round(result);
}

// Total combinations for each game
const TOTAL_COMBOS = {
    '645': combinations(45, 6),   // 8,145,060
    '655': combinations(55, 6),   // 28,989,675
    '535': combinations(35, 5),   // 324,632
};

// Vietlott prize structure (approximate, in VND)
const PRIZE_TABLES = {
    '645': {
        jackpot: 12_000_000_000,     // floor, real jackpot can be higher
        match5:  10_000_000,
        match4:  300_000,
        match3:  30_000,
    },
    '655': {
        jackpot1: 30_000_000_000,
        jackpot2: 3_000_000_000,      // requires special ball
        match5:   40_000_000,
        match4:   500_000,
        match3:   50_000,
    },
    '535': {
        match5: 1_000_000_000,
        match4: 300_000,
        match3: 10_000,
    },
};

const TICKET_PRICE = 10_000;

/**
 * Probability of matching exactly k numbers in a single ticket.
 * Hypergeometric distribution.
 */
function pExactMatch(gameTotal, drawSize, ticketSize, k) {
    return (combinations(drawSize, k) * combinations(gameTotal - drawSize, ticketSize - k))
         / combinations(gameTotal, ticketSize);
}

/**
 * Honest expected value of a single standard ticket.
 * Returns EV in VND (negative means losing money on average).
 */
export function expectedValue(game) {
    const prizes = PRIZE_TABLES[game];
    if (!prizes) return null;

    let ev = 0;
    if (game === '645') {
        ev += pExactMatch(45, 6, 6, 6) * prizes.jackpot;
        ev += pExactMatch(45, 6, 6, 5) * prizes.match5;
        ev += pExactMatch(45, 6, 6, 4) * prizes.match4;
        ev += pExactMatch(45, 6, 6, 3) * prizes.match3;
    } else if (game === '655') {
        // Approximate — ignores split between J1/J2 for simplicity
        ev += pExactMatch(55, 6, 6, 6) * prizes.jackpot1;
        ev += pExactMatch(55, 6, 6, 5) * prizes.match5;
        ev += pExactMatch(55, 6, 6, 4) * prizes.match4;
        ev += pExactMatch(55, 6, 6, 3) * prizes.match3;
    } else if (game === '535') {
        ev += pExactMatch(35, 5, 5, 5) * prizes.match5;
        ev += pExactMatch(35, 5, 5, 4) * prizes.match4;
        ev += pExactMatch(35, 5, 5, 3) * prizes.match3;
    }

    return {
        expectedReturn: ev,
        ticketCost: TICKET_PRICE,
        expectedLossPerTicket: TICKET_PRICE - ev,
        returnRate: ev / TICKET_PRICE,        // ~0.3-0.4 typically
        houseEdge: 1 - (ev / TICKET_PRICE),   // ~60-70% — far worse than casino
    };
}

/**
 * Cost and probability for a "Bao N" wheel system.
 * Returns total tickets, total cost, prob of jackpot, and EV.
 */
export function baoMath(game, baoSize) {
    const drawSize = game === '535' ? 5 : 6;
    const totalCombos = TOTAL_COMBOS[game];
    if (!totalCombos) return null;

    const ticketsGenerated = combinations(baoSize, drawSize);
    const totalCost = ticketsGenerated * TICKET_PRICE;

    // Probability that ALL drawSize winning numbers are within your baoSize picks
    const pAllWithinBao = combinations(baoSize, drawSize) / totalCombos;

    return {
        baoSize,
        ticketsGenerated,
        totalCost,
        pJackpot: pAllWithinBao,
        oddsAgainst: Math.round(1 / pAllWithinBao),
        // Even if you win jackpot, you typically need to win MORE than your spend
        breakEvenJackpot: totalCost / pAllWithinBao,
    };
}

/**
 * Honest verdict for the UI. No sugar-coating.
 */
export function getHonestVerdict(game) {
    const ev = expectedValue(game);
    if (!ev) return null;
    const lossPercent = Math.round(ev.houseEdge * 100);
    return {
        ...ev,
        verdict: `Trung bình bạn MẤT ${lossPercent}% mỗi vé. ` +
                 `10.000đ vé → kỳ vọng nhận lại ${Math.round(ev.expectedReturn).toLocaleString('vi-VN')}đ. ` +
                 `Vietlott KHÔNG phải hình thức đầu tư — đây là giải trí có chi phí.`,
        warningLevel: 'high',
    };
}

/**
 * Backtest validity check — flags if observed lift could just be noise.
 *
 * For a strategy that picks 6 numbers from 45, expected random matches
 * per draw = 6*6/45 ≈ 0.8. Variance per draw ≈ 0.74. Over N tested draws,
 * the standard error of the mean is sqrt(0.74/N).
 *
 * A "lift" of <2 standard errors is indistinguishable from chance.
 */
export function backtestSignificance(game, observedAvgMatch, testedDraws) {
    const expectedRandom = game === '535' ? (5 * 5 / 35) : (game === '645' ? (6 * 6 / 45) : (6 * 6 / 55));
    // Variance of hypergeometric per draw
    const drawSize = game === '535' ? 5 : 6;
    const N = game === '645' ? 45 : (game === '655' ? 55 : 35);
    const variancePerDraw = drawSize * (drawSize / N) * ((N - drawSize) / N) * ((N - drawSize) / (N - 1));
    const stdError = Math.sqrt(variancePerDraw / testedDraws);
    const lift = observedAvgMatch - expectedRandom;
    const zScore = lift / stdError;
    return {
        expectedRandom: Math.round(expectedRandom * 100) / 100,
        observed: Math.round(observedAvgMatch * 100) / 100,
        lift: Math.round(lift * 1000) / 1000,
        zScore: Math.round(zScore * 100) / 100,
        // |z| < 2 = could be pure luck; |z| > 2 = unlikely chance; |z| > 3 = strong signal
        significant: Math.abs(zScore) > 2,
        verdict: Math.abs(zScore) < 2
            ? '⚠️ Sự khác biệt này KHÔNG có ý nghĩa thống kê — có thể chỉ là may rủi'
            : Math.abs(zScore) < 3
                ? 'Có dấu hiệu lệch nhẹ so với random, cần thêm dữ liệu để chắc chắn'
                : '⚠️ Lệch mạnh — kiểm tra lại logic, có thể có bug trong backtest',
    };
}
