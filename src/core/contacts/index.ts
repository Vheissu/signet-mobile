/**
 * Contact List
 *
 * Stores favorite/frequent Hive accounts for quick access
 * in transfers, delegations, etc. Persisted via AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../logger';

export interface Contact {
  username: string;
  label?: string;       // Optional nickname ("Mom", "Business Partner")
  lastUsed: number;     // Timestamp of last transaction
  useCount: number;     // How many times used
}

const CONTACTS_KEY = 'signet_contacts';

/**
 * Get all contacts, sorted by most recently used.
 */
export async function getContacts(): Promise<Contact[]> {
  try {
    const raw = await AsyncStorage.getItem(CONTACTS_KEY);
    if (!raw) return [];
    const contacts: Contact[] = JSON.parse(raw);
    return contacts.sort((a, b) => b.lastUsed - a.lastUsed);
  } catch {
    return [];
  }
}

/**
 * Add or update a contact.
 */
export async function saveContact(contact: Contact): Promise<void> {
  const contacts = await getContacts();
  const existing = contacts.findIndex((c) => c.username === contact.username);

  if (existing >= 0) {
    contacts[existing] = { ...contacts[existing], ...contact };
  } else {
    contacts.push(contact);
  }

  await persistContacts(contacts);
}

/**
 * Remove a contact by username.
 */
export async function removeContact(username: string): Promise<void> {
  const contacts = await getContacts();
  const filtered = contacts.filter((c) => c.username !== username);
  await persistContacts(filtered);
}

/**
 * Record a transaction with a user -- auto-adds or updates as a contact.
 */
export async function recordTransaction(username: string): Promise<void> {
  const contacts = await getContacts();
  const existing = contacts.find((c) => c.username === username);

  if (existing) {
    existing.lastUsed = Date.now();
    existing.useCount++;
  } else {
    contacts.push({
      username,
      lastUsed: Date.now(),
      useCount: 1,
    });
  }

  await persistContacts(contacts);
}

/**
 * Search contacts by username or label.
 */
export async function searchContacts(query: string): Promise<Contact[]> {
  if (!query) return getContacts();

  const contacts = await getContacts();
  const q = query.toLowerCase().replace('@', '');

  return contacts.filter(
    (c) =>
      c.username.toLowerCase().includes(q) ||
      (c.label && c.label.toLowerCase().includes(q))
  );
}

async function persistContacts(contacts: Contact[]): Promise<void> {
  // Keep max 100 contacts
  const trimmed = contacts
    .sort((a, b) => b.lastUsed - a.lastUsed)
    .slice(0, 100);

  try {
    await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(trimmed));
  } catch (err) {
    logger.warn('[Signet] Failed to persist contacts:', err);
  }
}
