/**
 * Password Manager CSV Import
 *
 * Parses exported CSV files from 1Password, LastPass, and Bitwarden,
 * and extracts Hive blockchain credentials.
 *
 * This is pure string parsing that works identically in React Native.
 */

import { logger } from '../logger';

export interface ImportedEntry {
  source: 'onepassword' | 'lastpass' | 'bitwarden' | 'generic';
  title: string;
  username: string;
  fields: Record<string, string>;
}

export interface DetectedHiveAccount {
  username: string;
  keys: {
    posting?: string;
    active?: string;
    memo?: string;
    owner?: string;
    master?: string;
  };
  source: string;
  title: string;
}

// WIF private keys start with '5' and are 51 characters (base58)
const WIF_REGEX = /^5[HJK][1-9A-HJ-NP-Za-km-z]{49}$/;

// Hive master passwords are typically long random strings
const MASTER_KEY_REGEX = /^P5[A-Za-z0-9]{45,55}$/;

/**
 * Parse a CSV string into rows of objects.
 */
function parseCSV(text: string): Record<string, string>[] {
  // Join multi-line quoted fields before splitting into rows
  const logicalLines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const rawLine of text.trim().split('\n')) {
    if (!inQuotes) {
      current = rawLine;
    } else {
      current += '\n' + rawLine;
    }

    // Count unescaped quotes to track state
    let quotes = 0;
    for (let i = 0; i < rawLine.length; i++) {
      if (rawLine[i] === '"') {
        if (rawLine[i + 1] === '"') { i++; continue; } // escaped
        quotes++;
      }
    }
    if (quotes % 2 !== 0) inQuotes = !inQuotes;

    if (!inQuotes) {
      logicalLines.push(current);
      current = '';
    }
  }
  if (current) logicalLines.push(current);

  if (logicalLines.length < 2) return [];

  const headers = parseCSVLine(logicalLines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < logicalLines.length; i++) {
    const values = parseCSVLine(logicalLines[i]);
    if (values.length === 0) continue;

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header.trim().toLowerCase()] = (values[idx] || '').trim();
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Parse a single CSV line, handling quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
}

/**
 * Detect the CSV format (which password manager it came from).
 */
function detectFormat(headers: string[]): ImportedEntry['source'] {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

  // 1Password: Title, URL, Username, Password, Notes, Type
  if (lowerHeaders.includes('title') && lowerHeaders.includes('notes')) {
    return 'onepassword';
  }

  // LastPass: url, username, password, extra, name, grouping, fav
  if (lowerHeaders.includes('extra') && lowerHeaders.includes('grouping')) {
    return 'lastpass';
  }

  // Bitwarden: folder, favorite, type, name, notes, fields, reprompt, login_uri, login_username, login_password, login_totp
  if (lowerHeaders.includes('login_username') || lowerHeaders.includes('login_password')) {
    return 'bitwarden';
  }

  return 'generic';
}

/**
 * Check if a string looks like a Hive WIF private key.
 */
export function isWifKey(str: string): boolean {
  return WIF_REGEX.test(str.trim());
}

/**
 * Check if a string looks like a Hive master password.
 */
function isMasterPassword(str: string): boolean {
  return MASTER_KEY_REGEX.test(str.trim());
}

/**
 * Extract potential Hive keys from a text blob (notes, extra fields, etc.)
 */
function extractKeysFromText(text: string): Record<string, string> {
  const keys: Record<string, string> = {};
  if (!text) return keys;

  const lines = text.split(/[\n\r]+/);

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Look for labeled keys: "Posting Key: 5xxx..." or "posting: 5xxx..."
    const match = line.match(/(?:posting|active|memo|owner|master)\s*(?:key|private\s*key)?\s*[:=]\s*(\S+)/i);
    if (match && (isWifKey(match[1]) || isMasterPassword(match[1]))) {
      const role = lower.includes('posting') ? 'posting'
        : lower.includes('active') ? 'active'
        : lower.includes('memo') ? 'memo'
        : lower.includes('owner') ? 'owner'
        : lower.includes('master') ? 'master'
        : null;
      if (role) keys[role] = match[1].trim();
      continue;
    }

    // Look for unlabeled WIF keys
    const wifMatch = line.match(/(5[HJK][1-9A-HJ-NP-Za-km-z]{49})/);
    if (wifMatch && !keys._unlabeled) {
      keys._unlabeled = wifMatch[1];
    }
  }

  return keys;
}

/**
 * Extract keys from structured fields (1Password custom fields, Bitwarden fields).
 */
function extractKeysFromFields(fieldsJson: string): Record<string, string> {
  const keys: Record<string, string> = {};
  if (!fieldsJson) return keys;

  try {
    // Bitwarden fields format: "fieldname: value\n..."
    const lines = fieldsJson.split(/[\n\r]+/);
    for (const line of lines) {
      const [label, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();
      if (!label || !value) continue;

      const lower = label.toLowerCase().trim();
      if (isWifKey(value)) {
        if (lower.includes('posting')) keys.posting = value;
        else if (lower.includes('active')) keys.active = value;
        else if (lower.includes('memo')) keys.memo = value;
        else if (lower.includes('owner')) keys.owner = value;
      } else if (isMasterPassword(value)) {
        keys.master = value;
      }
    }
  } catch (err) {
    logger.warn('[Signet] Failed to parse structured fields:', err);
  }

  return keys;
}

/**
 * Parse and extract Hive accounts from a password manager CSV export.
 */
export function parsePasswordManagerCSV(csvText: string): DetectedHiveAccount[] {
  const rows = parseCSV(csvText);
  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]);
  const format = detectFormat(headers);
  const accounts: DetectedHiveAccount[] = [];

  for (const row of rows) {
    let title = '';
    let username = '';
    let password = '';
    let notes = '';
    let fields = '';

    switch (format) {
      case 'onepassword':
        title = row['title'] || '';
        username = row['username'] || '';
        password = row['password'] || '';
        notes = row['notes'] || '';
        break;

      case 'lastpass':
        title = row['name'] || '';
        username = row['username'] || '';
        password = row['password'] || '';
        notes = row['extra'] || '';
        break;

      case 'bitwarden':
        title = row['name'] || '';
        username = row['login_username'] || '';
        password = row['login_password'] || '';
        notes = row['notes'] || '';
        fields = row['fields'] || '';
        break;

      default:
        title = row['name'] || row['title'] || '';
        username = row['username'] || row['login'] || '';
        password = row['password'] || '';
        notes = row['notes'] || row['extra'] || row['comments'] || '';
        break;
    }

    // Check if this entry looks Hive-related
    const allText = `${title} ${username} ${notes} ${password}`.toLowerCase();
    const isHiveRelated =
      allText.includes('hive') ||
      allText.includes('peakd') ||
      allText.includes('ecency') ||
      allText.includes('splinterlands') ||
      allText.includes('posting key') ||
      allText.includes('active key') ||
      allText.includes('memo key') ||
      allText.includes('owner key') ||
      isWifKey(password);

    if (!isHiveRelated) continue;

    // Extract keys from various fields
    const notesKeys = extractKeysFromText(notes);
    const fieldKeys = extractKeysFromFields(fields);
    const allKeys = { ...notesKeys, ...fieldKeys };

    // If the password field is a WIF key, try to use it
    if (isWifKey(password) && !allKeys.posting && !allKeys.active) {
      allKeys._password = password;
    }

    // If we have a master password, note it
    if (isMasterPassword(password)) {
      allKeys.master = password;
    }

    // Clean username (remove @)
    const cleanUsername = username.replace(/^@/, '').trim().toLowerCase();

    if (cleanUsername || Object.keys(allKeys).length > 0) {
      accounts.push({
        username: cleanUsername,
        keys: {
          posting: allKeys.posting,
          active: allKeys.active,
          memo: allKeys.memo,
          owner: allKeys.owner,
          master: allKeys.master || allKeys._password,
        },
        source: format,
        title,
      });
    }
  }

  return accounts;
}

/**
 * Get a user-friendly name for the password manager format.
 */
export function getFormatName(source: string): string {
  switch (source) {
    case 'onepassword': return '1Password';
    case 'lastpass': return 'LastPass';
    case 'bitwarden': return 'Bitwarden';
    default: return 'CSV';
  }
}
