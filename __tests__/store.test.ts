/**
 * Tests for the Zustand store.
 *
 * Covers: initialization, lock/unlock state transitions, account management,
 * settings updates, and toast actions.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// We need to mock the encryption module before importing the store
jest.mock('../src/core/crypto/encryption', () => ({
  encrypt: jest.fn(async (plaintext: string) => ({
    ct: Buffer.from(plaintext).toString('base64'),
    iv: 'mockiv',
    s: 'mocksalt',
  })),
  decrypt: jest.fn(async (payload: any) => {
    return Buffer.from(payload.ct, 'base64').toString('utf8');
  }),
  encryptToString: jest.fn(async (value: any) => JSON.stringify(value)),
  decryptFromString: jest.fn(async (encrypted: string) => JSON.parse(encrypted)),
  verifyPassword: jest.fn(async () => true),
}));

jest.mock('../src/core/hive/client', () => ({
  getAccount: jest.fn(async () => ({
    name: 'alice',
    balance: '100.000 HIVE',
    hbd_balance: '50.000 HBD',
    vesting_shares: '1000000.000000 VESTS',
    delegated_vesting_shares: '0.000000 VESTS',
    received_vesting_shares: '0.000000 VESTS',
    savings_balance: '0.000 HIVE',
    savings_hbd_balance: '0.000 HBD',
    reward_hive_balance: '0.000 HIVE',
    reward_hbd_balance: '0.000 HBD',
    reward_vesting_balance: '0.000000 VESTS',
    voting_manabar: { current_mana: 1000 },
  })),
  getDynamicGlobalProperties: jest.fn(async () => ({
    total_vesting_shares: '1000000000.000000 VESTS',
    total_vesting_fund_hive: '500000.000 HIVE',
  })),
  getResourceCredits: jest.fn(async () => ({
    rc_manabar: { current_mana: 5000 },
    max_rc: 10000,
  })),
}));

jest.mock('../src/core/constants', () => ({
  coingeckoFetch: jest.fn(async () => ({
    json: async () => ({
      hive: { usd: 0.35, usd_24h_change: 2.5 },
      hive_dollar: { usd: 1.0 },
    }),
  })),
  setCoingeckoApiKey: jest.fn(),
}));

jest.mock('../src/components/ui/Toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

import { useStore } from '../src/store';

// Helper to reset store between tests
function resetStore() {
  useStore.setState({
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
    settings: {
      autoLockMinutes: 10,
      rpcNodes: ['https://api.hive.blog'],
      activeRpc: 'https://api.hive.blog',
      theme: 'dark' as const,
      currency: 'USD',
      showTestnets: false,
      biometricEnabled: false,
      coingeckoApiKey: '',
    },
    toasts: [],
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  resetStore();
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
  (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
  (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
});

describe('Store initialization', () => {
  it('starts in locked state', () => {
    const state = useStore.getState();
    expect(state.isLocked).toBe(true);
    expect(state.isInitialized).toBe(false);
    expect(state.password).toBeNull();
    expect(state.accounts).toEqual([]);
  });

  it('initializes as new wallet when no accounts exist', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    await useStore.getState().initialize();
    const state = useStore.getState();

    expect(state.isInitialized).toBe(false);
    expect(state.isLocked).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it('initializes as locked when wallet exists but no session', async () => {
    // Wallet exists (encrypted accounts blob) but no session password
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'signet_encrypted_accounts') return JSON.stringify([]);
      return null;
    });

    await useStore.getState().initialize();
    const state = useStore.getState();

    expect(state.isInitialized).toBe(true);
    expect(state.isLocked).toBe(true);
  });
});

describe('Store createWallet', () => {
  it('creates a wallet and transitions to unlocked', async () => {
    await useStore.getState().createWallet('testpassword123');
    const state = useStore.getState();

    expect(state.isInitialized).toBe(true);
    expect(state.isLocked).toBe(false);
    expect(state.password).toBe('testpassword123');
    expect(state.accounts).toEqual([]);
  });

  it('persists the encrypted accounts blob', async () => {
    await useStore.getState().createWallet('testpassword123');

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'signet_encrypted_accounts',
      expect.any(String),
    );
  });

  it('stores session password in SecureStore', async () => {
    await useStore.getState().createWallet('testpassword123');

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'signet_session_password',
      'testpassword123',
    );
  });
});

describe('Store lock', () => {
  it('clears sensitive state on lock', async () => {
    // Setup unlocked state
    await useStore.getState().createWallet('testpassword123');
    useStore.setState({ accounts: [{ username: 'alice', keys: {} }] });

    useStore.getState().lock();
    const state = useStore.getState();

    expect(state.isLocked).toBe(true);
    expect(state.password).toBeNull();
    expect(state.accounts).toEqual([]);
    expect(state.activeAccountData).toBeNull();
    expect(state.resources).toBeNull();
    expect(state.globalProperties).toBeNull();
    expect(state.hivePriceUsd).toBe(0);
    expect(state.hbdPriceUsd).toBe(0);
  });

  it('deletes session password from SecureStore', async () => {
    await useStore.getState().createWallet('testpassword123');
    useStore.getState().lock();

    // Wait for async cleanup
    await new Promise((r) => setTimeout(r, 50));

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('signet_session_password');
  });
});

describe('Store addAccount', () => {
  it('adds an account and sets it as active', async () => {
    await useStore.getState().createWallet('testpassword123');

    await useStore.getState().addAccount({
      username: 'alice',
      keys: { posting: 'wif123' },
    });

    const state = useStore.getState();
    expect(state.accounts.length).toBe(1);
    expect(state.accounts[0].username).toBe('alice');
    expect(state.activeAccountName).toBe('alice');
  });

  it('encrypts keys before storing', async () => {
    const { encrypt } = require('../src/core/crypto/encryption');

    await useStore.getState().createWallet('testpassword123');
    await useStore.getState().addAccount({
      username: 'alice',
      keys: { posting: 'wif123', active: 'wif456' },
    });

    expect(encrypt).toHaveBeenCalledWith('wif123', 'testpassword123');
    expect(encrypt).toHaveBeenCalledWith('wif456', 'testpassword123');
  });

  it('replaces existing account with same username', async () => {
    await useStore.getState().createWallet('testpassword123');

    await useStore.getState().addAccount({
      username: 'alice',
      keys: { posting: 'wif1' },
    });
    await useStore.getState().addAccount({
      username: 'alice',
      keys: { posting: 'wif2', active: 'wif3' },
    });

    const state = useStore.getState();
    expect(state.accounts.length).toBe(1);
  });
});

describe('Store removeAccount', () => {
  it('removes an account', async () => {
    await useStore.getState().createWallet('testpassword123');
    await useStore.getState().addAccount({ username: 'alice', keys: {} });
    await useStore.getState().addAccount({ username: 'bob', keys: {} });

    await useStore.getState().removeAccount('alice');

    const state = useStore.getState();
    expect(state.accounts.length).toBe(1);
    expect(state.accounts[0].username).toBe('bob');
  });

  it('switches active account when active is removed', async () => {
    await useStore.getState().createWallet('testpassword123');
    await useStore.getState().addAccount({ username: 'alice', keys: {} });
    await useStore.getState().addAccount({ username: 'bob', keys: {} });

    useStore.setState({ activeAccountName: 'alice' });
    await useStore.getState().removeAccount('alice');

    expect(useStore.getState().activeAccountName).toBe('bob');
  });
});

describe('Store updateSettings', () => {
  it('merges partial settings', async () => {
    await useStore.getState().updateSettings({ autoLockMinutes: 5 });
    expect(useStore.getState().settings.autoLockMinutes).toBe(5);
    // Other settings unchanged
    expect(useStore.getState().settings.theme).toBe('dark');
  });

  it('persists settings to storage', async () => {
    await useStore.getState().updateSettings({ autoLockMinutes: 5 });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'signet_settings',
      expect.stringContaining('"autoLockMinutes":5'),
    );
  });
});

describe('Store refreshPrices', () => {
  it('fetches and stores prices', async () => {
    await useStore.getState().refreshPrices();

    const state = useStore.getState();
    expect(state.hivePriceUsd).toBe(0.35);
    expect(state.hbdPriceUsd).toBe(1.0);
    expect(state.priceChange24h).toBe(2.5);
  });
});
