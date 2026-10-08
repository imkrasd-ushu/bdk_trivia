import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Host from '../../components/Host';
import Screen from '../../components/Screen';
import { Heading, ErrorText } from '../../components/Heading';
import StatCard from '../../components/StatCard';
import { claimGame } from '../../services/triviaService';
import { useAuth } from '../../context/AuthContext';
import { C } from '../../theme';

export default function ResultsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [data, setData] = useState(null);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    AsyncStorage.multiGet(['bdk-last-result', 'bdk-pending']).then(items => {
      const result = items[0][1];
      setData(result ? JSON.parse(result) : null);
      setPending(items[1][1] ? JSON.parse(items[1][1]) : null);
    });
  }, []);

  async function saveGame() {
    if (!pending) return;
    setBusy(true);
    try {
      const response = await claimGame(pending.sid);
      await AsyncStorage.removeItem('bdk-pending');
      setPending(null);
      setMessage(`Saved ${response.score} points${response.new_badges?.length ? ` and earned ${response.new_badges.map(badge => badge.name).join(', ')}` : ''}.`);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  if (!data) return <Screen><Text style={styles.loading}>Loading your result…</Text></Screen>;
  const result = data.result;
  const stars = Number(result.stars || 0);
  const messages = ['Every try helps you learn. Play again when you’re ready.', 'Good work. You learned something new.', 'Great job!', 'Fantastic Bible knowledge!'];
  return (
    <Screen>
      <Text style={styles.kicker}>ROUND COMPLETE</Text>
      <Heading style={styles.title}>You did it.</Heading>
      <Card>
        <Text accessibilityLabel={`${stars} out of 3 stars`} style={styles.stars}>{stars ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '✦'}</Text>
        <Text style={styles.encouragement}>{messages[stars] || messages[0]}</Text>
        {result.new_personal_best && result.saved && <Text style={styles.best}>NEW PERSONAL BEST</Text>}
        {!!data.progression && (
          <View style={styles.progressBox}>
            <Text style={styles.progressTitle}>{data.progression.passed ? 'Level passed!' : 'Try that level again'}</Text>
            <Text style={styles.progressText}>{data.progression.percent}% accuracy · {data.progression.module} · level {data.progression.stage}</Text>
            {!!data.progression.reward && <Text style={styles.reward}>🏆 {data.progression.reward}</Text>}
            {!!data.progression.certificate && <Text style={styles.certificate}>🎓 {data.progression.certificate}</Text>}
          </View>
        )}
        <View style={styles.stats}>
          <StatCard value={result.score} label="Points" />
          <StatCard value={`${result.correct}/${result.total || 10}`} label="Correct" />
          <StatCard value={result.best_streak} label="Best streak" />
          <StatCard value={`${stars}/3`} label="Stars" />
        </View>
      </Card>
      <Host who="hawi" text="You finished the Bible challenge. Well done!" />
      <Host who="ammi" text="Every story gives us something good to learn." />
      {!!data.lessons?.length && <Card><Text style={styles.sectionTitle}>What you learned</Text>{data.lessons.map((lesson, index) => <Text key={`${index}-${lesson}`} style={styles.lesson}>• {lesson}</Text>)}</Card>}
      {!!result.new_badges?.length && <Card><Text style={styles.sectionTitle}>New badges</Text>{result.new_badges.map(badge => <Text key={badge.id || badge.name} style={styles.badge}>✦ {badge.name}</Text>)}</Card>}
      {!!message && <ErrorText style={message.startsWith('Saved') ? styles.saved : undefined}>{message}</ErrorText>}
      {!result.saved && pending && (session
        ? <Button title="Save this game to my profile" onPress={saveGame} loading={busy} />
        : <Button title="Log in to save your progress" variant="soft" onPress={() => router.push('/login')} />)}
      <Button title="Play another round" variant="sun" onPress={() => router.replace('/levels')} style={{ marginTop: 14 }} />
      <Button title="Read the Bible" variant="soft" onPress={() => router.push('/bible')} />
      <Pressable onPress={() => router.replace('/')} style={styles.home}><Text style={styles.homeText}>Back to home</Text></Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { color: C.mute },
  kicker: { color: C.orange, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 7 },
  stars: { textAlign: 'center', fontSize: 45, color: C.sun, letterSpacing: 5 },
  encouragement: { textAlign: 'center', color: C.mute, marginBottom: 16, lineHeight: 21 },
  progressBox: { backgroundColor: C.greenSoft, borderRadius: 8, padding: 12, marginBottom: 12 },
  progressTitle: { color: C.green, fontWeight: '900' },
  progressText: { color: C.ink, marginTop: 4 },
  reward: { color: C.green, fontWeight: '800', marginTop: 6 },
  certificate: { color: C.orange, fontWeight: '800', marginTop: 6 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  best: { textAlign: 'center', color: C.green, fontWeight: '900', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: C.ink, marginBottom: 8 },
  lesson: { color: C.ink, lineHeight: 22, marginVertical: 3 },
  badge: { color: C.green, fontWeight: '800', paddingVertical: 5 },
  saved: { color: C.green },
  home: { padding: 14, alignItems: 'center' },
  homeText: { color: C.green, fontWeight: '800' },
});