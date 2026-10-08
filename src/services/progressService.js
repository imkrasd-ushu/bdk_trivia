import { rpc, requireSupabase } from './supabase';

export async function getProgress() {
  const client = requireSupabase();
  const [stats, userBadges, badges, history, characters] = await Promise.all([
    client.from('trivia_user_stats').select('*').maybeSingle(),
    client.from('trivia_user_badges').select('badge_id'),
    client.from('trivia_badges').select('*'),
    client.from('trivia_game_sessions').select('difficulty,score,stars,started_at').not('completed_at', 'is', null).order('started_at', { ascending: false }).limit(5),
    client.from('trivia_character_progress').select('character,attempted,correct'),
  ]);
  for (const result of [stats, userBadges, badges, history, characters]) if (result.error) throw result.error;
  return {
    stats: stats.data || { games_completed: 0, questions_answered: 0, correct_answers: 0, best_score: 0, best_streak: 0, stars_earned: 0 },
    earnedBadgeIds: new Set((userBadges.data || []).map(row => row.badge_id)),
    badges: badges.data || [],
    history: history.data || [],
    characters: characters.data || [],
  };
}

export const listChildren = () => rpc('list_children');
export const createLinkCode = () => rpc('create_link_code');
export const redeemLinkCode = code => rpc('redeem_link_code', { p_code: code });
export const resetChildProgress = child => rpc('reset_child_progress', { p_child: child });