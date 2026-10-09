import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Screen from '../../components/Screen';
import { ErrorText, Heading } from '../../components/Heading';
import { createCategory, listCategories } from '../../services/adminService';
import { C } from '../../theme';

export default function CategoriesScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('✦');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function refresh() {
    try { setCategories(await listCategories()); }
    catch (reason) { setError(reason.message); }
  }

  useEffect(() => {
    let active = true;
    listCategories().then(value => { if (active) setCategories(value); }).catch(reason => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, []);

  async function submit() {
    if (!label.trim()) {
      setError('Enter a category name.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await createCategory(label.trim(), icon.trim() || '✦');
      setLabel('');
      setIcon('✦');
      await refresh();
      setMessage('Category added. Sync the quiz pack on devices to download its published questions.');
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  return (
    <Screen>
      <Heading>Manage categories</Heading>
      {!!error && <ErrorText>{error}</ErrorText>}
      {!!message && <Text style={styles.success}>{message}</Text>}
      <Card>
        <Text style={styles.label}>Category name</Text>
        <TextInput value={label} onChangeText={setLabel} placeholder="e.g. Parables" style={styles.input} />
        <Text style={styles.label}>Icon</Text>
        <View style={styles.icons}>
          {['✦', '📖', '🌿', '🕊️', '🐑', '🏆'].map(value => (
            <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: icon === value }} onPress={() => setIcon(value)} style={[styles.iconChoice, icon === value && styles.iconSelected]}>
              <Text style={styles.iconText}>{value}</Text>
            </Pressable>
          ))}
        </View>
        <Button title="Add category" onPress={submit} loading={busy} style={{ marginTop: 14 }} />
      </Card>
      <Card>
        <Text style={styles.label}>Active categories</Text>
        {categories.map(item => <Text key={item.key} style={styles.categoryLine}>{item.icon || '✦'} {item.label} <Text style={styles.key}>{item.key}</Text></Text>)}
      </Card>
      <Button title="Back to questions" variant="soft" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: C.ink, fontSize: 14, fontWeight: '900', marginBottom: 7 },
  input: { height: 48, borderColor: C.line, borderWidth: 1, borderRadius: 5, paddingHorizontal: 12, color: C.ink, marginBottom: 12 },
  icons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  iconChoice: { width: 42, height: 42, borderWidth: 1, borderColor: C.line, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  iconSelected: { backgroundColor: C.greenSoft, borderColor: C.green },
  iconText: { fontSize: 20 },
  categoryLine: { color: C.ink, paddingVertical: 7 },
  key: { color: C.mute, fontSize: 12 },
  success: { color: C.green, marginBottom: 10 },
});