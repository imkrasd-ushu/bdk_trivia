import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';

export default function Host({ who = 'hawi', text }) {
  const hawi = who === 'hawi';
  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: hawi ? C.orange : C.green }]}><Text style={styles.initial}>{hawi ? 'H' : 'A'}</Text></View>
      <View style={styles.speech}><Text style={styles.name}>{hawi ? 'Hawi' : 'Ammi'}: </Text><Text style={styles.text}>{text}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8 }, avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, initial: { color: '#fff', fontWeight: '900', fontSize: 18 }, speech: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', backgroundColor: C.bg, borderColor: C.line, borderWidth: 1, borderRadius: 6, padding: 10 }, name: { color: C.ink, fontWeight: '800' }, text: { flexShrink: 1, color: C.ink, lineHeight: 20 } });