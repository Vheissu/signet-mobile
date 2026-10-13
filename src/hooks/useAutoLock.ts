/**
 * useAutoLock Hook
 *
 * Locks the wallet:
 * - after `autoLockMinutes` without a touch, and
 * - when the app has been out of the foreground for longer than a short
 *   grace period.
 *
 * The grace period matters on a phone: system prompts (Face ID, camera and
 * file pickers, the share sheet) briefly take the app out of the `active`
 * state. Locking on every one of those would throw the user back to the
 * unlock screen in the middle of enabling biometrics or importing a CSV.
 * `inactive` is ignored entirely; only a real `background` transition
 * starts the clock.
 *
 * Timers do not run while the app is suspended, so the elapsed time is
 * re-checked on every return to the foreground.
 *
 * Mount once in App.tsx. Call `resetActivity()` on any user touch.
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useStore } from '../store';

/** How long the app may stay in the background before it locks. */
export const BACKGROUND_GRACE_MS = 15_000;

const CHECK_INTERVAL_MS = 5_000;

export function useAutoLock() {
  const isLocked = useStore((s) => s.isLocked);
  const isInitialized = useStore((s) => s.isInitialized);
  const autoLockMinutes = useStore((s) => s.settings.autoLockMinutes);
  const lock = useStore((s) => s.lock);

  const lastActivityRef = useRef(Date.now());
  const backgroundedAtRef = useRef<number | null>(null);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const shouldLockForInactivity = useCallback(() => {
    if (autoLockMinutes <= 0) return false;
    return Date.now() - lastActivityRef.current >= autoLockMinutes * 60 * 1000;
  }, [autoLockMinutes]);

  // Inactivity timer while in the foreground
  useEffect(() => {
    if (isLocked || !isInitialized || autoLockMinutes <= 0) return;

    const interval = setInterval(() => {
      if (shouldLockForInactivity()) lock();
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isLocked, isInitialized, autoLockMinutes, lock, shouldLockForInactivity]);

  // Background handling
  useEffect(() => {
    if (isLocked || !isInitialized) return;

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'background') {
        if (backgroundedAtRef.current === null) {
          backgroundedAtRef.current = Date.now();
        }
        return;
      }

      if (nextState === 'active') {
        const away = backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        if ((away !== null && Date.now() - away >= BACKGROUND_GRACE_MS) || shouldLockForInactivity()) {
          lock();
        } else {
          resetActivity();
        }
      }
      // `inactive` is deliberately ignored (system prompts, control centre).
    });

    return () => subscription.remove();
  }, [isLocked, isInitialized, lock, resetActivity, shouldLockForInactivity]);

  return { resetActivity };
}

export default useAutoLock;
