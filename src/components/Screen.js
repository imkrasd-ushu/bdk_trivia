import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../theme';

export default function Screen({ children, scroll = true, style, contentStyle, edges = ['top', 'bottom'] }) {
  const Content = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <Content style={[styles.content, style]} contentContainerStyle={scroll ? [styles.inner, contentStyle] : undefined}>
        {children}
      </Content>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: C.bg }, content: { flex: 1 }, inner: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 20, paddingBottom: 36 } });