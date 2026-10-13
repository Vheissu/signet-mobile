import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import {
  Clock,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Repeat,
  Zap,
  Users,
  Gift,
  Landmark,
} from 'lucide-react-native';
import { colors } from '../theme';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { Avatar } from '../components/ui/Avatar';
import { useStore } from '../store';
import { getAccountHistoryPage } from '../core/hive/client';
import { decodeMemo, isEncryptedMemo } from '../core/crypto/hive-keys';
import { useAccounts } from '../hooks/useAccounts';
import { Button } from '../components/ui/Button';
import { Lock } from 'lucide-react-native';
import { vestsToHP, parseAmount } from '../core/hive/operations';
import type { TransactionRecord } from '../core/types';
import { logger } from '../core/logger';

// ---------- Types ----------

type FilterType =
  | 'all'
  | 'transfers'
  | 'tokens'
  | 'power'
  | 'delegation'
  | 'rewards'
  | 'savings';

interface FilterOption {
  key: FilterType;
  label: string;
  icon: React.ElementType;
}

const FILTERS: FilterOption[] = [
  { key: 'all', label: 'All', icon: Clock },
  { key: 'transfers', label: 'Transfers', icon: ArrowUpRight },
  { key: 'tokens', label: 'Tokens', icon: Repeat },
  { key: 'power', label: 'Power', icon: Zap },
  { key: 'delegation', label: 'Delegation', icon: Users },
  { key: 'rewards', label: 'Rewards', icon: Gift },
  { key: 'savings', label: 'Savings', icon: Landmark },
];

// ---------- Helpers ----------

const getTransactionMeta = (tx: TransactionRecord, currentUsername: string) => {
  const isSent = tx.from === currentUsername && tx.to !== currentUsername;

  switch (tx.type) {
    case 'transfer':
      return {
        icon: isSent ? ArrowUpRight : ArrowDownLeft,
        color: isSent ? colors.error : colors.success,
        label: isSent ? 'Sent' : 'Received',
        filter: 'transfers' as FilterType,
      };
    case 'claim_reward_balance':
    case 'curation_reward':
    case 'author_reward':
    case 'producer_reward':
      return {
        icon: Gift,
        color: colors.warning,
        label: tx.type === 'claim_reward_balance'
          ? 'Reward Claimed'
          : tx.type === 'curation_reward'
          ? 'Curation Reward'
          : tx.type === 'author_reward'
          ? 'Author Reward'
          : 'Producer Reward',
        filter: 'rewards' as FilterType,
      };
    case 'transfer_to_vesting':
      return {
        icon: Zap,
        color: colors.info,
        label: 'Power Up',
        filter: 'power' as FilterType,
      };
    case 'withdraw_vesting':
      return {
        icon: Zap,
        color: colors.info,
        label: 'Power Down',
        filter: 'power' as FilterType,
      };
    case 'delegate_vesting_shares':
      return {
        icon: Users,
        color: colors.coral,
        label: 'Delegation',
        filter: 'delegation' as FilterType,
      };
    case 'transfer_to_savings':
    case 'transfer_from_savings':
      return {
        icon: Landmark,
        color: colors.success,
        label: tx.type === 'transfer_to_savings' ? 'To Savings' : 'From Savings',
        filter: 'savings' as FilterType,
      };
    case 'he_transfer':
    case 'he_stake':
    case 'he_unstake':
    case 'he_delegate':
    case 'he_undelegate':
    case 'he_market_buy':
    case 'he_market_sell':
    case 'he_other':
      return {
        icon: Repeat,
        color: colors.textSecondary,
        label: tx.type.replace(/^he_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        filter: 'tokens' as FilterType,
      };
    case 'fill_convert_request':
    case 'fill_order':
    case 'convert':
    case 'collateralized_convert':
      return {
        icon: Repeat,
        color: colors.textSecondary,
        label:
          tx.type === 'fill_convert_request'
            ? 'Conversion Complete'
            : tx.type === 'fill_order'
            ? 'Order Filled'
            : tx.type === 'convert'
            ? 'Convert HBD'
            : 'Convert HIVE',
        filter: 'tokens' as FilterType,
      };
    case 'interest':
      return {
        icon: Landmark,
        color: colors.success,
        label: 'Savings Interest',
        filter: 'savings' as FilterType,
      };
    case 'fill_transfer_from_savings':
      return {
        icon: Landmark,
        color: colors.success,
        label: 'Savings Withdrawal',
        filter: 'savings' as FilterType,
      };
    case 'fill_vesting_withdraw':
      return {
        icon: Zap,
        color: colors.info,
        label: 'Power Down Payment',
        filter: 'power' as FilterType,
      };
    case 'recurrent_transfer':
    case 'fill_recurrent_transfer':
      return {
        icon: isSent ? ArrowUpRight : ArrowDownLeft,
        color: isSent ? colors.error : colors.success,
        label: tx.type === 'recurrent_transfer' ? 'Recurring Transfer Set' : isSent ? 'Recurring Sent' : 'Recurring Received',
        filter: 'transfers' as FilterType,
      };
    default:
      return {
        icon: Repeat,
        color: colors.textSecondary,
        label: tx.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        filter: 'tokens' as FilterType,
      };
  }
};

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) {
    const mins = Math.floor(diffMs / (1000 * 60));
    return `${mins}m ago`;
  }
  if (diffHours < 24) {
    return `${Math.floor(diffHours)}h ago`;
  }
  if (diffHours < 48) {
    return 'Yesterday';
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

// ---------- Sub-components ----------

const FilterPills: React.FC<{
  active: FilterType;
  onSelect: (f: FilterType) => void;
}> = ({ active, onSelect }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.filterScroll}
    style={styles.filterContainer}
  >
    {FILTERS.map((filter) => {
      const isActive = filter.key === active;
      return (
        <TouchableOpacity
          key={filter.key}
          style={[styles.filterPill, isActive && styles.filterPillActive]}
          onPress={() => onSelect(filter.key)}
          activeOpacity={0.7}
        >
          <filter.icon
            size={14}
            color={isActive ? colors.hive : colors.textTertiary}
          />
          <Text
            style={[
              styles.filterPillText,
              isActive && styles.filterPillTextActive,
            ]}
          >
            {filter.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </ScrollView>
);

const REWARD_TYPES = new Set([
  'curation_reward',
  'author_reward',
  'producer_reward',
  'claim_reward_balance',
  'interest',
]);

const PAGE_SIZE = 300;

/**
 * Format an amount string, converting any VESTS components to HP.
 */
function formatDisplayAmount(
  amount: string,
  globalProperties: any,
): string {
  if (!amount) return '';

  // Handle compound amounts like "0.145 HIVE + 236.985722 VESTS"
  const parts = amount.split('+').map((p) => p.trim());
  const formatted = parts.map((part) => {
    const parsed = parseAmount(part);
    if (parsed.currency === 'VESTS' && globalProperties) {
      const hp = vestsToHP(parsed.amount, globalProperties);
      return `${hp.toFixed(3)} HP`;
    }
    return part;
  });

  return formatted.filter((p) => {
    // Filter out zero-value parts
    const num = parseFloat(p);
    return isNaN(num) || num !== 0;
  }).join(' + ');
}

const TransactionItem: React.FC<{
  item: TransactionRecord;
  currentUsername: string;
  globalProperties: any;
  decryptedMemo?: string;
  onDecryptMemo?: (tx: TransactionRecord) => void;
}> = ({ item, currentUsername, globalProperties, decryptedMemo, onDecryptMemo }) => {
  const meta = getTransactionMeta(item, currentUsername);
  const Icon = meta.icon;
  const isReward = REWARD_TYPES.has(item.type);
  const isSent = !isReward && item.from === currentUsername && item.to !== currentUsername;
  const otherParty = isSent ? item.to : item.from;

  const displayAmount = item.amount ? formatDisplayAmount(item.amount, globalProperties) : '';
  const encrypted = isEncryptedMemo(item.memo) && !decryptedMemo;
  const memoText = decryptedMemo || item.memo || '';

  // Only show memos that look like human-written text (not hashes, permlinks, or UUIDs)
  const showMemo = !encrypted
    && memoText.length > 0
    && !memoText.match(/^[a-f0-9-]{20,}/i)
    && !memoText.match(/^re-[a-z]/)
    && !memoText.match(/^[a-z0-9-]+$/)
    && memoText.includes(' ');

  return (
    <View style={styles.txItem}>
      <View
        style={[styles.txIcon, { backgroundColor: `${meta.color}15` }]}
      >
        <Icon size={18} color={meta.color} />
      </View>

      <View style={styles.txDetails}>
        <View style={styles.txTopRow}>
          <Text style={styles.txLabel}>{meta.label}</Text>
          {displayAmount ? (
            <Text
              style={[
                styles.txAmount,
                { color: isReward ? colors.success : isSent ? colors.error : colors.success },
              ]}
              numberOfLines={1}
            >
              {isReward ? '+' : isSent ? '-' : '+'}
              {displayAmount}
            </Text>
          ) : null}
        </View>
        <View style={styles.txBottomRow}>
          <Text style={styles.txParty} numberOfLines={1}>
            {isReward
              ? `@${item.from}`
              : otherParty
              ? isSent
                ? `To @${otherParty}`
                : `From @${otherParty}`
              : item.from
              ? `@${item.from}`
              : ''}
          </Text>
          <Text style={styles.txTime}>{formatTimestamp(item.timestamp)}</Text>
        </View>
        {showMemo ? (
          <Text style={styles.txMemo} numberOfLines={1}>
            {memoText}
          </Text>
        ) : null}
        {encrypted ? (
          <TouchableOpacity style={styles.memoLock} onPress={() => onDecryptMemo?.(item)} activeOpacity={0.7}>
            <Lock size={11} color={colors.textTertiary} />
            <Text style={styles.memoLockText}>Encrypted memo, tap to read</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const EmptyState: React.FC = () => (
  <View style={styles.emptyState}>
    <View style={styles.emptyIcon}>
      <Clock size={40} color={colors.textTertiary} />
    </View>
    <Text style={styles.emptyTitle}>No Transactions</Text>
    <Text style={styles.emptySubtitle}>
      Your transaction history will appear here
    </Text>
  </View>
);

const LoadingState: React.FC = () => (
  <View style={styles.loadingState}>
    <Spinner size="lg" />
    <Text style={styles.loadingText}>Loading transactions...</Text>
  </View>
);

// ---------- Main Screen ----------

export const HistoryScreen: React.FC = () => {
  const activeAccountName = useStore((s) => s.activeAccountName);
  const globalProperties = useStore((s) => s.globalProperties);
  const addToast = useStore((s) => s.addToast);
  const { getDecryptedKey } = useAccounts();

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [oldestIndex, setOldestIndex] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [decryptedMemos, setDecryptedMemos] = useState<Record<string, string>>({});

  const currentUsername = activeAccountName || '';

  const fetchTransactions = useCallback(async () => {
    if (!activeAccountName) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    try {
      const page = await getAccountHistoryPage(activeAccountName, -1, PAGE_SIZE);
      setTransactions(page.records);
      setOldestIndex(page.oldestIndex);
      setHasMore(page.hasMore);
      setDecryptedMemos({});
    } catch (err: any) {
      logger.error('[HistoryScreen] Failed to fetch transactions:', err);
      addToast({
        type: 'error',
        message: 'Failed to load transaction history',
      });
    } finally {
      setLoading(false);
    }
  }, [activeAccountName, addToast]);

  const loadMore = useCallback(async () => {
    if (!activeAccountName || !hasMore || loadingMore || oldestIndex <= 0) return;
    setLoadingMore(true);
    try {
      const page = await getAccountHistoryPage(activeAccountName, oldestIndex - 1, PAGE_SIZE);
      setTransactions((prev) => [...prev, ...page.records]);
      setOldestIndex(page.oldestIndex);
      setHasMore(page.hasMore);
    } catch (err) {
      logger.error('[HistoryScreen] Failed to load older history:', err);
      addToast({ type: 'error', message: 'Failed to load older activity' });
    } finally {
      setLoadingMore(false);
    }
  }, [activeAccountName, hasMore, loadingMore, oldestIndex, addToast]);

  const decryptMemo = useCallback(
    async (tx: TransactionRecord) => {
      if (!tx.memo) return;
      const key = await getDecryptedKey('memo');
      if (!key) {
        addToast({ type: 'info', message: 'Add your memo key in Settings to read encrypted memos.' });
        return;
      }
      try {
        const text = decodeMemo(tx.memo, key);
        setDecryptedMemos((prev) => ({ ...prev, [`${tx.id}_${tx.block}`]: text }));
      } catch {
        addToast({ type: 'error', message: 'This memo was not encrypted for your memo key.' });
      }
    },
    [getDecryptedKey, addToast],
  );

  // Fetch on mount and when active account changes
  useEffect(() => {
    setLoading(true);
    fetchTransactions();
  }, [fetchTransactions]);

  const filteredTransactions = useMemo(() => {
    if (activeFilter === 'all') return transactions;

    return transactions.filter((tx) => {
      const meta = getTransactionMeta(tx, currentUsername);
      return meta.filter === activeFilter;
    });
  }, [transactions, activeFilter, currentUsername]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTransactions();
    setRefreshing(false);
  }, [fetchTransactions]);

  const renderItem = useCallback(
    ({ item }: { item: TransactionRecord }) => (
      <TransactionItem
        item={item}
        currentUsername={currentUsername}
        globalProperties={globalProperties}
        decryptedMemo={decryptedMemos[`${item.id}_${item.block}`]}
        onDecryptMemo={decryptMemo}
      />
    ),
    [currentUsername, globalProperties, decryptedMemos, decryptMemo],
  );

  const keyExtractor = useCallback(
    (item: TransactionRecord, index: number) => `${item.id}_${index}`,
    [],
  );

  return (
    <View style={styles.container}>
      <Header />

      {/* History header bar */}
      <View style={styles.historyHeader}>
        <View style={styles.historyHeaderLeft}>
          <Text style={styles.historyTitle}>History</Text>
          <Badge>{filteredTransactions.length} transactions</Badge>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
          activeOpacity={0.7}
        >
          <RefreshCw size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Filter Pills */}
      <FilterPills active={activeFilter} onSelect={setActiveFilter} />

      {/* Transaction List */}
      {loading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={filteredTransactions}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={EmptyState}
          ListFooterComponent={
            hasMore ? (
              <View style={styles.loadMore}>
                <Button variant="secondary" size="md" fullWidth loading={loadingMore} onPress={loadMore}>
                  Load older activity
                </Button>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.hive}
              colors={[colors.hive]}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // History header
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  historyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Filter pills
  filterContainer: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterScroll: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 6,
    alignItems: 'center',
    paddingBottom: 10,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: 'rgba(227,19,55,0.1)',
    borderColor: 'rgba(227,19,55,0.3)',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    flexShrink: 0,
  },
  filterPillTextActive: {
    color: colors.hive,
  },

  // Transaction list
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
    flexGrow: 1,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 48,
  },
  txItem: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
  },
  txIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txDetails: {
    flex: 1,
  },
  txTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  txLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  txBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txParty: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
    marginRight: 8,
  },
  txTime: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  txMemo: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  memoLock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  memoLockText: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  loadMore: {
    paddingTop: 12,
    paddingBottom: 8,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Loading state
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingBottom: 60,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },

});

export default HistoryScreen;
