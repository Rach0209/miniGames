import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const GAME_TYPE = 'snake';
const LOCAL_BEST_KEY = 'snake_best';
const LOCAL_GAMES_KEY = 'snake_total_games_v1';

async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function loadSnakeBest(): Promise<number> {
  const user = await getCurrentUser();
  if (user) {
    const { data } = await supabase
      .from('game_stats')
      .select('wins')
      .eq('user_id', user.id)
      .eq('game_type', GAME_TYPE)
      .maybeSingle();
    if (data?.wins) return data.wins;
  }
  const val = await AsyncStorage.getItem(LOCAL_BEST_KEY);
  return val ? parseInt(val, 10) : 0;
}

export async function recordSnakeGame(score: number): Promise<void> {
  const user = await getCurrentUser();
  const [bestVal, gamesVal] = await Promise.all([
    AsyncStorage.getItem(LOCAL_BEST_KEY),
    AsyncStorage.getItem(LOCAL_GAMES_KEY),
  ]);
  const currentBest = bestVal ? parseInt(bestVal, 10) : 0;
  const totalGames = (gamesVal ? parseInt(gamesVal, 10) : 0) + 1;
  const newBest = Math.max(currentBest, score);

  await Promise.all([
    AsyncStorage.setItem(LOCAL_BEST_KEY, String(newBest)),
    AsyncStorage.setItem(LOCAL_GAMES_KEY, String(totalGames)),
  ]);

  if (user) {
    await supabase.from('game_stats').upsert({
      user_id: user.id,
      game_type: GAME_TYPE,
      total_games: totalGames,
      wins: newBest,
      max_streak: newBest,
      current_streak: score,
      last_played_date: new Date().toISOString().slice(0, 10),
      last_played_won: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,game_type' });
  }
}
