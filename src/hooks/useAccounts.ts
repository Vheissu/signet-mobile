/**
 * useAccounts Hook
 *
 * Provides account management actions and key access.
 * Ported from the browser extension.
 */

import { useCallback } from 'react';
import { useStore } from '../store';
import { decrypt } from '../core/crypto/encryption';
import type { StoredAccount, KeyRole, EncryptedPayload } from '../core/types';
import { logger } from '../core/logger';

export function useAccounts() {
  const accounts = useStore((s) => s.accounts);
  const activeAccountName = useStore((s) => s.activeAccountName);
  const activeAccountData = useStore((s) => s.activeAccountData);
  const password = useStore((s) => s.password);

  const addAccountAction = useStore((s) => s.addAccount);
  const removeAccountAction = useStore((s) => s.removeAccount);
  const setActiveAccountAction = useStore((s) => s.setActiveAccount);
  const updateAccountKeysAction = useStore((s) => s.updateAccountKeys);

  /**
   * Get the decrypted private key (WIF) for a given role on the active account.
   * Returns null if the key is not stored or decryption fails.
   */
  const getDecryptedKey = useCallback(
    async (role: KeyRole): Promise<string | null> => {
      if (!password || !activeAccountName) return null;

      const account = accounts.find((a) => a.username === activeAccountName);
      if (!account) return null;

      const encryptedKey = account.keys[role];
      if (!encryptedKey) return null;

      try {
        const payload: EncryptedPayload = JSON.parse(encryptedKey);
        const decrypted = await decrypt(payload, password);
        return decrypted;
      } catch (error) {
        logger.error(`[useAccounts] Failed to decrypt ${role} key:`, error);
        return null;
      }
    },
    [accounts, activeAccountName, password],
  );

  /**
   * Get a decrypted key for a specific account (not necessarily the active one).
   */
  const getDecryptedKeyForAccount = useCallback(
    async (username: string, role: KeyRole): Promise<string | null> => {
      if (!password) return null;

      const account = accounts.find((a) => a.username === username);
      if (!account) return null;

      const encryptedKey = account.keys[role];
      if (!encryptedKey) return null;

      try {
        const payload: EncryptedPayload = JSON.parse(encryptedKey);
        const decrypted = await decrypt(payload, password);
        return decrypted;
      } catch (error) {
        logger.error(
          `[useAccounts] Failed to decrypt ${role} key for ${username}:`,
          error,
        );
        return null;
      }
    },
    [accounts, password],
  );

  /**
   * Check if the active account has a key stored for a given role.
   */
  const hasKey = useCallback(
    (role: KeyRole): boolean => {
      if (!activeAccountName) return false;
      const account = accounts.find((a) => a.username === activeAccountName);
      if (!account) return false;
      return !!account.keys[role];
    },
    [accounts, activeAccountName],
  );

  /**
   * Check if a specific account has a key stored for a given role.
   */
  const hasKeyForAccount = useCallback(
    (username: string, role: KeyRole): boolean => {
      const account = accounts.find((a) => a.username === username);
      if (!account) return false;
      return !!account.keys[role];
    },
    [accounts],
  );

  /**
   * Get the list of key roles available on the active account.
   */
  const getAvailableRoles = useCallback((): KeyRole[] => {
    if (!activeAccountName) return [];
    const account = accounts.find((a) => a.username === activeAccountName);
    if (!account) return [];

    const roles: KeyRole[] = ['posting', 'active', 'memo', 'owner'];
    return roles.filter((role) => !!account.keys[role]);
  }, [accounts, activeAccountName]);

  const addAccount = useCallback(
    (account: StoredAccount) => addAccountAction(account),
    [addAccountAction],
  );

  const removeAccount = useCallback(
    (username: string) => removeAccountAction(username),
    [removeAccountAction],
  );

  const setActiveAccount = useCallback(
    (username: string) => setActiveAccountAction(username),
    [setActiveAccountAction],
  );

  const updateAccountKeys = useCallback(
    (username: string, newKeys: Partial<StoredAccount['keys']>) =>
      updateAccountKeysAction(username, newKeys),
    [updateAccountKeysAction],
  );

  return {
    accounts,
    activeAccountName,
    activeAccountData,
    addAccount,
    removeAccount,
    setActiveAccount,
    updateAccountKeys,
    getDecryptedKey,
    getDecryptedKeyForAccount,
    hasKey,
    hasKeyForAccount,
    getAvailableRoles,
  };
}

export default useAccounts;
