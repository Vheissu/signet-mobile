/**
 * Signet Mobile Navigation
 *
 * React Navigation setup with:
 * - Auth flow (Welcome, CreatePassword, Login)
 * - Main tab navigator (Dashboard, Tokens, History, Governance)
 * - Detail stack screens (Send, Receive, Staking, etc.)
 */

import React from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet } from 'react-native';
import {
  LayoutDashboard,
  Coins,
  Clock,
  Landmark,
} from 'lucide-react-native';
import { colors } from '../theme';
import { useStore } from '../store';

// Screen imports
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { CreatePasswordScreen } from '../screens/CreatePasswordScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import TokensScreen from '../screens/TokensScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import GovernanceScreen from '../screens/GovernanceScreen';
import { SendScreen } from '../screens/SendScreen';
import { ReceiveScreen } from '../screens/ReceiveScreen';
import StakingScreen from '../screens/StakingScreen';
import SavingsScreen from '../screens/SavingsScreen';
import DelegationScreen from '../screens/DelegationScreen';
import SwapScreen from '../screens/SwapScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AddAccountScreen from '../screens/AddAccountScreen';
import EditAccountScreen from '../screens/EditAccountScreen';
import ImportKeysScreen from '../screens/ImportKeysScreen';
import ContactsScreen from '../screens/ContactsScreen';
import TokenDetailScreen from '../screens/TokenDetailScreen';

// -------------------------------------------------------------------
// Param Lists
// -------------------------------------------------------------------
export type RootStackParamList = {
  Welcome: undefined;
  CreatePassword: undefined;
  Login: undefined;
  Main: undefined;
  Send: { token?: string; to?: string } | undefined;
  Receive: undefined;
  Staking: undefined;
  Savings: undefined;
  Delegation: { username?: string } | undefined;
  Swap: undefined;
  Settings: undefined;
  Onboarding: undefined;
  AddAccount: undefined;
  EditAccount: { username: string };
  ImportKeys: { username?: string } | undefined;
  Contacts: undefined;
  TokenDetail: { symbol: string; tokenData?: any };
};

export type MainTabParamList = {
  Dashboard: undefined;
  Tokens: undefined;
  History: undefined;
  Governance: undefined;
};

// -------------------------------------------------------------------
// Navigation Theme (dark purple)
// -------------------------------------------------------------------
const SignetTheme: Theme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: '#1A1128',
    card: '#231838',
    text: '#F0ECF5',
    border: 'rgba(255,255,255,0.06)',
    primary: '#E31337',
    notification: '#E31337',
  },
};

// -------------------------------------------------------------------
// Bottom Tab Navigator
// -------------------------------------------------------------------
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 20,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.hive,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Wallet',
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard size={size - 4} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Tokens"
        component={TokensScreen}
        options={{
          tabBarLabel: 'Tokens',
          tabBarIcon: ({ color, size }) => (
            <Coins size={size - 4} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ color, size }) => (
            <Clock size={size - 4} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Governance"
        component={GovernanceScreen}
        options={{
          tabBarLabel: 'Govern',
          tabBarIcon: ({ color, size }) => (
            <Landmark size={size - 4} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// -------------------------------------------------------------------
// Root Stack Navigator
// -------------------------------------------------------------------
const Stack = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  const isInitialized = useStore((s) => s.isInitialized);
  const isLocked = useStore((s) => s.isLocked);
  const isLoading = useStore((s) => s.isLoading);
  const accounts = useStore((s) => s.accounts);

  // Determine which flow to show:
  // 1. Not initialized → Welcome/CreatePassword (onboarding)
  // 2. Initialized but locked → Login
  // 3. Initialized, unlocked, no accounts → AddAccount (post-wallet-creation)
  // 4. Initialized, unlocked, has accounts → Main (dashboard)
  const needsOnboarding = !isInitialized;
  const needsUnlock = isInitialized && isLocked;
  const needsAccount = isInitialized && !isLocked && accounts.length === 0;
  const isReady = isInitialized && !isLocked && accounts.length > 0;

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
      }}
    >
      {needsOnboarding ? (
        <>
          <Stack.Screen
            name="Welcome"
            component={WelcomeScreen}
            options={{ animation: 'fade' }}
          />
          <Stack.Screen
            name="CreatePassword"
            component={CreatePasswordScreen}
          />
        </>
      ) : needsUnlock ? (
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ animation: 'fade' }}
          />
        </>
      ) : needsAccount ? (
        <>
          <Stack.Screen
            name="Onboarding"
            component={AddAccountScreen}
          />
          <Stack.Screen name="ImportKeys" component={ImportKeysScreen} />
        </>
      ) : (
        <>
          <Stack.Screen
            name="Main"
            component={MainTabs}
            options={{ animation: 'fade' }}
          />
          <Stack.Screen name="Send" component={SendScreen} />
          <Stack.Screen
            name="Receive"
            component={ReceiveScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="Staking" component={StakingScreen} />
          <Stack.Screen name="Savings" component={SavingsScreen} />
          <Stack.Screen name="Delegation" component={DelegationScreen} />
          <Stack.Screen name="Swap" component={SwapScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="AddAccount" component={AddAccountScreen} />
          <Stack.Screen name="EditAccount" component={EditAccountScreen} />
          <Stack.Screen name="ImportKeys" component={ImportKeysScreen} />
          <Stack.Screen name="Contacts" component={ContactsScreen} />
          <Stack.Screen name="TokenDetail" component={TokenDetailScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

// -------------------------------------------------------------------
// Navigation Container
// -------------------------------------------------------------------
export function Navigation() {
  return (
    <NavigationContainer theme={SignetTheme}>
      <RootNavigator />
    </NavigationContainer>
  );
}

export default Navigation;
