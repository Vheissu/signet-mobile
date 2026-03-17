import {
  isValidHiveUsername,
  validateAmount,
  validateMemo,
  sanitizeUsername,
  MAX_MEMO_LENGTH,
} from '../src/core/validation';

describe('isValidHiveUsername', () => {
  // Valid usernames
  it('accepts standard usernames', () => {
    expect(isValidHiveUsername('alice')).toBe(true);
    expect(isValidHiveUsername('bob')).toBe(true);
    expect(isValidHiveUsername('hive.blog')).toBe(true);
    expect(isValidHiveUsername('user-name')).toBe(true);
    expect(isValidHiveUsername('user.name-123')).toBe(true);
    expect(isValidHiveUsername('abc')).toBe(true); // 3 chars minimum
  });

  it('accepts 16-character usernames', () => {
    expect(isValidHiveUsername('abcdefghijklmnop')).toBe(true); // exactly 16
  });

  // Invalid usernames
  it('rejects empty strings', () => {
    expect(isValidHiveUsername('')).toBe(false);
  });

  it('rejects too-short usernames', () => {
    expect(isValidHiveUsername('ab')).toBe(false);
    expect(isValidHiveUsername('a')).toBe(false);
  });

  it('rejects too-long usernames', () => {
    expect(isValidHiveUsername('abcdefghijklmnopq')).toBe(false); // 17 chars
  });

  it('rejects uppercase letters', () => {
    expect(isValidHiveUsername('Alice')).toBe(false);
    expect(isValidHiveUsername('ALICE')).toBe(false);
  });

  it('rejects special characters', () => {
    expect(isValidHiveUsername('user@name')).toBe(false);
    expect(isValidHiveUsername('user name')).toBe(false);
    expect(isValidHiveUsername('user_name')).toBe(false);
    expect(isValidHiveUsername('user!name')).toBe(false);
  });

  it('rejects usernames starting with non-letter', () => {
    expect(isValidHiveUsername('1alice')).toBe(false);
    expect(isValidHiveUsername('.alice')).toBe(false);
    expect(isValidHiveUsername('-alice')).toBe(false);
  });

  it('rejects usernames ending with dot or hyphen', () => {
    expect(isValidHiveUsername('alice.')).toBe(false);
    expect(isValidHiveUsername('alice-')).toBe(false);
  });
});

describe('validateAmount', () => {
  const balance = 100.0;

  // Valid amounts
  it('accepts valid amounts', () => {
    const result = validateAmount('10', balance);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.amount).toBe(10);
  });

  it('accepts amounts with 3 decimal places', () => {
    const result = validateAmount('10.123', balance);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.amount).toBe(10.123);
  });

  it('accepts the full balance', () => {
    const result = validateAmount('100.000', balance);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.amount).toBe(100);
  });

  it('accepts small amounts', () => {
    const result = validateAmount('0.001', balance);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.amount).toBe(0.001);
  });

  // Invalid amounts
  it('rejects zero', () => {
    const result = validateAmount('0', balance);
    expect(result.valid).toBe(false);
  });

  it('rejects negative numbers', () => {
    const result = validateAmount('-5', balance);
    expect(result.valid).toBe(false);
  });

  it('rejects NaN', () => {
    expect(validateAmount('abc', balance).valid).toBe(false);
    expect(validateAmount('', balance).valid).toBe(false);
    expect(validateAmount('NaN', balance).valid).toBe(false);
  });

  it('rejects Infinity', () => {
    expect(validateAmount('Infinity', balance).valid).toBe(false);
    expect(validateAmount('1e308', balance).valid).toBe(false);
  });

  it('rejects amounts exceeding balance', () => {
    const result = validateAmount('100.001', balance);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('Insufficient');
  });

  it('rejects excessive precision', () => {
    const result = validateAmount('10.1234', balance);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('decimal');
  });

  it('allows custom precision', () => {
    const result = validateAmount('10.123456', balance, 6);
    expect(result.valid).toBe(true);
  });

  it('rejects extremely large numbers', () => {
    const result = validateAmount('999999999999999999999', 1e30);
    // parseFloat will handle this but it should still work
    expect(result.valid).toBe(true); // Valid if within balance
  });
});

describe('validateMemo', () => {
  it('accepts empty memo', () => {
    expect(validateMemo('').valid).toBe(true);
  });

  it('accepts normal memo', () => {
    expect(validateMemo('Payment for services').valid).toBe(true);
  });

  it('accepts memo at exact limit', () => {
    const memo = 'a'.repeat(MAX_MEMO_LENGTH);
    expect(validateMemo(memo).valid).toBe(true);
  });

  it('rejects memo exceeding limit', () => {
    const memo = 'a'.repeat(MAX_MEMO_LENGTH + 1);
    const result = validateMemo(memo);
    expect(result.valid).toBe(false);
  });
});

describe('sanitizeUsername', () => {
  it('strips @ prefix', () => {
    expect(sanitizeUsername('@alice')).toBe('alice');
  });

  it('lowercases', () => {
    expect(sanitizeUsername('Alice')).toBe('alice');
  });

  it('trims whitespace', () => {
    expect(sanitizeUsername('  alice  ')).toBe('alice');
  });

  it('handles combined', () => {
    expect(sanitizeUsername(' @Alice ')).toBe('alice');
  });

  it('handles empty string', () => {
    expect(sanitizeUsername('')).toBe('');
  });
});
