import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { syncCatalog, syncPendingGames } from '../services/offlineService';
import { C } from '../theme';

function OfflineSync() {
  useEffect(() => {
    let syncing = false;
    const syncWhenOnline = async state => {
      if (!state.isConnected || state.isInternetReachable === false || syncing) return;
      syncing = true;
      try {
        try { await syncCatalog(); } catch { /* Preserve the last catalog and continue syncing completed games. */ }
        await syncPendingGames();
      } catch {
        // Retry queued work on the next connection event.
      } finally {
        syncing = false;
      }
    };

    const unsubscribeNetwork = NetInfo.addEventListener(state => { void syncWhenOnline(state); });
    const authSubscription = supabase?.auth.onAuthStateChange((_event, session) => {
      if (session) void syncPendingGames();
    }).data.subscription;
    void NetInfo.fetch().then(syncWhenOnline);

    return () => {
      unsubscribeNetwork();
      authSubscription?.unsubscribe();
    };
  }, []);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <OfflineSync />
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