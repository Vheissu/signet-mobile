import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowRightLeft,
  Plus,
  Trash2,
  Zap,
  Users,
  Info,
} from 'lucide-react-native';
import { colors } from '../theme';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { useStore } from '../store';
import { useHive } from '../hooks/useHive';
import { useAccounts } from '../hooks/useAccounts';
import {
  getVestingDelegations,
  broadcastDelegateVestingShares,
  getAccount,
} from '../core/hive/client';
import { vestsToHP, hpToVests, formatAmount, parseAmount } from '../core/hive/operations';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import type { DelegationInfo } from '../core/types';
import { logger } from '../core/logger';
import { isValidHiveUsername, validateAmount, sanitizeUsername } from '../core/validation';

interface DelegationDisplay {
  delegatee: string;
  hp: string;
  vestingShares: string;
}

const DelegationScreen: React.FC = () => {
  const navigation = useNavigation();
  const addToast = useStore((s) => s.addToast);
  const { balances, formatNumber, globalProperties, refreshAccountData } = useHive();
  const { getDecryptedKey, activeAccountName } = useAccounts();

  const [delegations, setDelegations] = useState<DelegationDisplay[]>([]);
  const [delegatee, setDelegatee] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [loadingDelegations, setLoadingDelegations] = useState(true);

  const availableHP = formatNumber(balances.hp);

  // Compute total delegated out from delegation list
  const totalDelegatedOut = delegations.reduce((sum, d) => sum + parseFloat(d.hp), 0);
  const totalDelegatedOutStr = formatNumber(totalDelegatedOut);

  // Fetch real delegations from chain
  const fetchDelegations = useCallback(async () => {
    if (!activeAccountName || !globalProperties) return;

    setLoadingDelegations(true);
    try {
      const raw: DelegationInfo[] = await getVestingDelegations(activeAccountName);

      const mapped: DelegationDisplay[] = raw.map((d) => {
        const vests = parseAmount(d.vesting_shares).amount;
        const hp = vestsToHP(vests, globalProperties);
        return {
          delegatee: d.delegatee,
          hp: hp.toFixed(3),
          vestingShares: d.vesting_shares,
        };
      });

      setDelegations(mapped);
    } catch (e: any) {
      logger.error('[DelegationScreen] fetchDelegations error:', e);
      addToast({ type: 'error', message: 'Failed to load delegations.' });
    } finally {
      setLoadingDelegations(false);
    }
  }, [activeAccountName, globalProperties, addToast]);

  // Load delegations on mount and when globalProperties become available
  useEffect(() => {
    fetchDelegations();
  }, [fetchDelegations]);

  const handleDelegate = useCallback(async () => {
    if (loading) return; // Prevent double-submit

    const cleanDelegatee = sanitizeUsername(delegatee);
    if (!cleanDelegatee || !isValidHiveUsername(cleanDelegatee)) {
      Alert.alert('Error', 'Please enter a valid Hive username (3-16 chars, lowercase).');
      return;
    }

    const amountCheck = validateAmount(amount, balances.hp);
    if (!amountCheck.valid) {
      Alert.alert('Error', amountCheck.error);
      return;
    }

    if (!activeAccountName) {
      Alert.alert('Error', 'No active account.');
      return;
    }
    if (!globalProperties) {
      Alert.alert('Error', 'Global properties not loaded. Please try again.');
      return;
    }

    setLoading(true);
    try {
      const activeKey = await getDecryptedKey('active');
      if (!activeKey) {
        Alert.alert('Error', 'Active key is required for delegation. Please import your active key.');
        return;
      }

      // Validate delegatee account exists
      const delegateeAccount = await getAccount(cleanDelegatee);
      if (!delegateeAccount) {
        Alert.alert('Error', `Account @${cleanDelegatee} does not exist.`);
        return;
      }

      // Convert HP to VESTS
      const vests = hpToVests(amountCheck.amount, globalProperties);
      const vestsStr = formatAmount(vests, 'VESTS', 6);

      await broadcastDelegateVestingShares(activeAccountName, cleanDelegatee, vestsStr, activeKey);

      addToast({ type: 'success', message: `Delegated ${amount} HP to @${cleanDelegatee}` });
      setDelegatee('');
      setAmount('');

      // Refresh data
      await refreshAccountData();
      await fetchDelegations();
    } catch (e: any) {
      const msg = e.message || 'Delegation failed';
      addToast({ type: 'error', message: msg });
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }, [delegatee, amount, activeAccountName, globalProperties, balances, getDecryptedKey, addToast, refreshAccountData, fetchDelegations]);

  const handleRemove = useCallback(
    async (username: string) => {
      Alert.alert(
        'Remove Delegation',
        `Are you sure you want to remove your delegation to @${username}? This will take 5 days to complete.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              if (!activeAccountName) {
                Alert.alert('Error', 'No active account.');
                return;
              }

              setRemovingId(username);
              try {
                const activeKey = await getDecryptedKey('active');
                if (!activeKey) {
                  Alert.alert('Error', 'Active key is required to remove delegation. Please import your active key.');
                  return;
                }

                await broadcastDelegateVestingShares(
                  activeAccountName,
                  username,
                  '0.000000 VESTS',
                  activeKey,
                );

                addToast({ type: 'success', message: `Delegation to @${username} removed` });

                // Refresh data
                await refreshAccountData();
                await fetchDelegations();
              } catch (e: any) {
                const msg = e.message || 'Failed to remove delegation';
                addToast({ type: 'error', message: msg });
                Alert.alert('Error', msg);
              } finally {
                setRemovingId(null);
              }
            },
          },
        ],
      );
    },
    [activeAccountName, getDecryptedKey, addToast, refreshAccountData, fetchDelegations],
  );

  const renderDelegation = ({ item }: { item: DelegationDisplay }) => (
    <Card variant="default" padding="md" style={styles.delegationCard}>
      <View style={styles.delegationRow}>
        <Avatar username={item.delegatee} size="sm" />
        <View style={styles.delegationInfo}>
          <Text style={styles.delegationUsername}>@{item.delegatee}</Text>
          <Text style={styles.delegationHP}>{item.hp} HP</Text>
        </View>
        <TouchableOpacity
          onPress={() => handleRemove(item.delegatee)}
          style={styles.removeButton}
          disabled={removingId === item.delegatee}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {removingId === item.delegatee ? (
            <ActivityIndicator size="small" color={colors.error} />
          ) : (
            <Trash2 size={16} color={colors.error} />
          )}
        </TouchableOpacity>
      </View>
    </Card>
  );

  const ListHeader = () => (
    <View style={styles.listHeader}>
      {/* Balance Cards */}
      <View style={styles.balanceRow}>
        <Card variant="default" padding="md" style={styles.balanceCard}>
          <View style={styles.balanceIcon}>
            <Zap size={16} color={colors.success} />
          </View>
          <Text style={styles.balanceLabel}>Available HP</Text>
          <Text style={styles.balanceValue}>{availableHP}</Text>
          <Text style={styles.balanceSub}>Hive Power</Text>
        </Card>

        <Card variant="gradient" padding="md" style={styles.balanceCard}>
          <View style={styles.balanceIcon}>
            <ArrowRightLeft size={16} color={colors.coral} />
          </View>
          <Text style={styles.balanceLabel}>Delegated Out</Text>
          <Text style={styles.balanceValue}>{totalDelegatedOutStr}</Text>
          <Text style={styles.balanceSub}>HP</Text>
        </Card>
      </View>

      {/* Add Delegation Form */}
      <Card variant="elevated" padding="lg" style={styles.formCard}>
        <View style={styles.formHeader}>
          <Plus size={16} color={colors.hive} />
          <Text style={styles.formTitle}>New Delegation</Text>
        </View>

        <Input
          label="Delegate To"
          placeholder="username"
          value={delegatee}
          onChangeText={setDelegatee}
          autoCapitalize="none"
          autoCorrect={false}
          leftIcon={
            <Text style={styles.atSymbol}>@</Text>
          }
        />

        <View style={styles.formSpacer} />

        <Input
          label="Amount (HP)"
          placeholder="0.000"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          rightElement={
            <TouchableOpacity
              onPress={() => setAmount(balances.hp.toFixed(3))}
              style={styles.maxButton}
            >
              <Text style={styles.maxText}>MAX</Text>
            </TouchableOpacity>
          }
        />

        <View style={styles.formSpacer} />

        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          onPress={handleDelegate}
          disabled={!delegatee.trim() || !amount || parseFloat(amount) <= 0}
          icon={<ArrowRightLeft size={16} color="#FFFFFF" />}
        >
          Delegate HP
        </Button>
      </Card>

      {/* Info Card */}
      <Card variant="default" padding="md" style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Info size={16} color={colors.info} />
          <Text style={styles.infoTitle}>About Delegations</Text>
        </View>
        <Text style={styles.infoText}>
          Delegating HP gives another account your voting influence without
          transferring ownership. Removing a delegation takes 5 days to return.
        </Text>
      </Card>

      {/* Active Delegations Header */}
      <View style={styles.sectionHeader}>
        <Users size={16} color={colors.textSecondary} />
        <Text style={styles.sectionTitle}>Active Delegations</Text>
        <Badge variant="default">{delegations.length.toString()}</Badge>
      </View>
    </View>
  );

  const ListEmpty = () => {
    if (loadingDelegations) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.hive} />
          <Text style={styles.emptyTitle}>Loading delegations...</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <ArrowRightLeft size={40} color={colors.textTertiary} />
        <Text style={styles.emptyTitle}>No Active Delegations</Text>
        <Text style={styles.emptyText}>
          Delegate your Hive Power to support other accounts and projects.
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Delegation" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <FlatList
          data={delegations}
          keyExtractor={(item) => item.delegatee}
          renderItem={renderDelegation}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
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
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 10,
  },
  listHeader: {
    gap: 16,
    marginBottom: 6,
  },
  balanceRow: {
    flexDirection: 'row',
    gap: 12,
  },
  balanceCard: {
    flex: 1,
    gap: 4,
  },
  balanceIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.surfaceOverlay,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  balanceLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  balanceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  balanceSub: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  formCard: {
    gap: 4,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  formSpacer: {
    height: 12,
  },
  atSymbol: {
    fontSize: 16,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  delegationCard: {},
  delegationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  delegationInfo: {
    flex: 1,
    gap: 2,
  },
  delegationUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  delegationHP: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(239,71,111,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
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

export default DelegationScreen;
