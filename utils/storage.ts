import AsyncStorage from '@react-native-async-storage/async-storage';

export interface GameStats {
  totalGames: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  distribution: number[]; // index 0 = won on try 1, index 4 = won on try 5
}

const STATS_KEY = 'jamo_wordle_stats';

const defaultStats: GameStats = {
  totalGames: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  distribution: [0, 0, 0, 0, 0],
};

export async function loadStats(): Promise<GameStats> {
  try {
    const data = await AsyncStorage.getItem(STATS_KEY);
    if (data) return { ...defaultStats, ...JSON.parse(data) };
  } catch {}
  return { ...defaultStats };
}

export async function updateStats(won: boolean, attempts: number): Promise<GameStats> {
  const stats = await loadStats();
  stats.totalGames += 1;
  if (won) {
    stats.wins += 1;
    stats.currentStreak += 1;
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
    stats.distribution[attempts - 1] = (stats.distribution[attempts - 1] || 0) + 1;
  } else {
    stats.currentStreak = 0;
  }
  await AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats));
  return stats;
}
