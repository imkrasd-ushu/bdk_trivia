import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { AVATARS } from '../../config/constants';
import { C } from '../../theme';

export default function HomeScreen() {
  const router = useRouter();
  const { profile, session, configured } = useAuth();

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/settings')} style={styles.gearButton}>
            <Text style={styles.gearText}>⚙</Text>
          </Pressable>
        </View>
        <View style={styles.eyebrow}><Text style={styles.eyebrowText}>A FAMILY BIBLE CHALLENGE</Text></View>
        <Text style={styles.title}>DK Bible{'\n'}Trivia</Text>
        <Text style={styles.subtitle}>Big stories. Brave people. One good question at a time.</Text>
        {session && profile?.nickname ? <Text style={styles.greeting}>Welcome back, {AVATARS[profile.avatar] || '✦'} {profile.nickname}</Text> : null}
        <View style={styles.hero}>
          <View style={styles.orbit}><Text style={styles.heroMark}>✦</Text></View>
          <View style={styles.peopleRow}><View style={styles.personA}><Text style={styles.personText}>H</Text></View><View style={styles.personB}><Text style={styles.personText}>A</Text></View></View>
          <Text style={styles.heroHeading}>Ready for today’s challenge?</Text>
          <Text style={styles.heroCopy}>Take a few minutes to explore the people and stories of the Bible.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/levels')} style={styles.primary}>
            <Text style={styles.primaryText}>Start challenge <Text style={styles.arrow}>›</Text></Text>
          </Pressable>
        </View>
        {!configured && <Text style={styles.configNote}>Add the Supabase values from `.env.example` to connect the game.</Text>}
        <View style={styles.bottomRow}>
          <Text style={styles.noSignup}>No account needed to play.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/login')}><Text style={styles.login}>{session ? 'Account' : 'Log in'} ↗</Text></Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 34, maxWidth: 640, width: '100%', alignSelf: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 8 },
  gearButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  gearText: { fontSize: 20, color: C.ink },
  eyebrow: { alignSelf: 'flex-start', borderBottomColor: C.orange, borderBottomWidth: 3, paddingBottom: 5 },
  eyebrowText: { color: C.mute, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: C.ink, fontFamily: 'Georgia', fontSize: 44, lineHeight: 47, fontWeight: '700', marginTop: 16 },
  subtitle: { color: C.mute, fontSize: 16, lineHeight: 23, marginTop: 10, maxWidth: 360 },
  greeting: { color: C.green, fontWeight: '700', marginTop: 14 },
  hero: { backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 8, marginTop: 24, padding: 20, overflow: 'hidden' },
  orbit: { position: 'absolute', right: -8, top: -20, width: 116, height: 116, borderRadius: 58, backgroundColor: C.sun, alignItems: 'center', justifyContent: 'center', opacity: 0.38 },
  heroMark: { color: C.orange, fontSize: 64 },
  peopleRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  personA: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' },
  personB: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginLeft: -15, borderWidth: 2, borderColor: C.paper },
  personText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  heroHeading: { color: C.ink, fontFamily: 'Georgia', fontSize: 23, lineHeight: 29, fontWeight: '700', maxWidth: 290 },
  heroCopy: { color: C.mute, fontSize: 15, lineHeight: 22, marginTop: 8 },
  primary: { backgroundColor: C.sun, borderRadius: 6, paddingHorizontal: 18, minHeight: 54, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  primaryText: { color: C.ink, fontSize: 17, fontWeight: '800' },
  arrow: { fontSize: 23 },
  configNote: { color: C.orange, fontSize: 13, marginTop: 12 },
  bottomRow: { marginTop: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  noSignup: { color: C.mute, fontSize: 13 },
  login: { color: C.green, fontSize: 14, fontWeight: '800' },
});