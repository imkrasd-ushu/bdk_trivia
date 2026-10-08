import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Screen from '../../components/Screen';
import { ErrorText, Heading } from '../../components/Heading';
import { useAuth } from '../../context/AuthContext';
import { setProfile, signOut } from '../../services/authService';
import { AVATARS, NICKNAMES } from '../../config/constants';
import { C } from '../../theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, session, refreshAccount } = useAuth();
  const [avatar, setAvatar] = useState(profile?.avatar || 'lamb');
  const [nickname, setNickname] = useState(profile?.nickname || NICKNAMES[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    const cleanedNickname = nickname.trim();
    if (!cleanedNickname) {
      setError('Please enter a nickname.');
      return;
    }

    setBusy(true);
    try { await setProfile(cleanedNickname, avatar); await refreshAccount(); router.back(); }
    catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true);
    try { await signOut(); router.replace('/'); }
    catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  return (
    <Screen>
      <Heading>My name and picture</Heading>
      <Text style={styles.copy}>Choose a fun nickname. Please don’t use your real name.</Text>
      {!session && <ErrorText>Log in to save your profile.</ErrorText>}
      <Card>
        <Text style={styles.label}>Picture</Text>
        <View style={styles.choices}>{Object.entries(AVATARS).map(([key, symbol]) => <Pressable key={key} accessibilityRole="radio" accessibilityState={{ selected: avatar === key }} onPress={() => setAvatar(key)} style={[styles.avatar, avatar === key && styles.selected]}><Text style={styles.emoji}>{symbol}</Text></Pressable>)}</View>
        <Text style={styles.label}>Nickname</Text>
        <TextInput
          value={nickname}
          onChangeText={setNickname}
          placeholder="Type your custom nickname"
          placeholderTextColor={C.mute}
          style={styles.input}
          maxLength={20}
        />
        <Text style={styles.helper}>Try one of these or type your own:</Text>
        <View style={styles.choices}>{NICKNAMES.map(name => <Pressable key={name} accessibilityRole="radio" accessibilityState={{ selected: nickname === name }} onPress={() => setNickname(name)} style={[styles.name, nickname === name && styles.selected]}><Text style={styles.nameText}>{name}</Text></Pressable>)}</View>
        {!!error && <ErrorText>{error}</ErrorText>}
        <Button title="Save profile" onPress={save} loading={busy} disabled={!session} style={{ marginTop: 15 }} />
        {session && <Button title="Log out" variant="danger" onPress={logout} loading={busy} />}
        <Button title="Cancel" variant="soft" onPress={() => router.back()} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  copy: { color: C.mute, lineHeight: 22 },
  label: { color: C.ink, fontWeight: '900', fontSize: 16, marginVertical: 10 },
  helper: { color: C.mute, fontSize: 12, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: C.ink,
    backgroundColor: C.paper,
    marginBottom: 8,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  avatar: { width: 54, height: 54, borderColor: C.line, borderWidth: 2, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  selected: { borderColor: C.green, backgroundColor: C.greenSoft },
  emoji: { fontSize: 28 },
  name: { borderColor: C.line, borderWidth: 1, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 8 },
  nameText: { color: C.ink, fontSize: 13, fontWeight: '700' },
});