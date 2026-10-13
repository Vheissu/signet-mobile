/**
 * Notification Monitor
 *
 * Polls for account activity and surfaces actionable notifications:
 * - Incoming transfers
 * - Reward claim reminders
 * - Power down payments
 * - Witness vote expiration
 * - Delegation changes
 *
 * Uses AsyncStorage instead of chrome.storage for React Native.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccount, getAccountHistory, getDynamicGlobalProperties } from '../hive/client';
import { parseAmount, hasPendingRewards } from '../hive/operations';
import { logger } from '../logger';

export interface Notification {
  id: string;
  type: 'transfer_in' | 'reward_available' | 'power_down' | 'witness_expiry' | 'delegation_change' | 'savings_interest';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  actionPage?: string;
  actionParams?: Record<string, any>;
}

const LAST_CHECK_KEY = 'signet_notification_last_check';
const NOTIFICATIONS_KEY = 'signet_notifications';

/**
 * Load stored notifications.
 */
export async function getNotifications(): Promise<Notification[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save notifications.
 */
async function saveNotifications(notifications: Notification[]): Promise<void> {
  try {
    // Keep only the last 50 notifications
    const trimmed = notifications.slice(0, 50);
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(trimmed));
  } catch (err) {
    logger.warn('[Signet] Failed to save notifications:', err);
  }
}

/**
 * Mark a notification as read.
 */
export async function markRead(id: string): Promise<void> {
  const notifications = await getNotifications();
  const updated = notifications.map((n) =>
    n.id === id ? { ...n, read: true } : n
  );
  await saveNotifications(updated);
}

/**
 * Mark all notifications as read.
 */
export async function markAllRead(): Promise<void> {
  const notifications = await getNotifications();
  const updated = notifications.map((n) => ({ ...n, read: true }));
  await saveNotifications(updated);
}

/**
 * Clear all notifications.
 */
export async function clearNotifications(): Promise<void> {
  await saveNotifications([]);
}

/**
 * Get unread count.
 */
export async function getUnreadCount(): Promise<number> {
  const notifications = await getNotifications();
  return notifications.filter((n) => !n.read).length;
}

/**
 * Check for new activity on an account and generate notifications.
 */
export async function checkForNewActivity(username: string): Promise<Notification[]> {
  const newNotifications: Notification[] = [];
  const now = Date.now();

  try {
    // Get last check timestamp
    let lastCheck = 0;
    try {
      const raw = await AsyncStorage.getItem(LAST_CHECK_KEY);
      lastCheck = raw ? parseInt(raw, 10) : 0;
    } catch {
      lastCheck = 0;
    }

    // Get account data
    const account = await getAccount(username);
    if (!account) return [];

    // Check for pending rewards
    if (hasPendingRewards(account)) {
      const rewardHive = parseAmount(account.reward_hive_balance as any || '0 HIVE').amount;
      const rewardHbd = parseAmount(account.reward_hbd_balance as any || '0 HBD').amount;

      const parts = [];
      if (rewardHive > 0) parts.push(`${rewardHive.toFixed(3)} HIVE`);
      if (rewardHbd > 0) parts.push(`${rewardHbd.toFixed(3)} HBD`);

      newNotifications.push({
        id: `reward_${parts.join('_')}`,
        type: 'reward_available',
        title: 'Rewards Available',
        message: `Claim ${parts.join(' + ')}`,
        timestamp: now,
        read: false,
        actionPage: 'dashboard',
      });
    }

    // Check for active power down
    const nextPowerDown = new Date(
      (account as any).next_vesting_withdrawal + 'Z'
    ).getTime();
    if (nextPowerDown > now && nextPowerDown < now + 7 * 86400 * 1000) {
      const daysUntil = Math.ceil((nextPowerDown - now) / 86400000);
      newNotifications.push({
        id: `powerdown_${(account as any).next_vesting_withdrawal}`,
        type: 'power_down',
        title: 'Power Down Payment',
        message: `Next payment in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
        timestamp: now,
        read: false,
        actionPage: 'staking',
      });
    }

    // HBD savings interest, at the rate the chain currently pays
    const savingsHbd = parseAmount(account.savings_hbd_balance as any || '0 HBD').amount;
    if (savingsHbd > 0) {
      let apr = 0;
      try {
        const props: any = await getDynamicGlobalProperties();
        apr = Number(props.hbd_interest_rate || 0) / 10000;
      } catch {
        apr = 0;
      }
      const monthlyInterest = (savingsHbd * apr) / 12;
      newNotifications.push({
        id: `savings_${savingsHbd.toFixed(3)}`,
        type: 'savings_interest',
        title: 'Savings Earning Interest',
        message:
          apr > 0
            ? `${savingsHbd.toFixed(3)} HBD earning ~${monthlyInterest.toFixed(3)} HBD/month at ${(apr * 100).toFixed(2)}% APR`
            : `${savingsHbd.toFixed(3)} HBD in savings`,
        timestamp: now,
        read: false,
        actionPage: 'savings',
      });
    }

    // Check recent history for incoming transfers (since last check)
    if (lastCheck > 0) {
      try {
        const history = await getAccountHistory(username, -1, 20);
        for (const tx of history) {
          const txTime = new Date(tx.timestamp + 'Z').getTime();
          if (txTime <= lastCheck) continue;

          if (tx.type === 'transfer' && tx.to === username && tx.from !== username) {
            newNotifications.push({
              id: `transfer_${tx.id}_${tx.block}`,
              type: 'transfer_in',
              title: 'Transfer Received',
              message: `${tx.amount} from @${tx.from}`,
              timestamp: txTime,
              read: false,
              actionPage: 'history',
            });
          }

          if (tx.type === 'delegate_vesting_shares' && tx.to === username) {
            newNotifications.push({
              id: `delegation_${tx.id}_${tx.block}`,
              type: 'delegation_change',
              title: 'Delegation Received',
              message: `From @${tx.from}`,
              timestamp: txTime,
              read: false,
              actionPage: 'delegation',
            });
          }
        }
      } catch (err) {
        logger.warn('[Signet] History fetch failed during notification check:', err);
      }
    }

    // Save last check time
    try {
      await AsyncStorage.setItem(LAST_CHECK_KEY, String(now));
    } catch {
      // Ignore
    }

    // Merge with existing notifications (deduplicate by id)
    if (newNotifications.length > 0) {
      const existing = await getNotifications();
      const existingIds = new Set(existing.map((n) => n.id));
      const fresh = newNotifications.filter((n) => !existingIds.has(n.id));

      if (fresh.length > 0) {
        await saveNotifications([...fresh, ...existing]);
      }
    }
  } catch (err) {
    logger.error('[Signet] Notification check failed:', err);
  }

  return newNotifications;
}
