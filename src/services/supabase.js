import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { hasSupabaseConfig, SUPABASE_ANON_KEY, SUPABASE_URL } from '../config/env';

export const supabase = hasSupabaseConfig
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.');
  }
  return supabase;
}

export function unwrap(result) {
  if (result.error) throw result.error;
  if (result.data?.error) throw new Error(String(result.data.error));
  return result.data;
}

export async function rpc(name, params = {}) {
  return unwrap(await requireSupabase().rpc(name, params));
}