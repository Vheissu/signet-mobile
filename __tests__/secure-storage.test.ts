/**
 * Tests for the secure storage routing logic.
 *
 * Verifies that session passwords route through SecureStore (OS keychain)
 * while other data routes through AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  getSecureItem,
  setSecureItem,
  removeSecureItem,
  STORE_KEYS,
} from '../src/core/storage/secure-storage';

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
  (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
  (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
});

describe('getSecureItem', () => {
  it('routes session password through SecureStore', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('mysecret');

    const result = await getSecureItem(STORE_KEYS.SESSION);

    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('signet_session_password');
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    expect(result).toBe('mysecret');
  });

  it('routes non-session keys through AsyncStorage', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('data');

    const result = await getSecureItem(STORE_KEYS.ACCOUNTS);

    expect(AsyncStorage.getItem).toHaveBeenCalledWith('signet_encrypted_accounts');
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
    expect(result).toBe('data');
  });

  it('routes settings through AsyncStorage', async () => {
    await getSecureItem(STORE_KEYS.SETTINGS);
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('signet_settings');
  });

  it('returns null on error', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('fail'));

    const result = await getSecureItem(STORE_KEYS.ACCOUNTS);
    expect(result).toBeNull();
  });
});

describe('setSecureItem', () => {
  it('routes session password through SecureStore', async () => {
    await setSecureItem(STORE_KEYS.SESSION, 'newsecret');

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'signet_session_password',
      'newsecret',
    );
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('routes non-session keys through AsyncStorage', async () => {
    await setSecureItem(STORE_KEYS.ACCOUNTS, 'encrypted_blob');

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'signet_encrypted_accounts',
      'encrypted_blob',
    );
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('does not throw on error', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('fail'));

    // Should not throw
    await expect(
      setSecureItem(STORE_KEYS.ACCOUNTS, 'data'),
    ).resolves.toBeUndefined();
  });
});

describe('removeSecureItem', () => {
  it('routes session removal through SecureStore', async () => {
    await removeSecureItem(STORE_KEYS.SESSION);

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('signet_session_password');
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it('routes non-session removal through AsyncStorage', async () => {
    await removeSecureItem(STORE_KEYS.ACCOUNTS);

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('signet_encrypted_accounts');
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });
});

describe('STORE_KEYS', () => {
  it('has the correct key constants', () => {
    expect(STORE_KEYS.SESSION).toBe('signet_session_password');
    expect(STORE_KEYS.ACCOUNTS).toBe('signet_encrypted_accounts');
    expect(STORE_KEYS.ACTIVE_ACCOUNT).toBe('signet_active_account');
    expect(STORE_KEYS.SETTINGS).toBe('signet_settings');
  });
});
