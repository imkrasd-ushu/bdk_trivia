import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';

export default function StatCard({ value, label }) {
  return <View style={styles.stat}><Text style={styles.value}>{value ?? 0}</Text><Text style={styles.label}>{label}</Text></View>;
}

const styles = StyleSheet.create({ stat: { flexGrow: 1, flexBasis: '42%', minHeight: 86, backgroundColor: C.bg, borderRadius: 6, padding: 12, justifyContent: 'center' }, value: { color: C.green, fontSize: 25, fontWeight: '800' }, label: { color: C.mute, fontSize: 12, marginTop: 3 } });