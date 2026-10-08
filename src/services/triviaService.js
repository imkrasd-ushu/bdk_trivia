import { CATEGORY, normalizeDifficulty } from '../config/constants';
import { rpc } from './supabase';

export async function startGame(difficulty, timer = true, category = CATEGORY) {
  return rpc('start_game', {
    p_category: category,
    p_difficulty: normalizeDifficulty(difficulty),
    p_timer: timer,
    p_mode: 'solo',
  });
}

export async function submitAnswer(session, question, chosen, timeLeft) {
  return rpc('submit_answer', { p_session: session, p_question: question, p_chosen: chosen, p_time_left: Math.round(timeLeft * 10) / 10 });
}

export async function finishGame(session) {
  return rpc('finish_game', { p_session: session });
}

export async function claimGame(session) {
  return rpc('claim_game', { p_session: session });
}

export async function gameLessons(session) {
  return rpc('game_lessons', { p_session: session });
}