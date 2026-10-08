import React from 'react';
import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { C } from '../../theme';

const tabIcon = symbol => function TabIcon({ color }) {
  return <Text style={{ color, fontSize: 19 }}>{symbol}</Text>;
};

export default function TabLayout() {
  const { isAdmin } = useAuth();
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: C.bg },
      headerTintColor: C.ink,
      headerTitleStyle: { fontWeight: '800' },
      tabBarActiveTintColor: C.green,
      tabBarInactiveTintColor: C.mute,
      tabBarStyle: { backgroundColor: C.paper, borderTopColor: C.line },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Bible Trivia', tabBarLabel: 'Play', tabBarIcon: tabIcon('✦') }} />
      <Tabs.Screen name="progress" options={{ title: 'My Progress', tabBarIcon: tabIcon('★') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: tabIcon('⚙') }} />
      <Tabs.Screen name="family" options={{ title: 'Family', tabBarIcon: tabIcon('⌂') }} />
      <Tabs.Screen name="admin" options={{ title: 'Admin', href: isAdmin ? undefined : null, tabBarIcon: tabIcon('▤') }} />
    </Tabs>
  );
}