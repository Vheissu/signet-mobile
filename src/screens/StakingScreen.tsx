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
  ArrowUp,
  ArrowDown,
  Zap,
  Clock,
  Info,
  ChevronLeft,
} from 'lucide-react-native';
import { colors } from '../theme';
import { useStore } from '../store';
import { useHive } from '../hooks/useHive';
import { useAccounts } from '../hooks/useAccounts';
import {
  broadcastTransferToVesting,
  broadcastWithdrawVesting,
} from '../core/hive/client';
import { hpToVests, formatAmount } from '../core/hive/operations';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { validateAmount } from '../core/validation';

type StakingTab = 'powerUp' | 'powerDown';

const StakingScreen: React.FC = () => {
  const navigation = useNavigation();
  const addToast = useStore((s) => s.addToast);
  const { balances, formatNumber, globalProperties, refreshAccountData } = useHive();
  const { getDecryptedKey, activeAccountName } = useAccounts();

  const [activeTab, setActiveTab] = useState<StakingTab>('powerUp');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const hiveBalance = formatNumber(balances.hive);
  const hpBalance = formatNumber(balances.hp);

  const handleSubmit = useCallback(async () => {
    if (submitted || loading) return; // Prevent double-submit

    const maxBalance = activeTab === 'powerUp' ? balances.hive : balances.hp;
    const amountCheck = validateAmount(amount, maxBalance);
    if (!amountCheck.valid) {
      Alert.alert('Invalid Amount', amountCheck.error);
      return;
    }
    if (!activeAccountName) {
      Alert.alert('Error', 'No active account.');
      return;
    }

    setLoading(true);
    try {
      const activeKey = await getDecryptedKey('active');
      if (!activeKey) {
        Alert.alert('Error', 'Active key is required for this operation. Please import your active key.');
        return;
      }

      if (activeTab === 'powerUp') {
        const parsedAmount = amountCheck.amount;
        const amountStr = formatAmount(parsedAmount, 'HIVE');
        await broadcastTransferToVesting(activeAccountName, activeAccountName, amountStr, activeKey);
        addToast({ type: 'success', message: `Successfully powered up ${amountStr}` });
      } else {
        const parsedAmount = amountCheck.amount;
        if (!globalProperties) {
          Alert.alert('Error', 'Global properties not loaded. Please try again.');
          return;
        }
        const vests = hpToVests(parsedAmount, globalProperties);
        const vestsStr = formatAmount(vests, 'VESTS', 6);
        await broadcastWithdrawVesting(activeAccountName, vestsStr, activeKey);
        addToast({ type: 'success', message: `Power down initiated for ${formatAmount(parsedAmount, 'HP')}` });
      }

      setSubmitted(true);
      setAmount('');
      await refreshAccountData();
      navigation.goBack();
    } catch (e: any) {
      const msg = e.message || 'Transaction failed';
      addToast({ type: 'error', message: msg });
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }, [amount, activeTab, activeAccountName, balances, globalProperties, getDecryptedKey, addToast, refreshAccountData, navigation]);

  const handleMax = useCallback(() => {
    if (activeTab === 'powerUp') {
      setAmount(balances.hive.toFixed(3));
    } else {
      setAmount(balances.hp.toFixed(3));
    }
  }, [activeTab, balances]);

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
        <Text style={styles.headerTitle}>Staking</Text>
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
          {/* Tab Switcher */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'powerUp' && styles.tabActive,
              ]}
              onPress={() => {
                setActiveTab('powerUp');
                setAmount('');
              }}
            >
              <ArrowUp
                size={16}
                color={
                  activeTab === 'powerUp'
                    ? colors.textPrimary
                    : colors.textTertiary
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'powerUp' && styles.tabTextActive,
                ]}
              >
                Power Up
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'powerDown' && styles.tabActive,
              ]}
              onPress={() => {
                setActiveTab('powerDown');
                setAmount('');
              }}
            >
              <ArrowDown
                size={16}
                color={
                  activeTab === 'powerDown'
                    ? colors.textPrimary
                    : colors.textTertiary
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'powerDown' && styles.tabTextActive,
                ]}
              >
                Power Down
              </Text>
            </TouchableOpacity>
          </View>

          {/* Balance Cards */}
          <View style={styles.balanceRow}>
            <Card variant="default" padding="md" style={styles.balanceCard}>
              <View style={styles.balanceHeader}>
                <Zap size={16} color={colors.coral} />
                <Text style={styles.balanceLabel}>HIVE Balance</Text>
              </View>
              <Text style={styles.balanceValue}>{hiveBalance}</Text>
              <Text style={styles.balanceSub}>HIVE</Text>
            </Card>

            <Card variant="default" padding="md" style={styles.balanceCard}>
              <View style={styles.balanceHeader}>
                <Zap size={16} color={colors.hive} />
                <Text style={styles.balanceLabel}>Hive Power</Text>
              </View>
              <Text style={styles.balanceValue}>{hpBalance}</Text>
              <Text style={styles.balanceSub}>HP</Text>
            </Card>
          </View>

          {/* Amount Input */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionLabel}>
              {activeTab === 'powerUp' ? 'AMOUNT TO STAKE' : 'AMOUNT TO UNSTAKE'}
            </Text>
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
            <Text style={styles.inputHint}>
              Available:{' '}
              {activeTab === 'powerUp' ? `${hiveBalance} HIVE` : `${hpBalance} HP`}
            </Text>
          </View>

          {/* Info Cards */}
          {activeTab === 'powerUp' ? (
            <Card variant="default" padding="md" style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Zap size={16} color={colors.success} />
                <Text style={styles.infoTitle}>Power Up Benefits</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoText}>
                  Increased influence on content rewards
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoText}>
                  Higher curation rewards
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoText}>
                  More resource credits for transactions
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoText}>
                  Governance voting weight
                </Text>
              </View>
            </Card>
          ) : (
            <Card variant="default" padding="md" style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Clock size={16} color={colors.warning} />
                <Text style={styles.infoTitle}>Power Down Info</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoText}>
                  Power down takes 13 weeks to complete
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoText}>
                  1/13th is converted each week
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoText}>
                  You can cancel at any time
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Info size={14} color={colors.warning} />
                <Text style={[styles.infoText, { color: colors.warning }]}>
                  Reduces your voting influence
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
              activeTab === 'powerUp' ? (
                <ArrowUp size={18} color="#FFFFFF" />
              ) : (
                <ArrowDown size={18} color="#FFFFFF" />
              )
            }
          >
            {activeTab === 'powerUp' ? 'Power Up' : 'Start Power Down'}
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
    flexDirection: 'row',
    gap: 12,
  },
  balanceCard: {
    flex: 1,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  balanceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  balanceSub: {
    fontSize: 12,
    color: colors.textTertiary,
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
    gap: 10,
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
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});

export default StakingScreen;
