import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Alert, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Host from '../../components/Host';
import { ErrorText } from '../../components/Heading';
import useGame from '../../hooks/useGame';
import { finishGame, gameLessons } from '../../services/triviaService';
import { HOST_MESSAGES, SECONDS_PER_QUESTION, pick } from '../../config/constants';
import { C } from '../../theme';

const Pill = ({ children }) => <View style={{ backgroundColor: '#fff', borderRadius: 99, borderWidth: 2, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 4 }}><Text style={{ fontWeight: '700', color: C.ink }}>{children}</Text></View>;

export default function GameScreen({ route, navigation }) {
  const { level, timer } = route.params;
  const { state: s, answer, next } = useGame(level, timer);
  const [finishing, setFinishing] = useState(false);
  const [line, setLine] = useState('');
  const q = s.qs[s.i], fb = s.feedback, last = s.qs.length > 0 && s.i === s.qs.length - 1;

  useEffect(() => {
    if (!fb) return;
    setLine(fb.correct ? (fb.streak >= 2 ? pick(HOST_MESSAGES.streak) : pick(HOST_MESSAGES.correct)) : pick(HOST_MESSAGES.wrong));
    AccessibilityInfo.announceForAccessibility(`${fb.correct ? 'Correct' : 'Good try'}. ${fb.explanation} ${fb.bible_reference}`);
  }, [fb]);

  async function onNext() {
    if (!last) return next();
    setFinishing(true);
    try {
      const result = await finishGame(s.sid);
      if (result.error) throw new Error('Could not finish this game.');
      const lessons = await gameLessons(s.sid).catch(() => []);
      if (!result.saved) await AsyncStorage.setItem('bdk-pending', JSON.stringify({ sid: s.sid, score: result.score }));
      navigation.replace('Results', { result, lessons, level, timer, refs: s.refs });
    } catch (e) { Alert.alert('Oops', e.message); setFinishing(false); }
  }
  const quit = () => Alert.alert('Leave this game?', 'Your progress in this game will not be saved.', [{ text: 'Keep playing', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: () => navigation.popToTop() }]);

  if (s.phase === 'error') return <Screen edges={['top', 'bottom']}><ErrorText>{s.error}</ErrorText><Button title="Back" onPress={() => navigation.popToTop()} style={{ marginTop: 16 }} /></Screen>;
  if (!q) return <Screen edges={['top', 'bottom']}><Text style={{ fontSize: 20, color: C.ink }}>Getting your questions ready…</Text></Screen>;

  const head = fb ? (fb.correct ? '🎉 CORRECT!' : s.chosen === null ? '⏰ TIME’S UP — GOOD TRY!' : '💡 GOOD TRY!') : '';
  const right = fb && q.options.find(o => o.key === fb.correct_option)?.text;
  return (
    <Screen scroll={false} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
          <Pill>QUESTION {s.i + 1} OF {s.qs.length}</Pill><Pill>⭐ {s.score} POINTS</Pill><Pill>🔥 {s.streak} STREAK</Pill>
        </View>
        {timer && <View accessibilityRole="progressbar" accessibilityLabel="Time left" style={{ height: 12, backgroundColor: C.line, borderRadius: 9, overflow: 'hidden', marginVertical: 12 }}><View style={{ height: '100%', width: `${s.left / SECONDS_PER_QUESTION * 100}%`, backgroundColor: C.purple }} /></View>}
        {last && <Host who="ammi" text={HOST_MESSAGES.last} />}
        <Card style={{ marginTop: 10 }}>
          {!!q.image_url && <Image source={{ uri: q.image_url }} accessibilityIgnoresInvertColors style={{ width: '100%', height: 170, borderRadius: 14, marginBottom: 12 }} resizeMode="cover" />}
          <Text style={{ fontSize: 23, fontWeight: '700', color: C.ink, marginBottom: 10 }}>{q.question}</Text>
          {q.options.map((o, i) => {
            const isRight = fb && o.key === fb.correct_option, isWrong = fb && o.key === s.chosen && !fb.correct;
            return (
              <TouchableOpacity key={o.key} disabled={s.phase !== 'playing'} onPress={() => answer(o.key)} accessibilityRole="button" accessibilityLabel={`${'ABCD'[i]}. ${o.text}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, borderRadius: 18, borderWidth: 3, padding: 12, marginTop: 10, backgroundColor: isRight ? C.okSoft : isWrong ? C.warnSoft : '#fff', borderColor: isRight ? C.ok : isWrong ? C.warn : C.line }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '800' }}>{'ABCD'[i]}</Text></View>
                <Text style={{ flex: 1, fontSize: 18, color: C.ink }}>{o.text}</Text>
              </TouchableOpacity>
            );
          })}
        </Card>
        {s.phase === 'answering' && <Text style={{ color: C.mute, textAlign: 'center' }}>Checking…</Text>}
        {fb && (
          <View style={{ backgroundColor: fb.correct ? C.okSoft : C.warnSoft, borderRadius: 20, padding: 16 }} accessibilityLiveRegion="polite">
            <Text style={{ fontSize: 22, fontWeight: '800', color: C.ink }}>{head}</Text>
            {fb.correct
              ? <Text style={{ marginTop: 6, fontWeight: '700', color: C.ink }}>+{fb.points} POINTS (100{fb.time_bonus ? ` + ${fb.time_bonus} speed` : ''}{fb.streak_bonus ? ` + ${fb.streak_bonus} streak` : ''}){fb.streak >= 2 ? `\n🔥 ${fb.streak} ANSWER STREAK!` : ''}</Text>
              : <Text style={{ marginTop: 6, color: C.ink }}>The correct answer is <Text style={{ fontWeight: '800' }}>{right}</Text>.</Text>}
            <Text style={{ marginTop: 8, color: C.ink }}><Text style={{ fontWeight: '800' }}>Bible Lesson: </Text>{fb.explanation}</Text>
            <Text style={{ marginTop: 6, color: C.ink }}>📖 {fb.bible_reference}</Text>
            <Host who={fb.correct ? 'hawi' : 'ammi'} text={line} />
          </View>
        )}
        {fb && <Button title={last ? 'See Results' : 'Next Question'} variant="sun" onPress={onNext} loading={finishing} style={{ marginTop: 14 }} />}
        <Button title="Leave game" variant="soft" onPress={quit} style={{ marginTop: 14 }} />
      </ScrollView>
    </Screen>
  );
}
