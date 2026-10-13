import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Host from '../../components/Host';
import Screen from '../../components/Screen';
import { ErrorText, Heading } from '../../components/Heading';
import useGame from '../../hooks/useGame';
import { finishGame, gameLessons } from '../../services/triviaService';
import { HOST_MESSAGES, SECONDS_PER_QUESTION, DEFAULT_CATEGORY } from '../../config/constants';
import { C } from '../../theme';
import { recordLevelProgress } from '../../utils/progression';

export default function GameScreen() {
  const { level = 'easy', stage = '1', timer = '1', category = DEFAULT_CATEGORY, timeLimit } = useLocalSearchParams();
  const timed = timer !== '0';
  const router = useRouter();
  const timeoutSeconds = Number(timeLimit || SECONDS_PER_QUESTION);
  const { state, answer, next } = useGame(level, timed, category || undefined, timeoutSeconds, Number(stage) || 1);
  const [finishing, setFinishing] = useState(false);
  const question = state.qs[state.i];
  const feedback = state.feedback;
  const isLast = state.qs.length > 0 && state.i === state.qs.length - 1;
  const hostLine = feedback
    ? feedback.correct
      ? (feedback.streak >= 2 ? HOST_MESSAGES.streak[0] : HOST_MESSAGES.correct[0])
      : HOST_MESSAGES.wrong[0]
    : '';

  useEffect(() => {
    if (!feedback) return;
    AccessibilityInfo.announceForAccessibility(`${feedback.correct ? 'Correct' : 'Good try'}. ${feedback.explanation} ${feedback.bible_reference}`);
  }, [feedback]);

  async function advance() {
    if (!isLast) return next();
    setFinishing(true);
    try {
      const result = await finishGame(state.sid);
      const lessons = await gameLessons(state.sid).catch(() => []);
      const stageNumber = Number(stage || 1);
      const totalQuestions = result.total || state.qs.length;
      const correctAnswers = Number(result.correct ?? 0);
      const progression = await recordLevelProgress({
        category: String(category || DEFAULT_CATEGORY),
        module: String(level),
        stage: stageNumber,
        correct: correctAnswers,
        total: totalQuestions,
      });
      await AsyncStorage.multiSet([
        ['bdk-last-result', JSON.stringify({ sid: state.sid, result, lessons, level, stage: stageNumber, timer, refs: state.refs, progression })],
        ['bdk-last-refs', JSON.stringify(state.refs)],
      ]);
      if (!result.saved) await AsyncStorage.setItem('bdk-pending', JSON.stringify({ sid: state.sid, score: result.score }));
      router.replace('/results');
    } catch (error) {
      Alert.alert('Could not finish this game', error.message);
      setFinishing(false);
    }
  }

  function leave() {
    Alert.alert('Leave this game?', 'Your progress in this game will not be saved.', [
      { text: 'Keep playing', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => router.dismissAll() },
    ]);
  }

  if (state.phase === 'error') return <Screen><ErrorText>{state.error}</ErrorText><Button title="Back to levels" onPress={() => router.replace('/levels')} style={{ marginTop: 16 }} /></Screen>;
  if (!question) return <Screen><Text style={styles.loading}>Getting your questions ready…</Text></Screen>;

  const correctText = feedback && question.options.find(option => option.key === feedback.correct_option)?.text;
  return (
    <Screen>
      <View style={styles.topline}>
        <Text style={styles.pill}>QUESTION {state.i + 1} OF {state.qs.length}</Text>
        <Text style={styles.pill}>★ {state.score} POINTS</Text>
        <Text style={styles.pill}>↗ {state.streak} STREAK</Text>
      </View>
      {timed && <View accessibilityRole="progressbar" accessibilityLabel="Time left" style={styles.track}><View style={[styles.fill, { width: `${Math.max(0, state.left / Math.max(1, timeoutSeconds) * 100)}%` }]} /></View>}
      {isLast && !feedback && <Host who="ammi" text={HOST_MESSAGES.last} />}
      <Card style={styles.questionCard}>
        {!!question.image_url && <Image source={{ uri: question.image_url }} style={styles.questionImage} resizeMode="cover" accessibilityIgnoresInvertColors />}
        <Heading style={styles.question}>{question.question}</Heading>
        {question.options.map((option, index) => {
          const correct = feedback && option.key === feedback.correct_option;
          const wrong = feedback && option.key === state.chosen && !feedback.correct;
          return (
            <Pressable key={option.key} disabled={state.phase !== 'playing'} onPress={() => answer(option.key)} accessibilityRole="button" accessibilityLabel={`${'ABCD'[index]}. ${option.text}`} style={[styles.option, correct && styles.correct, wrong && styles.wrong]}>
              <View style={styles.optionMark}><Text style={styles.optionLetter}>{'ABCD'[index]}</Text></View>
              <Text style={styles.optionText}>{option.text}</Text>
            </Pressable>
          );
        })}
      </Card>
      {state.phase === 'answering' && <Text style={styles.checking}>Checking your answer…</Text>}
      {feedback && (
        <View style={[styles.feedback, feedback.correct ? styles.feedbackGood : styles.feedbackTry]} accessibilityLiveRegion="polite">
          <Text style={styles.feedbackTitle}>{feedback.correct ? 'Correct!' : state.chosen === null ? 'Time’s up. Good try!' : 'Good try!'}</Text>
          {feedback.correct
            ? <Text style={styles.body}>+{feedback.points} points{feedback.streak >= 2 ? ` · ${feedback.streak} in a row` : ''}</Text>
            : <Text style={styles.body}>The correct answer is <Text style={styles.bold}>{correctText}</Text>.</Text>}
          <Text style={styles.body}><Text style={styles.bold}>Bible lesson: </Text>{feedback.explanation}</Text>
          <Text style={styles.body}>Read: {feedback.bible_reference}</Text>
          <Host who={feedback.correct ? 'hawi' : 'ammi'} text={hostLine} />
          <Button title={isLast ? 'See results' : 'Next question'} variant="sun" onPress={advance} loading={finishing} style={{ marginTop: 10 }} />
        </View>
      )}
      <Button title="Leave game" variant="soft" onPress={leave} style={{ marginTop: 8 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({ loading: { color: C.ink, fontSize: 19 }, topline: { flexDirection: 'row', justifyContent: 'space-between', gap: 5, flexWrap: 'wrap' }, pill: { color: C.ink, backgroundColor: C.paper, borderColor: C.line, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, fontSize: 11, fontWeight: '800' }, track: { height: 9, backgroundColor: C.line, overflow: 'hidden', borderRadius: 5, marginVertical: 14 }, fill: { height: '100%', backgroundColor: C.orange }, questionCard: { marginTop: 6 }, questionImage: { width: '100%', height: 170, borderRadius: 5, marginBottom: 15 }, question: { fontFamily: undefined, fontSize: 21, lineHeight: 27, marginBottom: 8 }, option: { flexDirection: 'row', alignItems: 'center', minHeight: 58, borderWidth: 2, borderColor: C.line, borderRadius: 6, backgroundColor: C.paper, padding: 10, gap: 11, marginTop: 9 }, correct: { borderColor: C.green, backgroundColor: C.greenSoft }, wrong: { borderColor: C.orange, backgroundColor: C.orangeSoft }, optionMark: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }, optionLetter: { color: '#fff', fontWeight: '900' }, optionText: { color: C.ink, flex: 1, fontSize: 16, lineHeight: 22 }, checking: { color: C.mute, textAlign: 'center', padding: 8 }, feedback: { padding: 15, borderRadius: 6, marginTop: 5 }, feedbackGood: { backgroundColor: C.greenSoft }, feedbackTry: { backgroundColor: C.orangeSoft }, feedbackTitle: { fontSize: 21, color: C.ink, fontWeight: '900', marginBottom: 5 }, body: { color: C.ink, fontSize: 14, lineHeight: 21, marginVertical: 3 }, bold: { fontWeight: '900' } });