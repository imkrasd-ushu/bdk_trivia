import { rpc, requireSupabase, unwrap } from './supabase';

export async function signIn(email, password) {
  return unwrap(await requireSupabase().auth.signInWithPassword({ email: email.trim(), password }));
}

export async function signUp(email, password) {
  return unwrap(await requireSupabase().auth.signUp({ email: email.trim(), password }));
}

export async function signOut() {
  return unwrap(await requireSupabase().auth.signOut());
}

export async function loadProfile() {
  const { data, error } = await requireSupabase()
    .from('trivia_user_stats')
    .select('nickname,avatar')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function isCurrentUserAdmin() {
  const { data, error } = await requireSupabase()
    .from('trivia_admins')
    .select('user_id')
    .limit(1);
  if (error) return false;
  return Boolean(data?.length);
}

export async function setProfile(nickname, avatar) {
  return rpc('set_profile', { p_nickname: nickname, p_avatar: avatar });
}