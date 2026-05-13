const GAMES = {
  '645': { code: '645', name: 'Mega 6/45', shortName: 'Mega', ballCount: 6, maxBall: 45, hasSpecialBall: false, tableName: 'draws_645', ticketPrice: 10000 },
  '655': { code: '655', name: 'Power 6/55', shortName: 'Power', ballCount: 6, maxBall: 55, hasSpecialBall: true, tableName: 'draws_655', ticketPrice: 10000 },
  '535': { code: '535', name: 'Lotto 5/35', shortName: 'Lotto', ballCount: 5, maxBall: 35, hasSpecialBall: false, tableName: 'draws_535', ticketPrice: 10000 },
  'max3dpro': { code: 'max3dpro', name: 'Max 3D Pro', shortName: 'Max3D', ballCount: null, maxBall: null, hasSpecialBall: false, tableName: 'draws_max3dpro', ticketPrice: 10000 },
};

export const VALID_GAMES = new Set(Object.keys(GAMES));
export const getGame = (code) => GAMES[code] || null;
export const getGameNames = () => Object.fromEntries(Object.entries(GAMES).map(([k, v]) => [k, v.name]));
export const getLotteryGames = () => Object.values(GAMES).filter(g => g.ballCount !== null);
export const getAllGames = () => Object.values(GAMES);
export const isValidGame = (code) => VALID_GAMES.has(code);
export { GAMES };
