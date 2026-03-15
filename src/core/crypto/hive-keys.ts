/**
 * Hive Key Utilities
 *
 * Functions for validating, deriving, and managing Hive blockchain keys.
 * Uses @hiveio/dhive which works in React Native.
 */

import { PrivateKey } from '@hiveio/dhive';

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
 * Sign a message buffer with a private key.
 */
export function signBuffer(message: string, wif: string): string {
  const key = PrivateKey.fromString(wif);
  const encoder = new TextEncoder();
  const signature = key.sign(Buffer.from(encoder.encode(message)));
  return signature.toString();
}
