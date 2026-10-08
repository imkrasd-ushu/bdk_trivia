import { normalizeDifficulty } from '../config/constants';
import { requireSupabase, rpc } from './supabase';

export async function listQuestions({ difficulty, status, query, category } = {}) {
  const client = requireSupabase();
  let request = client.from('trivia_questions').select('id,category,difficulty,character,question,is_published,updated_at').order('updated_at', { ascending: false }).limit(100);
  if (category && category !== 'all') request = request.eq('category', category);
  if (difficulty) {
    const normalized = normalizeDifficulty(difficulty);
    const values = normalized === 'hard' ? ['hard', 'challenge'] : [normalized];
    request = request.in('difficulty', values);
  }
  if (status === 'published') request = request.eq('is_published', true);
  if (status === 'draft') request = request.eq('is_published', false);
  const cleaned = query?.replace(/[,*()%&]/g, '').trim();
  if (cleaned) request = request.or(`question.ilike.*${cleaned}*,character.ilike.*${cleaned}*`);
  const { data, error } = await request;
  if (error) throw error;
  return data || [];
}

export async function getQuestion(id) {
  const { data, error } = await requireSupabase().from('trivia_questions').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function saveQuestion(question, id) {
  const client = requireSupabase();
  const result = id
    ? await client.from('trivia_questions').update(question).eq('id', id)
    : await client.from('trivia_questions').insert(question);
  if (result.error) throw result.error;
  return result.data;
}

export async function setQuestionPublished(id, isPublished) {
  const { error } = await requireSupabase().from('trivia_questions').update({ is_published: isPublished }).eq('id', id);
  if (error) throw error;
}

export async function deleteQuestion(id) {
  const { error } = await requireSupabase().from('trivia_questions').delete().eq('id', id);
  if (error) throw error;
}

export async function importQuestions(questions) {
  const { data, error } = await requireSupabase().from('trivia_questions').insert(questions).select('id');
  if (error) throw error;
  return data;
}

export const getPoolCounts = () => rpc('admin_pool_counts');
export const getAdminDashboard = () => rpc('admin_dashboard');

export async function uploadQuestionImage(uri) {
  const image = await (await import('expo-image-manipulator')).ImageManipulator.manipulate(uri)
    .resize({ width: 800 })
    .renderAsync();
  const compressed = await image.saveAsync({ format: 'jpeg', compress: 0.8 });
  const fileName = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}.jpg`;
  const response = await fetch(compressed.uri);
  const body = await response.blob();
  const { data, error } = await requireSupabase().storage.from('trivia-images').upload(fileName, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return requireSupabase().storage.from('trivia-images').getPublicUrl(data.path).data.publicUrl;
}