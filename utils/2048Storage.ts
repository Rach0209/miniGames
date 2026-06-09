import { supabase } from './supabase';

export interface Game2048Stats {
  totalGames: number;
  bestScore: number;
  bestTile: number;
  // 달성한 최고 타일 구간별 횟수: [128, 256, 512, 1024, 2048, 4096+]
  distribution: number[];
}

const GAME_TYPE = '2048';

const defaultStats: Game2048Stats = {
  totalGames: 0,
  bestScore: 0,
  bestTile: 0,
  distribution: Array(6).fill(0),
};

const TILE_MILESTONES = [128, 256, 512, 1024, 2048, 4096];

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function loadRemoteStats(userId: string): Promise<Game2048Stats | null> {
  const { data, error } = await supabase
    .from('game_stats')
    .select('*')
    .eq('user_id', userId)
    .eq('game_type', GAME_TYPE)
    .maybeSingle();

  if (error || !data) return null;

  return {
    totalGames: data.total_games,
    bestScore: data.wins,
    bestTile: data.current_streak,
    distribution: data.distribution ?? Array(6).fill(0),
  };
}

async function saveRemoteStats(userId: string, stats: Game2048Stats): Promise<void> {
  await supabase.from('game_stats').upsert({
    user_id: userId,
    game_type: GAME_TYPE,
    total_games: stats.totalGames,
    wins: stats.bestScore,
    current_streak: stats.bestTile,
    max_streak: stats.bestScore,
    distribution: stats.distribution,
    last_played_date: getTodayDate(),
    last_played_won: stats.bestTile >= 2048,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,game_type' });
}

export async function load2048Stats(): Promise<Game2048Stats> {
  const user = await getCurrentUser();
  if (user) {
    const remote = await loadRemoteStats(user.id);
    if (remote) return remote;
  }
  return { ...defaultStats };
}

export async function update2048Stats(score: number, maxTile: number): Promise<Game2048Stats> {
  const stats = await load2048Stats();
  stats.totalGames += 1;
  if (score > stats.bestScore) stats.bestScore = score;
  if (maxTile > stats.bestTile) stats.bestTile = maxTile;

  const milestoneIdx = TILE_MILESTONES.findLastIndex(m => maxTile >= m);
  if (milestoneIdx >= 0) {
    stats.distribution[milestoneIdx] = (stats.distribution[milestoneIdx] || 0) + 1;
  }

  const user = await getCurrentUser();
  if (user) await saveRemoteStats(user.id, stats);

  return stats;
}
