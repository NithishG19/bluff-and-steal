export const ROUND_COUNT = 5;
export const ROUND_SECONDS = 15;
export function rankPlayers(players = []) { return [...players].sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname)); }
