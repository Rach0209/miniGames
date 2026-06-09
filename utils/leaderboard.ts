import { supabase } from './supabase';

export interface LeaderboardEntry {
  rank: number;
  username: string;
  value: number;   // wins 컬럼 값 (게임마다 의미 다름)
  totalGames: number;
  isMe: boolean;
}

/**
 * 특정 game_type의 리더보드를 조회
 * @param gameType  game_stats.game_type 값
 * @param ascending true = 낮을수록 좋음 (반응속도), false = 높을수록 좋음 (나머지)
 */
export async function fetchGameLeaderboard(
  gameType: string,
  ascending = false,
): Promise<LeaderboardEntry[]> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('game_stats')
    .select('user_id, username, wins, total_games')
    .eq('game_type', gameType)
    .gt('wins', 0)
    .order('wins', { ascending })
    .limit(20);

  if (error || !data) return [];

  return data.map((row, i) => ({
    rank: i + 1,
    username: row.username ?? '익명',
    value: row.wins,
    totalGames: row.total_games,
    isMe: !!user && row.user_id === user.id,
  }));
}
