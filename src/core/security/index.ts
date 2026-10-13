/**
 * Security Utilities
 *
 * - Jailbreak/root detection with user warning
 * - Screen capture prevention for sensitive screens
 */

import { Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ScreenCapture from 'expo-screen-capture';
import { logger } from '../logger';

// ---------------------------------------------------------------------------
// Jailbreak / Root Detection
// ---------------------------------------------------------------------------

// Common paths that indicate a jailbroken iOS device
const IOS_JAILBREAK_PATHS = [
  '/Applications/Cydia.app',
  '/Library/MobileSubstrate/MobileSubstrate.dylib',
  '/bin/bash',
  '/usr/sbin/sshd',
  '/etc/apt',
  '/private/var/lib/apt/',
  '/usr/bin/ssh',
];

// Common paths that indicate a rooted Android device
const ANDROID_ROOT_PATHS = [
  '/system/app/Superuser.apk',
  '/system/xbin/su',
  '/system/bin/su',
  '/sbin/su',
  '/data/local/xbin/su',
  '/data/local/bin/su',
  '/data/local/su',
  '/su/bin/su',
];

async function checkPathExists(path: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(path);
    return info.exists;
  } catch {
    return false;
  }
}

/**
 * Check if the device appears to be jailbroken (iOS) or rooted (Android).
 * Returns true if compromise indicators are detected.
 */
export async function isDeviceCompromised(): Promise<boolean> {
  try {
    const paths =
      Platform.OS === 'ios' ? IOS_JAILBREAK_PATHS : ANDROID_ROOT_PATHS;

    for (const path of paths) {
      if (await checkPathExists(path)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Check for device compromise and show a warning alert if detected.
 * Call once on app startup.
 */
export async function checkDeviceSecurity(): Promise<void> {
  try {
    const compromised = await isDeviceCompromised();
    if (compromised) {
      const deviceType =
        Platform.OS === 'ios' ? 'jailbroken' : 'rooted';
      logger.warn(`[Signet] Device appears to be ${deviceType}`);

      Alert.alert(
        'Security Warning',
        `This device appears to be ${deviceType}. ` +
          'Your private keys and encrypted data may be at risk. ' +
          'For maximum security, use Signet on a non-modified device.',
        [{ text: 'I Understand the Risks' }],
      );
    }
  } catch (err) {
    logger.warn('[Signet] Device security check failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Screen Capture Prevention
// ---------------------------------------------------------------------------

/**
 * Prevent screenshots and screen recording.
 * On iOS: prevents screen capture and hides content in app switcher.
 * On Android: sets FLAG_SECURE on the window.
 */
export async function enableScreenProtection(): Promise<void> {
  try {
    await ScreenCapture.preventScreenCaptureAsync('signet_protection');
  } catch (err) {
    logger.warn('[Signet] Failed to enable screen protection:', err);
  }
}

/**
 * Re-allow screenshots and screen recording (e.g. when wallet is locked).
 */
export async function disableScreenProtection(): Promise<void> {
  try {
    await ScreenCapture.allowScreenCaptureAsync('signet_protection');
  } catch (err) {
    logger.warn('[Signet] Failed to disable screen protection:', err);
  }
}
