/**
 * Signet Mobile Zustand Store
 *
 * Central state management ported from the browser extension.
 * Uses mobile secure-storage instead of browser extension storage.
 */

import { create } from 'zustand';
import { encrypt, decrypt, encryptToString, decryptFromString } from '../core/crypto/encryption';
import {
  getSecureItem,
  setSecureItem,
  removeSecureItem,
  secureStorage,
  STORE_KEYS as STORAGE_KEYS,
} from '../core/storage/secure-storage';
import { getAccount, getDynamicGlobalProperties, getResourceCredits } from '../core/hive/client';
import { logger } from '../core/logger';
import { toast as toastUI } from '../components/ui/Toast';
import { coingeckoFetch, setCoingeckoApiKey } from '../core/constants';
import type {
  StoredAccount,
  Settings,
  Page,
  AccountResources,
  EncryptedPayload,
} from '../core/types';
import { DEFAULT_SETTINGS as defaultSettings } from '../core/types';

// -------------------------------------------------------------------
// Toast
// -------------------------------------------------------------------
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

// -------------------------------------------------------------------
// App State
// -------------------------------------------------------------------
export interface AppState {
  // Navigation (kept for compatibility; real nav via React Navigation)
  currentPage: Page;

  // Auth
  isInitialized: boolean;
  isLocked: boolean;
  password: string | null;
  isLoading: boolean;
  loadingMessage: string;

  // Accounts
  accounts: StoredAccount[];
  activeAccountName: string | null;
  activeAccountData: any | null; // raw Hive account object from dhive
  resources: AccountResources | null;

  // Blockchain
  globalProperties: any | null;
  hivePriceUsd: number;
  hbdPriceUsd: number;
  priceChange24h: number;

  // Settings
  settings: Settings;

  // UI
  toasts: Toast[];

  // ---------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------
  initialize: () => Promise<void>;
  createWallet: (password: string) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  lock: () => void;
  resetWallet: () => Promise<void>;

  addAccount: (account: StoredAccount) => Promise<void>;
  updateAccountKeys: (
    username: string,
    newKeys: Partial<StoredAccount['keys']>,
  ) => Promise<void>;
  removeAccount: (username: string) => Promise<void>;
  setActiveAccount: (username: string) => Promise<void>;

  refreshAccountData: () => Promise<void>;
  refreshPrices: () => Promise<void>;

  updateSettings: (partial: Partial<Settings>) => Promise<void>;

  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  setLoading: (loading: boolean, message?: string) => void;
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------
let toastCounter = 0;

function generateToastId(): string {
  toastCounter += 1;
  return `toast_${Date.now()}_${toastCounter}`;
}

/**
 * Encrypt the accounts array and persist it to secure storage.
 */
async function persistAccounts(
  accounts: StoredAccount[],
  password: string,
): Promise<void> {
  const encrypted = await encryptToString(accounts, password);
  await setSecureItem(STORAGE_KEYS.ACCOUNTS, encrypted);
}

// -------------------------------------------------------------------
// Store
// -------------------------------------------------------------------
export const useStore = create<AppState>((set, get) => ({
  // Initial state
  currentPage: 'welcome',
  isInitialized: false,
  isLocked: true,
  password: null,
  isLoading: false,
  loadingMessage: '',
  accounts: [],
  activeAccountName: null,
  activeAccountData: null,
  resources: null,
  globalProperties: null,
  hivePriceUsd: 0,
  hbdPriceUsd: 0,
  priceChange24h: 0,
  settings: { ...defaultSettings },
  toasts: [],

  // -----------------------------------------------------------------
  // initialize
  // -----------------------------------------------------------------
  initialize: async () => {
    try {
      set({ isLoading: true, loadingMessage: 'Initializing...' });

      // Load persisted settings
      const savedSettings = await getSecureItem(STORAGE_KEYS.SETTINGS);
      if (savedSettings) {
        try {
          const parsed: Settings = JSON.parse(savedSettings);
          const merged = { ...defaultSettings, ...parsed };
          set({ settings: merged });
          setCoingeckoApiKey(merged.coingeckoApiKey || null);
        } catch {
          // corrupted settings, use defaults
        }
      }

      // Check if a wallet has been created (encrypted accounts blob exists)
      const encryptedAccounts = await getSecureItem(STORAGE_KEYS.ACCOUNTS);
      const walletExists = !!encryptedAccounts;

      if (!walletExists) {
        set({
          isInitialized: false,
          isLocked: true,
          currentPage: 'welcome',
          isLoading: false,
          loadingMessage: '',
        });
        return;
      }

      // Wallet exists -- check for a cached session password
      const sessionPassword = await getSecureItem(STORAGE_KEYS.SESSION);
      if (sessionPassword) {
        try {
          const accounts = await decryptFromString<StoredAccount[]>(
            encryptedAccounts,
            sessionPassword,
          );
          const activeAccountName = await getSecureItem(
            STORAGE_KEYS.ACTIVE_ACCOUNT,
          );

          set({
            isInitialized: true,
            isLocked: false,
            password: sessionPassword,
            accounts,
            activeAccountName: activeAccountName || (accounts[0]?.username ?? null),
            currentPage: 'dashboard',
          });

          // Fire-and-forget data refresh
          const { refreshAccountData, refreshPrices } = get();
          refreshAccountData().catch((e) => logger.warn('[store] background task failed:', e));
          refreshPrices().catch((e) => logger.warn('[store] background task failed:', e));
        } catch {
          // Session password invalid / expired
          set({
            isInitialized: true,
            isLocked: true,
            currentPage: 'login',
          });
        }
      } else {
        set({
          isInitialized: true,
          isLocked: true,
          currentPage: 'login',
        });
      }
    } catch (error) {
      logger.error('[store] initialize error:', error);
      set({ isInitialized: false, isLocked: true, currentPage: 'welcome' });
    } finally {
      set({ isLoading: false, loadingMessage: '' });
    }
  },

  // -----------------------------------------------------------------
  // createWallet
  // -----------------------------------------------------------------
  createWallet: async (password: string) => {
    set({ isLoading: true, loadingMessage: 'Creating wallet...' });
    try {
      const accounts: StoredAccount[] = [];
      const encrypted = await encryptToString(accounts, password);
      await setSecureItem(STORAGE_KEYS.ACCOUNTS, encrypted);
      await setSecureItem(STORAGE_KEYS.SESSION, password);

      set({
        isInitialized: true,
        isLocked: false,
        password,
        accounts,
        currentPage: 'addAccount',
      });
    } catch (error) {
      logger.error('[store] createWallet error:', error);
      get().addToast({ type: 'error', message: 'Failed to create wallet.' });
      throw error;
    } finally {
      set({ isLoading: false, loadingMessage: '' });
    }
  },

  // -----------------------------------------------------------------
  // unlock
  // -----------------------------------------------------------------
  unlock: async (password: string) => {
    set({ isLoading: true, loadingMessage: 'Unlocking...' });
    try {
      const encryptedAccounts = await getSecureItem(STORAGE_KEYS.ACCOUNTS);
      if (!encryptedAccounts) {
        throw new Error('No wallet found');
      }

      const accounts = await decryptFromString<StoredAccount[]>(
        encryptedAccounts,
        password,
      );

      await setSecureItem(STORAGE_KEYS.SESSION, password);

      const activeAccountName = await getSecureItem(
        STORAGE_KEYS.ACTIVE_ACCOUNT,
      );

      set({
        isLocked: false,
        password,
        accounts,
        activeAccountName: activeAccountName || (accounts[0]?.username ?? null),
        currentPage: 'dashboard',
      });

      // Fire-and-forget data refresh
      const { refreshAccountData, refreshPrices } = get();
      refreshAccountData().catch((e) => logger.warn('[store] background task failed:', e));
      refreshPrices().catch((e) => logger.warn('[store] background task failed:', e));
    } catch (error) {
      logger.error('[store] unlock error:', error);
      get().addToast({
        type: 'error',
        message: 'Invalid password. Please try again.',
      });
      throw error;
    } finally {
      set({ isLoading: false, loadingMessage: '' });
    }
  },

  // -----------------------------------------------------------------
  // lock
  // -----------------------------------------------------------------
  lock: () => {
    // Clear session and form drafts in the background
    Promise.all([
      removeSecureItem(STORAGE_KEYS.SESSION),
      secureStorage.clearFormDraft('send'),
      secureStorage.clearNavState(),
    ]).catch((e) => logger.warn('[store] lock cleanup failed:', e));

    set({
      isLocked: true,
      password: null,
      accounts: [],
      activeAccountData: null,
      resources: null,
      globalProperties: null,
      hivePriceUsd: 0,
      hbdPriceUsd: 0,
      priceChange24h: 0,
      currentPage: 'login',
    });
  },

  // -----------------------------------------------------------------
  // resetWallet - clear ALL data and return to welcome screen
  // -----------------------------------------------------------------
  resetWallet: async () => {
    try {
      await removeSecureItem(STORAGE_KEYS.SESSION);
      await removeSecureItem(STORAGE_KEYS.ACCOUNTS);
      await removeSecureItem(STORAGE_KEYS.ACTIVE_ACCOUNT);
      await removeSecureItem(STORAGE_KEYS.SETTINGS);
    } catch (e) {
      logger.warn('[store] resetWallet cleanup error:', e);
    }
    set({
      isInitialized: false,
      isLocked: true,
      password: null,
      accounts: [],
      activeAccountName: null,
      activeAccountData: null,
      resources: null,
      globalProperties: null,
      currentPage: 'welcome',
      isLoading: false,
      loadingMessage: '',
    });
  },

  // -----------------------------------------------------------------
  // addAccount
  // -----------------------------------------------------------------
  addAccount: async (account: StoredAccount) => {
    const { accounts, password } = get();
    if (!password) throw new Error('Wallet is locked');

    // Encrypt each key individually before storing
    const encryptedKeys: StoredAccount['keys'] = {};
    for (const [role, wif] of Object.entries(account.keys)) {
      if (wif) {
        const payload = await encrypt(wif, password);
        encryptedKeys[role as keyof StoredAccount['keys']] =
          JSON.stringify(payload);
      }
    }

    const newAccount: StoredAccount = {
      username: account.username,
      keys: encryptedKeys,
    };

    // Replace if same username already exists, otherwise push
    const idx = accounts.findIndex(
      (a) => a.username === account.username,
    );
    const updated =
      idx >= 0
        ? accounts.map((a, i) => (i === idx ? newAccount : a))
        : [...accounts, newAccount];

    await persistAccounts(updated, password);
    await setSecureItem(STORAGE_KEYS.ACTIVE_ACCOUNT, account.username);

    set({
      accounts: updated,
      activeAccountName: account.username,
      currentPage: 'dashboard',
    });

    // Fetch data for the new active account
    get().refreshAccountData().catch((e) => logger.warn('[store] background task failed:', e));
  },

  // -----------------------------------------------------------------
  // updateAccountKeys
  // -----------------------------------------------------------------
  updateAccountKeys: async (
    username: string,
    newKeys: Partial<StoredAccount['keys']>,
  ) => {
    const { accounts, password } = get();
    if (!password) throw new Error('Wallet is locked');

    const encryptedNewKeys: Partial<StoredAccount['keys']> = {};
    for (const [role, wif] of Object.entries(newKeys)) {
      if (wif) {
        const payload = await encrypt(wif, password);
        encryptedNewKeys[role as keyof StoredAccount['keys']] =
          JSON.stringify(payload);
      }
    }

    const updated = accounts.map((a) => {
      if (a.username !== username) return a;
      return {
        ...a,
        keys: { ...a.keys, ...encryptedNewKeys },
      };
    });

    await persistAccounts(updated, password);
    set({ accounts: updated });
  },

  // -----------------------------------------------------------------
  // removeAccount
  // -----------------------------------------------------------------
  removeAccount: async (username: string) => {
    const { accounts, password, activeAccountName } = get();
    if (!password) throw new Error('Wallet is locked');

    const updated = accounts.filter((a) => a.username !== username);
    await persistAccounts(updated, password);

    const newActive =
      activeAccountName === username
        ? updated[0]?.username ?? null
        : activeAccountName;

    if (newActive) {
      await setSecureItem(STORAGE_KEYS.ACTIVE_ACCOUNT, newActive);
    }

    set({
      accounts: updated,
      activeAccountName: newActive,
      activeAccountData: activeAccountName === username ? null : get().activeAccountData,
      resources: activeAccountName === username ? null : get().resources,
    });

    if (newActive && activeAccountName === username) {
      get().refreshAccountData().catch((e) => logger.warn('[store] background task failed:', e));
    }
  },

  // -----------------------------------------------------------------
  // setActiveAccount
  // -----------------------------------------------------------------
  setActiveAccount: async (username: string) => {
    await setSecureItem(STORAGE_KEYS.ACTIVE_ACCOUNT, username);
    set({
      activeAccountName: username,
      activeAccountData: null,
      resources: null,
    });
    get().refreshAccountData().catch((e) => logger.warn('[store] background task failed:', e));
  },

  // -----------------------------------------------------------------
  // refreshAccountData
  // -----------------------------------------------------------------
  refreshAccountData: async () => {
    const { activeAccountName, settings } = get();
    if (!activeAccountName) return;

    try {
      const [accountData, globalProps, rcData] = await Promise.all([
        getAccount(activeAccountName),
        getDynamicGlobalProperties(),
        getResourceCredits(activeAccountName),
      ]);

      if (!accountData) {
        logger.warn(
          '[store] Account not found on chain:',
          activeAccountName,
        );
        return;
      }

      // Calculate resources
      const totalVestingShares = parseFloat(
        String(globalProps.total_vesting_shares).split(' ')[0] || '0',
      );
      const totalVestingFund = parseFloat(
        String(globalProps.total_vesting_fund_hive).split(' ')[0] || '0',
      );

      const votingMana =
        accountData.voting_manabar?.current_mana
          ? Number(accountData.voting_manabar.current_mana)
          : 0;
      const votingManaMax =
        (accountData as any).post_voting_power?.amount
          ? Number((accountData as any).post_voting_power.amount)
          : Number(String(accountData.vesting_shares).split(' ')[0] || '0') * 1e6;

      const rcMana = rcData?.rc_manabar?.current_mana
        ? Number(rcData.rc_manabar.current_mana)
        : 0;
      const rcManaMax = rcData?.max_rc
        ? Number(rcData.max_rc)
        : 0;

      const resources: AccountResources = {
        votingPower: votingManaMax > 0 ? (votingMana / votingManaMax) * 100 : 0,
        votingMana,
        votingManaMax,
        resourceCredits: rcManaMax > 0 ? (rcMana / rcManaMax) * 100 : 0,
        rcMana,
        rcManaMax,
      };

      set({
        activeAccountData: accountData,
        globalProperties: globalProps,
        resources,
      });
    } catch (error) {
      logger.error('[store] refreshAccountData error:', error);
    }
  },

  // -----------------------------------------------------------------
  // refreshPrices
  // -----------------------------------------------------------------
  refreshPrices: async () => {
    try {
      const response = await coingeckoFetch(
        '/simple/price?ids=hive,hive_dollar&vs_currencies=usd&include_24hr_change=true',
      );
      const data = await response.json();

      set({
        hivePriceUsd: data?.hive?.usd ?? 0,
        hbdPriceUsd: data?.hive_dollar?.usd ?? 1,
        priceChange24h: data?.hive?.usd_24h_change ?? 0,
      });
    } catch (error) {
      logger.error('[store] refreshPrices error:', error);
    }
  },

  // -----------------------------------------------------------------
  // updateSettings
  // -----------------------------------------------------------------
  updateSettings: async (partial: Partial<Settings>) => {
    const current = get().settings;
    const updated = { ...current, ...partial };
    set({ settings: updated });
    if ('coingeckoApiKey' in partial) {
      setCoingeckoApiKey(updated.coingeckoApiKey || null);
    }
    await setSecureItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
  },

  // -----------------------------------------------------------------
  // Toasts
  // -----------------------------------------------------------------
  addToast: (t: Omit<Toast, 'id'>) => {
    // Forward to the actual Toast UI component
    if (t.type === 'success') toastUI.success(t.message, undefined, t.duration);
    else if (t.type === 'error') toastUI.error(t.message, undefined, t.duration);
    else toastUI.info(t.message, undefined, t.duration);
  },

  removeToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  // -----------------------------------------------------------------
  // Loading
  // -----------------------------------------------------------------
  setLoading: (loading: boolean, message?: string) => {
    set({ isLoading: loading, loadingMessage: message || '' });
  },
}));

export default useStore;
