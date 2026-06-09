import { supabase } from './supabase';

export interface ReactionStats {
  totalGames: number;
  bestMs: number;
  distribution: number[];
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  bestMs: number;
  totalGames: number;
  isMe: boolean;
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

function formatUsername(email: string | undefined): string {
  if (!email) return '익명';
  // 이메일에서 @ 앞부분만 사용, 너무 길면 자름
  const local = email.split('@')[0];
  return local.length > 12 ? local.slice(0, 12) + '…' : local;
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
    bestMs: data.wins,
    distribution: data.distribution ?? Array(10).fill(0),
  };
}

async function saveRemoteStats(userId: string, stats: ReactionStats, lastMs: number, username: string): Promise<void> {
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
    username,
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

  const idx = Math.min(Math.floor(avgMs / 100), 9);
  stats.distribution[idx] = (stats.distribution[idx] || 0) + 1;

  const user = await getCurrentUser();
  if (user) {
    const username = formatUsername(user.email ?? '');
    await saveRemoteStats(user.id, stats, avgMs, username);
  }

  return stats;
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from('game_stats')
    .select('user_id, username, wins, total_games')
    .eq('game_type', GAME_TYPE)
    .gt('wins', 0)           // 기록이 있는 유저만
    .order('wins', { ascending: true })  // bestMs 낮을수록 좋음
    .limit(20);

  if (error || !data) return [];

  return data.map((row, i) => ({
    rank: i + 1,
    username: row.username ?? '익명',
    bestMs: row.wins,
    totalGames: row.total_games,
    isMe: !!user && row.user_id === user.id,
  }));
}
