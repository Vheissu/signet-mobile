/**
 * Input Validation Utilities
 *
 * Centralized validation for all user inputs that affect
 * blockchain transactions. Used across all transaction screens.
 */

/** Hive usernames: 3-16 chars, lowercase alphanumeric + dots + hyphens */
const HIVE_USERNAME_REGEX = /^[a-z][a-z0-9.-]{1,14}[a-z0-9]$/;

/**
 * Validate a Hive blockchain username format.
 * Does NOT check if the account exists on-chain (use getAccount for that).
 */
export function isValidHiveUsername(name: string): boolean {
  if (!name || name.length < 3 || name.length > 16) return false;
  return HIVE_USERNAME_REGEX.test(name);
}

/**
 * Validate and parse an amount string for blockchain transactions.
 * Returns the parsed number or null if invalid.
 *
 * Checks for: NaN, Infinity, negative, zero, exceeds balance, precision.
 */
export function validateAmount(
  input: string,
  maxBalance: number,
  precision: number = 3,
): { valid: true; amount: number } | { valid: false; error: string } {
  const num = parseFloat(input);

  if (isNaN(num) || !isFinite(num)) {
    return { valid: false, error: 'Please enter a valid number' };
  }
  if (num <= 0) {
    return { valid: false, error: 'Amount must be greater than zero' };
  }
  if (num > maxBalance) {
    return { valid: false, error: 'Insufficient balance' };
  }

  // Check precision (e.g. HIVE supports 3 decimal places)
  const parts = input.split('.');
  if (parts[1] && parts[1].length > precision) {
    return { valid: false, error: `Maximum ${precision} decimal places allowed` };
  }

  return { valid: true, amount: num };
}

/** Maximum memo length on the Hive blockchain */
export const MAX_MEMO_LENGTH = 2048;

/**
 * Validate a memo string.
 */
export function validateMemo(memo: string): { valid: true } | { valid: false; error: string } {
  if (memo.length > MAX_MEMO_LENGTH) {
    return { valid: false, error: `Memo cannot exceed ${MAX_MEMO_LENGTH} characters` };
  }
  return { valid: true };
}

/**
 * Sanitize a username from user input (strip @, lowercase, trim).
 */
export function sanitizeUsername(input: string): string {
  return input.replace(/^@/, '').trim().toLowerCase();
}
