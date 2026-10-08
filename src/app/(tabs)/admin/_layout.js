import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { C } from '../../../theme';

export default function AdminLayout() {
  const { isAdmin, ready, session } = useAuth();
  if (!ready) return null;
  if (!session || !isAdmin) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerStyle: { backgroundColor: C.bg }, headerTintColor: C.ink, headerTitleStyle: { fontWeight: '800' }, contentStyle: { backgroundColor: C.bg } }} />;
}