import React, { useState, useCallback } from 'react';
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
  ArrowDownToLine,
  ArrowUpFromLine,
  PiggyBank,
  TrendingUp,
  Clock,
  Info,
  ChevronDown,
} from 'lucide-react-native';
import { colors } from '../theme';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { useStore } from '../store';
import { useHive } from '../hooks/useHive';
import { useAccounts } from '../hooks/useAccounts';
import {
  broadcastTransferToSavings,
  broadcastTransferFromSavings,
} from '../core/hive/client';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';

type SavingsTab = 'deposit' | 'withdraw';
type Currency = 'HIVE' | 'HBD';

const SavingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const addToast = useStore((s) => s.addToast);
  const { balances, formatNumber, refreshAccountData, globalProperties } = useHive();
  const { activeAccountName, getDecryptedKey } = useAccounts();

  // The chain publishes the HBD savings rate in basis points (median of witness votes).
  const hbdApr = globalProperties ? Number((globalProperties as any).hbd_interest_rate || 0) / 100 : null;
  const aprLabel = hbdApr === null ? '–' : `${hbdApr.toFixed(hbdApr % 1 === 0 ? 0 : 2)}%`;

  const [activeTab, setActiveTab] = useState<SavingsTab>('deposit');
  const [currency, setCurrency] = useState<Currency>('HBD');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  const hiveBalance = formatNumber(balances.hive);
  const hbdBalance = formatNumber(balances.hbd);
  const hiveSavings = formatNumber(balances.savingsHive);
  const hbdSavings = formatNumber(balances.savingsHbd);

  const handleSubmit = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
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
      const amountStr = `${parseFloat(amount).toFixed(precision)} ${currency}`;

      if (activeTab === 'deposit') {
        await broadcastTransferToSavings(
          activeAccountName,
          activeAccountName,
          amountStr,
          '',
          activeKey,
        );
        addToast({ type: 'success', message: `Deposited ${amountStr} to savings` });
      } else {
        const requestId = Math.floor(Math.random() * 2 ** 32);
        await broadcastTransferFromSavings(
          activeAccountName,
          requestId,
          activeAccountName,
          amountStr,
          '',
          activeKey,
        );
        addToast({ type: 'success', message: `Withdrawal of ${amountStr} initiated (3-day wait)` });
      }

      setAmount('');
      await refreshAccountData();
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  }, [amount, activeTab, currency, activeAccountName, getDecryptedKey, refreshAccountData, addToast, navigation]);

  const getAvailableBalance = () => {
    if (activeTab === 'deposit') {
      return currency === 'HIVE' ? hiveBalance : hbdBalance;
    }
    return currency === 'HIVE' ? hiveSavings : hbdSavings;
  };

  const getAvailableBalanceRaw = () => {
    if (activeTab === 'deposit') {
      return currency === 'HIVE' ? balances.hive : balances.hbd;
    }
    return currency === 'HIVE' ? balances.savingsHive : balances.savingsHbd;
  };

  const handleMax = useCallback(() => {
    const bal = getAvailableBalanceRaw();
    setAmount(bal.toFixed(3));
  }, [activeTab, currency, balances]);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Savings" />

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
          {/* Tab Switcher */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'deposit' && styles.tabActive,
              ]}
              onPress={() => {
                setActiveTab('deposit');
                setAmount('');
              }}
            >
              <ArrowDownToLine
                size={16}
                color={
                  activeTab === 'deposit'
                    ? colors.textPrimary
                    : colors.textTertiary
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'deposit' && styles.tabTextActive,
                ]}
              >
                Deposit
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'withdraw' && styles.tabActive,
              ]}
              onPress={() => {
                setActiveTab('withdraw');
                setAmount('');
              }}
            >
              <ArrowUpFromLine
                size={16}
                color={
                  activeTab === 'withdraw'
                    ? colors.textPrimary
                    : colors.textTertiary
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'withdraw' && styles.tabTextActive,
                ]}
              >
                Withdraw
              </Text>
            </TouchableOpacity>
          </View>

          {/* Savings Balance Cards */}
          <View style={styles.balanceRow}>
            <Card variant="default" padding="md" style={styles.balanceCard}>
              <View style={styles.balanceHeaderRow}>
                <PiggyBank size={16} color={colors.coral} />
                <Text style={styles.balanceLabel}>HIVE Savings</Text>
              </View>
              <Text style={styles.balanceValue}>{hiveSavings}</Text>
              <Text style={styles.balanceSub}>HIVE</Text>
            </Card>

            <Card variant="gradient" padding="md" style={styles.balanceCard}>
              <View style={styles.balanceHeaderRow}>
                <PiggyBank size={16} color={colors.success} />
                <Text style={styles.balanceLabel}>HBD Savings</Text>
                <Badge variant="success">{aprLabel} APR</Badge>
              </View>
              <Text style={styles.balanceValue}>{hbdSavings}</Text>
              <Text style={styles.balanceSub}>HBD</Text>
            </Card>
          </View>

          {/* HBD APR Info */}
          <Card variant="default" padding="sm" style={styles.aprCard}>
            <View style={styles.aprRow}>
              <TrendingUp size={14} color={colors.success} />
              <Text style={styles.aprText}>
                HBD savings earn <Text style={styles.aprHighlight}>{aprLabel} APR</Text>, paid monthly, set by witness vote
              </Text>
            </View>
          </Card>

          {/* Currency Selector */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionLabel}>CURRENCY</Text>
            <View style={styles.currencyRow}>
              <TouchableOpacity
                style={[
                  styles.currencyBtn,
                  currency === 'HIVE' && styles.currencyBtnActive,
                ]}
                onPress={() => {
                  setCurrency('HIVE');
                  setAmount('');
                }}
              >
                <Text
                  style={[
                    styles.currencyBtnText,
                    currency === 'HIVE' && styles.currencyBtnTextActive,
                  ]}
                >
                  HIVE
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.currencyBtn,
                  currency === 'HBD' && styles.currencyBtnActive,
                ]}
                onPress={() => {
                  setCurrency('HBD');
                  setAmount('');
                }}
              >
                <Text
                  style={[
                    styles.currencyBtnText,
                    currency === 'HBD' && styles.currencyBtnTextActive,
                  ]}
                >
                  HBD
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Amount Input */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionLabel}>
              {activeTab === 'deposit' ? 'AMOUNT TO DEPOSIT' : 'AMOUNT TO WITHDRAW'}
            </Text>
            <Input
              placeholder="0.000"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              rightElement={
                <View style={styles.inputRight}>
                  <Text style={styles.currencyLabel}>{currency}</Text>
                  <TouchableOpacity onPress={handleMax} style={styles.maxButton}>
                    <Text style={styles.maxText}>MAX</Text>
                  </TouchableOpacity>
                </View>
              }
            />
            <Text style={styles.inputHint}>
              Available: {getAvailableBalance()} {currency}
            </Text>
          </View>

          {/* Info Cards */}
          {activeTab === 'deposit' ? (
            <Card variant="default" padding="md" style={styles.infoCard}>
              <View style={styles.infoHeaderRow}>
                <Info size={16} color={colors.info} />
                <Text style={styles.infoTitle}>Deposit Info</Text>
              </View>
              <Text style={styles.infoText}>
                Deposits to savings are instant. Your tokens are safely stored
                and can be withdrawn with a 3-day waiting period.
              </Text>
              {currency === 'HBD' && (
                <View style={styles.infoHighlight}>
                  <TrendingUp size={14} color={colors.success} />
                  <Text style={styles.infoHighlightText}>
                    HBD savings earn {aprLabel} annual interest, paid monthly.
                  </Text>
                </View>
              )}
            </Card>
          ) : (
            <Card variant="default" padding="md" style={styles.infoCard}>
              <View style={styles.infoHeaderRow}>
                <Clock size={16} color={colors.warning} />
                <Text style={styles.infoTitle}>Withdrawal Info</Text>
              </View>
              <Text style={styles.infoText}>
                Withdrawals from savings require a 3-day waiting period for
                security. After 3 days, the funds will be available in your
                liquid balance.
              </Text>
              <View style={styles.infoHighlight}>
                <Info size={14} color={colors.warning} />
                <Text style={[styles.infoHighlightText, { color: colors.warning }]}>
                  You can cancel a pending withdrawal at any time.
                </Text>
              </View>
            </Card>
          )}

          {/* Submit Button */}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            onPress={handleSubmit}
            disabled={!amount || parseFloat(amount) <= 0}
            icon={
              activeTab === 'deposit' ? (
                <ArrowDownToLine size={18} color="#FFFFFF" />
              ) : (
                <ArrowUpFromLine size={18} color="#FFFFFF" />
              )
            }
          >
            {activeTab === 'deposit'
              ? `Deposit ${currency}`
              : `Withdraw ${currency}`}
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 11,
    gap: 6,
  },
  tabActive: {
    backgroundColor: colors.surfaceElevated,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  tabTextActive: {
    color: colors.textPrimary,
  },
  balanceRow: {
    gap: 12,
  },
  balanceCard: {
    gap: 4,
  },
  balanceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    flex: 1,
  },
  balanceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  balanceSub: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  aprCard: {
    flexDirection: 'row',
  },
  aprRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aprText: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  aprHighlight: {
    fontWeight: '700',
    color: colors.success,
  },
  inputSection: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  currencyRow: {
    flexDirection: 'row',
    gap: 10,
  },
  currencyBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  currencyBtnActive: {
    backgroundColor: 'rgba(227,19,55,0.1)',
    borderColor: 'rgba(227,19,55,0.3)',
  },
  currencyBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  currencyBtnTextActive: {
    color: colors.hive,
  },
  inputRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencyLabel: {
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
  inputHint: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  infoCard: {
    gap: 8,
  },
  infoHeaderRow: {
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
  infoHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  infoHighlightText: {
    fontSize: 13,
    color: colors.success,
    flex: 1,
    lineHeight: 18,
  },
});

export default SavingsScreen;
