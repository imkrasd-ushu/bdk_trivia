import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { AVATARS } from '../../config/constants';
import { getProgress } from '../../services/progressService';

const hawiImage = require('../../../assets/hawi.png');
const ammiImage = require('../../../assets/ammi.png');

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { profile, session, configured } = useAuth();
  const [progress, setProgress] = useState(null);
  const compact = width < 390;

  useEffect(() => {
    if (!session) return undefined;

    let active = true;
    getProgress()
      .then(result => {
        if (active) setProgress(result);
      })
      .catch(() => {
        if (active) setProgress({ stats: { stars_earned: 0, games_completed: 0, best_score: 0 } });
      });

    return () => { active = false; };
  }, [session]);

  const stats = useMemo(() => progress?.stats || { stars_earned: 0, games_completed: 0, best_score: 0 }, [progress]);
  const navLabel = session ? (profile?.nickname ? profile.nickname : 'Profile') : 'Log in';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View style={styles.brandWrap}>
            <View style={styles.logoBadge}><Text style={styles.logoText}>BDK</Text></View>
            <View style={styles.brandTextWrap}>
              <Text style={styles.brandTitle}>Bible Trivia</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push(session ? '/profile' : '/login')} style={styles.accountPill}>
            <Text style={styles.accountText}>{navLabel}</Text>
          </Pressable>
        </View>

        <View style={[styles.heroCard, compact && styles.heroCardCompact]}>
          <View style={styles.decorCircle} />
          <View style={styles.decorSpark} />
          <View style={[styles.characterMount, compact && styles.characterMountCompact]}>
            <Image source={hawiImage} style={[styles.characterLeft, compact && styles.characterLeftCompact]} resizeMode="contain" />
            <Image source={ammiImage} style={[styles.characterRight, compact && styles.characterRightCompact]} resizeMode="contain" />
          </View>

          <Text style={[styles.heroEyebrow, compact && styles.heroEyebrowCompact]}>Big Bible stories. Brave heroes. Amazing truths!</Text>
          <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>BDK Bible Trivia</Text>
          <Text style={[styles.heroDescription, compact && styles.heroDescriptionCompact]}>
            Discover the Bible, test your knowledge, and learn something wonderful about Jesus with Hawi and Ammi.
          </Text>
        </View>

        <View style={[styles.challengeCard, compact && styles.challengeCardCompact]}>
          <View style={styles.badgeRow}>
            <View style={styles.badgeMini}><Text style={styles.badgeMiniText}>HA</Text></View>
          </View>
          <Text style={styles.challengeTitle}>Ready for Today’s Bible Challenge?</Text>
          <Text style={styles.challengeCopy}>Answer fun questions, discover Bible truths, and earn stars as you learn.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/levels')} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Start Bible Challenge →</Text>
          </Pressable>
          <Text style={styles.noSignup}>No account needed to play.</Text>
        </View>

        <View style={styles.stepsSection}>
          <Text style={styles.sectionHeading}>How to Play</Text>
          <View style={[styles.stepsGrid, compact && styles.stepsGridCompact]}>
            <View style={[styles.stepCard, compact && styles.stepCardCompact]}>
              <View style={styles.stepIcon}><Text style={styles.stepIconText}>1</Text></View>
              <Text style={styles.stepTitle}>Choose Your Challenge</Text>
              <Text style={styles.stepText}>Pick your age level and get ready to play.</Text>
            </View>
            <View style={[styles.stepCard, compact && styles.stepCardCompact]}>
              <View style={[styles.stepIcon, styles.stepIconAlt]}><Text style={styles.stepIconText}>2</Text></View>
              <Text style={styles.stepTitle}>Answer Bible Questions</Text>
              <Text style={styles.stepText}>Think carefully and discover God’s Word.</Text>
            </View>
            <View style={[styles.stepCard, compact && styles.stepCardCompact]}>
              <View style={[styles.stepIcon, styles.stepIconGold]}><Text style={styles.stepIconText}>3</Text></View>
              <Text style={styles.stepTitle}>Earn Stars</Text>
              <Text style={styles.stepText}>Learn from every answer and celebrate your progress.</Text>
            </View>
          </View>
        </View>

        <View style={styles.progressPanel}>
          {session ? (
            <>
              <Text style={styles.sectionHeading}>Your progress</Text>
              <View style={styles.statRow}>
                <View style={styles.statItem}><Text style={styles.statValue}>{stats.stars_earned}</Text><Text style={styles.statLabel}>Stars</Text></View>
                <View style={styles.statItem}><Text style={styles.statValue}>{stats.games_completed}</Text><Text style={styles.statLabel}>Challenges</Text></View>
                <View style={styles.statItem}><Text style={styles.statValue}>{stats.best_score}</Text><Text style={styles.statLabel}>Best score</Text></View>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.sectionHeading}>Keep learning</Text>
              <Text style={styles.progressMessage}>Every question is a new chance to learn!</Text>
            </>
          )}
        </View>

        {!configured && <Text style={styles.configNote}>Add the Supabase values from .env.example to connect the game.</Text>}

        {session && profile?.nickname ? <Text style={styles.greeting}>Welcome back, {AVATARS[profile.avatar] || '✦'} {profile.nickname}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F3FF' },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 32,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  brandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#5B2D9F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2D0D55',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  logoText: { color: '#fff', fontWeight: '900', fontSize: 18 },
  brandTextWrap: { flexShrink: 1 },
  brandTitle: {
    color: '#2E1F57',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  accountPill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E7DFFF',
  },
  accountText: { color: '#4B2A8E', fontWeight: '800', fontSize: 12 },
  heroCard: {
    backgroundColor: '#6E3AD1',
    borderRadius: 32,
    paddingTop: 22,
    paddingBottom: 18,
    paddingHorizontal: 18,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FFD95E',
    minHeight: 260,
    alignItems: 'center',
    shadowColor: '#3E168A',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  heroCardCompact: {
    minHeight: 250,
    paddingTop: 18,
    paddingBottom: 118,
    paddingHorizontal: 12,
  },
  decorCircle: {
    position: 'absolute',
    bottom: -48,
    left: -30,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#9A70F1',
    opacity: 0.42,
  },
  decorSpark: {
    position: 'absolute',
    right: 24,
    top: 22,
    width: 42,
    height: 42,
    backgroundColor: '#FFD95E',
    borderRadius: 12,
    transform: [{ rotate: '22deg' }],
    opacity: 0.9,
  },
  characterMount: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 150,
  },
  characterMountCompact: {
    height: 128,
  },
  characterLeft: { position: 'absolute', left: 8, bottom: 6, width: 150, height: 160 },
  characterRight: { position: 'absolute', right: 10, bottom: 6, width: 152, height: 162 },
  characterLeftCompact: { left: 0, bottom: 4, width: 105, height: 118 },
  characterRightCompact: { right: 0, bottom: 4, width: 108, height: 120 },
  heroEyebrow: {
    color: '#FFF7CC',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: 18,
    maxWidth: 320,
  },
  heroEyebrowCompact: {
    fontSize: 10,
    lineHeight: 14,
    marginTop: 10,
    maxWidth: 250,
  },
  heroTitle: {
    color: '#FFF2A8',
    fontSize: 40,
    lineHeight: 42,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
  heroTitleCompact: {
    fontSize: 30,
    lineHeight: 34,
    marginTop: 18,
  },
  heroDescription: {
    color: '#F6F1FF',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 360,
    marginTop: 2,
    paddingHorizontal: 10,
  },
  heroDescriptionCompact: {
    fontSize: 12,
    lineHeight: 18,
    maxWidth: 270,
    paddingHorizontal: 0,
    marginTop: 8,
  },
  challengeCard: {
    backgroundColor: '#FFF7D6',
    borderRadius: 28,
    padding: 22,
    marginTop: 18,
    borderWidth: 3,
    borderColor: '#A078F5',
    shadowColor: '#5330A3',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  challengeCardCompact: {
    padding: 18,
    borderRadius: 22,
    marginTop: 20,
  },
  badgeRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 8 },
  badgeMini: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#6E3AD1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#F7D45D',
  },
  badgeMiniText: { color: '#fff', fontWeight: '900', fontSize: 18 },
  challengeTitle: {
    color: '#2E1F57',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 31,
  },
  challengeCopy: {
    color: '#4B2A8E',
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 6,
  },
  primaryButton: {
    backgroundColor: '#F7C739',
    borderRadius: 18,
    minHeight: 62,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    shadowColor: '#BB7C00',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  primaryButtonText: {
    color: '#2F1D63',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  noSignup: {
    color: '#5B2D9F',
    textAlign: 'center',
    fontWeight: '700',
    marginTop: 14,
    fontSize: 13,
  },
  stepsSection: {
    marginTop: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionHeading: {
    color: '#2E1F57',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
  },
  stepsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  stepsGridCompact: {
    gap: 8,
    marginTop: 2,
  },
  stepCard: {
    flexBasis: '31%',
    minWidth: 100,
    backgroundColor: '#F1E9FF',
    borderRadius: 18,
    padding: 12,
    borderWidth: 2,
    borderColor: '#DCCAFD',
    alignItems: 'center',
  },
  stepCardCompact: {
    flexBasis: '48%',
    minWidth: 0,
    padding: 10,
    borderRadius: 16,
  },
  stepIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#7C56E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  stepIconAlt: { backgroundColor: '#5BC8A8' },
  stepIconGold: { backgroundColor: '#F7C739' },
  stepIconText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  stepTitle: {
    color: '#2E1F57',
    fontWeight: '900',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 5,
  },
  stepText: {
    color: '#4B2A8E',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  progressPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginTop: 18,
    padding: 18,
    borderWidth: 2,
    borderColor: '#E8DFFF',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  statItem: {
    flex: 1,
    backgroundColor: '#F6F1FF',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: { color: '#3A1E78', fontWeight: '900', fontSize: 22 },
  statLabel: { color: '#5B2D9F', fontWeight: '700', fontSize: 11, marginTop: 4 },
  progressMessage: {
    color: '#3F2B7B',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    fontWeight: '700',
  },
  greeting: { color: '#4B2A8E', fontWeight: '800', marginTop: 14, textAlign: 'center' },
  configNote: { color: '#C05600', fontSize: 12, marginTop: 14, textAlign: 'center' },
});