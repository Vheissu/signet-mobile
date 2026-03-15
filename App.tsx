import { install } from 'react-native-quick-crypto';
install();

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Navigation } from './src/navigation';
import { ToastContainer } from './src/components/ui/Toast';
import { OfflineBanner } from './src/components/ui/OfflineBanner';
import { useAutoLock } from './src/hooks/useAutoLock';
import { useStore } from './src/store';
import { colors } from './src/theme';

function AppContent() {
  const isLoading = useStore((s) => s.isLoading);
  const loadingMessage = useStore((s) => s.loadingMessage);
  const initialize = useStore((s) => s.initialize);
  const { resetActivity } = useAutoLock();

  useEffect(() => {
    initialize();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>S</Text>
          </View>
        </View>
        <ActivityIndicator size="large" color={colors.hive} style={{ marginBottom: 12 }} />
        <Text style={styles.loadingText}>{loadingMessage}</Text>
      </View>
    );
  }

  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={() => {
        resetActivity();
        return false;
      }}
    >
      <Navigation />
      <ToastContainer />
      <OfflineBanner />
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor={colors.bg} />
        <AppContent />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: colors.hive,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.hive,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
