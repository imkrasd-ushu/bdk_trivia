import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Host from '../../components/Host';
import Screen from '../../components/Screen';
import { Heading, ErrorText } from '../../components/Heading';
import StatCard from '../../components/StatCard';
import { claimGame } from '../../services/triviaService';
import { getDuel } from '../../services/duelService';
import { useAuth } from '../../context/AuthContext';
import { C } from '../../theme';

export default function ResultsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [data, setData] = useState(null);
  const [duel, setDuel] = useState(null);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [certificateBusy, setCertificateBusy] = useState(false);
  const [certificateMessage, setCertificateMessage] = useState('');
  const [starAnimations] = useState(() => Array.from({ length: 3 }, () => new Animated.Value(0)));
  const certificateRef = useRef(null);

  useEffect(() => {
    AsyncStorage.multiGet(['bdk-last-result', 'bdk-pending']).then(items => {
      const result = items[0][1];
      const savedResult = result ? { completedAt: new Date().toISOString(), ...JSON.parse(result) } : null;
      setData(savedResult);
      setDuel(savedResult?.duelResult || null);
      setPending(items[1][1] ? JSON.parse(items[1][1]) : null);
    });
  }, []);

  useEffect(() => {
    if (!data?.duelCode || duel?.status === 'completed') return undefined;
    let active = true;
    const refreshDuel = async () => {
      try {
        const latest = await getDuel(data.duelCode);
        if (active) setDuel(latest);
      } catch {
        // Keep the last known match state if the network drops.
      }
    };
    void refreshDuel();
    const interval = setInterval(() => { void refreshDuel(); }, 1500);
    return () => { active = false; clearInterval(interval); };
  }, [data?.duelCode, duel?.status]);

  useEffect(() => {
    if (!data) return;
    Animated.stagger(180, starAnimations.map(animation => Animated.sequence([
      Animated.spring(animation, { toValue: 1.22, useNativeDriver: true, speed: 19, bounciness: 11 }),
      Animated.spring(animation, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 7 }),
    ]))).start();
  }, [data, starAnimations]);

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

  async function downloadCertificate() {
    if (!certificateRef.current) return;
    setCertificateBusy(true);
    setCertificateMessage('');
    try {
      const imageUri = await captureRef(certificateRef, { format: 'png', quality: 1, result: 'tmpfile', width: 1200, height: 845 });
      const fileName = `bdk-${String(data.progression.module).toLowerCase()}-certificate.png`;
      if (Platform.OS === 'web') {
        const response = await fetch(imageUri);
        const imageUrl = URL.createObjectURL(await response.blob());
        const link = globalThis.document.createElement('a');
        link.href = imageUrl;
        link.download = fileName;
        globalThis.document.body.appendChild(link);
        link.click();
        globalThis.document.body.removeChild(link);
        globalThis.setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
      } else {
        if (!await Sharing.isAvailableAsync()) throw new Error('Image sharing is not available on this device.');
        await Sharing.shareAsync(imageUri, { mimeType: 'image/png', dialogTitle: 'Save your certificate', UTI: 'public.png' });
      }
    } catch (error) {
      setCertificateMessage(error.message || 'Could not create the certificate image.');
    } finally {
      setCertificateBusy(false);
    }
  }

  if (!data) return <Screen><Text style={styles.loading}>Loading your result…</Text></Screen>;
  const result = data.result;
  const stars = Number(result.stars || 0);
  const certificateEarned = Boolean(data.progression?.moduleComplete && data.progression?.certificate);
  const learnerName = session?.user?.user_metadata?.nickname || session?.user?.user_metadata?.full_name || 'Bible Challenge Learner';
  const completionDate = new Date(data.completedAt).toLocaleDateString();
  const hasDuration = Number.isFinite(Number(data.durationSeconds));
  const durationSeconds = Math.max(0, Number(data.durationSeconds) || 0);
  const durationLabel = !hasDuration
    ? 'Not recorded'
    : durationSeconds >= 3600
      ? `${Math.floor(durationSeconds / 3600)}h ${Math.floor((durationSeconds % 3600) / 60)}m ${durationSeconds % 60}s`
      : `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`;
  const duelPlayers = duel?.players || [];
  const ownDuelPlayer = duelPlayers.find(player => player.user_id === session?.user?.id);
  const otherDuelPlayer = duelPlayers.find(player => player.user_id !== session?.user?.id);
  const duelOutcome = duel?.status !== 'completed'
    ? 'Your score is saved. Waiting for the other player to finish…'
    : !duel.winner_user_id
      ? 'It’s a tie!'
      : duel.winner_user_id === session?.user?.id
        ? 'You won!'
        : `${otherDuelPlayer?.display_name || 'The other player'} won`;
  const messages = ['Every try helps you learn. Play again when you’re ready.', 'Good work. You learned something new.', 'Great job!', 'Fantastic Bible knowledge!'];
  return (
    <Screen>
      <Text style={styles.kicker}>ROUND COMPLETE</Text>
      <Heading style={styles.title}>You did it.</Heading>
      <Card>
        <View accessibilityLabel={`${stars} out of 3 stars`} accessibilityRole="image" style={styles.stars}>
          {starAnimations.map((animation, index) => (
            <Animated.Text key={index} style={[styles.star, { transform: [{ scale: animation }] }, index < stars ? styles.earnedStar : styles.unearnedStar]}>{index < stars ? '★' : '☆'}</Animated.Text>
          ))}
        </View>
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
          <StatCard value={durationLabel} label="Time" />
        </View>
      </Card>
      {!!data.duelCode && (
        <Card style={styles.duelCard}>
          <Text style={styles.sectionTitle}>Head-to-head result</Text>
          <Text style={styles.duelOutcome}>{duelOutcome}</Text>
          {[ownDuelPlayer, otherDuelPlayer].filter(Boolean).map((player, index) => (
            <View key={player.user_id} style={styles.duelPlayerRow}>
              <Text style={styles.duelPlayerName}>{player.display_name}{index === 0 ? ' (you)' : ''}</Text>
              <Text style={styles.duelPlayerScore}>{player.score ?? 'Playing'} pts</Text>
              <Text style={styles.duelPlayerTime}>{player.elapsed_ms != null && Number.isFinite(Number(player.elapsed_ms)) ? formatDuelTime(player.elapsed_ms) : 'In progress'}</Text>
            </View>
          ))}
          {duel?.status === 'completed' && <Text style={styles.duelRule}>Higher score wins. Fastest time breaks a tie.</Text>}
        </Card>
      )}
      {certificateEarned && (
        <>
          <View ref={certificateRef} collapsable={false} style={styles.certificateImage}>
            <Text style={styles.certificateBrand}>BDK TRIVIA</Text>
            <Text style={styles.certificateEyebrow}>CERTIFICATE OF COMPLETION</Text>
            <Text style={styles.certificateHeading}>{data.progression.certificate}</Text>
            <Text style={styles.certificatePresented}>This certificate is proudly presented to</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.certificateName}>{learnerName}</Text>
            <Text style={styles.certificateDetails}>For completing all 10 levels of the {data.progression.module} module</Text>
            <Text style={styles.certificateDetails}>Level completion time: {durationLabel}</Text>
            <Text style={styles.certificateDate}>{completionDate}</Text>
          </View>
          <Button title={certificateBusy ? 'Preparing image…' : 'Download certificate image'} onPress={downloadCertificate} loading={certificateBusy} variant="sun" />
          {!!certificateMessage && <ErrorText>{certificateMessage}</ErrorText>}
        </>
      )}
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
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 },
  star: { fontSize: 42 },
  earnedStar: { color: C.sun },
  unearnedStar: { color: C.line },
  encouragement: { textAlign: 'center', color: C.mute, marginBottom: 16, lineHeight: 21 },
  progressBox: { backgroundColor: C.greenSoft, borderRadius: 8, padding: 12, marginBottom: 12 },
  progressTitle: { color: C.green, fontWeight: '900' },
  progressText: { color: C.ink, marginTop: 4 },
  reward: { color: C.green, fontWeight: '800', marginTop: 6 },
  certificate: { color: C.orange, fontWeight: '800', marginTop: 6 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  best: { textAlign: 'center', color: C.green, fontWeight: '900', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: C.ink, marginBottom: 8 },
  duelCard: { marginTop: 12 },
  duelOutcome: { color: C.green, fontWeight: '900', fontSize: 20, marginBottom: 10 },
  duelPlayerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderColor: C.line, paddingVertical: 9 },
  duelPlayerName: { flex: 1, color: C.ink, fontWeight: '800' },
  duelPlayerScore: { color: C.ink, fontWeight: '900' },
  duelPlayerTime: { minWidth: 72, color: C.mute, textAlign: 'right', fontSize: 12 },
  duelRule: { color: C.mute, fontSize: 12, marginTop: 8 },
  lesson: { color: C.ink, lineHeight: 22, marginVertical: 3 },
  badge: { color: C.green, fontWeight: '800', paddingVertical: 5 },
  saved: { color: C.green },
  home: { padding: 14, alignItems: 'center' },
  homeText: { color: C.green, fontWeight: '800' },
  certificateImage: { width: '100%', aspectRatio: 1.42, backgroundColor: '#fffdf6', borderWidth: 4, borderColor: C.green, padding: 16, alignItems: 'center', justifyContent: 'center', marginTop: 14, marginBottom: 6 },
  certificateBrand: { color: C.green, fontSize: 12, fontWeight: '900' },
  certificateEyebrow: { color: C.orange, fontSize: 9, fontWeight: '900', marginTop: 10 },
  certificateHeading: { color: C.ink, fontSize: 21, fontWeight: '900', textAlign: 'center', marginTop: 5 },
  certificatePresented: { color: C.mute, fontSize: 10, marginTop: 9 },
  certificateName: { maxWidth: '100%', color: C.green, fontSize: 19, fontWeight: '900', marginTop: 4 },
  certificateDetails: { color: C.ink, fontSize: 10, textAlign: 'center', marginTop: 8 },
  certificateDate: { color: C.mute, fontSize: 9, marginTop: 8 },
});

function formatDuelTime(milliseconds) {
  const seconds = Math.floor(Number(milliseconds) / 1000);
  return seconds >= 3600
    ? `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${seconds % 60}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}