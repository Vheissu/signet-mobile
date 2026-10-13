import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Image,
} from 'react-native';
import {
  ChevronDown,
  RefreshCw,
  Bell,
  Settings,
  Lock,
  Plus,
  Check,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme';
import { useStore } from '../../store';
import { logger } from '../../core/logger';
import { NotificationCenter } from '../wallet/NotificationCenter';
import { useNotifications } from '../../hooks/useNotifications';

const AccountAvatar: React.FC<{ username: string; size?: number }> = ({
  username,
  size = 32,
}) => {
  const [imgError, setImgError] = useState(false);
  const initial = (username || '?').charAt(0).toUpperCase();
  const imageUrl = `https://images.hive.blog/u/${username}/avatar/small`;

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      {!imgError ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setImgError(true)}
        />
      ) : (
        <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>
          {initial}
        </Text>
      )}
    </View>
  );
};

export const Header: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const accounts = useStore((s) => s.accounts);
  const activeAccountName = useStore((s) => s.activeAccountName);
  const setActiveAccount = useStore((s) => s.setActiveAccount);
  const refreshAccountData = useStore((s) => s.refreshAccountData);
  const refreshPrices = useStore((s) => s.refreshPrices);
  const lock = useStore((s) => s.lock);

  const {
    notifications,
    markRead: onMarkRead,
    markAllRead: onMarkAllRead,
    clearAll: onClearAll,
  } = useNotifications();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ).start();

    try {
      await Promise.all([refreshAccountData(), refreshPrices()]);
    } catch (err) {
      logger.warn('[Signet] Refresh failed:', err);
    }

    spinAnim.stopAnimation();
    spinAnim.setValue(0);
    setIsRefreshing(false);
  }, [refreshAccountData, refreshPrices, spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleSwitchAccount = useCallback(
    (username: string) => {
      setDropdownOpen(false);
      setActiveAccount(username);
    },
    [setActiveAccount],
  );

  const displayName = activeAccountName || 'Select';

  return (
    <>
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.accountSelector}
          onPress={() => setDropdownOpen(true)}
          activeOpacity={0.7}
        >
          {activeAccountName && (
            <AccountAvatar username={activeAccountName} size={32} />
          )}
          <Text style={styles.username} numberOfLines={1}>
            @{displayName}
          </Text>
          <ChevronDown size={14} color={colors.textTertiary} />
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleRefresh}
            activeOpacity={0.7}
          >
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <RefreshCw size={16} color={colors.textTertiary} />
            </Animated.View>
          </TouchableOpacity>

          <NotificationCenter
            notifications={notifications}
            onMarkAllRead={onMarkAllRead}
            onClearAll={onClearAll}
            onMarkRead={(id) => onMarkRead(id)}
          />

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.7}
          >
            <Settings size={16} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={lock}
            activeOpacity={0.7}
          >
            <Lock size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={dropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdownOpen(false)}
      >
        <Pressable
          style={[styles.overlay, { paddingTop: insets.top + 54 }]}
          onPress={() => setDropdownOpen(false)}
        >
          <View style={styles.dropdown}>
            <Text style={styles.dropdownTitle}>Accounts</Text>

            {accounts.map((account) => {
              const isActive = account.username === activeAccountName;
              return (
                <TouchableOpacity
                  key={account.username}
                  style={[
                    styles.dropdownItem,
                    isActive && styles.dropdownItemActive,
                  ]}
                  onPress={() => handleSwitchAccount(account.username)}
                  activeOpacity={0.7}
                >
                  <AccountAvatar username={account.username} size={28} />
                  <View style={styles.dropdownItemInfo}>
                    <Text style={styles.dropdownItemName}>
                      @{account.username}
                    </Text>
                    <Text style={styles.dropdownItemSub}>
                      {Object.keys(account.keys).filter(k => account.keys[k as keyof typeof account.keys]).length} keys
                    </Text>
                  </View>
                  {isActive && (
                    <Check size={16} color={colors.success} />
                  )}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.addAccountButton}
              onPress={() => {
                setDropdownOpen(false);
                navigation.navigate('AddAccount');
              }}
              activeOpacity={0.7}
            >
              <Plus size={18} color={colors.hive} />
              <Text style={styles.addAccountText}>Add Account</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  accountSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: {
    color: colors.hive,
    fontWeight: '700',
  },
  username: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
  },
  dropdown: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
  },
  dropdownTitle: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 10,
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(227,19,55,0.08)',
  },
  dropdownItemInfo: {
    flex: 1,
  },
  dropdownItemName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownItemSub: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: 1,
  },
  addAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
  },
  addAccountText: {
    color: colors.hive,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default Header;
