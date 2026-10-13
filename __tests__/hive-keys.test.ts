/**
 * Tests for Hive key utilities.
 * Uses real @hiveio/dhive key operations (they work in Node.js).
 */

import {
  validatePrivateKey,
  getPublicFromPrivate,
  identifyKeyRole,
  deriveKeysFromPassword,
  signBuffer,
  verifyBufferSignature,
  encodeMemo,
  decodeMemo,
  isEncryptedMemo,
} from '../src/core/crypto/hive-keys';

// Known test vectors - these are NOT real keys, just valid format keys for testing
// Generated from the dhive library
const TEST_SEED = 'testseed';
const TEST_USERNAME = 'testuser';
const TEST_PASSWORD = 'P5testpassword123';

describe('validatePrivateKey', () => {
  it('validates a key derived from seed', () => {
    // Derive a key we know is valid
    const keys = deriveKeysFromPassword(TEST_USERNAME, TEST_PASSWORD);
    expect(validatePrivateKey(keys[0].private)).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validatePrivateKey('')).toBe(false);
  });

  it('rejects random string', () => {
    expect(validatePrivateKey('not-a-key')).toBe(false);
  });

  it('rejects truncated key', () => {
    const keys = deriveKeysFromPassword(TEST_USERNAME, TEST_PASSWORD);
    const truncated = keys[0].private.substring(0, 30);
    expect(validatePrivateKey(truncated)).toBe(false);
  });

  it('handles whitespace trimming', () => {
    const keys = deriveKeysFromPassword(TEST_USERNAME, TEST_PASSWORD);
    expect(validatePrivateKey(`  ${keys[0].private}  `)).toBe(true);
  });
});

describe('getPublicFromPrivate', () => {
  it('returns a public key string', () => {
    const keys = deriveKeysFromPassword(TEST_USERNAME, TEST_PASSWORD);
    const pubKey = getPublicFromPrivate(keys[0].private);

    expect(pubKey).toMatch(/^STM/); // Hive public keys start with STM
    expect(pubKey.length).toBeGreaterThan(40);
  });

  it('is deterministic', () => {
    const keys = deriveKeysFromPassword(TEST_USERNAME, TEST_PASSWORD);
    const pub1 = getPublicFromPrivate(keys[0].private);
    const pub2 = getPublicFromPrivate(keys[0].private);
    expect(pub1).toBe(pub2);
  });

  it('different private keys produce different public keys', () => {
    const keys = deriveKeysFromPassword(TEST_USERNAME, TEST_PASSWORD);
    const pub0 = getPublicFromPrivate(keys[0].private);
    const pub1 = getPublicFromPrivate(keys[1].private);
    expect(pub0).not.toBe(pub1);
  });
});

describe('deriveKeysFromPassword', () => {
  it('derives 4 key pairs (owner, active, posting, memo)', () => {
    const keys = deriveKeysFromPassword(TEST_USERNAME, TEST_PASSWORD);

    expect(keys.length).toBe(4);
    expect(keys.map((k) => k.role)).toEqual(['owner', 'active', 'posting', 'memo']);
  });

  it('each key pair has private and public key', () => {
    const keys = deriveKeysFromPassword(TEST_USERNAME, TEST_PASSWORD);

    for (const key of keys) {
      expect(key.private).toBeTruthy();
      expect(key.public).toBeTruthy();
      expect(key.public).toMatch(/^STM/);
      expect(validatePrivateKey(key.private)).toBe(true);
    }
  });

  it('is deterministic - same inputs produce same keys', () => {
    const keys1 = deriveKeysFromPassword(TEST_USERNAME, TEST_PASSWORD);
    const keys2 = deriveKeysFromPassword(TEST_USERNAME, TEST_PASSWORD);

    for (let i = 0; i < 4; i++) {
      expect(keys1[i].private).toBe(keys2[i].private);
      expect(keys1[i].public).toBe(keys2[i].public);
    }
  });

  it('different usernames produce different keys', () => {
    const keys1 = deriveKeysFromPassword('alice', TEST_PASSWORD);
    const keys2 = deriveKeysFromPassword('bob', TEST_PASSWORD);

    for (let i = 0; i < 4; i++) {
      expect(keys1[i].private).not.toBe(keys2[i].private);
    }
  });

  it('different passwords produce different keys', () => {
    const keys1 = deriveKeysFromPassword(TEST_USERNAME, 'pass1');
    const keys2 = deriveKeysFromPassword(TEST_USERNAME, 'pass2');

    for (let i = 0; i < 4; i++) {
      expect(keys1[i].private).not.toBe(keys2[i].private);
    }
  });

  it('all 4 derived keys are different from each other', () => {
    const keys = deriveKeysFromPassword(TEST_USERNAME, TEST_PASSWORD);
    const privates = keys.map((k) => k.private);
    const unique = new Set(privates);
    expect(unique.size).toBe(4);
  });
});

describe('identifyKeyRole', () => {
  it('identifies a posting key', () => {
    const keys = deriveKeysFromPassword(TEST_USERNAME, TEST_PASSWORD);
    const postingKey = keys.find((k) => k.role === 'posting')!;

    const mockAccount = {
      posting: { key_auths: [[postingKey.public, 1]] },
      active: { key_auths: [] },
      owner: { key_auths: [] },
      memo_key: 'STMother',
    };

    expect(identifyKeyRole(postingKey.private, mockAccount)).toBe('posting');
  });

  it('identifies an active key', () => {
    const keys = deriveKeysFromPassword(TEST_USERNAME, TEST_PASSWORD);
    const activeKey = keys.find((k) => k.role === 'active')!;

    const mockAccount = {
      posting: { key_auths: [] },
      active: { key_auths: [[activeKey.public, 1]] },
      owner: { key_auths: [] },
      memo_key: 'STMother',
    };

    expect(identifyKeyRole(activeKey.private, mockAccount)).toBe('active');
  });

  it('identifies a memo key', () => {
    const keys = deriveKeysFromPassword(TEST_USERNAME, TEST_PASSWORD);
    const memoKey = keys.find((k) => k.role === 'memo')!;

    const mockAccount = {
      posting: { key_auths: [] },
      active: { key_auths: [] },
      owner: { key_auths: [] },
      memo_key: memoKey.public,
    };

    expect(identifyKeyRole(memoKey.private, mockAccount)).toBe('memo');
  });

  it('identifies an owner key', () => {
    const keys = deriveKeysFromPassword(TEST_USERNAME, TEST_PASSWORD);
    const ownerKey = keys.find((k) => k.role === 'owner')!;

    const mockAccount = {
      posting: { key_auths: [] },
      active: { key_auths: [] },
      owner: { key_auths: [[ownerKey.public, 1]] },
      memo_key: 'STMother',
    };

    expect(identifyKeyRole(ownerKey.private, mockAccount)).toBe('owner');
  });

  it('returns null when key does not match any role', () => {
    const keys = deriveKeysFromPassword(TEST_USERNAME, TEST_PASSWORD);

    const mockAccount = {
      posting: { key_auths: [['STMnomatch', 1]] },
      active: { key_auths: [['STMnomatch2', 1]] },
      owner: { key_auths: [['STMnomatch3', 1]] },
      memo_key: 'STMnomatch4',
    };

    expect(identifyKeyRole(keys[0].private, mockAccount)).toBeNull();
  });

  it('returns null for invalid key', () => {
    expect(identifyKeyRole('invalid', {})).toBeNull();
  });
});

describe('signBuffer', () => {
  const keys = deriveKeysFromPassword(TEST_USERNAME, TEST_PASSWORD);
  const posting = keys.find((k) => k.role === 'posting')!;

  it('produces a Keychain-compatible 130 character hex signature', () => {
    const sig = signBuffer('hello hive', posting.private);
    expect(sig).toMatch(/^[0-9a-f]{130}$/);
  });

  it('verifies against the matching public key', () => {
    const sig = signBuffer('login:alice:123', posting.private);
    expect(verifyBufferSignature('login:alice:123', sig, posting.public)).toBe(true);
  });

  it('rejects a different message or key', () => {
    const sig = signBuffer('message', posting.private);
    const active = keys.find((k) => k.role === 'active')!;
    expect(verifyBufferSignature('other', sig, posting.public)).toBe(false);
    expect(verifyBufferSignature('message', sig, active.public)).toBe(false);
    expect(verifyBufferSignature('message', 'nothex', posting.public)).toBe(false);
  });

  it('signs long messages (digest, not raw bytes)', () => {
    const sig = signBuffer('x'.repeat(5000), posting.private);
    expect(verifyBufferSignature('x'.repeat(5000), sig, posting.public)).toBe(true);
  });
});

describe('memo encryption', () => {
  const sender = deriveKeysFromPassword('alice', 'P5alicepassword').find((k) => k.role === 'memo')!;
  const recipient = deriveKeysFromPassword('bob', 'P5bobpassword').find((k) => k.role === 'memo')!;

  it('round-trips a message between sender and recipient', () => {
    const encoded = encodeMemo('secret payment note', sender.private, recipient.public);
    expect(encoded.startsWith('#')).toBe(true);
    expect(isEncryptedMemo(encoded)).toBe(true);
    expect(decodeMemo(encoded, recipient.private)).toBe('secret payment note');
    expect(decodeMemo(encoded, sender.private)).toBe('secret payment note');
  });

  it('leaves plain memos alone', () => {
    expect(decodeMemo('plain memo', recipient.private)).toBe('plain memo');
    expect(isEncryptedMemo('plain')).toBe(false);
    expect(isEncryptedMemo('#')).toBe(false);
    expect(isEncryptedMemo('')).toBe(false);
  });
});
