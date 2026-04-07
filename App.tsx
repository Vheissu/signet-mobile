import { install } from 'react-native-quick-crypto';
install();

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator, Text, Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Navigation } from './src/navigation';
import { ToastContainer } from './src/components/ui/Toast';
import { OfflineBanner } from './src/components/ui/OfflineBanner';
import { useAutoLock } from './src/hooks/useAutoLock';
import { useStore } from './src/store';
import { colors } from './src/theme';
import {
  checkDeviceSecurity,
  enableScreenProtection,
  disableScreenProtection,
} from './src/core/security';
import {
  buildProtocolCallbackUrl,
  parseProtocolRequest,
} from './src/core/protocol';

function AppContent() {
  const isLoading = useStore((s) => s.isLoading);
  const loadingMessage = useStore((s) => s.loadingMessage);
  const isLocked = useStore((s) => s.isLocked);
  const initialize = useStore((s) => s.initialize);
  const setProtocolRequest = useStore((s) => s.setProtocolRequest);
  const addToast = useStore((s) => s.addToast);
  const { resetActivity } = useAutoLock();
  const securityChecked = useRef(false);
  const pendingUrlsRef = useRef<string[]>([]);
  const [bootComplete, setBootComplete] = useState(false);
  const [queuedUrlCount, setQueuedUrlCount] = useState(0);

  useEffect(() => {
    initialize().finally(() => {
      setBootComplete(true);
    });

    // One-time jailbreak/root check on startup
    if (!securityChecked.current) {
      securityChecked.current = true;
      checkDeviceSecurity();
    }
  }, [initialize]);

  // Prevent screenshots/screen recording while wallet is unlocked
  useEffect(() => {
    if (!isLocked) {
      enableScreenProtection();
    } else {
      disableScreenProtection();
    }
  }, [isLocked]);

  const respondWithProtocolError = useCallback(
    async (
      callback: string,
      requestId: string | undefined,
      error: string,
      message: string,
      username?: string,
    ) => {
      const callbackUrl = buildProtocolCallbackUrl(callback, {
        status: 'error',
        error,
        message,
        request_id: requestId,
        username,
      });

      try {
        await Linking.openURL(callbackUrl);
      } catch {
        addToast({
          type: 'error',
          message,
        });
      }
    },
    [addToast],
  );

  const handleProtocolUrl = useCallback(
    async (incomingUrl: string) => {
      const request = parseProtocolRequest(incomingUrl);
      if (!request) {
        return;
      }

      const state = useStore.getState();
      const requestedAccount = state.accounts.find(
        (account) => account.username === request.username,
      );

      if (!state.isInitialized) {
        await respondWithProtocolError(
          request.callback,
          request.requestId,
          'wallet_unavailable',
          'Signet is not set up on this device.',
          request.username,
        );
        return;
      }

      if (!requestedAccount && !state.isLocked) {
        await respondWithProtocolError(
          request.callback,
          request.requestId,
          'account_not_found',
          `@${request.username} is not available in Signet.`,
          request.username,
        );
        return;
      }

      setProtocolRequest(request);

      addToast({
        type: 'info',
        message: state.isLocked
          ? 'Unlock Signet to review the external login request.'
          : 'Review the external login request in Signet.',
      });
    },
    [addToast, respondWithProtocolError, setProtocolRequest],
  );

  const queueIncomingUrl = useCallback((incomingUrl: string) => {
    pendingUrlsRef.current.push(incomingUrl);
    setQueuedUrlCount((count) => count + 1);
  }, []);

  useEffect(() => {
    Linking.getInitialURL()
      .then((initialUrl) => {
        if (initialUrl) {
          queueIncomingUrl(initialUrl);
        }
      })
      .catch(() => {
        // No initial URL to process
      });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      queueIncomingUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, [queueIncomingUrl]);

  useEffect(() => {
    if (!bootComplete || pendingUrlsRef.current.length === 0) {
      return;
    }

    const queuedUrls = [...pendingUrlsRef.current];
    pendingUrlsRef.current = [];

    queuedUrls.reduce<Promise<void>>(
      (chain, incomingUrl) => chain.then(() => handleProtocolUrl(incomingUrl)),
      Promise.resolve(),
    ).catch(() => {
      // Individual handlers surface their own errors to the caller or UI
    });
  }, [bootComplete, handleProtocolUrl, queuedUrlCount]);

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
