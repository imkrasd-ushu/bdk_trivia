import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Screen from '../../components/Screen';
import { ErrorText, Heading } from '../../components/Heading';
import { DEFAULT_CATEGORY, TRIVIA_CATEGORIES, normalizeDifficulty } from '../../config/constants';
import { getQuestion, saveQuestion, uploadQuestionImage } from '../../services/adminService';
import { C } from '../../theme';

const EMPTY = { category: DEFAULT_CATEGORY, difficulty: 'easy', character: '', question: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'a', explanation: '', bible_reference: '', hint: '', image_url: '', is_published: false };
const FIELDS = [
  ['character', 'Bible character'], ['question', 'Question'], ['option_a', 'Option A'],
  ['option_b', 'Option B'], ['option_c', 'Option C'], ['option_d', 'Option D'],
  ['explanation', 'Bible lesson (child-friendly)'], ['bible_reference', 'Bible reference'],
  ['hint', 'Hint (optional)'], ['image_url', 'Image URL (optional)'],
];

export default function QuizFormScreen() {
  const router = useRouter();
  const { id, copy, category } = useLocalSearchParams();
  const [form, setForm] = useState({ ...EMPTY, category: String(category || DEFAULT_CATEGORY) });
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!id) return;
    getQuestion(id).then(question => setForm({ ...EMPTY, category: question.category || String(category || DEFAULT_CATEGORY), ...question, difficulty: normalizeDifficulty(question.difficulty), id: copy ? undefined : question.id, is_published: copy ? false : question.is_published })).catch(reason => setError(reason.message));
  }, [id, copy, category]);

  function setField(name, value) { setForm(current => ({ ...current, [name]: value })); }

  async function pickImage() {
    setImageBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 1 });
      if (result.canceled) return;
      const uploaded = await uploadQuestionImage(result.assets[0].uri);
      setField('image_url', uploaded);
    } catch (reason) { setError(reason.message); }
    finally { setImageBusy(false); }
  }

  function validate() {
    const nextErrors = {};
    for (const [key] of FIELDS.slice(0, 8)) if (!String(form[key] || '').trim()) nextErrors[key] = 'Required';
    const values = ['option_a', 'option_b', 'option_c', 'option_d'].map(key => form[key].trim().toLowerCase());
    if (new Set(values).size !== 4) for (const key of ['option_a', 'option_b', 'option_c', 'option_d']) nextErrors[key] = 'Answers must be different';
    if (form.bible_reference && !/\d/.test(form.bible_reference)) nextErrors.bible_reference = 'Add a chapter and verse, e.g. Genesis 6:14.';
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    setBusy(true);
    setError('');
    const question = { ...form, category: form.category || DEFAULT_CATEGORY, difficulty: normalizeDifficulty(form.difficulty), hint: form.hint.trim() || null, image_url: form.image_url.trim() || null };
    delete question.id;
    try { await saveQuestion(question, form.id); router.back(); }
    catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  return (
    <Screen>
      <Heading>{form.id ? 'Edit question' : id ? 'Duplicate question' : 'Add question'}</Heading>
      {!!error && <ErrorText>{error}</ErrorText>}
      <Card>
        <Text style={styles.label}>Category</Text>
        <View style={styles.choices}>{Object.entries(TRIVIA_CATEGORIES).map(([key, item]) => <Pressable key={key} onPress={() => setField('category', key)} style={[styles.choice, form.category === key && styles.choiceSelected]}><Text style={[styles.choiceText, form.category === key && styles.choiceSelectedText]}>{item.icon} {item.label}</Text></Pressable>)}</View>
        <Text style={styles.label}>Level</Text>
        <View style={styles.choices}>{['easy', 'medium', 'hard'].map(level => <Pressable key={level} onPress={() => setField('difficulty', level)} style={[styles.choice, form.difficulty === level && styles.choiceSelected]}><Text style={[styles.choiceText, form.difficulty === level && styles.choiceSelectedText]}>{level}</Text></Pressable>)}</View>
        {FIELDS.map(([key, label]) => <View key={key}>
          <Text style={styles.label}>{label}</Text>
          <TextInput value={form[key] || ''} onChangeText={value => setField(key, value)} multiline={key === 'question' || key === 'explanation'} autoCapitalize={key === 'bible_reference' ? 'words' : 'sentences'} style={[styles.input, (key === 'question' || key === 'explanation') && styles.multiline]} />
          {!!fieldErrors[key] && <ErrorText style={styles.fieldError}>{fieldErrors[key]}</ErrorText>}
          {key === 'option_d' && <><Text style={styles.label}>Correct answer</Text><View style={styles.choices}>{['a', 'b', 'c', 'd'].map(answer => <Pressable key={answer} accessibilityRole="radio" accessibilityState={{ selected: form.correct_option === answer }} onPress={() => setField('correct_option', answer)} style={[styles.choice, styles.answerChoice, form.correct_option === answer && styles.choiceSelected]}><Text style={[styles.choiceText, form.correct_option === answer && styles.choiceSelectedText]}>{answer.toUpperCase()}</Text></Pressable>)}</View></>}
        </View>)}
        {!!form.image_url && <Image source={{ uri: form.image_url }} style={styles.preview} resizeMode="cover" />}
        <Button title={imageBusy ? 'Compressing and uploading…' : 'Choose question picture'} variant="soft" onPress={pickImage} loading={imageBusy} />
        <View style={styles.publish}><Text style={styles.label}>Published</Text><Switch value={form.is_published} onValueChange={value => setField('is_published', value)} trackColor={{ true: C.green }} thumbColor="#fff" /></View>
        <Button title="Save question" onPress={submit} loading={busy} />
        <Button title="Cancel" variant="soft" onPress={() => router.back()} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({ label: { color: C.ink, fontSize: 13, fontWeight: '900', marginTop: 10, marginBottom: 5 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, choice: { borderColor: C.line, borderWidth: 1, borderRadius: 4, paddingHorizontal: 11, paddingVertical: 8 }, choiceSelected: { backgroundColor: C.greenSoft, borderColor: C.green }, choiceText: { color: C.mute, fontWeight: '800', fontSize: 12, textTransform: 'capitalize' }, choiceSelectedText: { color: C.green }, answerChoice: { minWidth: 42, alignItems: 'center' }, input: { minHeight: 46, borderColor: C.line, borderWidth: 1, borderRadius: 5, paddingHorizontal: 10, paddingVertical: 8, color: C.ink, textAlignVertical: 'top' }, multiline: { minHeight: 74 }, fieldError: { marginTop: 4 }, preview: { height: 160, width: '100%', borderRadius: 5, marginTop: 10 }, publish: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 9 } });