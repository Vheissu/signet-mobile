import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  Send,
  ArrowUp,
  ArrowDown,
  ArrowRightLeft,
  TrendingUp,
  TrendingDown,
} from 'lucide-react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '../theme';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { useStore } from '../store';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import {
  getTokenPrice,
  buildTransferPayload,
  buildStakePayload,
  buildUnstakePayload,
  buildDelegatePayload,
  HE_ID,
} from '../core/hive-engine/api';
import { broadcastCustomJson } from '../core/hive/client';
import { useAccounts } from '../hooks/useAccounts';
import { logger } from '../core/logger';
import { isValidHiveUsername, sanitizeUsername } from '../core/validation';
import { fetchTokenPriceHistory, formatTick, percentChange, type PricePoint } from '../core/prices';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 64;
const CHART_HEIGHT = 160;

type ActionType = 'transfer' | 'stake' | 'unstake' | 'delegate' | null;

const TokenDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const addToast = useStore((s) => s.addToast);
  const activeAccountName = useStore((s) => s.activeAccountName);
  const hivePriceUsd = useStore((s) => s.hivePriceUsd);
  const { getDecryptedKey } = useAccounts();

  // Get token data from route params (passed from TokensScreen)
  const symbol = route.params?.symbol ?? 'BEE';
  const tokenParam = route.params?.token;

  const token = useMemo(
    () => ({
      symbol,
      name: tokenParam?.name ?? symbol,
      price: tokenParam?.price ?? 0,
      change24h: 0,
      balance: tokenParam?.balance ?? '0',
      stake: tokenParam?.stake ?? '0',
      pendingUnstake: tokenParam?.pendingUnstake ?? '0',
      delegationsIn: tokenParam?.delegationsIn ?? '0',
      delegationsOut: tokenParam?.delegationsOut ?? '0',
      usdValue: tokenParam?.usdValue ?? 0,
    }),
    [symbol, tokenParam],
  );

  const [activeAction, setActiveAction] = useState<ActionType>(null);
  const [actionAmount, setActionAmount] = useState('');
  const [actionRecipient, setActionRecipient] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [chartData, setChartData] = useState<PricePoint[]>([]);
  const [historyStatus, setHistoryStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [currentPrice, setCurrentPrice] = useState(token.price);

  // Real daily closes from the Hive Engine market history
  useEffect(() => {
    let cancelled = false;
    setHistoryStatus('loading');

    getTokenPrice(symbol)
      .then((price) => {
        if (!cancelled && price > 0) setCurrentPrice(price);
      })
      .catch((err) => logger.warn('[TokenDetail] price unavailable:', err));

    fetchTokenPriceHistory(symbol, 30).then((points) => {
      if (cancelled) return;
      if (points === null) {
        setChartData([]);
        setHistoryStatus('error');
      } else if (points.length < 2) {
        setChartData([]);
        setHistoryStatus('empty');
      } else {
        setChartData(points);
        setHistoryStatus('ready');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const priceChange = historyStatus === 'ready' ? percentChange(chartData) : 0;

  // Chart path generation
  const chartPath = useMemo(() => {
    if (chartData.length < 2) return '';
    const values = chartData.map((p) => p.price);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;
    const t0 = chartData[0].time;
    const span = chartData[chartData.length - 1].time - t0 || 1;

    let path = '';
    chartData.forEach((point, i) => {
      const x = ((point.time - t0) / span) * CHART_WIDTH;
      const y = CHART_HEIGHT - ((point.price - minVal) / range) * (CHART_HEIGHT - 20);
      if (i === 0) {
        path += `M ${x} ${y}`;
      } else {
        const prev = chartData[i - 1];
        const prevX = ((prev.time - t0) / span) * CHART_WIDTH;
        const prevY = CHART_HEIGHT - ((prev.price - minVal) / range) * (CHART_HEIGHT - 20);
        const cpX = (prevX + x) / 2;
        path += ` C ${cpX} ${prevY} ${cpX} ${y} ${x} ${y}`;
      }
    });
    return path;
  }, [chartData]);

  const fillPath = useMemo(() => {
    if (!chartPath) return '';
    return `${chartPath} L ${CHART_WIDTH} ${CHART_HEIGHT} L 0 ${CHART_HEIGHT} Z`;
  }, [chartPath]);

  const displayPrice = currentPrice * (hivePriceUsd || 0);

  const handleAction = useCallback(async () => {
    if (actionLoading) return; // Prevent double-submit

    const amt = parseFloat(actionAmount);
    if (!actionAmount || isNaN(amt) || !isFinite(amt) || amt <= 0) {
      addToast({ type: 'error', message: 'Please enter a valid amount.' });
      return;
    }
    if (!activeAccountName) {
      addToast({ type: 'error', message: 'No active account.' });
      return;
    }

    setActionLoading(true);
    try {
      const activeKey = await getDecryptedKey('active');
      if (!activeKey) {
        addToast({ type: 'error', message: 'Active key is required for token operations. Please import it first.' });
        return;
      }

      let json: string;
      const quantity = amt.toFixed(tokenParam?.precision ?? 3);

      switch (activeAction) {
        case 'transfer': {
          const recipient = sanitizeUsername(actionRecipient);
          if (!recipient || !isValidHiveUsername(recipient)) {
            addToast({ type: 'error', message: 'Please enter a valid Hive username.' });
            return;
          }
          json = buildTransferPayload(symbol, recipient, quantity);
          break;
        }
        case 'stake':
          json = buildStakePayload(symbol, activeAccountName, quantity);
          break;
        case 'unstake':
          json = buildUnstakePayload(symbol, quantity);
          break;
        case 'delegate': {
          const delegatee = sanitizeUsername(actionRecipient);
          if (!delegatee || !isValidHiveUsername(delegatee)) {
            addToast({ type: 'error', message: 'Please enter a valid Hive username.' });
            return;
          }
          json = buildDelegatePayload(symbol, delegatee, quantity);
          break;
        }
        default:
          return;
      }

      await broadcastCustomJson(activeAccountName, HE_ID, json, true, activeKey);

      addToast({ type: 'success', message: `${activeAction} ${quantity} ${symbol} successful!` });
      setActiveAction(null);
      setActionAmount('');
      setActionRecipient('');
      navigation.goBack();
    } catch (err: any) {
      logger.error('[TokenDetail] Action failed:', err);
      addToast({ type: 'error', message: err.message || `Failed to ${activeAction} ${symbol}.` });
    } finally {
      setActionLoading(false);
    }
  }, [actionAmount, actionRecipient, activeAction, activeAccountName, symbol, getDecryptedKey, addToast, navigation, tokenParam]);

  const getActionTitle = () => {
    switch (activeAction) {
      case 'transfer':
        return `Transfer ${symbol}`;
      case 'stake':
        return `Stake ${symbol}`;
      case 'unstake':
        return `Unstake ${symbol}`;
      case 'delegate':
        return `Delegate ${symbol}`;
      default:
        return '';
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Token Details" />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Token Header */}
        <View style={styles.tokenHeader}>
          <View style={styles.tokenIconLarge}>
            <Text style={styles.tokenIconText}>{symbol.charAt(0)}</Text>
          </View>
          <View style={styles.tokenTitleCol}>
            <Text style={styles.tokenSymbol}>{symbol}</Text>
            <Text style={styles.tokenName}>{token.name}</Text>
          </View>
          <View style={styles.tokenPriceCol}>
            <Text style={styles.tokenPrice}>${displayPrice.toFixed(4)}</Text>
            <View
              style={[
                styles.changeRow,
                priceChange >= 0 ? styles.changeUp : styles.changeDown,
              ]}
            >
              {priceChange >= 0 ? (
                <TrendingUp size={12} color={colors.success} />
              ) : (
                <TrendingDown size={12} color={colors.error} />
              )}
              <Text
                style={[
                  styles.changeText,
                  {
                    color:
                      priceChange >= 0 ? colors.success : colors.error,
                  },
                ]}
              >
                {Math.abs(priceChange).toFixed(1)}%
              </Text>
            </View>
          </View>
        </View>

        {/* Price Chart */}
        <Card variant="default" padding="md" style={styles.chartCard}>
          <Text style={styles.chartTitle}>Price in HIVE, last 30 days</Text>
          <View style={styles.chartContainer}>
            {historyStatus === 'loading' ? (
              <View style={styles.chartPlaceholder}>
                <ActivityIndicator size="small" color={colors.textTertiary} />
              </View>
            ) : historyStatus === 'ready' ? (
              <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
                <Defs>
                  <LinearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={colors.hive} stopOpacity={0.3} />
                    <Stop offset="100%" stopColor={colors.hive} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                {fillPath && (
                  <Path d={fillPath} fill="url(#chartGradient)" />
                )}
                {chartPath && (
                  <Path
                    d={chartPath}
                    fill="none"
                    stroke={colors.hive}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </Svg>
            ) : (
              <View style={styles.chartPlaceholder}>
                <Text style={styles.chartLabel}>
                  {historyStatus === 'empty'
                    ? `No market history for ${symbol}`
                    : 'Price history unavailable right now'}
                </Text>
              </View>
            )}
          </View>
          {historyStatus === 'ready' && (
            <View style={styles.chartFooter}>
              <Text style={styles.chartLabel}>{formatTick(chartData[0].time, 'days')}</Text>
              <Text style={styles.chartLabel}>{formatTick(chartData[chartData.length - 1].time, 'days')}</Text>
            </View>
          )}
        </Card>

        {/* Balance Cards Grid */}
        <View style={styles.balanceGrid}>
          <Card variant="default" padding="md" style={styles.balanceGridCard}>
            <Text style={styles.gridLabel}>Balance</Text>
            <Text style={styles.gridValue}>{token.balance}</Text>
            <Text style={styles.gridSub}>{symbol}</Text>
          </Card>
          <Card variant="default" padding="md" style={styles.balanceGridCard}>
            <Text style={styles.gridLabel}>Staked</Text>
            <Text style={styles.gridValue}>{token.stake}</Text>
            <Text style={styles.gridSub}>{symbol}</Text>
          </Card>
          <Card variant="default" padding="md" style={styles.balanceGridCard}>
            <Text style={styles.gridLabel}>Delegated In</Text>
            <Text style={styles.gridValue}>{token.delegationsIn}</Text>
            <Text style={styles.gridSub}>{symbol}</Text>
          </Card>
          <Card variant="default" padding="md" style={styles.balanceGridCard}>
            <Text style={styles.gridLabel}>Delegated Out</Text>
            <Text style={styles.gridValue}>{token.delegationsOut}</Text>
            <Text style={styles.gridSub}>{symbol}</Text>
          </Card>
        </View>

        {/* Total Value Card */}
        <Card variant="gradient" padding="md" style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total Value</Text>
          <Text style={styles.totalValue}>${token.usdValue.toFixed(2)}</Text>
          <Text style={styles.totalSub}>
            {token.balance} + {token.stake} staked
          </Text>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setActiveAction('transfer')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(99,179,237,0.12)' }]}>
              <Send size={18} color={colors.info} />
            </View>
            <Text style={styles.actionLabel}>Transfer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setActiveAction('stake')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(92,234,160,0.12)' }]}>
              <ArrowUp size={18} color={colors.success} />
            </View>
            <Text style={styles.actionLabel}>Stake</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setActiveAction('unstake')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(255,209,102,0.12)' }]}>
              <ArrowDown size={18} color={colors.warning} />
            </View>
            <Text style={styles.actionLabel}>Unstake</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setActiveAction('delegate')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(244,132,95,0.12)' }]}>
              <ArrowRightLeft size={18} color={colors.coral} />
            </View>
            <Text style={styles.actionLabel}>Delegate</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Action Modal */}
      <Modal
        visible={activeAction !== null}
        onClose={() => {
          setActiveAction(null);
          setActionAmount('');
          setActionRecipient('');
        }}
        title={getActionTitle()}
      >
        <View style={styles.modalContent}>
          {(activeAction === 'transfer' || activeAction === 'delegate') && (
            <>
              <Input
                label="Recipient"
                placeholder="username"
                value={actionRecipient}
                onChangeText={setActionRecipient}
                autoCapitalize="none"
                autoCorrect={false}
                leftIcon={
                  <Text style={styles.atSymbol}>@</Text>
                }
              />
              <View style={styles.modalSpacer} />
            </>
          )}

          <Input
            label="Amount"
            placeholder="0.000"
            value={actionAmount}
            onChangeText={setActionAmount}
            keyboardType="decimal-pad"
            rightElement={
              <View style={styles.inputRight}>
                <Text style={styles.inputCurrency}>{symbol}</Text>
                <TouchableOpacity
                  onPress={() => {
                    const maxVal = activeAction === 'unstake' ? token.stake : token.balance;
                    setActionAmount(maxVal.replace(/,/g, ''));
                  }}
                  style={styles.maxButton}
                >
                  <Text style={styles.maxText}>MAX</Text>
                </TouchableOpacity>
              </View>
            }
          />

          <Text style={styles.modalHint}>
            Available: {activeAction === 'unstake' ? token.stake : token.balance}{' '}
            {symbol}
          </Text>

          <View style={styles.modalSpacer} />

          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={actionLoading}
            onPress={handleAction}
            disabled={!actionAmount || parseFloat(actionAmount) <= 0}
          >
            {getActionTitle()}
          </Button>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  // Token Header
  tokenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tokenIconLarge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.surfaceOverlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenIconText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tokenTitleCol: {
    flex: 1,
    gap: 2,
  },
  tokenSymbol: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tokenName: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  tokenPriceCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  tokenPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  changeUp: {
    backgroundColor: 'rgba(92,234,160,0.1)',
  },
  changeDown: {
    backgroundColor: 'rgba(239,71,111,0.1)',
  },
  changeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  // Chart
  chartCard: {
    gap: 8,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chartContainer: {
    alignItems: 'center',
    paddingTop: 8,
  },
  chartFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartPlaceholder: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartLabel: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  // Balance Grid
  balanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  balanceGridCard: {
    width: (SCREEN_WIDTH - 42) / 2,
    gap: 2,
  },
  gridLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  gridValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  gridSub: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  // Total Value Card
  totalCard: {
    gap: 4,
  },
  totalLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  totalValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  totalSub: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  // Action Buttons
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  // Modal
  modalContent: {
    gap: 4,
  },
  modalSpacer: {
    height: 12,
  },
  atSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  inputRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputCurrency: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  maxButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(227,19,55,0.15)',
    borderRadius: 6,
  },
  maxText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.hive,
  },
  modalHint: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 6,
  },
});

export default TokenDetailScreen;
