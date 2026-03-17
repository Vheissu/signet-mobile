/**
 * Tests for the notification monitor.
 * Covers notification CRUD and activity checking.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock the hive client module
jest.mock('../src/core/hive/client', () => ({
  getAccount: jest.fn(),
  getAccountHistory: jest.fn(),
}));

jest.mock('../src/core/hive/operations', () => ({
  parseAmount: jest.fn((str: string) => {
    const parts = str.split(' ');
    return { amount: parseFloat(parts[0]) || 0, currency: parts[1] || 'HIVE' };
  }),
  hasPendingRewards: jest.fn(() => false),
}));

import {
  getNotifications,
  markRead,
  markAllRead,
  clearNotifications,
  getUnreadCount,
  checkForNewActivity,
  type Notification,
} from '../src/core/notifications/monitor';

import { getAccount, getAccountHistory } from '../src/core/hive/client';
import { hasPendingRewards } from '../src/core/hive/operations';

const NOTIFICATIONS_KEY = 'signet_notifications';
const LAST_CHECK_KEY = 'signet_notification_last_check';

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
});

describe('getNotifications', () => {
  it('returns empty array when nothing stored', async () => {
    const result = await getNotifications();
    expect(result).toEqual([]);
  });

  it('returns stored notifications', async () => {
    const notifications: Notification[] = [
      {
        id: '1',
        type: 'transfer_in',
        title: 'Transfer',
        message: '10 HIVE from @bob',
        timestamp: Date.now(),
        read: false,
      },
    ];
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === NOTIFICATIONS_KEY) return JSON.stringify(notifications);
      return null;
    });

    const result = await getNotifications();
    expect(result.length).toBe(1);
    expect(result[0].title).toBe('Transfer');
  });
});

describe('markRead', () => {
  it('marks a notification as read', async () => {
    const notifications: Notification[] = [
      { id: '1', type: 'transfer_in', title: 'T', message: 'M', timestamp: 1000, read: false },
      { id: '2', type: 'transfer_in', title: 'T2', message: 'M2', timestamp: 2000, read: false },
    ];
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === NOTIFICATIONS_KEY) return JSON.stringify(notifications);
      return null;
    });

    await markRead('1');

    const savedData = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
    const saved = JSON.parse(savedData);
    expect(saved.find((n: Notification) => n.id === '1').read).toBe(true);
    expect(saved.find((n: Notification) => n.id === '2').read).toBe(false);
  });
});

describe('markAllRead', () => {
  it('marks all notifications as read', async () => {
    const notifications: Notification[] = [
      { id: '1', type: 'transfer_in', title: 'T', message: 'M', timestamp: 1000, read: false },
      { id: '2', type: 'transfer_in', title: 'T2', message: 'M2', timestamp: 2000, read: false },
    ];
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === NOTIFICATIONS_KEY) return JSON.stringify(notifications);
      return null;
    });

    await markAllRead();

    const savedData = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
    const saved = JSON.parse(savedData);
    expect(saved.every((n: Notification) => n.read)).toBe(true);
  });
});

describe('clearNotifications', () => {
  it('clears all notifications', async () => {
    await clearNotifications();

    const savedData = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
    expect(JSON.parse(savedData)).toEqual([]);
  });
});

describe('getUnreadCount', () => {
  it('returns 0 for empty', async () => {
    expect(await getUnreadCount()).toBe(0);
  });

  it('counts unread notifications', async () => {
    const notifications: Notification[] = [
      { id: '1', type: 'transfer_in', title: 'T', message: 'M', timestamp: 1000, read: false },
      { id: '2', type: 'transfer_in', title: 'T', message: 'M', timestamp: 2000, read: true },
      { id: '3', type: 'transfer_in', title: 'T', message: 'M', timestamp: 3000, read: false },
    ];
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === NOTIFICATIONS_KEY) return JSON.stringify(notifications);
      return null;
    });

    expect(await getUnreadCount()).toBe(2);
  });
});

describe('checkForNewActivity', () => {
  it('returns empty when account not found', async () => {
    (getAccount as jest.Mock).mockResolvedValue(null);

    const result = await checkForNewActivity('noone');
    expect(result).toEqual([]);
  });

  it('generates reward notification when rewards pending', async () => {
    (getAccount as jest.Mock).mockResolvedValue({
      reward_hive_balance: '1.000 HIVE',
      reward_hbd_balance: '0.500 HBD',
      reward_vesting_balance: '0.000000 VESTS',
      next_vesting_withdrawal: '1970-01-01T00:00:00',
      savings_hbd_balance: '0.000 HBD',
    });
    (hasPendingRewards as jest.Mock).mockReturnValue(true);

    const result = await checkForNewActivity('alice');

    const rewardNotif = result.find((n) => n.type === 'reward_available');
    expect(rewardNotif).toBeDefined();
    expect(rewardNotif!.title).toBe('Rewards Available');
  });

  it('generates transfer notification for incoming transfers', async () => {
    const now = Date.now();
    const lastCheck = now - 60000;

    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === LAST_CHECK_KEY) return String(lastCheck);
      return null;
    });

    (getAccount as jest.Mock).mockResolvedValue({
      reward_hive_balance: '0.000 HIVE',
      reward_hbd_balance: '0.000 HBD',
      reward_vesting_balance: '0.000000 VESTS',
      next_vesting_withdrawal: '1970-01-01T00:00:00',
      savings_hbd_balance: '0.000 HBD',
    });
    (hasPendingRewards as jest.Mock).mockReturnValue(false);

    (getAccountHistory as jest.Mock).mockResolvedValue([
      {
        id: 'tx123',
        type: 'transfer',
        timestamp: new Date(now - 30000).toISOString().replace('Z', ''),
        from: 'bob',
        to: 'alice',
        amount: '10.000 HIVE',
        block: 1000,
      },
    ]);

    const result = await checkForNewActivity('alice');

    const transferNotif = result.find((n) => n.type === 'transfer_in');
    expect(transferNotif).toBeDefined();
    expect(transferNotif!.message).toContain('10.000 HIVE');
    expect(transferNotif!.message).toContain('@bob');
  });

  it('saves last check timestamp', async () => {
    (getAccount as jest.Mock).mockResolvedValue({
      reward_hive_balance: '0.000 HIVE',
      reward_hbd_balance: '0.000 HBD',
      reward_vesting_balance: '0.000000 VESTS',
      next_vesting_withdrawal: '1970-01-01T00:00:00',
      savings_hbd_balance: '0.000 HBD',
    });
    (hasPendingRewards as jest.Mock).mockReturnValue(false);

    await checkForNewActivity('alice');

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      LAST_CHECK_KEY,
      expect.any(String),
    );
  });
});
