import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { C } from '../theme';

export function Heading({ children, style }) {
  return <Text style={[styles.heading, style]}>{children}</Text>;
}

export function ErrorText({ children, style }) {
  return <Text accessibilityRole="alert" style={[styles.error, style]}>{children}</Text>;
}

export function Eyebrow({ children, style }) {
  return <Text style={[styles.eyebrow, style]}>{children}</Text>;
}

const styles = StyleSheet.create({ heading: { color: C.ink, fontFamily: 'Georgia', fontSize: 27, lineHeight: 33, fontWeight: '700', marginBottom: 8 }, error: { color: C.orange, fontSize: 14, lineHeight: 20, fontWeight: '700' }, eyebrow: { color: C.green, fontSize: 11, fontWeight: '800', letterSpacing: 1.1, marginBottom: 7 } });