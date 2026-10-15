import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Screen from '../../components/Screen';
import { ErrorText, Heading, Eyebrow } from '../../components/Heading';
import { useAuth } from '../../context/AuthContext';
import { COURSE_MODULES, DEFAULT_CATEGORY, DEFAULT_QUESTION_TIMEOUT } from '../../config/constants';
import { createDuel, getDuel, joinDuel } from '../../services/duelService';
import { C } from '../../theme';

export default function DuelScreen() {
  const router = useRouter();
  const { session, configured } = useAuth();
  const { category = DEFAULT_CATEGORY, module = 'easy', timer = '1', timeLimit } = useLocalSearchParams();
  const [code, setCode] = useState('');
  const [room, setRoom] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const timeoutSeconds = Number(timeLimit || DEFAULT_QUESTION_TIMEOUT);
  const timerEnabled = timer !== '0';
  const roomCode = room?.code;
  const roomStatus = room?.status;

  useEffect(() => {
    if (!roomCode || roomStatus !== 'waiting') return undefined;
    let active = true;
    const poll = async () => {
      try {
        const latest = await getDuel(roomCode);
        if (active) setRoom(latest);
      } catch (error) {
        if (active) setMessage(error.message);
      }
    };
    const interval = setInterval(() => { void poll(); }, 1200);
    return () => { active = false; clearInterval(interval); };
  }, [roomCode, roomStatus]);

  useEffect(() => {
    if (!room || room.status !== 'started') return;
    router.replace({
      pathname: '/game',
      params: {
        category: room.category,
        level: room.difficulty,
        stage: '1',
        timer: room.timer_enabled ? '1' : '0',
        timeLimit: String(room.time_limit || timeoutSeconds),
        duelCode: room.code,
      },
    });
  }, [room, router, timeoutSeconds]);

  async function hostGame() {
    setBusy(true);
    setMessage('');
    try {
      const created = await createDuel(String(category), String(module), timerEnabled, timeoutSeconds);
      setCode(created.code);
      setRoom(created);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function enterGame() {
    setBusy(true);
    setMessage('');
    try {
      const joined = await joinDuel(code.trim().toUpperCase());
      setRoom(joined);
      setCode(joined.code);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return <Screen><Heading>Head-to-head</Heading><Text style={styles.copy}>Connect Supabase before creating or joining a live match.</Text><Button title="Open settings" onPress={() => router.push('/settings')} /></Screen>;
  }

  if (!session) {
    return <Screen><Heading>Head-to-head</Heading><Text style={styles.copy}>Both players need an account so the match can start together and record a fair result.</Text><Button title="Log in or join BDK" onPress={() => router.push('/login')} /><Button title="Back" variant="soft" onPress={() => router.back()} /></Screen>;
  }

  return (
    <Screen>
      <Eyebrow>LIVE MATCH</Eyebrow>
      <Heading>Head-to-head</Heading>
      {room?.status === 'waiting' ? (
        <Card style={styles.roomCard}>
          <Text style={styles.roomTitle}>Your join code</Text>
          <Text selectable style={styles.code}>{room.code}</Text>
          <Text style={styles.copy}>Share this code with the other player. The quiz starts for both players when they join.</Text>
          <Text style={styles.roomMeta}>{room.category} · {COURSE_MODULES[room.difficulty]?.label || room.difficulty}</Text>
          <Text style={styles.waiting}>Waiting for the other player…</Text>
        </Card>
      ) : (
        <>
          <Card>
            <Text style={styles.section}>Create a match</Text>
            <Text style={styles.copy}>Your friend will answer the same ten questions. The quiz begins together after they enter your code.</Text>
            <Text style={styles.roomMeta}>Selected: {category} · {COURSE_MODULES[module]?.label || module}</Text>
            <Button title="Create join code" onPress={hostGame} loading={busy} style={{ marginTop: 12 }} />
          </Card>
          <Card>
            <Text style={styles.section}>Join a match</Text>
            <Text style={styles.copy}>Enter the six-character code from the other player.</Text>
            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              value={code}
              onChangeText={value => setCode(value.replace(/[^a-z0-9]/gi, '').toUpperCase())}
              style={styles.input}
              accessibilityLabel="Head-to-head join code"
            />
            <Button title="Join match" variant="sun" onPress={enterGame} loading={busy} disabled={code.length !== 6} />
          </Card>
        </>
      )}
      {!!message && <ErrorText>{message}</ErrorText>}
      <Button title="Back" variant="soft" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  copy: { color: C.mute, lineHeight: 21, marginTop: 4 },
  roomCard: { alignItems: 'center', padding: 20 },
  roomTitle: { color: C.ink, fontWeight: '900', fontSize: 17 },
  code: { color: C.green, fontSize: 38, fontWeight: '900', letterSpacing: 5, marginVertical: 12 },
  roomMeta: { color: C.ink, fontWeight: '800', marginTop: 12, textTransform: 'capitalize' },
  waiting: { color: C.orange, fontWeight: '900', marginTop: 16 },
  section: { color: C.ink, fontSize: 17, fontWeight: '900' },
  input: { height: 54, borderWidth: 1, borderColor: C.line, borderRadius: 6, paddingHorizontal: 14, marginTop: 14, marginBottom: 8, color: C.ink, fontSize: 22, fontWeight: '900', letterSpacing: 5, textAlign: 'center' },
});
