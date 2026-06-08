import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export interface GameStats {
  totalGames: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  distribution: number[]; // index 0 = won on try 1, index 4 = won on try 5
}

const STATS_KEY = 'jamo_wordle_stats';
const GAME_TYPE = 'jamo-wordle';

const defaultStats: GameStats = {
  totalGames: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  distribution: [0, 0, 0, 0, 0],
};

async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// 로컬 저장
async function loadLocalStats(): Promise<GameStats> {
  try {
    const data = await AsyncStorage.getItem(STATS_KEY);
    if (data) return { ...defaultStats, ...JSON.parse(data) };
  } catch {}
  return { ...defaultStats };
}

async function saveLocalStats(stats: GameStats): Promise<void> {
  await AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

// Supabase 저장
async function loadRemoteStats(userId: string): Promise<GameStats | null> {
  const { data, error } = await supabase
    .from('game_stats')
    .select('*')
    .eq('user_id', userId)
    .eq('game_type', GAME_TYPE)
    .maybeSingle();

  if (error || !data) return null;

  return {
    totalGames: data.total_games,
    wins: data.wins,
    currentStreak: data.current_streak,
    maxStreak: data.max_streak,
    distribution: data.distribution,
  };
}

async function saveRemoteStats(userId: string, stats: GameStats): Promise<void> {
  await supabase.from('game_stats').upsert({
    user_id: userId,
    game_type: GAME_TYPE,
    total_games: stats.totalGames,
    wins: stats.wins,
    current_streak: stats.currentStreak,
    max_streak: stats.maxStreak,
    distribution: stats.distribution,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,game_type' });
}

// 공개 API
export async function loadStats(): Promise<GameStats> {
  const user = await getCurrentUser();
  if (user) {
    const remote = await loadRemoteStats(user.id);
    if (remote) return remote;
  }
  return loadLocalStats();
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

  const user = await getCurrentUser();
  if (user) {
    await saveRemoteStats(user.id, stats);
  } else {
    await saveLocalStats(stats);
  }

  return stats;
}
