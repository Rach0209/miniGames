import { supabase } from './supabase';

export interface StrokePath {
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

export interface Drawing {
  id: string;
  user_id: string;
  answer: string;
  paths: StrokePath[];
  hint: string;
  created_at: string;
  solver_count: number;
  correct_count: number;
}

export interface Guess {
  id: string;
  drawing_id: string;
  user_id: string;
  guess: string;
  is_correct: boolean;
  created_at: string;
}

export async function submitDrawing(
  answer: string,
  hint: string,
  paths: StrokePath[]
) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('로그인이 필요합니다');

  const { data, error } = await supabase
    .from('catch_mind_drawings')
    .insert({
      user_id: userData.user.id,
      answer: answer.trim().toLowerCase(),
      hint: hint.trim(),
      paths,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Drawing;
}

export async function getRandomDrawing(userId?: string): Promise<Drawing | null> {
  let query = supabase
    .from('catch_mind_drawings')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (userId) {
    // 내가 출제한 것 제외, 이미 맞춘 것 제외
    const { data: solvedIds } = await supabase
      .from('catch_mind_guesses')
      .select('drawing_id')
      .eq('user_id', userId)
      .eq('is_correct', true);

    const excludeIds = (solvedIds ?? []).map((g: any) => g.drawing_id);
    query = query.neq('user_id', userId);
    if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.join(',')})`);
    }
  }

  const { data, error } = await query.limit(50);
  if (error) throw error;
  if (!data || data.length === 0) return null;

  const idx = Math.floor(Math.random() * data.length);
  return data[idx] as Drawing;
}

export async function submitGuess(
  drawingId: string,
  guess: string,
  answer: string,
  userId?: string
): Promise<boolean> {
  const isCorrect = guess.trim().toLowerCase() === answer.trim().toLowerCase();

  // 비로그인이면 로컬 체크만
  if (!userId) return isCorrect;

  const { error } = await supabase.from('catch_mind_guesses').insert({
    drawing_id: drawingId,
    user_id: userId,
    guess: guess.trim(),
    is_correct: isCorrect,
  });

  if (error) throw error;
  return isCorrect;
}

export async function getMyDrawings(): Promise<Drawing[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  const { data, error } = await supabase
    .from('catch_mind_drawings')
    .select('*, catch_mind_guesses(count)')
    .eq('user_id', userData.user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Drawing[];
}

export async function deleteDrawing(id: string) {
  const { error } = await supabase
    .from('catch_mind_drawings')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function getMyStats() {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const [drawingsRes, guessesRes] = await Promise.all([
    supabase
      .from('catch_mind_drawings')
      .select('id', { count: 'exact' })
      .eq('user_id', userData.user.id),
    supabase
      .from('catch_mind_guesses')
      .select('is_correct')
      .eq('user_id', userData.user.id),
  ]);

  const guesses = guessesRes.data ?? [];
  const correct = guesses.filter((g: any) => g.is_correct).length;

  return {
    drawingCount: drawingsRes.count ?? 0,
    guessCount: guesses.length,
    correctCount: correct,
  };
}
