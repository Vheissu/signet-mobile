/**
 * Biometric Authentication for React Native
 *
 * Uses expo-local-authentication to enable Face ID / Touch ID
 * for unlocking the wallet. The flow:
 *
 * 1. ENROLLMENT: After a successful password unlock, encrypt the wallet
 *    password with a random AES-256-GCM key and store both in expo-secure-store.
 *
 * 2. UNLOCK: Trigger the biometric prompt via expo-local-authentication.
 *    On success, retrieve and decrypt the stored password.
 *
 * The password is encrypted at rest in the OS keychain via expo-secure-store,
 * and the biometric check gates access to it.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import {
  AESEncryptionKey,
  AESSealedData,
  aesEncryptAsync,
  aesDecryptAsync,
} from 'expo-crypto';
import { logger } from '../logger';

const BIOMETRIC_KEY_KEY = 'signet_biometric_key';
const BIOMETRIC_ENCRYPTED_PW_KEY = 'signet_biometric_encrypted_pw';
const BIOMETRIC_ENROLLED_KEY = 'signet_biometric_enrolled';

/**
 * Check if biometric hardware is available and enrolled on this device.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return isEnrolled;
  } catch {
    return false;
  }
}

/**
 * Get the supported biometric types on this device.
 * Returns human-readable strings like "Face ID", "Touch ID", "Fingerprint".
 */
export async function getBiometricType(): Promise<string> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'Face ID';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'Touch ID';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return 'Iris';
    }
    return 'Biometric';
  } catch {
    return 'Biometric';
  }
}

/**
 * Check if biometric unlock is enrolled in Signet.
 */
export async function isBiometricEnrolled(): Promise<boolean> {
  try {
    const enrolled = await SecureStore.getItemAsync(BIOMETRIC_ENROLLED_KEY);
    return enrolled === 'true';
  } catch {
    return false;
  }
}

/**
 * Enroll biometric authentication.
 * Call this after a successful password unlock.
 */
export async function enrollBiometric(password: string): Promise<boolean> {
  try {
    const available = await isBiometricAvailable();
    if (!available) return false;

    // Authenticate first to confirm the user's identity
    const authResult = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Enable biometric unlock',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });

    if (!authResult.success) return false;

    // Generate a random AES-256 key
    const key = await AESEncryptionKey.generate();
    const keyB64 = await key.encoded('base64');

    // Encrypt the password with native AES-256-GCM
    const encoder = new TextEncoder();
    const sealed = await aesEncryptAsync(encoder.encode(password), key);
    const sealedB64 = await sealed.combined('base64');

    // Store key and encrypted password in the OS keychain
    await SecureStore.setItemAsync(BIOMETRIC_KEY_KEY, keyB64);
    await SecureStore.setItemAsync(BIOMETRIC_ENCRYPTED_PW_KEY, sealedB64);
    await SecureStore.setItemAsync(BIOMETRIC_ENROLLED_KEY, 'true');

    return true;
  } catch (err) {
    logger.error('[Signet] Biometric enrollment failed:', err);
    return false;
  }
}

/**
 * Authenticate with biometrics and return the decrypted wallet password.
 * Returns null if authentication fails or biometric is not enrolled.
 */
export async function authenticateWithBiometric(): Promise<string | null> {
  try {
    const enrolled = await isBiometricEnrolled();
    if (!enrolled) return null;

    // Trigger the biometric prompt
    // disableDeviceFallback: true prevents PIN/passcode fallback, which would
    // bypass the wallet password with a weaker 4-6 digit code.
    const biometricType = await getBiometricType();
    const authResult = await LocalAuthentication.authenticateAsync({
      promptMessage: `Unlock Signet with ${biometricType}`,
      cancelLabel: 'Use Password',
      disableDeviceFallback: true,
    });

    if (!authResult.success) return null;

    // Retrieve key and encrypted password from keychain
    const keyB64 = await SecureStore.getItemAsync(BIOMETRIC_KEY_KEY);
    const sealedB64 = await SecureStore.getItemAsync(BIOMETRIC_ENCRYPTED_PW_KEY);

    if (!keyB64 || !sealedB64) return null;

    const key = await AESEncryptionKey.import(keyB64, 'base64');
    const sealed = AESSealedData.fromCombined(sealedB64);

    // Decrypt with native AES-256-GCM
    const decrypted = await aesDecryptAsync(sealed, key);
    // decrypted is Uint8Array by default
    const decoder = new TextDecoder();
    return decoder.decode(decrypted as Uint8Array);
  } catch (err) {
    logger.error('[Signet] Biometric authentication failed:', err);
    return null;
  }
}

/**
 * Remove biometric enrollment.
 */
export async function removeBiometric(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(BIOMETRIC_KEY_KEY);
    await SecureStore.deleteItemAsync(BIOMETRIC_ENCRYPTED_PW_KEY);
    await SecureStore.deleteItemAsync(BIOMETRIC_ENROLLED_KEY);
  } catch (err) {
    logger.warn('[Signet] Failed to remove biometric enrollment:', err);
  }
}
