import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Screen from '../../components/Screen';
import { Heading, Eyebrow } from '../../components/Heading';
import { LEVELS, TRIVIA_CATEGORIES, DEFAULT_CATEGORY, DEFAULT_QUESTION_TIMEOUT, QUESTION_TIMEOUT_OPTIONS, MODULE_LEVEL_COUNT, PASS_PERCENT_REQUIRED, COURSE_MODULES } from '../../config/constants';
import { getAvailableCategories, getOfflineSyncStatus, syncCatalog, syncPendingGames } from '../../services/offlineService';
import { C } from '../../theme';
import { createEmptyProgress, getModuleStageStatus, loadProgressForCategory, MODULE_SEQUENCE } from '../../utils/progression';

const QUESTION_TIMEOUT_KEY = 'bdk-question-timeout';

export default function LevelScreen() {
  const router = useRouter();
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [timerSeconds, setTimerSeconds] = useState(DEFAULT_QUESTION_TIMEOUT);
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [module, setModule] = useState('easy');
  const [progress, setProgress] = useState(createEmptyProgress());
  const [categories, setCategories] = useState(() => Object.entries(TRIVIA_CATEGORIES).map(([key, value], sort_order) => ({ key, ...value, sort_order })));
  const [syncStatus, setSyncStatus] = useState({ syncedAt: null, questionCount: 0, pendingGames: 0 });
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const refreshOfflinePack = useCallback(async (showMessage = false) => {
    setSyncing(true);
    setSyncMessage('');
    try {
      const catalog = await syncCatalog();
      try { await syncPendingGames(); } catch { /* Keep the offline pack even if queued-game sync fails. */ }
      setCategories(catalog.categories);
      setSyncStatus(await getOfflineSyncStatus());
      if (showMessage) setSyncMessage(`Downloaded ${catalog.questions.length} published questions.`);
    } catch (error) {
      const [available, status] = await Promise.all([getAvailableCategories(), getOfflineSyncStatus()]);
      setCategories(available);
      setSyncStatus(status);
      if (showMessage) setSyncMessage(status.questionCount ? 'Offline pack is ready. Connect to update it.' : error.message);
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getAvailableCategories().then(value => { if (active) setCategories(value); });
    getOfflineSyncStatus().then(value => { if (active) setSyncStatus(value); });
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable !== false) void refreshOfflinePack();
    });
    return () => { active = false; unsubscribe(); };
  }, [refreshOfflinePack]);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(QUESTION_TIMEOUT_KEY)
      .then(value => {
        if (!active || !value) return;
        try {
          const parsed = JSON.parse(value);
          setTimerEnabled(parsed.enabled !== false);
          setTimerSeconds(Number(parsed.seconds) || DEFAULT_QUESTION_TIMEOUT);
        } catch {
          setTimerEnabled(true);
          setTimerSeconds(DEFAULT_QUESTION_TIMEOUT);
        }
      })
      .catch(() => {});

    loadProgressForCategory(category)
      .then(data => { if (active) setProgress(data); })
      .catch(() => { if (active) setProgress(createEmptyProgress()); });

    return () => { active = false; };
  }, [category]);

  const stageStatus = useMemo(() => getModuleStageStatus(progress, module), [progress, module]);
  const currentModuleMeta = COURSE_MODULES[module] || COURSE_MODULES.easy;

  return (
    <Screen>
      <Eyebrow>CHOOSE YOUR PACE</Eyebrow>
      <Heading>Pick a category and level</Heading>
      <Text style={styles.intro}>Each module has 100 questions in 10 levels. You need {PASS_PERCENT_REQUIRED}% to unlock the next level, then the next module.</Text>

      <Card style={{ padding: 14, marginBottom: 10 }}>
        <Text style={styles.progressTitle}>Offline quiz pack</Text>
        <Text style={styles.progressDetail}>{syncStatus.questionCount ? `${syncStatus.questionCount} questions downloaded` : 'No questions downloaded yet'}</Text>
        {!!syncStatus.pendingGames && <Text style={styles.progressDetail}>{syncStatus.pendingGames} completed game(s) waiting to sync</Text>}
        {!!syncMessage && <Text style={{ color: C.green, marginTop: 6 }}>{syncMessage}</Text>}
        <Button title={syncing ? 'Updating…' : 'Download / update'} variant="soft" onPress={() => refreshOfflinePack(true)} loading={syncing} style={{ marginTop: 10 }} />
      </Card>

      <Text style={styles.section}>Category</Text>
      <View style={styles.categoryRow}>
        {categories.map(item => (
          <Pressable key={item.key} onPress={() => setCategory(item.key)} style={[styles.categoryPill, category === item.key && styles.categoryPillActive]}>
            <Text style={[styles.categoryText, category === item.key && styles.categoryTextActive]}>{item.icon || '✦'} {item.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>Module</Text>
      <View style={styles.moduleRow}>
        {MODULE_SEQUENCE.map(key => {
          const meta = COURSE_MODULES[key];
          const lockState = getModuleStageStatus(progress, key);
          const isLocked = key === 'easy' ? false : lockState.unlockedLevel <= 0;
          return (
            <Pressable key={key} onPress={() => !isLocked && setModule(key)} style={[styles.modulePill, module === key && styles.modulePillActive, isLocked && styles.modulePillLocked]}>
              <Text style={[styles.moduleText, module === key && styles.moduleTextActive, isLocked && styles.moduleTextLocked]}>{meta.label}</Text>
              {lockState.isComplete && <Text style={styles.crownLabel}>👑</Text>}
            </Pressable>
          );
        })}
      </View>

      <Card style={styles.progressCard}>
        <Text style={styles.progressTitle}>{currentModuleMeta.label}</Text>
        <Text style={styles.progressDetail}>{stageStatus.isComplete ? `${currentModuleMeta.finishLabel} · ${stageStatus.completedLevels.length}/${MODULE_LEVEL_COUNT} levels passed` : `Unlocked through level ${Math.max(1, stageStatus.unlockedLevel)} of ${MODULE_LEVEL_COUNT}`}</Text>
        {stageStatus.reward && <Text style={styles.reward}>{stageStatus.reward}</Text>}
        {stageStatus.certificate && <Text style={styles.certificate}>{stageStatus.certificate}</Text>}
      </Card>

      <Text style={styles.section}>Levels</Text>
      <View style={styles.levelGrid}>
        {Array.from({ length: MODULE_LEVEL_COUNT }, (_, index) => {
          const levelNumber = index + 1;
          const isUnlocked = levelNumber <= stageStatus.unlockedLevel;
          const isComplete = stageStatus.completedLevels.includes(levelNumber);
          const levelInfo = LEVELS[module] || LEVELS.easy;
          return (
            <Pressable
              key={`${module}-${levelNumber}`}
              disabled={!isUnlocked}
              onPress={() => {
                if (isUnlocked) router.push({ pathname: '/game', params: { category, level: module, stage: String(levelNumber), timer: timerEnabled ? '1' : '0', timeLimit: String(timerSeconds) } });
              }}
              style={[styles.levelTile, isComplete && styles.levelTileComplete, !isUnlocked && styles.levelTileLocked]}
            >
              <Text style={[styles.levelTileTitle, isComplete && styles.levelTileTitleComplete]}>{levelNumber}</Text>
              <Text style={styles.levelTileMeta}>{isComplete ? 'Passed' : isUnlocked ? 'Ready' : 'Locked'}</Text>
              <Text style={styles.levelTileLabel}>{levelInfo.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.timerRow}>
        <View style={styles.timerCopy}><Text style={styles.timerTitle}>{timerEnabled ? `${timerSeconds}-second timer` : 'No timer'}</Text><Text style={styles.detail}>{timerEnabled ? 'The question times out after the saved limit.' : 'Turn the timer back on for a timed round.'}</Text></View>
        <Switch value={timerEnabled} onValueChange={value => setTimerEnabled(value)} trackColor={{ true: C.green }} thumbColor="#fff" accessibilityLabel="Use a timed round" />
      </View>
      {timerEnabled && <View style={styles.optionRow}>{QUESTION_TIMEOUT_OPTIONS.map(seconds => <Pressable key={seconds} onPress={() => setTimerSeconds(seconds)} style={[styles.optionPill, timerSeconds === seconds && styles.optionPillActive]}><Text style={[styles.optionPillText, timerSeconds === seconds && styles.optionPillTextActive]}>{seconds}s</Text></Pressable>)}</View>}
      <Button title="Play together" variant="sun" onPress={() => router.push({ pathname: '/duel', params: { category, module, timer: timerEnabled ? '1' : '0', timeLimit: String(timerSeconds) } })} style={{ marginTop: 14 }} />
      <Button title="Back" variant="soft" onPress={() => router.back()} style={{ marginTop: 14 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({ intro: { color: C.mute, lineHeight: 22, marginBottom: 14 }, section: { color: C.ink, fontWeight: '900', fontSize: 14, marginTop: 10, marginBottom: 8 }, categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }, categoryPill: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: C.paper }, categoryPillActive: { backgroundColor: C.greenSoft, borderColor: C.green }, categoryText: { color: C.mute, fontSize: 12, fontWeight: '800' }, categoryTextActive: { color: C.green }, moduleRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }, modulePill: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.paper, flexDirection: 'row', alignItems: 'center', gap: 6 }, modulePillActive: { backgroundColor: C.greenSoft, borderColor: C.green }, modulePillLocked: { opacity: 0.45 }, moduleText: { color: C.mute, fontSize: 12, fontWeight: '800' }, moduleTextActive: { color: C.green }, moduleTextLocked: { color: C.mute }, crownLabel: { fontSize: 14 }, progressCard: { padding: 14, marginBottom: 12 }, progressTitle: { color: C.ink, fontWeight: '900', fontSize: 16 }, progressDetail: { color: C.mute, marginTop: 4 }, reward: { color: C.green, fontWeight: '800', marginTop: 8 }, certificate: { color: C.orange, fontWeight: '800', marginTop: 6 }, levelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, levelTile: { width: '31%', minHeight: 88, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10 }, levelTileComplete: { backgroundColor: C.greenSoft, borderColor: C.green }, levelTileLocked: { opacity: 0.45 }, levelTileTitle: { color: C.ink, fontSize: 22, fontWeight: '900' }, levelTileTitleComplete: { color: C.green }, levelTileMeta: { color: C.mute, fontSize: 11, marginTop: 4 }, levelTileLabel: { color: C.ink, fontSize: 10, marginTop: 8, fontWeight: '700' }, detail: { color: C.mute, fontSize: 13, lineHeight: 18, marginTop: 3 }, timerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.blueSoft, borderRadius: 6, padding: 14, marginTop: 14 }, timerCopy: { flex: 1, paddingRight: 8 }, timerTitle: { color: C.ink, fontWeight: '800' }, optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, optionPill: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: C.paper }, optionPillActive: { borderColor: C.green, backgroundColor: C.greenSoft }, optionPillText: { color: C.mute, fontSize: 12, fontWeight: '800' }, optionPillTextActive: { color: C.green } });