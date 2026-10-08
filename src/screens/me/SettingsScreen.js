import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Screen from '../../components/Screen';
import { ErrorText, Heading, Eyebrow } from '../../components/Heading';
import { DEFAULT_QUESTION_TIMEOUT, QUESTION_TIMEOUT_OPTIONS, TRIVIA_CATEGORIES } from '../../config/constants';
import { C } from '../../theme';

const QUESTION_TIMEOUT_KEY = 'bdk-question-timeout';
const USER_SETTINGS_KEY = 'bdk-user-settings';
const LANGUAGES = ['English', 'Español', 'Français'];

export default function SettingsScreen() {
  const router = useRouter();
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [timerSeconds, setTimerSeconds] = useState(DEFAULT_QUESTION_TIMEOUT);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [language, setLanguage] = useState('English');
  const [defaultCategory, setDefaultCategory] = useState('bible_stories');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    Promise.all([
      AsyncStorage.getItem(QUESTION_TIMEOUT_KEY),
      AsyncStorage.getItem(USER_SETTINGS_KEY),
    ])
      .then(([timeoutValue, userValue]) => {
        if (!active) return;

        if (timeoutValue) {
          try {
            const parsed = JSON.parse(timeoutValue);
            setTimerEnabled(parsed.enabled !== false);
            setTimerSeconds(Number(parsed.seconds) || DEFAULT_QUESTION_TIMEOUT);
          } catch {
            setTimerEnabled(true);
            setTimerSeconds(DEFAULT_QUESTION_TIMEOUT);
          }
        }

        if (userValue) {
          try {
            const parsed = JSON.parse(userValue);
            setSoundEnabled(parsed.soundEnabled !== false);
            setLanguage(parsed.language || 'English');
            setDefaultCategory(parsed.defaultCategory || 'bible_stories');
          } catch {
            setSoundEnabled(true);
            setLanguage('English');
            setDefaultCategory('bible_stories');
          }
        }
      })
      .catch(() => {});

    return () => { active = false; };
  }, []);

  async function saveSettings() {
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await AsyncStorage.setItem(QUESTION_TIMEOUT_KEY, JSON.stringify({
        enabled: timerEnabled,
        seconds: timerEnabled ? timerSeconds : DEFAULT_QUESTION_TIMEOUT,
      }));
      await AsyncStorage.setItem(USER_SETTINGS_KEY, JSON.stringify({
        soundEnabled,
        language,
        defaultCategory,
      }));
      setSaved(true);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Eyebrow>APP SETTINGS</Eyebrow>
      <Heading>Settings</Heading>
      <Card>
        <Text style={styles.label}>Sound</Text>
        <View style={styles.toggleRow}>
          <Pressable onPress={() => setSoundEnabled(!soundEnabled)} style={[styles.toggle, soundEnabled && styles.toggleActive]}>
            <Text style={[styles.toggleText, soundEnabled && styles.toggleTextActive]}>{soundEnabled ? 'On' : 'Off'}</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Language</Text>
        <View style={styles.options}>
          {LANGUAGES.map(option => (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected: language === option }}
              onPress={() => setLanguage(option)}
              style={[styles.option, language === option && styles.optionSelected]}
            >
              <Text style={[styles.optionText, language === option && styles.optionTextSelected]}>{option}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Default category</Text>
        <View style={styles.options}>
          {Object.entries(TRIVIA_CATEGORIES).map(([key, value]) => (
            <Pressable
              key={key}
              accessibilityRole="radio"
              accessibilityState={{ selected: defaultCategory === key }}
              onPress={() => setDefaultCategory(key)}
              style={[styles.option, defaultCategory === key && styles.optionSelected]}
            >
              <Text style={[styles.optionText, defaultCategory === key && styles.optionTextSelected]}>{value.icon} {value.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Question timeout</Text>
        <View style={styles.toggleRow}>
          <Pressable onPress={() => setTimerEnabled(!timerEnabled)} style={[styles.toggle, timerEnabled && styles.toggleActive]}>
            <Text style={[styles.toggleText, timerEnabled && styles.toggleTextActive]}>{timerEnabled ? 'On' : 'Off'}</Text>
          </Pressable>
        </View>
        {timerEnabled && (
          <View style={styles.options}>
            {QUESTION_TIMEOUT_OPTIONS.map(seconds => (
              <Pressable
                key={seconds}
                accessibilityRole="radio"
                accessibilityState={{ selected: timerSeconds === seconds }}
                onPress={() => setTimerSeconds(seconds)}
                style={[styles.option, timerSeconds === seconds && styles.optionSelected]}
              >
                <Text style={[styles.optionText, timerSeconds === seconds && styles.optionTextSelected]}>{seconds}s</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.copy}>{timerEnabled ? `Each question will time out after ${timerSeconds} seconds.` : 'Timed questions are disabled for now.'}</Text>
        {!!error && <ErrorText>{error}</ErrorText>}
        {saved && <Text style={styles.success}>Your settings were saved.</Text>}
        <Button title="Save settings" onPress={saveSettings} loading={busy} style={{ marginTop: 16 }} />
        <Button title="Back" variant="soft" onPress={() => router.back()} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  copy: { color: C.mute, lineHeight: 22, marginTop: 12 },
  label: { color: C.ink, fontWeight: '900', fontSize: 16, marginTop: 16, marginBottom: 10 },
  toggleRow: { alignItems: 'flex-start', marginBottom: 8 },
  toggle: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  toggleActive: { borderColor: C.green, backgroundColor: C.greenSoft },
  toggleText: { color: C.mute, fontSize: 12, fontWeight: '800' },
  toggleTextActive: { color: C.green },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  option: { borderColor: C.line, borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, marginRight: 6, marginBottom: 6 },
  optionSelected: { borderColor: C.green, backgroundColor: C.greenSoft },
  optionText: { color: C.ink, fontSize: 12, fontWeight: '800' },
  optionTextSelected: { color: C.green },
  success: { color: C.green, fontWeight: '800', marginTop: 10 },
});
