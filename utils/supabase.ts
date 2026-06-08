import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { transport: ws },
});

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://Rach0209.github.io/miniGames/',
      skipBrowserRedirect: true,
    },
  });
  return { data, error };
}

export async function signOut() {
  return await supabase.auth.signOut();
}

export function getUser() {
  return supabase.auth.getUser();
}

export function onAuthStateChange(callback: (user: any) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
}
