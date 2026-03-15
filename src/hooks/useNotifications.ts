/**
 * useNotifications Hook
 *
 * Polls the notification monitor and exposes notification state
 * for the NotificationCenter component.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '../store';
import {
  checkForNewActivity,
  getNotifications,
  markRead,
  markAllRead,
  clearNotifications,
  type Notification as MonitorNotification,
} from '../core/notifications/monitor';
import { logger } from '../core/logger';

// The NotificationCenter component expects this shape
export interface UINotification {
  id: string;
  type:
    | 'transfer_in'
    | 'transfer_out'
    | 'reward'
    | 'delegation'
    | 'power_up'
    | 'vote'
    | 'warning'
    | 'info';
  title: string;
  message: string;
  timestamp: string; // ISO string
  read: boolean;
}

/** Map monitor notification types to UI notification types */
function mapType(type: MonitorNotification['type']): UINotification['type'] {
  switch (type) {
    case 'transfer_in':
      return 'transfer_in';
    case 'reward_available':
      return 'reward';
    case 'power_down':
      return 'power_up';
    case 'delegation_change':
      return 'delegation';
    case 'savings_interest':
      return 'info';
    case 'witness_expiry':
      return 'warning';
    default:
      return 'info';
  }
}

function toUINotification(n: MonitorNotification): UINotification {
  return {
    id: n.id,
    type: mapType(n.type),
    title: n.title,
    message: n.message,
    timestamp: new Date(n.timestamp).toISOString(),
    read: n.read,
  };
}

const POLL_INTERVAL = 60_000; // 60 seconds

export function useNotifications() {
  const activeAccountName = useStore((s) => s.activeAccountName);
  const isLocked = useStore((s) => s.isLocked);

  const [notifications, setNotifications] = useState<UINotification[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reload = useCallback(async () => {
    const stored = await getNotifications();
    setNotifications(stored.map(toUINotification));
  }, []);

  const poll = useCallback(async () => {
    if (!activeAccountName) return;
    try {
      await checkForNewActivity(activeAccountName);
      await reload();
    } catch (err) {
      logger.warn('[useNotifications] Poll failed:', err);
    }
  }, [activeAccountName, reload]);

  // Start polling when unlocked and account is set
  useEffect(() => {
    if (isLocked || !activeAccountName) {
      setNotifications([]);
      return;
    }

    // Initial load
    reload();
    // First poll after a short delay to avoid blocking unlock
    const initialTimeout = setTimeout(poll, 3_000);

    pollRef.current = setInterval(poll, POLL_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isLocked, activeAccountName, poll, reload]);

  const handleMarkRead = useCallback(
    async (id: string) => {
      await markRead(id);
      await reload();
    },
    [reload],
  );

  const handleMarkAllRead = useCallback(async () => {
    await markAllRead();
    await reload();
  }, [reload]);

  const handleClearAll = useCallback(async () => {
    await clearNotifications();
    await reload();
  }, [reload]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    markRead: handleMarkRead,
    markAllRead: handleMarkAllRead,
    clearAll: handleClearAll,
    refresh: poll,
  };
}

export default useNotifications;
