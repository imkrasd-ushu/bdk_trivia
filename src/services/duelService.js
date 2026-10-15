import { rpc } from './supabase';
import { getQuestionHistory, recordQuestionHistory } from './offlineService';

export async function createDuel(category, difficulty, timer, timeLimit, displayName) {
  const excludedQuestions = await getQuestionHistory(category, difficulty);
  const duel = await rpc('create_trivia_duel', {
    p_category: category,
    p_difficulty: difficulty,
    p_timer: timer,
    p_time_limit: timeLimit,
    p_excluded_questions: excludedQuestions,
  });
  await recordQuestionHistory(category, difficulty, duel.question_ids || []);
  const namedDuel = await rpc('set_trivia_duel_player_name', { p_code: duel.code, p_display_name: displayName });
  return { ...duel, ...namedDuel };
}

export async function joinDuel(code, displayName) {
  let duel;
  try {
    duel = await rpc('join_trivia_duel', { p_code: code });
  } catch (error) {
    const messages = {
      not_found: 'No active match uses that code. Check the code and try again.',
      own_code: 'You cannot join your own match. Ask another player to enter the code.',
      unavailable: 'That match already has another player or is no longer available.',
    };
    throw new Error(messages[error.message] || error.message);
  }
  await recordQuestionHistory(duel.category, duel.difficulty, duel.question_ids || []);
  const namedDuel = await rpc('set_trivia_duel_player_name', { p_code: duel.code, p_display_name: displayName });
  return { ...duel, ...namedDuel };
}

export function getDuel(code) {
  return rpc('get_trivia_duel', { p_code: code });
}

export function startDuelGame(code) {
  return rpc('start_trivia_duel_game', { p_code: code });
}

export function finishDuelGame(sessionId) {
  return rpc('finish_trivia_duel_game', { p_session: sessionId });
}
