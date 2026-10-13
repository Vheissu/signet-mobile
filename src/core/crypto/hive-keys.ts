/**
 * Hive Key Utilities
 *
 * Functions for validating, deriving, and managing Hive blockchain keys.
 * Uses @hiveio/dhive which works in React Native.
 */

import { PrivateKey, PublicKey, Signature, Memo, cryptoUtils } from '@hiveio/dhive';

export type KeyRole = 'posting' | 'active' | 'memo' | 'owner';

export interface KeyPair {
  private: string;
  public: string;
  role: KeyRole;
}

/**
 * Validate that a string is a valid Hive private key (WIF format).
 */
export function validatePrivateKey(wif: string): boolean {
  try {
    PrivateKey.fromString(wif.trim());
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the public key corresponding to a private key.
 */
export function getPublicFromPrivate(wif: string): string {
  return PrivateKey.fromString(wif.trim()).createPublic().toString();
}

/**
 * Identify what role a private key has for a given account.
 * Returns null if the key doesn't match any role.
 */
export function identifyKeyRole(wif: string, account: any): KeyRole | null {
  try {
    const publicKey = getPublicFromPrivate(wif);

    if (account.posting?.key_auths?.some(([k]: [string, number]) => k === publicKey)) {
      return 'posting';
    }
    if (account.active?.key_auths?.some(([k]: [string, number]) => k === publicKey)) {
      return 'active';
    }
    if (account.memo_key === publicKey) {
      return 'memo';
    }
    if (account.owner?.key_auths?.some(([k]: [string, number]) => k === publicKey)) {
      return 'owner';
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Derive all key roles from a master password and username.
 * Hive uses a deterministic key derivation: username + role + password
 */
export function deriveKeysFromPassword(username: string, password: string): KeyPair[] {
  const roles: KeyRole[] = ['owner', 'active', 'posting', 'memo'];

  return roles.map((role) => {
    const seed = username + role + password;
    const privateKey = PrivateKey.fromSeed(seed);
    return {
      private: privateKey.toString(),
      public: privateKey.createPublic().toString(),
      role,
    };
  });
}

/**
 * Sign an arbitrary message with a private key.
 *
 * dhive signs a 32-byte digest, so the message is hashed with SHA-256
 * first. The result is the 130-character hex signature Hive Keychain
 * produces for requestSignBuffer, so verifiers written for Keychain work.
 */
export function signBuffer(message: string | Uint8Array, wif: string): string {
  const key = PrivateKey.fromString(wif.trim());
  const bytes = typeof message === 'string' ? Buffer.from(message, 'utf8') : Buffer.from(message);
  const digest = cryptoUtils.sha256(bytes);
  return key.sign(digest).toString();
}

/**
 * Verify a signature produced by signBuffer against a public key.
 */
export function verifyBufferSignature(message: string, signatureHex: string, publicKey: string): boolean {
  try {
    const digest = cryptoUtils.sha256(Buffer.from(message, 'utf8'));
    const signature = Signature.fromString(signatureHex);
    return PublicKey.fromString(publicKey).verify(digest, signature);
  } catch {
    return false;
  }
}

/**
 * Encrypt a memo for a recipient. The result starts with '#' and can only
 * be read by the holder of the recipient's private key (or the sender's).
 */
export function encodeMemo(message: string, senderWif: string, recipientPublicKey: string): string {
  const body = message.startsWith('#') ? message : `#${message}`;
  return Memo.encode(PrivateKey.fromString(senderWif), PublicKey.fromString(recipientPublicKey), body);
}

/**
 * Decrypt an encrypted memo ('#...') with a private key.
 * Returns the plaintext without the leading '#'.
 */
export function decodeMemo(memo: string, wif: string): string {
  if (!memo.startsWith('#')) return memo;
  const decoded = Memo.decode(PrivateKey.fromString(wif), memo);
  return decoded.startsWith('#') ? decoded.slice(1) : decoded;
}

/**
 * True when a memo is encrypted and needs a memo key to read.
 */
export function isEncryptedMemo(memo: string | undefined | null): boolean {
  return !!memo && memo.startsWith('#') && memo.length > 1;
}
