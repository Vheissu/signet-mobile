import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Search,
  TrendingUp,
  TrendingDown,
  Coins,
  ChevronRight,
  RefreshCw,
} from 'lucide-react-native';
import { colors } from '../theme';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { useStore } from '../store';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { getFullTokenData, getMarketMetrics } from '../core/hive-engine/api';
import type { HiveEngineToken } from '../core/types';
import type { HEBalance, HEToken } from '../core/hive-engine/api';
import { logger } from '../core/logger';

interface FullTokenEntry {
  balance: HEBalance;
  token: HEToken | null;
  price: number;
  valueHive: number;
}

interface PriceTick {
  symbol: string;
  price: number;
  change: number;
}

const TokensScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const activeAccountName = useStore((s) => s.activeAccountName);
  const hivePriceUsd = useStore((s) => s.hivePriceUsd);

  const [searchQuery, setSearchQuery] = useState('');
  const [tokenData, setTokenData] = useState<FullTokenEntry[]>([]);
  const [tickers, setTickers] = useState<PriceTick[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTokens = useCallback(async (isRefresh = false) => {
    if (!activeAccountName) {
      setLoading(false);
      return;
    }
    if (!isRefresh) setLoading(true);

    try {
      const data = await getFullTokenData(activeAccountName);
      setTokenData(data);

      // Build tickers from the top tokens by value
      const topSymbols = data.slice(0, 6).map((d) => d.balance.symbol);
      if (topSymbols.length > 0) {
        try {
          const metrics = await getMarketMetrics(topSymbols);
          setTickers(
            metrics.map((m) => ({
              symbol: m.symbol,
              price: parseFloat(m.lastPrice) * (hivePriceUsd || 1),
              change: parseFloat(m.priceChangePercent || '0'),
            })),
          );
        } catch (err) {
          logger.warn('[Signet] Failed to fetch ticker data:', err);
        }
      }
    } catch (err) {
      logger.error('[TokensScreen] Failed to load token data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeAccountName, hivePriceUsd]);

  // Load on mount and when account changes
  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTokens(true);
  }, [loadTokens]);

  // Map FullTokenEntry to HiveEngineToken for display
  const tokens: HiveEngineToken[] = useMemo(() => {
    return tokenData.map((entry) => {
      const bal = entry.balance;
      const tok = entry.token;
      const totalBalance = parseFloat(bal.balance) + parseFloat(bal.stake || '0');
      const usdValue = entry.valueHive * (hivePriceUsd || 0);

      return {
        symbol: bal.symbol,
        name: tok?.name ?? bal.symbol,
        balance: bal.balance,
        stake: parseFloat(bal.stake || '0') > 0 ? bal.stake : undefined,
        pendingUnstake: bal.pendingUnstake,
        delegationsIn: bal.delegationsIn,
        delegationsOut: bal.delegationsOut,
        usdValue,
        icon: tok?.metadata?.icon,
        precision: tok?.precision ?? 3,
      };
    });
  }, [tokenData, hivePriceUsd]);

  const filteredTokens = useMemo(() => {
    if (!searchQuery.trim()) return tokens;
    const query = searchQuery.toLowerCase();
    return tokens.filter(
      (t) =>
        t.symbol.toLowerCase().includes(query) ||
        t.name.toLowerCase().includes(query),
    );
  }, [tokens, searchQuery]);

  const totalValue = useMemo(() => {
    return tokens.reduce((sum, t) => sum + (t.usdValue ?? 0), 0);
  }, [tokens]);

  const handleTokenPress = useCallback(
    (token: HiveEngineToken) => {
      // Find the full entry to pass along
      const entry = tokenData.find((e) => e.balance.symbol === token.symbol);
      navigation.navigate('TokenDetail', {
        symbol: token.symbol,
        token: {
          symbol: token.symbol,
          name: token.name,
          price: entry?.price ?? 0,
          balance: token.balance,
          stake: token.stake ?? '0',
          pendingUnstake: token.pendingUnstake ?? '0',
          delegationsIn: token.delegationsIn ?? '0',
          delegationsOut: token.delegationsOut ?? '0',
          usdValue: token.usdValue ?? 0,
          precision: token.precision,
        },
      });
    },
    [navigation, tokenData],
  );

  const renderToken = ({ item }: { item: HiveEngineToken }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => handleTokenPress(item)}
    >
      <Card variant="default" padding="md" style={styles.tokenCard}>
        <View style={styles.tokenRow}>
          {/* Token Icon */}
          <View style={styles.tokenIcon}>
            <Text style={styles.tokenIconText}>
              {item.symbol.charAt(0)}
            </Text>
          </View>

          {/* Token Info */}
          <View style={styles.tokenInfo}>
            <View style={styles.tokenNameRow}>
              <Text style={styles.tokenSymbol}>{item.symbol}</Text>
              {item.stake && (
                <Badge variant="default">Stakeable</Badge>
              )}
            </View>
            <Text style={styles.tokenName} numberOfLines={1}>
              {item.name}
            </Text>
          </View>

          {/* Token Balance */}
          <View style={styles.tokenBalanceCol}>
            <Text style={styles.tokenBalance}>{item.balance}</Text>
            {item.usdValue !== undefined && (
              <Text style={styles.tokenUsd}>
                ${item.usdValue.toFixed(2)}
              </Text>
            )}
          </View>

          <ChevronRight size={16} color={colors.textTertiary} />
        </View>
      </Card>
    </TouchableOpacity>
  );

  const ListHeader = () => (
    <View style={styles.listHeader}>
      {/* Horizontal Price Ticker */}
      {tickers.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tickerContainer}
        >
          {tickers.map((tick) => (
            <View key={tick.symbol} style={styles.tickItem}>
              <Text style={styles.tickSymbol}>{tick.symbol}</Text>
              <Text style={styles.tickPrice}>${tick.price.toFixed(3)}</Text>
              <View
                style={[
                  styles.tickChange,
                  tick.change >= 0 ? styles.tickChangeUp : styles.tickChangeDown,
                ]}
              >
                {tick.change >= 0 ? (
                  <TrendingUp size={10} color={colors.success} />
                ) : (
                  <TrendingDown size={10} color={colors.error} />
                )}
                <Text
                  style={[
                    styles.tickChangeText,
                    { color: tick.change >= 0 ? colors.success : colors.error },
                  ]}
                >
                  {Math.abs(tick.change).toFixed(1)}%
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Total Value */}
      <Card variant="gradient" padding="md" style={styles.totalCard}>
        <View style={styles.totalRow}>
          <View>
            <Text style={styles.totalLabel}>Total Token Value</Text>
            <Text style={styles.totalValue}>${totalValue.toFixed(2)}</Text>
          </View>
          <View style={styles.totalIcon}>
            <Coins size={24} color={colors.hive} />
          </View>
        </View>
      </Card>

      {/* Search */}
      <Input
        placeholder="Search tokens..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        leftIcon={<Search size={16} color={colors.textTertiary} />}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* Token count */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {filteredTokens.length} token{filteredTokens.length !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.emptyState}>
      {loading ? (
        <ActivityIndicator size="large" color={colors.hive} />
      ) : (
        <>
          <Coins size={48} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No Tokens Found</Text>
          <Text style={styles.emptyText}>
            {searchQuery
              ? `No tokens matching "${searchQuery}"`
              : 'You don\'t have any Hive Engine tokens yet.'}
          </Text>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="Tokens" />

      <FlatList
        data={loading ? [] : filteredTokens}
        keyExtractor={(item) => item.symbol}
        renderItem={renderToken}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.hive}
            colors={[colors.hive]}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 10,
  },
  listHeader: {
    gap: 14,
    marginBottom: 6,
  },
  // Price Ticker
  tickerContainer: {
    gap: 10,
    paddingVertical: 4,
  },
  tickItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 2,
    marginRight: 8,
  },
  tickSymbol: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tickPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tickChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tickChangeUp: {
    backgroundColor: 'rgba(92,234,160,0.1)',
  },
  tickChangeDown: {
    backgroundColor: 'rgba(239,71,111,0.1)',
  },
  tickChangeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  // Total Card
  totalCard: {},
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  totalIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(227,19,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Count
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  // Token Card
  tokenCard: {},
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tokenIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceOverlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenIconText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tokenInfo: {
    flex: 1,
    gap: 2,
  },
  tokenNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tokenSymbol: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tokenName: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  tokenBalanceCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  tokenBalance: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  tokenUsd: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 18,
  },
});

export default TokensScreen;
