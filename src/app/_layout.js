import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../context/AuthContext';
import { C } from '../theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{
          headerStyle: { backgroundColor: C.bg },
          headerTintColor: C.ink,
          headerTitleStyle: { fontWeight: '800' },
          contentStyle: { backgroundColor: C.bg },
        }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="levels" options={{ title: 'Choose a level' }} />
          <Stack.Screen name="game" options={{ title: 'Bible challenge', headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="results" options={{ title: 'Your results', headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="bible" options={{ title: 'Read the Bible' }} />
          <Stack.Screen name="login" options={{ title: 'BDK account', presentation: 'modal' }} />
          <Stack.Screen name="profile" options={{ title: 'My name and picture' }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}