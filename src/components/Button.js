import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { C } from '../theme';

const variants = {
  primary: { backgroundColor: C.green, borderColor: C.green, color: '#fff' },
  sun: { backgroundColor: C.sun, borderColor: C.sun, color: C.ink },
  soft: { backgroundColor: C.paper, borderColor: C.line, color: C.ink },
  danger: { backgroundColor: C.orangeSoft, borderColor: C.orangeSoft, color: C.orange },
};

export default function Button({ title, onPress, variant = 'primary', loading = false, disabled = false, style, compact = false, accessibilityLabel }) {
  const theme = variants[variant] || variants.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.button, compact && styles.compact, { backgroundColor: theme.backgroundColor, borderColor: theme.borderColor, opacity: pressed ? 0.82 : disabled ? 0.5 : 1 }, style]}>
      {loading ? <ActivityIndicator color={theme.color} /> : <Text style={[styles.label, { color: theme.color }]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({ button: { minHeight: 52, borderRadius: 6, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center', alignItems: 'center', marginVertical: 5 }, compact: { minHeight: 42, paddingVertical: 8, paddingHorizontal: 12 }, label: { fontSize: 16, fontWeight: '800', textAlign: 'center' } });