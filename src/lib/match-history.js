// ============================================================================
// MATCH HISTORY — Find past draws that overlap with a candidate pick
// ----------------------------------------------------------------------------
// This is the TRANSPARENCY feature. After generating a set, we look at the
// ENTIRE historical record and list every past draw that shares ≥3 numbers
// with the new pick. The user can see concrete evidence: "Bộ này có 12 kỳ
// quá khứ trùng 3+ số, kỳ gần nhất là #01234 trùng 4 số."
//
// This doesn't say anything about future probability. It's purely a way to
// give the user a visceral sense of how "novel" or "common" their pick is.
// ============================================================================

/**
 * Find all historical draws sharing >= minMatches numbers with the pick.
 *
 * @param {Array<string|number>} pick — the candidate set
 * @param {Array<{draw_id, date, balls}>} allDraws — historical rows
 * @param {number} minMatches — threshold (default 3)
 * @returns {Array<{draw_id, date, balls, matchCount, matched}>}
 */
export function findMatchingDraws(pick, allDraws, minMatches = 3) {
    const pickSet = new Set(
        pick.map(n => typeof n === 'number' ? n.toString().padStart(2, '0') : String(n).trim().padStart(2, '0'))
    );

    const matches = [];
    for (const draw of allDraws) {
        if (!draw.balls) continue;
        const drawBalls = draw.balls.split(',').map(b => b.trim());
        let count = 0;
        const matchedNums = [];
        for (const b of drawBalls) {
            if (pickSet.has(b)) {
                count++;
                matchedNums.push(b);
            }
        }
        if (count >= minMatches) {
            matches.push({
                draw_id: draw.draw_id,
                date: draw.date,
                balls: drawBalls,
                matchCount: count,
                matched: matchedNums,
                special_ball: draw.special_ball || null,
            });
        }
    }

    return matches.sort((a, b) => {
        // Higher match count first; within same count, more recent first
        if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
        return parseInt(b.draw_id, 10) - parseInt(a.draw_id, 10);
    });
}

/**
 * Aggregate stats about the match list.
 */
export function summarizeMatches(matches, totalDraws, ballCount) {
    const byCount = {};
    for (let m = 3; m <= ballCount; m++) byCount[m] = 0;
    for (const m of matches) {
        const k = Math.min(m.matchCount, ballCount);
        byCount[k] = (byCount[k] || 0) + 1;
    }

    return {
        totalMatching: matches.length,
        byCount,
        pctOfHistory: totalDraws > 0 ? Math.round((matches.length / totalDraws) * 1000) / 10 : 0,
        hasExactDuplicate: matches.some(m => m.matchCount === ballCount),
        maxMatch: matches[0]?.matchCount || 0,
    };
}

/**
 * Lightweight check: does this pick exactly match any past draw?
 * Used during candidate generation to reject "literal duplicates of past winners".
 */
export function isDuplicateOfPastWinner(pick, allDraws) {
    const pickKey = pick
        .map(n => typeof n === 'number' ? n.toString().padStart(2, '0') : String(n).padStart(2, '0'))
        .sort()
        .join(',');
    for (const draw of allDraws) {
        if (!draw.balls) continue;
        const key = draw.balls.split(',').map(b => b.trim()).sort().join(',');
        if (key === pickKey) return draw;
    }
    return null;
}
