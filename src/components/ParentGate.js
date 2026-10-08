import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { C } from '../theme';

export default function ParentGate({ visible, onCancel, onConfirm }) {
  const [problem, setProblem] = useState(() => makeProblem());
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');

  function close() {
    setAnswer('');
    setError('');
    onCancel();
  }

  function confirm() {
    if (Number(answer) === problem.total) {
      setAnswer('');
      setError('');
      onConfirm();
      return;
    }
    setError('Ask a grown-up to help with this step.');
    setProblem(makeProblem());
    setAnswer('');
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <Text style={styles.eyebrow}>GROWN-UP CHECK</Text>
          <Text style={styles.title}>Before you leave the app</Text>
          <Text style={styles.copy}>Ask a grown-up to solve {problem.left} + {problem.right}.</Text>
          <TextInput accessibilityLabel="Answer to the grown-up check" keyboardType="number-pad" value={answer} onChangeText={setAnswer} style={styles.input} />
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <Pressable accessibilityRole="button" onPress={confirm} style={styles.confirm}><Text style={styles.confirmText}>Continue</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={close} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeProblem() {
  const left = 6 + Math.floor(Math.random() * 8);
  const right = 4 + Math.floor(Math.random() * 6);
  return { left, right, total: left + right };
}

const styles = StyleSheet.create({ backdrop: { flex: 1, backgroundColor: '#132125AA', justifyContent: 'center', padding: 22 }, dialog: { backgroundColor: C.paper, borderRadius: 8, padding: 22 }, eyebrow: { color: C.orange, fontSize: 11, fontWeight: '900', letterSpacing: 1 }, title: { color: C.ink, fontFamily: 'Georgia', fontSize: 24, fontWeight: '700', marginTop: 8 }, copy: { color: C.mute, marginTop: 9, fontSize: 16, lineHeight: 23 }, input: { height: 50, borderColor: C.line, borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, marginTop: 16, color: C.ink, fontSize: 18 }, error: { color: C.orange, marginTop: 8 }, confirm: { height: 50, backgroundColor: C.green, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginTop: 14 }, confirmText: { color: '#fff', fontWeight: '800' }, cancel: { padding: 12, alignItems: 'center' }, cancelText: { color: C.mute, fontWeight: '700' } });