/**
 * Jest test setup for Signet Mobile.
 * Mocks native modules that don't exist in the test environment.
 */

// Mock react-native-quick-crypto
jest.mock('react-native-quick-crypto', () => ({
  install: jest.fn(),
}));

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn(() => Promise.resolve([])),
}));

// Mock expo-local-authentication
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(() => Promise.resolve(false)),
  isEnrolledAsync: jest.fn(() => Promise.resolve(false)),
  authenticateAsync: jest.fn(() => Promise.resolve({ success: false })),
  supportedAuthenticationTypesAsync: jest.fn(() => Promise.resolve([])),
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
}));

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  AESEncryptionKey: { generate: jest.fn(), import: jest.fn() },
  AESSealedData: { fromCombined: jest.fn() },
  aesEncryptAsync: jest.fn(),
  aesDecryptAsync: jest.fn(),
}));
