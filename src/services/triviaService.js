import { CATEGORY, normalizeDifficulty } from '../config/constants';
import { rpc } from './supabase';
import { answerOfflineGame, claimOfflineGame, finishOfflineGame, getCachedCatalog, getOfflineGameLessons, isOfflineSession, startOfflineGame, syncCatalog } from './offlineService';

export async function startGame(difficulty, timer = true, category = CATEGORY) {
  const normalizedDifficulty = normalizeDifficulty(difficulty);
  let catalog = await getCachedCatalog();
  const hasEnoughCachedQuestions = () => (catalog?.questions || []).filter(question => question.category === category && question.difficulty === normalizedDifficulty).length >= 10;

  if (!hasEnoughCachedQuestions()) {
    try { catalog = await syncCatalog(); }
    catch { /* Use the remote game RPC if no offline catalog can be downloaded. */ }
  }
  if (hasEnoughCachedQuestions()) return startOfflineGame(category, normalizedDifficulty, timer);

  return rpc('start_game', {
    p_category: category,
    p_difficulty: normalizedDifficulty,
    p_timer: timer,
    p_mode: 'solo',
  });
}

export async function submitAnswer(session, question, chosen, timeLeft) {
  if (isOfflineSession(session)) return answerOfflineGame(session, question, chosen, timeLeft);
  return rpc('submit_answer', { p_session: session, p_question: question, p_chosen: chosen, p_time_left: Math.round(timeLeft * 10) / 10 });
}

export async function finishGame(session) {
  if (isOfflineSession(session)) return finishOfflineGame(session);
  return rpc('finish_game', { p_session: session });
}

export async function claimGame(session) {
  if (isOfflineSession(session)) return claimOfflineGame(session);
  return rpc('claim_game', { p_session: session });
}

export async function gameLessons(session) {
  if (isOfflineSession(session)) return getOfflineGameLessons(session);
  return rpc('game_lessons', { p_session: session });
}