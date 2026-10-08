import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { C } from '../theme';
import HomeScreen from '../screens/play/HomeScreen';
import LevelScreen from '../screens/play/LevelScreen';
import GameScreen from '../screens/play/GameScreen';
import ResultsScreen from '../screens/play/ResultsScreen';
import BibleScreen from '../screens/play/BibleScreen';
import ProgressScreen from '../screens/me/ProgressScreen';
import ProfileScreen from '../screens/me/ProfileScreen';
import FamilyScreen from '../screens/me/FamilyScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import QuizFormScreen from '../screens/admin/QuizFormScreen';
import CsvImportScreen from '../screens/admin/CsvImportScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: C.bg, primary: C.purple, card: '#fff', text: C.ink, border: C.line } };
const icon = e => () => <Text style={{ fontSize: 22 }}>{e}</Text>;

function Tabs() {
  const { isAdmin } = useAuth();
  return (
    <Tab.Navigator screenOptions={{ tabBarActiveTintColor: C.purple, headerTitleStyle: { fontWeight: '800' } }}>
      <Tab.Screen name="Play" component={HomeScreen} options={{ title: 'Bible Trivia', tabBarLabel: 'Play', tabBarIcon: icon('🎮') }} />
      <Tab.Screen name="Progress" component={ProgressScreen} options={{ title: 'My Progress', tabBarIcon: icon('🏆') }} />
      <Tab.Screen name="Family" component={FamilyScreen} options={{ tabBarIcon: icon('👨‍👩‍👧') }} />
      {isAdmin && <Tab.Screen name="Admin" component={AdminDashboardScreen} options={{ headerShown: false, tabBarIcon: icon('🛠️') }} />}
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { ready } = useAuth();
  if (!ready) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={C.purple} size="large" /></View>;
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={{ headerTitleStyle: { fontWeight: '800' }, headerBackTitle: 'Back' }}>
        <Stack.Screen name="Main" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="Levels" component={LevelScreen} options={{ title: 'Bible Characters' }} />
        <Stack.Screen name="Game" component={GameScreen} options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="Results" component={ResultsScreen} options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="Bible" component={BibleScreen} options={{ title: 'Read the Bible' }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My name and picture' }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'BDK account', presentation: 'modal' }} />
        <Stack.Screen name="QuizForm" component={QuizFormScreen} options={{ title: 'Quiz' }} />
        <Stack.Screen name="CsvImport" component={CsvImportScreen} options={{ title: 'Import quizzes' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
