import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File as ExpoFile } from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Screen from '../../components/Screen';
import { ErrorText, Heading } from '../../components/Heading';
import { DEFAULT_CATEGORY, TRIVIA_CATEGORIES } from '../../config/constants';
import { importQuestions, listCategories } from '../../services/adminService';
import { parseCSV, validateQuestionRows } from '../../utils/csv';
import { C } from '../../theme';

export default function CsvImportScreen() {
  const router = useRouter();
  const { category: initialCategory } = useLocalSearchParams();
  const [category, setCategory] = useState(String(initialCategory || DEFAULT_CATEGORY));
  const [fileName, setFileName] = useState('');
  const [ready, setReady] = useState([]);
  const [errors, setErrors] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [categories, setCategories] = useState(() => Object.entries(TRIVIA_CATEGORIES).map(([key, value]) => ({ key, ...value })));

  useEffect(() => {
    let active = true;
    listCategories().then(value => { if (active && value.length) setCategories(value); }).catch(() => {});
    return () => { active = false; };
  }, []);

  async function pickFile() {
    setMessage('');
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values'], copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.size > 10 * 1024 * 1024) throw new Error('Choose a CSV smaller than 10 MB.');
      const text = Platform.OS === 'web' && asset.file ? await asset.file.text() : await new ExpoFile(asset.uri).text();
      const checked = validateQuestionRows(parseCSV(text), category);
      setFileName(asset.name);
      setReady(checked.ready);
      setErrors(checked.errors);
    } catch (error) { setMessage(error.message); }
  }

  async function importReady() {
    setBusy(true);
    setMessage('');
    try {
      await importQuestions(ready.map(question => ({ ...question, category })));
      setMessage(`Imported ${ready.length} questions as drafts into ${categories.find(item => item.key === category)?.label || 'this category'}.`);
      setReady([]);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  return (
    <Screen>
      <Heading>Import quiz questions</Heading>
      <Text style={styles.copy}>Choose a category and then pick a CSV file. Questions import as drafts so they can be checked before publishing.</Text>
      <Card>
        <Text style={styles.section}>Category</Text>
        <View style={styles.filters}>{categories.map(item => <Pressable key={item.key} onPress={() => setCategory(item.key)} style={[styles.filter, category === item.key && styles.filterSelected]}><Text style={[styles.filterText, category === item.key && styles.filterSelectedText]}>{item.icon || '✦'} {item.label}</Text></Pressable>)}</View>
        <Text style={styles.section}>Required columns</Text>
        <Text selectable style={styles.code}>difficulty, character, question, option_a, option_b, option_c, option_d, correct_option, explanation, bible_reference</Text>
        <Text style={styles.copy}>Use easy, medium or hard; correct_option must be a, b, c or d. The optional hint column is also accepted.</Text>
        <Button title="Choose CSV file" variant="soft" onPress={pickFile} />
        {!!fileName && <Text style={styles.file}>{fileName}</Text>}
      </Card>
      {!!fileName && <Card>
        <Text style={styles.section}>Preview</Text>
        <Text style={styles.copy}>{ready.length} ready to import · {errors.length} with problems</Text>
        {ready.slice(0, 5).map((question, index) => <Text key={`${index}-${question.question}`} style={styles.preview}>{question.difficulty} · {question.character} · {question.question}</Text>)}
        {errors.length > 0 && <><Text style={styles.section}>Rows to fix</Text>{errors.map((item, index) => <Text key={`${item.row}-${index}`} style={styles.errorLine}>Row {item.row}: {item.messages.join('; ')}</Text>)}</>}
        {ready.length > 0 && <Button title={`Import ${ready.length} as drafts`} onPress={importReady} loading={busy} />}
      </Card>}
      {!!message && (message.startsWith('Imported') ? <Text style={styles.success}>{message}</Text> : <ErrorText>{message}</ErrorText>)}
      <Button title="Back to questions" variant="soft" onPress={() => router.back()} style={{ marginTop: 10 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({ copy: { color: C.mute, lineHeight: 21, marginVertical: 4 }, section: { color: C.ink, fontWeight: '900', fontSize: 16, marginBottom: 7 }, filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }, filter: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 }, filterSelected: { borderColor: C.green, backgroundColor: C.greenSoft }, filterText: { color: C.mute, fontSize: 12, fontWeight: '800' }, filterSelectedText: { color: C.green }, code: { color: C.green, backgroundColor: C.greenSoft, padding: 10, borderRadius: 4, fontSize: 12, lineHeight: 18, marginBottom: 8 }, file: { color: C.green, fontWeight: '800', marginTop: 7 }, preview: { color: C.ink, lineHeight: 21, marginVertical: 4 }, errorLine: { color: C.orange, lineHeight: 20, marginVertical: 3 }, success: { color: C.green, fontWeight: '800', padding: 10 } });