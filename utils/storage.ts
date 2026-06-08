import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export interface GameStats {
  totalGames: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  distribution: number[];
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

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// 비로그인은 저장하지 않음 — 항상 기본값 반환
async function loadLocalStats(): Promise<GameStats> {
  return { ...defaultStats };
}

// ── Supabase 통계 (로그인) ──
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

async function saveRemoteStats(userId: string, stats: GameStats, won: boolean): Promise<void> {
  await supabase.from('game_stats').upsert({
    user_id: userId,
    game_type: GAME_TYPE,
    total_games: stats.totalGames,
    wins: stats.wins,
    current_streak: stats.currentStreak,
    max_streak: stats.maxStreak,
    distribution: stats.distribution,
    last_played_date: getTodayDate(),
    last_played_won: won,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,game_type' });
}

// ── 오늘 플레이 여부 (로그인 유저만) ──
export interface TodayStatus {
  played: boolean;
  won: boolean;
}

export async function loadTodayStatus(): Promise<TodayStatus | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('game_stats')
    .select('last_played_date, last_played_won')
    .eq('user_id', user.id)
    .eq('game_type', GAME_TYPE)
    .maybeSingle();

  if (error || !data || data.last_played_date !== getTodayDate()) return null;

  return { played: true, won: data.last_played_won ?? false };
}

// ── 공개 API ──
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
    await saveRemoteStats(user.id, stats, won);
  }
  // 비로그인: 저장하지 않음

  return stats;
}
