// Schedule: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
// drawTime: HH:MM in Asia/Ho_Chi_Minh (VN)
const GAMES = {
  '645':      { code: '645',      name: 'Mega 6/45',  shortName: 'Mega',  ballCount: 6, maxBall: 45, hasSpecialBall: false, tableName: 'draws_645',      ticketPrice: 10000, drawDays: [3, 5, 0],    drawTime: '18:00' }, // Wed, Fri, Sun
  '655':      { code: '655',      name: 'Power 6/55', shortName: 'Power', ballCount: 6, maxBall: 55, hasSpecialBall: true,  tableName: 'draws_655',      ticketPrice: 10000, drawDays: [2, 4, 6],    drawTime: '18:00' }, // Tue, Thu, Sat
  '535':      { code: '535',      name: 'Lotto 5/35', shortName: 'Lotto', ballCount: 5, maxBall: 35, hasSpecialBall: false, tableName: 'draws_535',      ticketPrice: 10000, drawDays: [0, 1, 2, 3, 4, 5, 6], drawTime: '21:00' }, // daily, 2 slots (13h + 21h displayed combined)
  'max3dpro': { code: 'max3dpro', name: 'Max 3D Pro', shortName: 'Max3D', ballCount: null, maxBall: null, hasSpecialBall: false, tableName: 'draws_max3dpro', ticketPrice: 10000, drawDays: [2, 4, 6], drawTime: '18:00' }, // Tue, Thu, Sat
};

export const VALID_GAMES = new Set(Object.keys(GAMES));
export const getGame = (code) => GAMES[code] || null;
export const getGameNames = () => Object.fromEntries(Object.entries(GAMES).map(([k, v]) => [k, v.name]));
export const getLotteryGames = () => Object.values(GAMES).filter(g => g.ballCount !== null);
export const getAllGames = () => Object.values(GAMES);
export const isValidGame = (code) => VALID_GAMES.has(code);
export { GAMES };

// Helper: get next N upcoming draw dates for a game
export function getUpcomingDraws(gameCode, count = 10, fromDate = new Date()) {
    const cfg = GAMES[gameCode];
    if (!cfg || !cfg.drawDays) return [];
    const upcoming = [];
    const date = new Date(fromDate);
    date.setHours(0, 0, 0, 0);
    const drawDaySet = new Set(cfg.drawDays);

    for (let i = 0; upcoming.length < count && i < 60; i++) {
        const day = new Date(date);
        day.setDate(day.getDate() + i);
        if (drawDaySet.has(day.getDay())) {
            const [h, m] = cfg.drawTime.split(':').map(Number);
            const drawAt = new Date(day);
            drawAt.setHours(h, m, 0, 0);
            // Skip past draws of today
            if (drawAt > fromDate) {
                upcoming.push(drawAt);
            }
        }
    }
    return upcoming;
}
