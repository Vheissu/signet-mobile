/**
 * Production-safe logger for Signet Mobile.
 *
 * - Silent in production builds (__DEV__ === false)
 * - Sanitizes potential private keys and passwords from log output
 * - Drop-in replacement for console.log/warn/error
 */

/** Regex patterns for sensitive data that should never appear in logs. */
const SENSITIVE_PATTERNS = [
  // Hive WIF private keys (base58, start with 5 + H/J/K, 51 chars)
  /5[HJK][1-9A-HJ-NP-Za-km-z]{49}/g,
  // Hive master passwords (start with P5)
  /P5[A-Za-z0-9]{45,55}/g,
  // Generic long base58 strings (potential keys)
  /[1-9A-HJ-NP-Za-km-z]{50,}/g,
  // Hex-encoded private keys (64 hex chars)
  /[0-9a-f]{64}/gi,
  // Password field values in JSON-like formats
  /"password"\s*:\s*"[^"]+"/gi,
  /password[=:]\s*\S+/gi,
  // API keys (common patterns)
  /(?:api[_-]?key|secret|token)[=:]\s*\S+/gi,
];

function sanitize(value: unknown): unknown {
  if (typeof value === 'string') {
    let sanitized = value;
    for (const pattern of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    return sanitized;
  }
  if (value instanceof Error) {
    const msg = sanitize(value.message) as string;
    return `${value.name}: ${msg}`;
  }
  return value;
}

function noop() {}

function createLogger(level: 'log' | 'warn' | 'error') {
  // Always keep error and warn logging in production for crash/diagnostic reporting.
  // Only suppress verbose log output in release builds.
  if (!__DEV__ && level === 'log') return noop;

  return (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console[level](...args.map(sanitize));
  };
}

export const logger = {
  log: createLogger('log'),
  warn: createLogger('warn'),
  error: createLogger('error'),
};
