/**
 * useAuth Hook
 *
 * Provides authentication state and actions for the wallet.
 */

import { useCallback } from 'react';
import { useStore } from '../store';

export function useAuth() {
  const isInitialized = useStore((s) => s.isInitialized);
  const isLocked = useStore((s) => s.isLocked);
  const isLoading = useStore((s) => s.isLoading);
  const loadingMessage = useStore((s) => s.loadingMessage);

  const initializeAction = useStore((s) => s.initialize);
  const createWalletAction = useStore((s) => s.createWallet);
  const unlockAction = useStore((s) => s.unlock);
  const lockAction = useStore((s) => s.lock);

  const initialize = useCallback(() => initializeAction(), [initializeAction]);

  const createWallet = useCallback(
    (password: string) => createWalletAction(password),
    [createWalletAction],
  );

  const unlock = useCallback(
    (password: string) => unlockAction(password),
    [unlockAction],
  );

  const lock = useCallback(() => lockAction(), [lockAction]);

  return {
    isInitialized,
    isLocked,
    isLoading,
    loadingMessage,
    initialize,
    createWallet,
    unlock,
    lock,
  };
}

export default useAuth;
