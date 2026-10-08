import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect, useRouter } from 'expo-router';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Screen from '../../components/Screen';
import { ErrorText, Heading, Eyebrow } from '../../components/Heading';
import { COURSE_MODULES, DEFAULT_CATEGORY, LEVELS, TRIVIA_CATEGORIES } from '../../config/constants';
import { getAdminDashboard, getPoolCounts, listQuestions, setQuestionPublished, deleteQuestion } from '../../services/adminService';
import { C } from '../../theme';

const FILTER_LEVELS = ['', 'easy', 'medium', 'hard'];
const FILTER_STATUS = [['', 'All'], ['published', 'Published'], ['draft', 'Drafts']];

export default function AdminDashboardScreen() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [category, setCategory] = useState('all');
  const [difficulty, setDifficulty] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const categoryOptions = Object.entries(TRIVIA_CATEGORIES);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const [questions, pool, analytics] = await Promise.all([
        listQuestions({ difficulty, status, query, category }), getPoolCounts(), getAdminDashboard(),
      ]);
      setRows(questions);
      setCounts(pool);
      setDashboard(analytics);
      setError('');
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }, [difficulty, status, query, category]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const categorySummary = useMemo(() => categoryOptions.map(([key, meta]) => {
    const total = rows.filter(row => row.category === key).length;
    const published = rows.filter(row => row.category === key && row.is_published).length;
    return { key, meta, total, published };
  }), [categoryOptions, rows]);

  const activeCategoryLabel = category === 'all' ? 'All categories' : TRIVIA_CATEGORIES[category]?.label || 'Category';
  const publishedCount = level => Number(counts.find(count => count.difficulty === level)?.published || 0);
  const completionRate = dashboard?.games_started ? Math.round(dashboard.games_completed / dashboard.games_started * 100) : 0;
  const levelCards = ['easy', 'medium', 'hard'].map(level => ({
    key: level,
    ...LEVELS[level],
    published: publishedCount(level),
    total: rows.filter(row => row.difficulty === level).length,
  }));

  async function togglePublished(row) {
    try { await setQuestionPublished(row.id, !row.is_published); await refresh(); }
    catch (reason) { setError(reason.message); }
  }

  function remove(row) {
    Alert.alert('Delete this question?', 'This permanently removes the question.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteQuestion(row.id); await refresh(); } catch (reason) { setError(reason.message); } } },
    ]);
  }

  async function exportCategoryCsv() {
    if (!rows.length) {
      setError('There are no questions in this category to export yet.');
      return;
    }
    const header = ['category', 'difficulty', 'character', 'question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option', 'explanation', 'bible_reference', 'hint'];
    const csv = [header.join(','), ...rows.map(row => header.map(key => JSON.stringify(row[key] ?? '')).join(','))].join('\n');
    const safeCategory = (category === 'all' ? DEFAULT_CATEGORY : category).replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
    const fileName = `${safeCategory}-questions.csv`;
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    const fileUri = `${FileSystem.cacheDirectory || ''}${fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
    Alert.alert('CSV exported', `Saved to ${fileUri}`);
  }

  function openAddQuestion(nextCategory = category) {
    const target = nextCategory === 'all' ? DEFAULT_CATEGORY : nextCategory;
    router.push({ pathname: '/admin/quiz-form', params: { category: target } });
  }

  const currentQuestions = rows.filter(row => {
    if (query.trim()) {
      const term = query.toLowerCase();
      const matchesQuestion = (row.question || '').toLowerCase().includes(term);
      const matchesCharacter = (row.character || '').toLowerCase().includes(term);
      if (!matchesQuestion && !matchesCharacter) return false;
    }
    return true;
  });

  return (
    <Screen scroll={false} contentStyle={styles.screenInner}>
      <View style={styles.shell}>
        <View style={styles.sidebar}>
          <Eyebrow>ADMIN</Eyebrow>
          <Heading>Content hub</Heading>

          <Button title="New question" onPress={() => openAddQuestion()} style={styles.primaryAction} />
          <Button title="Import CSV" variant="soft" onPress={() => router.push({ pathname: '/admin/csv-import', params: { category: category === 'all' ? DEFAULT_CATEGORY : category } })} style={styles.primaryAction} />

          <Text style={styles.sideLabel}>Categories</Text>
          <Pressable key="all" onPress={() => setCategory('all')} style={[styles.sideItem, category === 'all' && styles.sideItemSelected]}>
            <Text style={[styles.sideItemText, category === 'all' && styles.sideItemTextSelected]}>All</Text>
            <Text style={styles.sideBadge}>{rows.length}</Text>
          </Pressable>
          {categorySummary.map(({ key, meta, total }) => (
            <Pressable key={key} onPress={() => setCategory(key)} style={[styles.sideItem, category === key && styles.sideItemSelected]}>
              <Text style={[styles.sideItemText, category === key && styles.sideItemTextSelected]}>{meta.icon} {meta.label}</Text>
              <Text style={styles.sideBadge}>{total}</Text>
            </Pressable>
          ))}

          <Text style={styles.sideLabel}>Levels</Text>
          {['easy', 'medium', 'hard'].map(level => (
            <Pressable key={level} onPress={() => { setCategory('all'); setDifficulty(level); }} style={[styles.sideItem, difficulty === level && styles.sideItemSelected]}>
              <Text style={[styles.sideItemText, difficulty === level && styles.sideItemTextSelected]}>{LEVELS[level].label}</Text>
              <Text style={styles.sideBadge}>{publishedCount(level)}</Text>
            </Pressable>
          ))}

          <Text style={styles.sideLabel}>Modules</Text>
          {Object.entries(COURSE_MODULES).map(([key, meta]) => (
            <View key={key} style={styles.moduleCard}>
              <Text style={styles.moduleTitle}>{meta.label}</Text>
              <Text style={styles.moduleCaption}>{meta.rewardName}</Text>
            </View>
          ))}
        </View>

        <ScrollView style={styles.main} contentContainerStyle={styles.mainInner}>
          <View style={styles.topBar}>
            <View>
              <Eyebrow>QUESTION BANK</Eyebrow>
              <Heading>{activeCategoryLabel}</Heading>
            </View>
            <View style={styles.topActions}>
              <Button title="Add in this category" onPress={() => openAddQuestion()} style={styles.inlineAction} />
              <Button title="Export CSV" variant="soft" onPress={exportCategoryCsv} style={styles.inlineAction} />
            </View>
          </View>

          {!!error && <ErrorText>{error}</ErrorText>}

          <View style={styles.summaryGrid}>
            <Card style={styles.metricCard}>
              <Text style={styles.metricLabel}>Visible questions</Text>
              <Text style={styles.metricValue}>{currentQuestions.length}</Text>
            </Card>
            <Card style={styles.metricCard}>
              <Text style={styles.metricLabel}>Published</Text>
              <Text style={styles.metricValue}>{currentQuestions.filter(row => row.is_published).length}</Text>
            </Card>
            <Card style={styles.metricCard}>
              <Text style={styles.metricLabel}>Drafts</Text>
              <Text style={styles.metricValue}>{currentQuestions.filter(row => !row.is_published).length}</Text>
            </Card>
            <Card style={styles.metricCard}>
              <Text style={styles.metricLabel}>Completion</Text>
              <Text style={styles.metricValue}>{completionRate}%</Text>
            </Card>
          </View>

          <Card>
            <Text style={styles.section}>Filters</Text>
            <TextInput value={query} onChangeText={setQuery} placeholder="Search question or character" placeholderTextColor={C.mute} style={styles.search} />
            <View style={styles.filters}>
              {FILTER_LEVELS.map(value => (
                <Pressable key={value || 'all-levels'} onPress={() => setDifficulty(value)} style={[styles.filter, difficulty === value && styles.filterSelected]}>
                  <Text style={[styles.filterText, difficulty === value && styles.filterSelectedText]}>{value ? LEVELS[value].label : 'All levels'}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.filters}>
              {FILTER_STATUS.map(([value, label]) => (
                <Pressable key={label} onPress={() => setStatus(value)} style={[styles.filter, status === value && styles.filterSelected]}>
                  <Text style={[styles.filterText, status === value && styles.filterSelectedText]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </Card>

          <Card>
            <Text style={styles.section}>Level management</Text>
            <View style={styles.levelGrid}>
              {levelCards.map(level => (
                <View key={level.key} style={styles.levelCard}>
                  <Text style={styles.levelLabel}>{level.label}</Text>
                  <Text style={styles.levelAge}>{level.age}</Text>
                  <Text style={styles.levelDetail}>{level.detail}</Text>
                  <Text style={styles.levelMeta}>{level.published} published · {level.total} total</Text>
                </View>
              ))}
            </View>
          </Card>

          <View style={styles.listHeader}>
            <Text style={styles.section}>Question list</Text>
            <Text style={styles.listCount}>{currentQuestions.length} items</Text>
          </View>

          {busy && !currentQuestions.length ? (
            <Text style={styles.empty}>Loading questions…</Text>
          ) : currentQuestions.length ? currentQuestions.map(row => (
            <Card key={row.id} style={styles.questionCard}>
              <View style={styles.questionTop}>
                <View style={styles.questionTitleWrap}>
                  <Text style={styles.questionCategory}>{TRIVIA_CATEGORIES[row.category]?.label || row.category}</Text>
                  <Text style={styles.questionCharacter}>{row.character}</Text>
                </View>
                <View style={[styles.statusPill, row.is_published ? styles.statusPillLive : styles.statusPillDraft]}>
                  <Text style={[styles.statusText, row.is_published ? styles.statusTextLive : styles.statusTextDraft]}>{row.is_published ? 'Published' : 'Draft'}</Text>
                </View>
              </View>

              <Text style={styles.questionDifficulty}>{row.difficulty}</Text>
              <Text style={styles.questionText}>{row.question}</Text>

              <View style={styles.rowActions}>
                <Button compact title="Edit" variant="soft" onPress={() => router.push({ pathname: '/admin/quiz-form', params: { id: row.id } })} style={styles.smallAction} />
                <Button compact title={row.is_published ? 'Unpublish' : 'Publish'} variant="soft" onPress={() => togglePublished(row)} style={styles.smallAction} />
                <Button compact title="Duplicate" variant="soft" onPress={() => router.push({ pathname: '/admin/quiz-form', params: { id: row.id, copy: '1', category: row.category } })} style={styles.smallAction} />
                <Button compact title="Delete" variant="danger" onPress={() => remove(row)} style={styles.smallAction} />
              </View>
            </Card>
          )) : (
            <Text style={styles.empty}>No questions match this view yet.</Text>
          )}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenInner: { padding: 0 },
  shell: { flexDirection: 'row', flex: 1, backgroundColor: C.bg },
  sidebar: { width: 300, backgroundColor: C.paper, borderRightWidth: 1, borderRightColor: C.line, padding: 16 },
  primaryAction: { marginVertical: 8 },
  sideLabel: { color: C.mute, fontSize: 12, fontWeight: '900', letterSpacing: 1.1, marginTop: 18, marginBottom: 8, textTransform: 'uppercase' },
  sideItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, marginBottom: 8 },
  sideItemSelected: { backgroundColor: C.greenSoft, borderColor: C.green },
  sideItemText: { color: C.ink, fontWeight: '800', fontSize: 13, flex: 1 },
  sideItemTextSelected: { color: C.green },
  sideBadge: { minWidth: 24, textAlign: 'center', backgroundColor: C.blueSoft, color: C.blue, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, fontWeight: '800', fontSize: 11 },
  moduleCard: { backgroundColor: C.bg, borderColor: C.line, borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 8 },
  moduleTitle: { color: C.ink, fontWeight: '800', fontSize: 12 },
  moduleCaption: { color: C.mute, fontSize: 11, marginTop: 3 },
  main: { flex: 1 },
  mainInner: { padding: 18, paddingBottom: 36 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 },
  topActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inlineAction: { minWidth: 150 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  metricCard: { width: '23%', minWidth: 120, flexGrow: 1 },
  metricLabel: { color: C.mute, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  metricValue: { color: C.ink, fontSize: 28, fontWeight: '900', marginTop: 6 },
  section: { color: C.ink, fontSize: 16, fontWeight: '900', marginBottom: 10 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  filter: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  filterSelected: { borderColor: C.green, backgroundColor: C.greenSoft },
  filterText: { color: C.mute, fontSize: 12, fontWeight: '800' },
  filterSelectedText: { color: C.green },
  search: { minHeight: 46, borderWidth: 1, borderColor: C.line, borderRadius: 6, paddingHorizontal: 12, color: C.ink, backgroundColor: C.paper },
  levelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  levelCard: { flex: 1, minWidth: 150, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 12, backgroundColor: C.bg },
  levelLabel: { color: C.ink, fontSize: 16, fontWeight: '900' },
  levelAge: { color: C.mute, fontSize: 12, marginTop: 4 },
  levelDetail: { color: C.mute, fontSize: 12, lineHeight: 18, marginTop: 8 },
  levelMeta: { color: C.green, fontWeight: '800', marginTop: 10 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 },
  listCount: { color: C.mute, fontSize: 12, fontWeight: '800' },
  questionCard: { marginBottom: 10 },
  questionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  questionTitleWrap: { flex: 1 },
  questionCategory: { color: C.mute, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  questionCharacter: { color: C.ink, fontSize: 18, fontWeight: '900', marginTop: 2 },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  statusPillLive: { backgroundColor: C.greenSoft },
  statusPillDraft: { backgroundColor: C.orangeSoft },
  statusText: { fontSize: 11, fontWeight: '800' },
  statusTextLive: { color: C.green },
  statusTextDraft: { color: C.orange },
  questionDifficulty: { color: C.blue, fontSize: 12, fontWeight: '900', marginTop: 10, textTransform: 'uppercase' },
  questionText: { color: C.ink, fontSize: 15, lineHeight: 22, marginTop: 8 },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  smallAction: { flexGrow: 1, minWidth: 110 },
  empty: { color: C.mute, fontSize: 14, marginTop: 12 },
});