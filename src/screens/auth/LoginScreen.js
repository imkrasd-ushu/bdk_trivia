import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Screen from '../../components/Screen';
import { Heading, ErrorText } from '../../components/Heading';
import { signIn, signUp } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { C } from '../../theme';

export default function LoginScreen() {
  const router = useRouter();
  const { configured } = useAuth();
  const [mode, setMode] = useState('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit() {
    setBusy(true);
    setMessage('');
    try {
      if (mode === 'up') {
        const result = await signUp(email, password);
        if (!result.session) setMessage('Check your email to confirm your account, then log in.');
        else router.back();
      } else {
        await signIn(email, password);
        router.back();
      }
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  return (
    <Screen>
      <View style={styles.brandWrap}>
        <Image source={require('../../../assets/bdklogo.jpg')} style={styles.logo} resizeMode="contain" />
      </View>
      <Heading>{mode === 'up' ? 'Join BDK' : 'Welcome back'}</Heading>
      <Text style={styles.copy}>An account keeps your badges and game progress together. Children should ask a parent to help.</Text>
      <Card>
        <Text style={styles.label}>Email</Text>
        <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.input} />
        <Text style={styles.label}>Password</Text>
        <TextInput secureTextEntry autoComplete={mode === 'up' ? 'new-password' : 'current-password'} value={password} onChangeText={setPassword} style={styles.input} />
        {!!message && <ErrorText style={message.startsWith('Check your email') ? styles.success : undefined}>{message}</ErrorText>}
        {!configured && <ErrorText>Supabase configuration is missing. Set the values in `.env`.</ErrorText>}
        <Button title={mode === 'up' ? 'Create account' : 'Log in'} onPress={submit} loading={busy} disabled={!configured || !email.trim() || password.length < 6} style={{ marginTop: 14 }} />
        <Pressable onPress={() => { setMode(mode === 'up' ? 'in' : 'up'); setMessage(''); }} style={styles.switch}><Text style={styles.switchText}>{mode === 'up' ? 'I already have an account' : 'Create an account'}</Text></Pressable>
        <Button title="Back" variant="soft" onPress={() => router.back()} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandWrap: { alignItems: 'center', marginBottom: 12 },
  logo: { width: 120, height: 120, borderRadius: 24 },
  copy: { color: C.mute, lineHeight: 22, marginBottom: 12 },
  label: { color: C.ink, fontSize: 13, fontWeight: '800', marginTop: 8 },
  input: { height: 50, borderColor: C.line, borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, marginTop: 5, color: C.ink, backgroundColor: C.paper },
  switch: { alignItems: 'center', padding: 12 },
  switchText: { color: C.green, fontWeight: '800' },
  success: { color: C.green, marginTop: 6 }
});