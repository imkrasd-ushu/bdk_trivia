import React from 'react';
import { StyleSheet, View } from 'react-native';
import { C } from '../theme';

export default function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({ card: { backgroundColor: C.paper, borderColor: C.line, borderWidth: 1, borderRadius: 8, padding: 18, marginVertical: 8 } });