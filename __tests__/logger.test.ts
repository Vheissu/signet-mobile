/**
 * Tests for the logger sanitization patterns.
 * Verifies that private keys and sensitive data are redacted from log output.
 */

// We test the sanitization function directly by importing the module
// and checking that console output is sanitized.

// Since sanitize is not exported, we test via the logger itself.
// We need __DEV__ to be true for the logger to produce output.

// Mock __DEV__ as true
Object.defineProperty(global, '__DEV__', { value: true, writable: true });

// Capture console output
const consoleSpy = {
  log: jest.spyOn(console, 'log').mockImplementation(),
  warn: jest.spyOn(console, 'warn').mockImplementation(),
  error: jest.spyOn(console, 'error').mockImplementation(),
};

// Import after mocking __DEV__
import { logger } from '../src/core/logger';

afterEach(() => {
  consoleSpy.log.mockClear();
  consoleSpy.warn.mockClear();
  consoleSpy.error.mockClear();
});

describe('logger sanitization', () => {
  it('redacts WIF private keys starting with 5H', () => {
    logger.log('Key is 5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ');
    const output = consoleSpy.log.mock.calls[0][0] as string;
    expect(output).not.toContain('5HueCGU8rMjx');
    expect(output).toContain('[REDACTED]');
  });

  it('redacts WIF private keys starting with 5J', () => {
    logger.log('Key: 5JamTPvZyQsHf8c2pbN92F1gUY3sJkpg4jE1EBYrRBiwnEFNabC');
    const output = consoleSpy.log.mock.calls[0][0] as string;
    expect(output).not.toContain('5JamTPvZyQs');
    expect(output).toContain('[REDACTED]');
  });

  it('redacts WIF private keys starting with 5K', () => {
    logger.warn('5KYZdUEo39z3FPrtuX2QbbwGnNP5zTd7yyr2SC1j299sBCnWjss');
    const output = consoleSpy.warn.mock.calls[0][0] as string;
    expect(output).not.toContain('5KYZdUEo');
    expect(output).toContain('[REDACTED]');
  });

  it('redacts JSON password fields', () => {
    logger.log('Config: {"password": "mysecret123", "user": "alice"}');
    const output = consoleSpy.log.mock.calls[0][0] as string;
    expect(output).not.toContain('mysecret123');
    expect(output).toContain('[REDACTED]');
  });

  it('redacts long base58 strings', () => {
    const longBase58 = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789012345';
    logger.log(`Potential key: ${longBase58}`);
    const output = consoleSpy.log.mock.calls[0][0] as string;
    expect(output).toContain('[REDACTED]');
  });

  it('does not redact normal text', () => {
    logger.log('Hello world, this is normal text');
    const output = consoleSpy.log.mock.calls[0][0] as string;
    expect(output).toBe('Hello world, this is normal text');
  });

  it('does not redact short strings', () => {
    logger.log('alice sent 10.000 HIVE');
    const output = consoleSpy.log.mock.calls[0][0] as string;
    expect(output).toBe('alice sent 10.000 HIVE');
  });

  it('sanitizes Error objects', () => {
    const err = new Error('Failed with key 5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ');
    logger.error('Error:', err);
    const output = consoleSpy.error.mock.calls[0][1] as string;
    expect(output).not.toContain('5HueCGU8');
    expect(output).toContain('[REDACTED]');
  });

  it('passes non-string non-error values through', () => {
    logger.log('Count:', 42);
    expect(consoleSpy.log.mock.calls[0][0]).toBe('Count:');
    expect(consoleSpy.log.mock.calls[0][1]).toBe(42);
  });
});
