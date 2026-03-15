import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Platform,
  Pressable,
} from 'react-native';
import {
  Bell,
  ArrowDownLeft,
  ArrowUpRight,
  Award,
  Users,
  Layers,
  Vote,
  AlertTriangle,
  Info,
  CheckCheck,
  Trash2,
  X,
} from 'lucide-react-native';
import { colors } from '../../theme';

type NotificationType =
  | 'transfer_in'
  | 'transfer_out'
  | 'reward'
  | 'delegation'
  | 'power_up'
  | 'vote'
  | 'warning'
  | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

interface NotificationCenterProps {
  notifications?: Notification[];
  onMarkAllRead?: () => void;
  onClearAll?: () => void;
  onDismiss?: (id: string) => void;
  onMarkRead?: (id: string) => void;
}

const notificationIconMap: Record<
  NotificationType,
  {
    icon: React.FC<{ size: number; color: string }>;
    color: string;
    bgColor: string;
  }
> = {
  transfer_in: {
    icon: ArrowDownLeft,
    color: colors.success,
    bgColor: 'rgba(92,234,160,0.12)',
  },
  transfer_out: {
    icon: ArrowUpRight,
    color: colors.hive,
    bgColor: 'rgba(227,19,55,0.12)',
  },
  reward: {
    icon: Award,
    color: colors.warning,
    bgColor: 'rgba(255,209,102,0.12)',
  },
  delegation: {
    icon: Users,
    color: colors.info,
    bgColor: 'rgba(99,179,237,0.12)',
  },
  power_up: {
    icon: Layers,
    color: colors.coral,
    bgColor: 'rgba(244,132,95,0.12)',
  },
  vote: {
    icon: Vote,
    color: colors.coralLight,
    bgColor: 'rgba(247,160,132,0.12)',
  },
  warning: {
    icon: AlertTriangle,
    color: colors.error,
    bgColor: 'rgba(239,71,111,0.12)',
  },
  info: {
    icon: Info,
    color: colors.info,
    bgColor: 'rgba(99,179,237,0.12)',
  },
};

function formatTimestamp(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

const NotificationRow: React.FC<{
  notification: Notification;
  onPress?: () => void;
}> = ({ notification, onPress }) => {
  const config = notificationIconMap[notification.type] || notificationIconMap.info;
  const Icon = config.icon;

  return (
    <TouchableOpacity
      style={[
        styles.notifRow,
        !notification.read && styles.notifRowUnread,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[styles.notifIcon, { backgroundColor: config.bgColor }]}
      >
        <Icon size={16} color={config.color} />
      </View>
      <View style={styles.notifContent}>
        <View style={styles.notifHeader}>
          <Text
            style={[
              styles.notifTitle,
              !notification.read && styles.notifTitleUnread,
            ]}
            numberOfLines={1}
          >
            {notification.title}
          </Text>
          {!notification.read && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.notifMessage} numberOfLines={2}>
          {notification.message}
        </Text>
        <Text style={styles.notifTime}>
          {formatTimestamp(notification.timestamp)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications = [],
  onMarkAllRead,
  onClearAll,
  onDismiss,
  onMarkRead,
}) => {
  const [visible, setVisible] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleOpen = useCallback(() => {
    setVisible(true);
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
  }, []);

  const handleNotificationPress = useCallback(
    (id: string) => {
      onMarkRead?.(id);
    },
    [onMarkRead],
  );

  return (
    <>
      <TouchableOpacity
        style={styles.bellButton}
        onPress={handleOpen}
        activeOpacity={0.7}
      >
        <Bell size={20} color={colors.textSecondary} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={handleClose}
      >
        <Pressable style={styles.overlay} onPress={handleClose}>
          {/* Inner Pressable captures touches so tapping the panel doesn't close the overlay */}
          <Pressable
            style={styles.panel}
            onPress={undefined}
          >
            <View style={styles.panelHeader}>
              <View style={styles.panelTitleRow}>
                <Text style={styles.panelTitle}>Notifications</Text>
                {unreadCount > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{unreadCount}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                activeOpacity={0.7}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {notifications.length > 0 && (
              <View style={styles.actionBar}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={onMarkAllRead}
                  activeOpacity={0.7}
                >
                  <CheckCheck size={14} color={colors.info} />
                  <Text style={styles.actionButtonText}>Mark all read</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={onClearAll}
                  activeOpacity={0.7}
                >
                  <Trash2 size={14} color={colors.textTertiary} />
                  <Text style={styles.actionButtonTextMuted}>Clear all</Text>
                </TouchableOpacity>
              </View>
            )}

            <ScrollView
              style={styles.notifList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={
                notifications.length === 0 ? styles.emptyContainer : undefined
              }
            >
              {notifications.length === 0 ? (
                <View style={styles.emptyState}>
                  <Bell size={36} color={colors.textTertiary} />
                  <Text style={styles.emptyTitle}>No notifications</Text>
                  <Text style={styles.emptySubtitle}>
                    You're all caught up!
                  </Text>
                </View>
              ) : (
                notifications.map((notif) => (
                  <NotificationRow
                    key={notif.id}
                    notification={notif}
                    onPress={() => handleNotificationPress(notif.id)}
                  />
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.hive,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: '50%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  panelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  panelTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  countBadge: {
    backgroundColor: colors.hive,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceOverlay,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionButtonText: {
    color: colors.info,
    fontSize: 12,
    fontWeight: '600',
  },
  actionButtonTextMuted: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
  },
  notifList: {
    flex: 1,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  notifRowUnread: {
    backgroundColor: 'rgba(227,19,55,0.04)',
  },
  notifIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  notifContent: {
    flex: 1,
    gap: 3,
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notifTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  notifTitleUnread: {
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.hive,
    marginLeft: 8,
  },
  notifMessage: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  notifTime: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  emptySubtitle: {
    color: colors.textTertiary,
    fontSize: 13,
  },
});

export default NotificationCenter;
