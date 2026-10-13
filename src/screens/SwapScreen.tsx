import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronLeft,
  ArrowDownUp,
  Clock,
  Info,
  RefreshCw,
} from 'lucide-react-native';
import { colors } from '../theme';
import { useStore } from '../store';
import { useHive } from '../hooks/useHive';
import { useAccounts } from '../hooks/useAccounts';
import {
  broadcastConvert,
  broadcastCollateralizedConvert,
  getCurrentMedianHistoryPrice,
} from '../core/hive/client';
import { parseAmount } from '../core/hive/operations';
import { logger } from '../core/logger';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { validateAmount } from '../core/validation';

type SwapDirection = 'hiveToHbd' | 'hbdToHive';

const SwapScreen: React.FC = () => {
  const navigation = useNavigation();
  const addToast = useStore((s) => s.addToast);
  const { balances, formatNumber, refreshAccountData } = useHive();
  const { activeAccountName, getDecryptedKey } = useAccounts();

  const [direction, setDirection] = useState<SwapDirection>('hiveToHbd');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // HBD per HIVE from the witness median price feed, which is what the
  // conversion actually settles against (not the exchange price).
  const [medianPrice, setMedianPrice] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getCurrentMedianHistoryPrice()
      .then((price: any) => {
        if (cancelled) return;
        const base = parseAmount(String(price.base)).amount; // HBD
        const quote = parseAmount(String(price.quote)).amount; // HIVE
        if (base > 0 && quote > 0) setMedianPrice(base / quote);
      })
      .catch((e) => logger.warn('[Swap] median price unavailable:', e));
    return () => {
      cancelled = true;
    };
  }, []);

  const hiveBalance = formatNumber(balances.hive);
  const hbdBalance = formatNumber(balances.hbd);
  const hivePrice = medianPrice;

  const fromCurrency = direction === 'hiveToHbd' ? 'HIVE' : 'HBD';
  const toCurrency = direction === 'hiveToHbd' ? 'HBD' : 'HIVE';
  const fromBalance = direction === 'hiveToHbd' ? hiveBalance : hbdBalance;

  const estimatedOutput = useMemo(() => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0 || hivePrice <= 0) return '0.000';
    if (direction === 'hiveToHbd') {
      // Collateralized convert: HBD is issued up front for roughly half the
      // collateral's value at 5% under the median; the rest of the HIVE
      // comes back after 3.5 days.
      return ((parsed * hivePrice * 0.95) / 2).toFixed(3);
    }
    return (parsed / hivePrice).toFixed(3);
  }, [amount, direction, hivePrice]);

  const toggleDirection = useCallback(() => {
    setDirection((prev) =>
      prev === 'hiveToHbd' ? 'hbdToHive' : 'hiveToHbd',
    );
    setAmount('');
  }, []);

  const handleConvert = useCallback(async () => {
    if (submitted || loading) return; // Prevent double-submit

    const rawBalance = direction === 'hiveToHbd' ? balances.hive : balances.hbd;
    const amountCheck = validateAmount(amount, rawBalance);
    if (!amountCheck.valid) {
      Alert.alert('Invalid Amount', amountCheck.error);
      return;
    }

    if (!activeAccountName) {
      Alert.alert('Error', 'No active account found.');
      return;
    }

    setLoading(true);
    try {
      const activeKey = await getDecryptedKey('active');
      if (!activeKey) {
        Alert.alert('Error', 'Active key not found. Please add your active key in account settings.');
        return;
      }

      const precision = 3;

      if (direction === 'hbdToHive') {
        // HBD -> HIVE: standard convert operation
        const amountStr = `${parseFloat(amount).toFixed(precision)} HBD`;
        await broadcastConvert(activeAccountName, amountStr, activeKey);
        addToast({
          type: 'success',
          message: `Converting ${amountStr} to HIVE (~3.5 days)`,
        });
      } else {
        // HIVE -> HBD: collateralized convert operation
        const amountStr = `${parseFloat(amount).toFixed(precision)} HIVE`;
        await broadcastCollateralizedConvert(activeAccountName, amountStr, activeKey);
        addToast({
          type: 'success',
          message: `Converting ${amountStr} to HBD (~3.5 days)`,
        });
      }

      setSubmitted(true);
      setAmount('');
      await refreshAccountData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Conversion failed');
    } finally {
      setLoading(false);
    }
  }, [amount, direction, activeAccountName, getDecryptedKey, refreshAccountData, addToast]);

  const handleMax = useCallback(() => {
    const rawBalance = direction === 'hiveToHbd' ? balances.hive : balances.hbd;
    setAmount(rawBalance.toFixed(3));
  }, [direction, balances]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Convert</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* From Card */}
          <View style={styles.swapSection}>
            <Text style={styles.sectionLabel}>FROM</Text>
            <Card variant="elevated" padding="lg" style={styles.swapCard}>
              <View style={styles.swapCardHeader}>
                <View style={styles.currencyBadge}>
                  <Text style={styles.currencySymbol}>{fromCurrency}</Text>
                </View>
                <Text style={styles.balanceText}>
                  Balance: {fromBalance}
                </Text>
              </View>
              <Input
                placeholder="0.000"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                rightElement={
                  <TouchableOpacity onPress={handleMax} style={styles.maxButton}>
                    <Text style={styles.maxText}>MAX</Text>
                  </TouchableOpacity>
                }
              />
            </Card>
          </View>

          {/* Swap Direction Button */}
          <View style={styles.swapButtonWrapper}>
            <TouchableOpacity
              onPress={toggleDirection}
              style={styles.swapDirectionButton}
              activeOpacity={0.7}
            >
              <ArrowDownUp size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.swapDivider} />
          </View>

          {/* To Card */}
          <View style={styles.swapSection}>
            <Text style={styles.sectionLabel}>TO (ESTIMATED)</Text>
            <Card variant="default" padding="lg" style={styles.swapCard}>
              <View style={styles.swapCardHeader}>
                <View style={styles.currencyBadge}>
                  <Text style={styles.currencySymbol}>{toCurrency}</Text>
                </View>
                <Text style={styles.balanceText}>
                  Balance:{' '}
                  {direction === 'hiveToHbd' ? hbdBalance : hiveBalance}
                </Text>
              </View>
              <View style={styles.estimatedOutput}>
                <Text style={styles.estimatedValue}>{estimatedOutput}</Text>
                <Text style={styles.estimatedCurrency}>{toCurrency}</Text>
              </View>
            </Card>
          </View>

          {/* Rate Info */}
          {amount && parseFloat(amount) > 0 && hivePrice > 0 && (
            <Card variant="default" padding="sm" style={styles.rateCard}>
              <View style={styles.rateRow}>
                <RefreshCw size={14} color={colors.textTertiary} />
                <Text style={styles.rateText}>
                  1 {fromCurrency} ={' '}
                  {direction === 'hiveToHbd'
                    ? hivePrice.toFixed(3)
                    : (1 / hivePrice).toFixed(3)}{' '}
                  {toCurrency}
                </Text>
              </View>
            </Card>
          )}

          {/* Conversion Info */}
          <Card variant="default" padding="md" style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Clock size={16} color={colors.warning} />
              <Text style={styles.infoTitle}>3.5 Day Conversion</Text>
            </View>
            <Text style={styles.infoText}>
              Conversions settle against the witness median price feed, not
              an exchange, and take about 3.5 days. The estimate uses the
              current feed; the final amount depends on the feed at settlement.
            </Text>
            <View style={styles.infoBullets}>
              <View style={styles.infoBullet}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>
                  HIVE to HBD locks your HIVE as collateral and pays out about half its value in HBD now; the unused collateral returns after 3.5 days
                </Text>
              </View>
              <View style={styles.infoBullet}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>
                  HBD to HIVE uses the 3.5 day median price
                </Text>
              </View>
              <View style={styles.infoBullet}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>
                  Conversion cannot be cancelled once initiated
                </Text>
              </View>
            </View>
          </Card>

          {/* Warning */}
          <Card variant="default" padding="sm" style={styles.warningCard}>
            <View style={styles.warningRow}>
              <Info size={14} color={colors.warning} />
              <Text style={styles.warningText}>
                For a quick swap at market price, trade on an exchange or the
                internal market instead. Conversion is for moving between HIVE
                and HBD without an order book.
              </Text>
            </View>
          </Card>

          {/* Convert Button */}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            onPress={handleConvert}
            disabled={!amount || parseFloat(amount) <= 0}
            icon={<ArrowDownUp size={18} color="#FFFFFF" />}
          >
            Convert {fromCurrency} to {toCurrency}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerRight: {
    width: 36,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  swapSection: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  swapCard: {
    gap: 12,
  },
  swapCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  currencyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surfaceOverlay,
    borderRadius: 10,
  },
  currencySymbol: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  balanceText: {
    fontSize: 12,
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
  swapButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -8,
    zIndex: 1,
  },
  swapDirectionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapDivider: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 1,
    backgroundColor: colors.border,
    zIndex: -1,
  },
  estimatedOutput: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingVertical: 8,
  },
  estimatedValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  estimatedCurrency: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  rateCard: {},
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rateText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  infoCard: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  infoBullets: {
    gap: 6,
    paddingTop: 4,
  },
  infoBullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textTertiary,
    marginTop: 6,
  },
  bulletText: {
    fontSize: 12,
    color: colors.textTertiary,
    flex: 1,
    lineHeight: 16,
  },
  warningCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,209,102,0.2)',
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  warningText: {
    fontSize: 12,
    color: colors.warning,
    flex: 1,
    lineHeight: 16,
  },
});

export default SwapScreen;
