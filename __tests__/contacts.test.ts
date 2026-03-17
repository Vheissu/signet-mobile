/**
 * Tests for the contacts module.
 * Covers CRUD operations, search, and transaction recording.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getContacts,
  saveContact,
  removeContact,
  searchContacts,
  recordTransaction,
  type Contact,
} from '../src/core/contacts';

const CONTACTS_KEY = 'signet_contacts';

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
});

describe('getContacts', () => {
  it('returns empty array when no contacts stored', async () => {
    const result = await getContacts();
    expect(result).toEqual([]);
  });

  it('returns parsed contacts sorted by lastUsed', async () => {
    const contacts: Contact[] = [
      { username: 'alice', lastUsed: 1000, useCount: 1 },
      { username: 'bob', lastUsed: 3000, useCount: 2 },
      { username: 'carol', lastUsed: 2000, useCount: 1 },
    ];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(contacts));

    const result = await getContacts();

    expect(result[0].username).toBe('bob');   // most recent
    expect(result[1].username).toBe('carol');
    expect(result[2].username).toBe('alice'); // least recent
  });

  it('returns empty array on parse error', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid json');
    const result = await getContacts();
    expect(result).toEqual([]);
  });
});

describe('saveContact', () => {
  it('adds a new contact', async () => {
    const contact: Contact = {
      username: 'alice',
      label: 'Friend',
      lastUsed: Date.now(),
      useCount: 0,
    };

    await saveContact(contact);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      CONTACTS_KEY,
      expect.stringContaining('alice'),
    );
  });

  it('updates existing contact by username', async () => {
    const existing: Contact[] = [
      { username: 'alice', label: 'Old Label', lastUsed: 1000, useCount: 5 },
    ];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existing));

    await saveContact({
      username: 'alice',
      label: 'New Label',
      lastUsed: 2000,
      useCount: 5,
    });

    const savedData = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
    const saved = JSON.parse(savedData);
    expect(saved[0].label).toBe('New Label');
    expect(saved[0].lastUsed).toBe(2000);
  });
});

describe('removeContact', () => {
  it('removes a contact by username', async () => {
    const contacts: Contact[] = [
      { username: 'alice', lastUsed: 1000, useCount: 1 },
      { username: 'bob', lastUsed: 2000, useCount: 1 },
    ];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(contacts));

    await removeContact('alice');

    const savedData = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
    const saved = JSON.parse(savedData);
    expect(saved.length).toBe(1);
    expect(saved[0].username).toBe('bob');
  });

  it('does nothing when username not found', async () => {
    const contacts: Contact[] = [
      { username: 'alice', lastUsed: 1000, useCount: 1 },
    ];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(contacts));

    await removeContact('notexist');

    const savedData = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
    const saved = JSON.parse(savedData);
    expect(saved.length).toBe(1);
  });
});

describe('searchContacts', () => {
  const contacts: Contact[] = [
    { username: 'alice', label: 'Friend', lastUsed: 1000, useCount: 1 },
    { username: 'bob', label: 'Exchange', lastUsed: 2000, useCount: 2 },
    { username: 'carol', lastUsed: 3000, useCount: 1 },
  ];

  beforeEach(() => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(contacts));
  });

  it('returns all contacts for empty query', async () => {
    const result = await searchContacts('');
    expect(result.length).toBe(3);
  });

  it('searches by username', async () => {
    const result = await searchContacts('ali');
    expect(result.length).toBe(1);
    expect(result[0].username).toBe('alice');
  });

  it('searches by label', async () => {
    const result = await searchContacts('exchange');
    expect(result.length).toBe(1);
    expect(result[0].username).toBe('bob');
  });

  it('strips @ from query', async () => {
    const result = await searchContacts('@bob');
    expect(result.length).toBe(1);
    expect(result[0].username).toBe('bob');
  });

  it('is case insensitive', async () => {
    const result = await searchContacts('ALICE');
    expect(result.length).toBe(1);
  });

  it('returns empty for no matches', async () => {
    const result = await searchContacts('zzzzz');
    expect(result.length).toBe(0);
  });
});

describe('recordTransaction', () => {
  it('creates new contact for first transaction', async () => {
    await recordTransaction('alice');

    const savedData = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
    const saved = JSON.parse(savedData);
    expect(saved.length).toBe(1);
    expect(saved[0].username).toBe('alice');
    expect(saved[0].useCount).toBe(1);
  });

  it('increments useCount for existing contact', async () => {
    const contacts: Contact[] = [
      { username: 'alice', lastUsed: 1000, useCount: 3 },
    ];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(contacts));

    await recordTransaction('alice');

    const savedData = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
    const saved = JSON.parse(savedData);
    expect(saved[0].useCount).toBe(4);
    expect(saved[0].lastUsed).toBeGreaterThan(1000);
  });
});
