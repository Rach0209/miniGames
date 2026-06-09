import { supabase } from './supabase';

export interface ReactionStats {
  totalGames: number;
  bestMs: number;       // 최고 기록 (낮을수록 좋음, 0 = 기록 없음)
  distribution: number[]; // 구간별 게임 수 (0~100, 100~200, ..., 900~1000ms)
}

const GAME_TYPE = 'reaction-test';

const defaultStats: ReactionStats = {
  totalGames: 0,
  bestMs: 0,
  distribution: Array(10).fill(0),
};

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function loadRemoteStats(userId: string): Promise<ReactionStats | null> {
  const { data, error } = await supabase
    .from('game_stats')
    .select('*')
    .eq('user_id', userId)
    .eq('game_type', GAME_TYPE)
    .maybeSingle();

  if (error || !data) return null;

  return {
    totalGames: data.total_games,
    bestMs: data.wins,           // wins 컬럼에 bestMs 저장
    distribution: data.distribution ?? Array(10).fill(0),
  };
}

async function saveRemoteStats(userId: string, stats: ReactionStats, lastMs: number): Promise<void> {
  await supabase.from('game_stats').upsert({
    user_id: userId,
    game_type: GAME_TYPE,
    total_games: stats.totalGames,
    wins: stats.bestMs,
    current_streak: lastMs,
    max_streak: stats.bestMs,
    distribution: stats.distribution,
    last_played_date: getTodayDate(),
    last_played_won: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,game_type' });
}

export async function loadReactionStats(): Promise<ReactionStats> {
  const user = await getCurrentUser();
  if (user) {
    const remote = await loadRemoteStats(user.id);
    if (remote) return remote;
  }
  return { ...defaultStats };
}

export async function updateReactionStats(avgMs: number): Promise<ReactionStats> {
  const stats = await loadReactionStats();
  stats.totalGames += 1;
  if (stats.bestMs === 0 || avgMs < stats.bestMs) stats.bestMs = avgMs;

  // 구간 분류: 0~99ms=0, 100~199ms=1, ..., 900ms+=9
  const idx = Math.min(Math.floor(avgMs / 100), 9);
  stats.distribution[idx] = (stats.distribution[idx] || 0) + 1;

  const user = await getCurrentUser();
  if (user) await saveRemoteStats(user.id, stats, avgMs);

  return stats;
}
