import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { TRIVIA_CATEGORIES } from '../config/constants';
import { supabase } from './supabase';

const CATALOG_KEY = 'bdk-offline-catalog';
const GAMES_KEY = 'bdk-offline-games';
const PAGE_SIZE = 500;
let catalogSyncPromise;

export const isOfflineSession = sessionId => String(sessionId || '').startsWith('offline:');

async function readJson(key, fallback) {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export async function getCachedCatalog() {
  return readJson(CATALOG_KEY, null);
}

export async function getAvailableCategories() {
  const catalog = await getCachedCatalog();
  if (catalog?.categories?.length) return catalog.categories;
  return Object.entries(TRIVIA_CATEGORIES).map(([key, value], sort_order) => ({ key, ...value, sort_order }));
}

export async function syncCatalog() {
  if (catalogSyncPromise) return catalogSyncPromise;
  catalogSyncPromise = (async () => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data: categories, error: categoryError } = await supabase.from('trivia_categories')
      .select('key,label,icon,sort_order').eq('is_active', true).order('sort_order');
    if (categoryError) throw categoryError;

    const questions = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase.from('trivia_questions')
        .select('id,category,difficulty,character,question,option_a,option_b,option_c,option_d,correct_option,explanation,bible_reference,hint,image_url,updated_at')
        .eq('is_published', true).order('updated_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      questions.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
    }
    const catalog = { categories: categories || [], questions, syncedAt: new Date().toISOString() };
    await AsyncStorage.setItem(CATALOG_KEY, JSON.stringify(catalog));
    return catalog;
  })();
  try { return await catalogSyncPromise; }
  finally { catalogSyncPromise = null; }
}

async function readGames() {
  return readJson(GAMES_KEY, []);
}

async function writeGames(games) {
  await AsyncStorage.setItem(GAMES_KEY, JSON.stringify(games));
}

function toPlayableQuestion(question) {
  return {
    id: question.id,
    character: question.character,
    question: question.question,
    options: [
      { key: 'a', text: question.option_a },
      { key: 'b', text: question.option_b },
      { key: 'c', text: question.option_c },
      { key: 'd', text: question.option_d },
    ],
    correct_option: question.correct_option,
    explanation: question.explanation,
    bible_reference: question.bible_reference,
    hint: question.hint,
    image_url: question.image_url,
  };
}

export async function startOfflineGame(category, difficulty, timer = true, stage = 1) {
  const catalog = await getCachedCatalog();
  const pool = (catalog?.questions || []).filter(row => row.category === category && row.difficulty === difficulty);
  if (pool.length < 10) throw new Error('Download at least 10 published questions for this category and level before playing offline.');
  const shuffled = [...pool];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  const questions = shuffled.slice(0, 10).map(toPlayableQuestion);
  const session_id = `offline:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const games = await readGames();
  games.push({ id: session_id, category, difficulty, timer, stage: Number(stage) || 1, questions: questions.map(row => row.id), answers: [], status: 'active' });
  await writeGames(games);
  return { session_id, questions };
}

export async function answerOfflineGame(sessionId, questionId, chosen, timeLeft) {
  const games = await readGames();
  const game = games.find(row => row.id === sessionId);
  if (!game || game.status !== 'active') throw new Error('Offline game was not found or is already finished.');
  if (!game.questions.includes(questionId) || game.answers.some(row => row.question_id === questionId)) throw new Error('This question is not available in the current game.');
  const catalog = await getCachedCatalog();
  const question = catalog?.questions?.find(row => row.id === questionId);
  if (!question) throw new Error('This question is missing from the downloaded quiz pack.');
  const correct = String(chosen || '').toLowerCase() === question.correct_option;
  const previousStreak = game.answers.at(-1)?.streak || 0;
  const streak = correct ? previousStreak + 1 : 0;
  game.answers.push({ question_id: questionId, chosen_option: chosen ? String(chosen).toLowerCase() : null, time_left: Math.max(0, Number(timeLeft) || 0), correct, points: correct ? 10 : 0, streak });
  await writeGames(games);
  return { correct, points: correct ? 10 : 0, streak, correct_option: question.correct_option, explanation: question.explanation, bible_reference: question.bible_reference, time_left: timeLeft };
}

export async function finishOfflineGame(sessionId) {
  const games = await readGames();
  const game = games.find(row => row.id === sessionId);
  if (!game) throw new Error('Offline game was not found.');
  const total = game.questions.length;
  const correct = game.answers.filter(row => row.correct).length;
  const stars = total && correct * 100 >= total * 85 ? 3 : total && correct * 100 >= total * 70 ? 2 : total && correct * 100 >= total * 50 ? 1 : 0;
  game.status = 'pending';
  game.result = { score: game.answers.reduce((sum, row) => sum + row.points, 0), correct, total, best_streak: Math.max(0, ...game.answers.map(row => row.streak)), stars, saved: false, new_personal_best: false, new_badges: [] };
  await writeGames(games);
  await syncPendingGames();
  const updatedGames = await readGames();
  return updatedGames.find(row => row.id === sessionId)?.result || game.result;
}

export async function syncPendingGames() {
  if (!supabase) return 0;
  const connection = await NetInfo.fetch();
  if (!connection.isConnected || connection.isInternetReachable === false) return 0;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return 0;
  const games = await readGames();
  let count = 0;
  const syncedGameIds = [];
  for (const game of games) {
    if (game.status !== 'pending') continue;
    const { data, error } = await supabase.rpc('sync_offline_game', {
      p_client_game_id: game.id,
      p_category: game.category,
      p_difficulty: game.difficulty,
      p_timer: game.timer,
      p_stage: game.stage,
      p_answers: game.answers.map(({ question_id, chosen_option, time_left }) => ({ question_id, chosen_option, time_left })),
    });
    if (error) continue;
    game.status = 'synced';
    game.result = { ...game.result, ...data, saved: true };
    game.syncedAt = new Date().toISOString();
    count += 1;
    syncedGameIds.push(game.id);
  }
  if (count) {
    await writeGames(games);
    for (const game of games.filter(row => syncedGameIds.includes(row.id))) {
      const pending = await readJson('bdk-pending', null);
      if (pending?.sid === game.id) await AsyncStorage.removeItem('bdk-pending');
      const lastResult = await readJson('bdk-last-result', null);
      if (lastResult?.sid === game.id) {
        lastResult.result = game.result;
        await AsyncStorage.setItem('bdk-last-result', JSON.stringify(lastResult));
      }
    }
  }
  return count;
}

export async function claimOfflineGame(sessionId) {
  let games = await readGames();
  let game = games.find(row => row.id === sessionId);
  if (!game) throw new Error('Offline game was not found.');
  if (game.status !== 'synced') {
    await syncPendingGames();
    games = await readGames();
    game = games.find(row => row.id === sessionId);
  }
  if (game?.status !== 'synced') throw new Error('This game is queued on this device. Sign in and reconnect to sync it.');
  return { score: game.result.score, new_badges: game.result.new_badges || [] };
}

export async function getOfflineGameLessons(sessionId) {
  const games = await readGames();
  const game = games.find(row => row.id === sessionId);
  const catalog = await getCachedCatalog();
  if (!game || !catalog) return [];
  const questionById = new Map(catalog.questions.map(question => [question.id, question]));
  return game.questions.map(id => {
    const question = questionById.get(id);
    return question ? [question.explanation, question.bible_reference].filter(Boolean).join(' ') : '';
  }).filter(Boolean);
}

export async function getOfflineSyncStatus() {
  const [catalog, games] = await Promise.all([getCachedCatalog(), readGames()]);
  return { syncedAt: catalog?.syncedAt || null, questionCount: catalog?.questions?.length || 0, pendingGames: games.filter(row => row.status === 'pending').length };
}