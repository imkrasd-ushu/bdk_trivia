import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Screen from '../../components/Screen';
import { ErrorText, Heading } from '../../components/Heading';
import { useAuth } from '../../context/AuthContext';
import { createLinkCode, listChildren, redeemLinkCode, resetChildProgress } from '../../services/progressService';
import { AVATARS } from '../../config/constants';
import { C } from '../../theme';

export default function FamilyScreen() {
  const router = useRouter();
  const { session, configured } = useAuth();
  const [children, setChildren] = useState([]);
  const [code, setCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    try { setChildren(await listChildren()); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  useFocusEffect(useCallback(() => {
    if (!session) return undefined;
    let active = true;
    listChildren().then(rows => { if (active) setChildren(rows); }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, [session]));

  async function linkChild() {
    setBusy(true);
    setMessage('');
    try { setNewCode(await createLinkCode()); setMessage('This code is valid for 24 hours.'); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  async function linkParent() {
    setBusy(true);
    setMessage('');
    try {
      const result = await redeemLinkCode(code.trim().toUpperCase());
      if (result.ok) { setMessage('Linked to your parent.'); setCode(''); }
      else setMessage(result.error === 'same_account' ? 'You can’t link an account to itself.' : 'That code did not work. Ask for a new one.');
      await refresh();
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  function confirmReset(childId) {
    Alert.alert('Reset progress?', 'This permanently clears this child’s scores, badges and game history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: async () => { try { await resetChildProgress(childId); await refresh(); } catch (error) { setMessage(error.message); } } },
    ]);
  }

  if (!configured) return <Screen><Heading>Family</Heading><Text style={styles.copy}>Family linking is ready when your Supabase connection is set up. Add your app environment values first, then sign in to link family profiles.</Text><Button title="Open settings" onPress={() => router.push('/settings')} /></Screen>;

  if (!session) return <Screen><Heading>Family</Heading><Text style={styles.copy}>Sign in to link family profiles and manage progress.</Text><Button title="Log in or join BDK" onPress={() => router.push('/login')} /></Screen>;

  return (
    <Screen>
      <Heading>Family</Heading>
      {!!message && <ErrorText style={message.startsWith('This code') || message.startsWith('Linked') ? styles.success : undefined}>{message}</ErrorText>}
      <Card>
        <Text style={styles.section}>I’m a parent</Text>
        <Text style={styles.copy}>Create a code for your child to enter from their own account.</Text>
        <Button title="Make a link code" variant="soft" onPress={linkChild} loading={busy} />
        {!!newCode && <><Text style={styles.code}>{newCode}</Text><Text style={styles.note}>Works for 24 hours.</Text></>}
        <Text style={[styles.section, styles.sectionSpacer]}>Linked children</Text>
        {children.length ? children.map(child => <Card key={child.child_id} style={styles.child}><Text style={styles.childName}>{AVATARS[child.avatar] || '✦'} {child.nickname || 'Player'}</Text><Text style={styles.copy}>{child.games} games · best score {child.best_score}</Text><Button title="Reset progress" compact variant="danger" onPress={() => confirmReset(child.child_id)} /></Card>) : <Text style={styles.note}>No children linked yet.</Text>}
      </Card>
      <Card>
        <Text style={styles.section}>I’m a child</Text>
        <Text style={styles.copy}>Ask your parent for a link code.</Text>
        <TextInput autoCapitalize="characters" maxLength={6} value={code} onChangeText={setCode} style={styles.input} accessibilityLabel="Parent link code" />
        <Button title="Link to my parent" variant="soft" onPress={linkParent} loading={busy} disabled={code.trim().length < 4} />
      </Card>
      <Card>
        <Text style={styles.section}>Delete my progress</Text>
        <Text style={styles.copy}>Clears your own scores, badges and history.</Text>
        <Button title="Delete my progress" compact variant="danger" onPress={() => confirmReset(session.user.id)} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({ section: { color: C.ink, fontSize: 17, fontWeight: '900', marginBottom: 6 }, sectionSpacer: { marginTop: 18 }, copy: { color: C.mute, lineHeight: 21 }, code: { color: C.green, textAlign: 'center', fontSize: 30, fontWeight: '900', letterSpacing: 4, marginVertical: 10 }, note: { color: C.mute, fontSize: 13, lineHeight: 19, marginTop: 6 }, child: { marginHorizontal: 0, marginVertical: 6, padding: 12 }, childName: { color: C.ink, fontWeight: '900', fontSize: 15 }, input: { height: 50, borderWidth: 1, borderColor: C.line, borderRadius: 6, paddingHorizontal: 12, marginTop: 12, color: C.ink, fontSize: 18 }, success: { color: C.green }, });