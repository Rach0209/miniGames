import { supabase } from '../utils/supabase';

let cachedWords: string[] = [];

export async function fetchWordPool(): Promise<string[]> {
  if (cachedWords.length > 0) return cachedWords;

  const { data, error } = await supabase
    .from('word_pool')
    .select('word')
    .order('word');

  if (error || !data || data.length === 0) {
    throw new Error('단어 목록을 불러오지 못했어요.');
  }

  cachedWords = data.map((r: { word: string }) => r.word);
  return cachedWords;
}

export function getTodayWord(wordList: string[]): string {
  const today = new Date();
  const dayIndex = Math.floor(
    (today.getTime() - new Date('2025-01-01').getTime()) / (1000 * 60 * 60 * 24)
  );
  return wordList[((dayIndex % wordList.length) + wordList.length) % wordList.length];
}

export function getRandomWord(wordList: string[], exclude?: string): string {
  const pool = exclude ? wordList.filter(w => w !== exclude) : wordList;
  return pool[Math.floor(Math.random() * pool.length)];
}
