import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { DEFAULT_CATEGORY } from '../config/constants';
import { supabase } from '../services/supabase';

export const MODULE_SEQUENCE = ['easy', 'medium', 'hard'];

export const MODULES = {
  easy: { label: 'Easy module', maxLevels: 10, passPercent: 85, reward: 'Crown of Courage', certificate: 'Easy Certificate' },
  medium: { label: 'Medium module', maxLevels: 10, passPercent: 85, reward: 'Crown of Wisdom', certificate: 'Medium Certificate' },
  hard: { label: 'Hard module', maxLevels: 10, passPercent: 85, reward: 'Crown of Faith', certificate: 'Category Certificate' },
};

export function createDefaultModuleState() {
  return {
    unlockedLevel: 1,
    completedLevels: [],
    lastPercent: 0,
    lastStage: 0,
    isComplete: false,
    reward: null,
    certificate: null,
  };
}

export function createEmptyProgress() {
  return {
    easy: createDefaultModuleState(),
    medium: { ...createDefaultModuleState(), unlockedLevel: 0 },
    hard: { ...createDefaultModuleState(), unlockedLevel: 0 },
  };
}

export async function loadProgressForCategory(category = DEFAULT_CATEGORY) {
  let progress;
  try {
    const raw = await AsyncStorage.getItem('bdk-module-progress');
    const parsed = raw ? JSON.parse(raw) : {};
    const saved = parsed?.[category] || createEmptyProgress();
    progress = {
      easy: { ...createDefaultModuleState(), ...(saved.easy || {}) },
      medium: { ...createDefaultModuleState(), unlockedLevel: 0, ...(saved.medium || {}) },
      hard: { ...createDefaultModuleState(), unlockedLevel: 0, ...(saved.hard || {}) },
    };
  } catch {
    progress = createEmptyProgress();
  }

  try {
    const connection = await NetInfo.fetch();
    if (supabase && connection.isConnected && connection.isInternetReachable !== false) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data, error } = await supabase.from('trivia_user_level_progress')
          .select('module,unlocked_level,completed_levels,last_percent,last_stage,is_complete,reward,certificate')
          .eq('category', category);
        if (!error) {
          for (const row of data || []) {
            const previous = progress[row.module] || createDefaultModuleState();
            progress[row.module] = {
              ...previous,
              unlockedLevel: Math.max(Number(previous.unlockedLevel || 0), Number(row.unlocked_level || 0)),
              completedLevels: [...new Set([...(previous.completedLevels || []), ...(row.completed_levels || [])])].sort((a, b) => a - b),
              lastPercent: row.last_percent,
              lastStage: row.last_stage,
              isComplete: Boolean(previous.isComplete || row.is_complete),
              reward: row.reward || previous.reward,
              certificate: row.certificate || previous.certificate,
            };
          }
          await saveProgressForCategory(category, progress);
        }
      }
    }
  } catch {
    // Keep locally saved progression when offline or not signed in.
  }

  return progress;
}

export async function saveProgressForCategory(category, value) {
  try {
    const existing = await AsyncStorage.getItem('bdk-module-progress');
    const parsed = existing ? JSON.parse(existing) : {};
    parsed[category] = value;
    await AsyncStorage.setItem('bdk-module-progress', JSON.stringify(parsed));
    return value;
  } catch {
    return value;
  }
}

export async function recordLevelProgress({ category = DEFAULT_CATEGORY, module, stage, correct = 0, total = 10 }) {
  const current = await loadProgressForCategory(category);
  const moduleState = { ...createDefaultModuleState(), ...(current[module] || {}) };
  const threshold = MODULES[module]?.passPercent ?? 85;
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const completedLevels = new Set(moduleState.completedLevels || []);

  moduleState.lastPercent = percent;
  moduleState.lastStage = stage;

  if (percent >= threshold) {
    completedLevels.add(Number(stage));
    moduleState.completedLevels = Array.from(completedLevels).sort((a, b) => a - b);
    const nextLevel = Math.min(MODULES[module].maxLevels, Number(stage) + 1);
    moduleState.unlockedLevel = Math.max(moduleState.unlockedLevel || 1, nextLevel);
    moduleState.reward = MODULES[module].reward;
    if (Number(stage) >= MODULES[module].maxLevels) {
      moduleState.isComplete = true;
      moduleState.certificate = MODULES[module].certificate;
    }
  }

  if (module === 'easy' && moduleState.isComplete) {
    current.medium = { ...createDefaultModuleState(), ...(current.medium || {}), unlockedLevel: 1 };
  }
  if (module === 'medium' && moduleState.isComplete) {
    current.hard = { ...createDefaultModuleState(), ...(current.hard || {}), unlockedLevel: 1 };
  }
  if (module === 'hard' && moduleState.isComplete) {
    current.hard.certificate = MODULES.hard.certificate;
  }

  current[module] = moduleState;
  await saveProgressForCategory(category, current);

  try {
    const connection = await NetInfo.fetch();
    if (supabase && connection.isConnected && connection.isInternetReachable !== false) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.rpc('record_level_progress', {
          p_category: category,
          p_module: module,
          p_stage: Number(stage),
          p_correct: Number(correct),
          p_total: Number(total),
        });
      }
    }
  } catch {
    // Keep the local result even if account sync is unavailable.
  }

  return {
    percent,
    passed: percent >= threshold,
    stage,
    module,
    moduleComplete: moduleState.isComplete,
    reward: moduleState.reward,
    certificate: moduleState.certificate,
    current,
  };
}

export function getModuleStageStatus(progress, module) {
  const moduleState = progress?.[module] || createDefaultModuleState();
  return {
    unlockedLevel: Number(moduleState.unlockedLevel || 1),
    completedLevels: moduleState.completedLevels || [],
    isComplete: Boolean(moduleState.isComplete),
    reward: moduleState.reward || null,
    certificate: moduleState.certificate || null,
  };
}
