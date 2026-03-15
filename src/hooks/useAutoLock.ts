/**
 * useAutoLock Hook
 *
 * Security features:
 * - Locks the wallet after `autoLockMinutes` of inactivity
 * - Locks immediately when the app goes to background
 *
 * Mount once in App.tsx. Call `resetActivity()` on any user touch.
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useStore } from '../store';

export function useAutoLock() {
  const isLocked = useStore((s) => s.isLocked);
  const isInitialized = useStore((s) => s.isInitialized);
  const autoLockMinutes = useStore((s) => s.settings.autoLockMinutes);
  const lock = useStore((s) => s.lock);

  const lastActivityRef = useRef(Date.now());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Inactivity timer - check every 15 seconds
  useEffect(() => {
    if (isLocked || !isInitialized || autoLockMinutes <= 0) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      const limitMs = autoLockMinutes * 60 * 1000;

      if (elapsed >= limitMs) {
        lock();
      }
    }, 15_000);

    return () => clearInterval(interval);
  }, [isLocked, isInitialized, autoLockMinutes, lock]);

  // Lock when app goes to background
  useEffect(() => {
    if (isLocked || !isInitialized) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (
        appStateRef.current === 'active' &&
        (nextState === 'background' || nextState === 'inactive')
      ) {
        lock();
      }
      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, [isLocked, isInitialized, lock]);

  return { resetActivity };
}

export default useAutoLock;
