import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Screen from '../../components/Screen';
import { ErrorText, Heading, Eyebrow } from '../../components/Heading';
import StatCard from '../../components/StatCard';
import { getProgress } from '../../services/progressService';
import { useAuth } from '../../context/AuthContext';
import { AVATARS } from '../../config/constants';
import { C } from '../../theme';

export default function ProgressScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    if (!session) return undefined;
    let active = true;
    setError('');
    getProgress().then(result => { if (active) setData(result); }).catch(reason => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [session]));

  if (!session) return <Screen><Eyebrow>YOUR JOURNEY</Eyebrow><Heading>Progress starts with a profile</Heading><Text style={styles.copy}>You can play without signing in. Log in to keep scores, stars and badges.</Text><Button title="Log in or join BDK" onPress={() => router.push('/login')} /></Screen>;
  if (error) return <Screen><ErrorText>{error}</ErrorText><Button title="Try again" onPress={() => { setError(''); getProgress().then(setData).catch(reason => setError(reason.message)); }} /></Screen>;
  if (!data) return <Screen><Text style={styles.copy}>Loading your progress…</Text></Screen>;

  const { stats, earnedBadgeIds, badges, history, characters } = data;
  const accuracy = stats.questions_answered ? Math.round(stats.correct_answers / stats.questions_answered * 100) : 0;
  const byCharacter = Object.values(characters.reduce((groups, row) => {
    const current = groups[row.character] || { name: row.character, attempted: 0, correct: 0 };
    current.attempted += row.attempted;
    current.correct += row.correct;
    groups[row.character] = current;
    return groups;
  }, {})).map(row => ({ ...row, percent: Math.round(row.correct / row.attempted * 100) }));
  const strengths = byCharacter.filter(row => row.percent >= 70).sort((a, b) => b.percent - a.percent);
  const practice = byCharacter.filter(row => row.percent < 70).sort((a, b) => a.percent - b.percent);

  return (
    <Screen>
      <Eyebrow>YOUR JOURNEY</Eyebrow>
      <Heading>{profile?.nickname ? `${AVATARS[profile.avatar] || '✦'} ${profile.nickname}` : 'My progress'}</Heading>
      <Card><Text style={styles.section}>Personal best</Text><View style={styles.stats}>
        <StatCard value={stats.games_completed} label="Games" /><StatCard value={`${accuracy}%`} label="Accuracy" />
        <StatCard value={stats.best_score} label="Best score" /><StatCard value={stats.best_streak} label="Best streak" />
        <StatCard value={stats.stars_earned} label="Stars" /><StatCard value={stats.correct_answers} label="Correct answers" />
      </View></Card>
      <Card><Text style={styles.section}>Badges</Text><View style={styles.badges}>{badges.map(badge => {
        const earned = earnedBadgeIds.has(badge.id);
        return <View key={badge.id} style={[styles.badge, !earned && styles.badgeLocked]}><Text style={[styles.badgeText, !earned && styles.badgeTextLocked]}>{earned ? '✦ ' : '○ '}{badge.name}</Text></View>;
      })}</View></Card>
      <Card><Text style={styles.section}>People you know well</Text>{strengths.length ? strengths.map(row => <Text key={row.name} style={styles.line}>{row.name} · {row.percent}% ({row.attempted} tried)</Text>) : <Text style={styles.muted}>Keep playing to build your list.</Text>}<Text style={[styles.section, { marginTop: 16 }]}>People to practise</Text>{practice.length ? practice.map(row => <Text key={row.name} style={styles.line}>{row.name} · {row.percent}% ({row.attempted} tried)</Text>) : <Text style={styles.muted}>Nothing to practise yet.</Text>}</Card>
      <Card><Text style={styles.section}>Recent games</Text>{history.length ? history.map((game, index) => <Text key={`${game.started_at}-${index}`} style={styles.line}>{new Date(game.started_at).toLocaleDateString()} · {game.difficulty} · {game.score} points · {'★'.repeat(game.stars || 0) || '—'}</Text>) : <Text style={styles.muted}>Your completed rounds will show here.</Text>}</Card>
      <Pressable onPress={() => router.push('/profile')}><Text style={styles.link}>Edit my name and picture ›</Text></Pressable>
      <Pressable onPress={() => router.push('/settings')}><Text style={styles.link}>Open settings ›</Text></Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({ copy: { color: C.mute, lineHeight: 22, marginBottom: 12 }, stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, section: { color: C.ink, fontWeight: '900', fontSize: 17, marginBottom: 10 }, badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, badge: { backgroundColor: C.sun, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 7 }, badgeLocked: { backgroundColor: C.bg, borderColor: C.line, borderWidth: 1 }, badgeText: { color: C.ink, fontWeight: '800', fontSize: 12 }, badgeTextLocked: { color: C.mute }, line: { color: C.ink, lineHeight: 23 }, muted: { color: C.mute, lineHeight: 21 }, link: { padding: 14, color: C.green, fontWeight: '800', textAlign: 'center' } });