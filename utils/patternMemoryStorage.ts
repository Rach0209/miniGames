import { supabase } from './supabase';

export interface PatternMemoryStats {
  totalGames: number;
  highScore: number;       // 최고 라운드 수
  distribution: number[];  // 라운드별 게임 수 (인덱스 = 라운드-1, 최대 30)
}

const GAME_TYPE = 'pattern-memory';

const defaultStats: PatternMemoryStats = {
  totalGames: 0,
  highScore: 0,
  distribution: Array(30).fill(0),
};

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function loadRemoteStats(userId: string): Promise<PatternMemoryStats | null> {
  const { data, error } = await supabase
    .from('game_stats')
    .select('*')
    .eq('user_id', userId)
    .eq('game_type', GAME_TYPE)
    .maybeSingle();

  if (error || !data) return null;

  return {
    totalGames: data.total_games,
    highScore: data.wins,
    distribution: data.distribution ?? Array(30).fill(0),
  };
}

async function saveRemoteStats(userId: string, stats: PatternMemoryStats, score: number): Promise<void> {
  await supabase.from('game_stats').upsert({
    user_id: userId,
    game_type: GAME_TYPE,
    total_games: stats.totalGames,
    wins: stats.highScore,
    current_streak: score,
    max_streak: stats.highScore,
    distribution: stats.distribution,
    last_played_date: getTodayDate(),
    last_played_won: score > 0,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,game_type' });
}

export async function loadPatternMemoryStats(): Promise<PatternMemoryStats> {
  const user = await getCurrentUser();
  if (user) {
    const remote = await loadRemoteStats(user.id);
    if (remote) return remote;
  }
  return { ...defaultStats };
}

export async function updatePatternMemoryStats(score: number): Promise<PatternMemoryStats> {
  const stats = await loadPatternMemoryStats();
  stats.totalGames += 1;
  if (score > stats.highScore) stats.highScore = score;

  const idx = Math.min(score, 29); // 0~29
  stats.distribution[idx] = (stats.distribution[idx] || 0) + 1;

  const user = await getCurrentUser();
  if (user) {
    await saveRemoteStats(user.id, stats, score);
  }

  return stats;
}
