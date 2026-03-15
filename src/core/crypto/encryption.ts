/**
 * Signet Mobile Encryption Module
 *
 * Uses react-native-quick-crypto for all cryptographic operations.
 * Native C++ JSI implementation — no JavaScript crypto libraries.
 *
 * - AES-256-GCM authenticated encryption (native C++)
 * - PBKDF2-HMAC-SHA256 with 600,000 iterations (native C++)
 * - Native random IV and salt generation
 */

import QuickCrypto from 'react-native-quick-crypto';
import { Buffer } from '@craftzdog/react-native-buffer';
import type { EncryptedPayload } from '../types';

const { pbkdf2: pbkdf2Async, createCipheriv, createDecipheriv, randomBytes } = QuickCrypto;

const PBKDF2_ITERATIONS = 600_000;
const KEY_BYTES = 32; // AES-256
const SALT_BYTES = 16;
const IV_BYTES = 12; // GCM standard

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveKey(
  password: string,
  salt: Buffer,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    pbkdf2Async(password, salt, PBKDF2_ITERATIONS, KEY_BYTES, 'sha256', (err, key) => {
      if (err || !key) reject(err || new Error('PBKDF2 returned empty key'));
      else resolve(Buffer.from(key));
    });
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encrypt a plaintext string with a password.
 */
export async function encrypt(
  plaintext: string,
  password: string,
): Promise<EncryptedPayload> {
  const salt = Buffer.from(randomBytes(SALT_BYTES));
  const iv = Buffer.from(randomBytes(IV_BYTES));
  const key = await deriveKey(password, salt);

  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const ctWithTag = Buffer.concat([encrypted, tag]);

  return {
    ct: ctWithTag.toString('base64'),
    iv: iv.toString('base64'),
    s: salt.toString('base64'),
  };
}

/**
 * Decrypt an encrypted payload with a password.
 * Throws if the password is incorrect, data is corrupted, or auth tag fails.
 */
export async function decrypt(
  payload: EncryptedPayload,
  password: string,
): Promise<string> {
  const salt = Buffer.from(payload.s, 'base64');
  const iv = Buffer.from(payload.iv, 'base64');
  const ctWithTag = Buffer.from(payload.ct, 'base64');

  // Last 16 bytes are the GCM auth tag
  const ct = ctWithTag.subarray(0, ctWithTag.length - 16);
  const tag = ctWithTag.subarray(ctWithTag.length - 16);

  const key = await deriveKey(password, salt);

  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(ct),
      decipher.final(),
    ]);
    const result = decrypted.toString('utf8');

    if (!result) {
      throw new Error('Empty result');
    }
    return result;
  } catch {
    throw new Error('Decryption failed: invalid password or corrupted data');
  }
}

/**
 * Encrypt a value and return as a JSON string.
 */
export async function encryptToString(
  value: any,
  password: string,
): Promise<string> {
  const json = JSON.stringify(value);
  const payload = await encrypt(json, password);
  return JSON.stringify(payload);
}

/**
 * Decrypt a JSON string payload and parse the result.
 */
export async function decryptFromString<T = any>(
  encrypted: string,
  password: string,
): Promise<T> {
  const payload: EncryptedPayload = JSON.parse(encrypted);
  const json = await decrypt(payload, password);
  return JSON.parse(json);
}

/**
 * Verify a password against encrypted data.
 */
export async function verifyPassword(
  encrypted: string,
  password: string,
): Promise<boolean> {
  try {
    await decryptFromString(encrypted, password);
    return true;
  } catch {
    return false;
  }
}
