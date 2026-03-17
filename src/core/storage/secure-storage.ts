/**
 * Secure Storage for React Native
 *
 * Uses two storage backends:
 * - expo-secure-store: For the session password (sensitive, small string).
 *   Data is encrypted at rest by the OS keychain (Keychain on iOS,
 *   Keystore on Android).
 * - AsyncStorage: For everything else (encrypted accounts blob, settings,
 *   contacts, notifications, nav state). These are already encrypted
 *   by our application-level encryption, or are non-sensitive preferences.
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { logger } from '../logger';

// Keys for SecureStore (sensitive data)
const SECURE_SESSION_PASSWORD = 'signet_session_password';

// Keys for AsyncStorage (encrypted or non-sensitive data)
const STORAGE_KEYS = {
  encryptedAccounts: 'signet_encrypted_accounts',
  activeAccount: 'signet_active_account',
  passwordCheck: 'signet_password_check',
  settings: 'signet_settings',
  navState: 'signet_nav_state',
} as const;

// Exported key constants for use in the store
export const STORE_KEYS = {
  ACCOUNTS: STORAGE_KEYS.encryptedAccounts,
  ACTIVE_ACCOUNT: STORAGE_KEYS.activeAccount,
  SETTINGS: STORAGE_KEYS.settings,
  SESSION: SECURE_SESSION_PASSWORD,
} as const;

/**
 * Generic get/set/remove helpers for the store.
 * Routes session-related keys through SecureStore, everything else through AsyncStorage.
 */
export async function getSecureItem(key: string): Promise<string | null> {
  try {
    if (key === SECURE_SESSION_PASSWORD) {
      return await SecureStore.getItemAsync(key);
    }
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    if (key === SECURE_SESSION_PASSWORD) {
      await SecureStore.setItemAsync(key, value);
    } else {
      await AsyncStorage.setItem(key, value);
    }
  } catch (err) {
    logger.warn('[Signet] Storage write failed for key:', key, err);
  }
}

export async function removeSecureItem(key: string): Promise<void> {
  try {
    if (key === SECURE_SESSION_PASSWORD) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await AsyncStorage.removeItem(key);
    }
  } catch (err) {
    logger.warn('[Signet] Storage remove failed for key:', key, err);
  }
}

/**
 * Get a prefixed form draft key.
 */
function draftKey(page: string): string {
  return `signet_draft_${page}`;
}

export const secureStorage = {
  // --- Encrypted Accounts ---

  async getEncryptedAccounts(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.encryptedAccounts);
    } catch {
      return null;
    }
  },

  async setEncryptedAccounts(data: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.encryptedAccounts, data);
    } catch (err) {
      logger.warn('[Signet] Failed to save encrypted accounts:', err);
    }
  },

  async clearEncryptedAccounts(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.encryptedAccounts);
    } catch (err) {
      logger.warn('[Signet] Failed to clear encrypted accounts:', err);
    }
  },

  // --- Settings ---

  async getSettings(): Promise<Settings> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.settings);
      if (raw) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch {
      // Parse error, return defaults
    }
    return DEFAULT_SETTINGS;
  },

  async setSettings(settings: Settings): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    } catch (err) {
      logger.warn('[Signet] Failed to save settings:', err);
    }
  },

  // --- Session Password (sensitive, stored in OS keychain) ---

  async getSessionPassword(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(SECURE_SESSION_PASSWORD);
    } catch {
      return null;
    }
  },

  async setSessionPassword(password: string | null): Promise<void> {
    try {
      if (password) {
        await SecureStore.setItemAsync(SECURE_SESSION_PASSWORD, password);
      } else {
        await SecureStore.deleteItemAsync(SECURE_SESSION_PASSWORD);
      }
    } catch (err) {
      logger.warn('[Signet] SecureStore session password operation failed:', err);
    }
  },

  // --- Active Account ---

  async getActiveAccountName(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.activeAccount);
    } catch {
      return null;
    }
  },

  async setActiveAccountName(username: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.activeAccount, username);
    } catch (err) {
      logger.warn('[Signet] Failed to save active account name:', err);
    }
  },

  // --- Password Check (for quick verification) ---

  async getPasswordCheck(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.passwordCheck);
    } catch {
      return null;
    }
  },

  async setPasswordCheck(check: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.passwordCheck, check);
    } catch (err) {
      logger.warn('[Signet] Failed to save password check:', err);
    }
  },

  // --- Navigation State ---

  async getNavState(): Promise<{ navStack: any[]; formDrafts: Record<string, any> } | null> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.navState);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  async setNavState(navStack: any[], formDrafts?: Record<string, any>): Promise<void> {
    try {
      const value = { navStack, formDrafts: formDrafts || {} };
      await AsyncStorage.setItem(STORAGE_KEYS.navState, JSON.stringify(value));
    } catch (err) {
      logger.warn('[Signet] Failed to save nav state:', err);
    }
  },

  async clearNavState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.navState);
    } catch (err) {
      logger.warn('[Signet] Failed to clear nav state:', err);
    }
  },

  // --- Form Drafts ---

  async getFormDraft(page: string): Promise<Record<string, any> | null> {
    try {
      const raw = await AsyncStorage.getItem(draftKey(page));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  async setFormDraft(page: string, data: Record<string, any>): Promise<void> {
    try {
      await AsyncStorage.setItem(draftKey(page), JSON.stringify(data));
    } catch (err) {
      logger.warn('[Signet] Failed to save form draft:', page, err);
    }
  },

  async clearFormDraft(page: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(draftKey(page));
    } catch (err) {
      logger.warn('[Signet] Failed to clear form draft:', page, err);
    }
  },

  // --- Full Clear ---

  async clearAll(): Promise<void> {
    try {
      // Clear secure store
      await SecureStore.deleteItemAsync(SECURE_SESSION_PASSWORD);
    } catch (err) {
      logger.warn('[Signet] Failed to clear SecureStore:', err);
    }

    try {
      // Clear all AsyncStorage keys individually
      const allKeys = Object.values(STORAGE_KEYS);
      for (const key of allKeys) {
        await AsyncStorage.removeItem(key);
      }

      // Clear contacts and notifications (stored outside STORAGE_KEYS)
      await AsyncStorage.removeItem('signet_contacts');
      await AsyncStorage.removeItem('signet_notifications');
      await AsyncStorage.removeItem('signet_login_lockout');

      // Also clear any draft keys
      const keys = await AsyncStorage.getAllKeys();
      const draftKeys = keys.filter((k) => k.startsWith('signet_draft_'));
      for (const key of draftKeys) {
        await AsyncStorage.removeItem(key);
      }
    } catch (err) {
      logger.warn('[Signet] Failed to clear AsyncStorage:', err);
    }
  },
};
