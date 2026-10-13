import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Send,
  Download,
  ArrowUpDown,
  Landmark,
  Vote,
  Coins,
  TrendingUp,
  Gift,
  Fingerprint,
  X,
} from 'lucide-react-native';
import { PriceChart } from '../components/wallet/PriceChart';
import { colors } from '../theme';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useHive } from '../hooks/useHive';
import { useAccounts } from '../hooks/useAccounts';
import { useStore } from '../store';
import { broadcastClaimRewards } from '../core/hive/client';
import { isBiometricAvailable, enrollBiometric } from '../core/biometric';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ---------- Sub-components ----------

const BiometricBanner: React.FC<{
  visible: boolean;
  onEnable: () => void;
  onDismiss: () => void;
}> = ({ visible, onEnable, onDismiss }) => {
  if (!visible) return null;

  return (
    <Card variant="gradient" padding="md" style={styles.biometricBanner}>
      <View style={styles.biometricBannerContent}>
        <View style={styles.biometricBannerIcon}>
          <Fingerprint size={22} color={colors.hive} />
        </View>
        <View style={styles.biometricBannerText}>
          <Text style={styles.biometricTitle}>Enable Biometric Unlock</Text>
          <Text style={styles.biometricSubtitle}>
            Use Face ID or fingerprint for faster access
          </Text>
        </View>
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>
      <Button
        variant="primary"
        size="sm"
        onPress={onEnable}
        style={styles.biometricButton}
      >
        Enable
      </Button>
    </Card>
  );
};

const BalanceCard: React.FC<{
  totalUsd: string;
  hive: string;
  hbd: string;
  priceChange24h: number;
}> = ({ totalUsd, hive, hbd, priceChange24h }) => {
  const isPositive = priceChange24h >= 0;
  return (
    <Card variant="gradient" padding="lg" style={styles.balanceCard}>
      <Text style={styles.balanceLabel}>Total Balance</Text>
      <Text style={styles.balanceAmount}>{totalUsd}</Text>
      <View style={styles.balanceRow}>
        <View style={styles.balanceToken}>
          <Text style={styles.tokenAmount}>{hive}</Text>
          <Badge variant="hive">HIVE</Badge>
        </View>
        <View style={styles.balanceToken}>
          <Text style={styles.tokenAmount}>{hbd}</Text>
          <Badge>HBD</Badge>
        </View>
      </View>
      <View style={styles.changeRow}>
        <TrendingUp size={14} color={isPositive ? colors.success : colors.error} />
        <Text style={[styles.changeText, { color: isPositive ? colors.success : colors.error }]}>
          {isPositive ? '+' : ''}{priceChange24h.toFixed(2)}% (24h)
        </Text>
      </View>
    </Card>
  );
};

interface ActionItem {
  icon: React.ElementType;
  label: string;
  route: string;
  color: string;
}

const ACTIONS: ActionItem[] = [
  { icon: Send, label: 'Send', route: 'Send', color: colors.hive },
  { icon: Download, label: 'Receive', route: 'Receive', color: colors.coral },
  { icon: ArrowUpDown, label: 'Swap', route: 'Swap', color: colors.info },
  {
    icon: Landmark,
    label: 'Staking',
    route: 'Staking',
    color: colors.success,
  },
  {
    icon: Vote,
    label: 'Governance',
    route: 'Governance',
    color: colors.warning,
  },
  { icon: Coins, label: 'Tokens', route: 'Tokens', color: colors.coralLight },
];

const ActionButtons: React.FC = () => {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.actionsGrid}>
      {ACTIONS.map((action) => (
        <TouchableOpacity
          key={action.label}
          style={styles.actionItem}
          onPress={() => navigation.navigate(action.route)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.actionIcon,
              { backgroundColor: `${action.color}20` },
            ]}
          >
            <action.icon size={20} color={action.color} />
          </View>
          <Text style={styles.actionLabel}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const RewardsBanner: React.FC<{
  pending: boolean;
  rewardHive: string;
  rewardHbd: string;
  rewardHp: string;
  onClaim: () => void;
  claiming: boolean;
}> = ({ pending, rewardHive, rewardHbd, rewardHp, onClaim, claiming }) => {
  if (!pending) return null;

  return (
    <Card variant="elevated" padding="md" style={styles.rewardsBanner}>
      <View style={styles.rewardsContent}>
        <View style={styles.rewardsIconContainer}>
          <Gift size={20} color={colors.warning} />
        </View>
        <View style={styles.rewardsText}>
          <Text style={styles.rewardsTitle}>Pending Rewards</Text>
          <Text style={styles.rewardsSubtitle}>
            {rewardHive} HIVE, {rewardHbd} HBD, {rewardHp} HP
          </Text>
        </View>
        <Button variant="primary" size="sm" onPress={onClaim} loading={claiming} disabled={claiming}>
          Claim
        </Button>
      </View>
    </Card>
  );
};

const ResourceBar: React.FC<{
  votingPower: number;
  resourceCredits: number;
}> = ({ votingPower, resourceCredits }) => (
  <Card variant="default" padding="md">
    <Text style={styles.resourceTitle}>Resources</Text>
    <View style={styles.resourceRow}>
      <View style={styles.resourceItem}>
        <Text style={styles.resourceLabel}>Voting Power</Text>
        <View style={styles.resourceBarTrack}>
          <View
            style={[
              styles.resourceBarFill,
              { width: `${Math.min(votingPower, 100)}%`, backgroundColor: colors.success },
            ]}
          />
        </View>
        <Text style={styles.resourceValue}>{votingPower.toFixed(1)}%</Text>
      </View>
      <View style={styles.resourceItem}>
        <Text style={styles.resourceLabel}>Resource Credits</Text>
        <View style={styles.resourceBarTrack}>
          <View
            style={[
              styles.resourceBarFill,
              { width: `${Math.min(resourceCredits, 100)}%`, backgroundColor: colors.info },
            ]}
          />
        </View>
        <Text style={styles.resourceValue}>{resourceCredits.toFixed(1)}%</Text>
      </View>
    </View>
  </Card>
);

// ---------- Main Screen ----------

export const DashboardScreen: React.FC = () => {
  const { balances, rewards, resources, hivePriceUsd, formatNumber, formatUsd, refreshAccountData } = useHive();
  const { activeAccountName, activeAccountData, getDecryptedKey } = useAccounts();
  const refreshPrices = useStore((s) => s.refreshPrices);
  const priceChange24h = useStore((s) => s.priceChange24h);
  const password = useStore((s) => s.password);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const addToast = useStore((s) => s.addToast);

  const [refreshing, setRefreshing] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [showBiometricBanner, setShowBiometricBanner] = useState(!settings.biometricEnabled);

  const hasPendingRewards = rewards.hive > 0 || rewards.hbd > 0 || rewards.hp > 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshAccountData(), refreshPrices()]);
    } catch {
      // errors handled inside the store actions
    } finally {
      setRefreshing(false);
    }
  }, [refreshAccountData, refreshPrices]);

  const handleEnableBiometrics = useCallback(async () => {
    if (!password) {
      addToast({ type: 'error', message: 'Wallet must be unlocked to enable biometrics.' });
      return;
    }
    const available = await isBiometricAvailable();
    if (!available) {
      addToast({ type: 'info', message: 'Biometric authentication is not available on this device.' });
      setShowBiometricBanner(false);
      return;
    }
    const success = await enrollBiometric(password);
    if (success) {
      await updateSettings({ biometricEnabled: true });
      addToast({ type: 'success', message: 'Biometric unlock enabled!' });
    } else {
      addToast({ type: 'error', message: 'Biometric enrollment cancelled or failed.' });
    }
    setShowBiometricBanner(false);
  }, [password, addToast, updateSettings]);

  const handleClaimRewards = useCallback(async () => {
    if (!activeAccountName || !activeAccountData) return;

    setClaiming(true);
    try {
      const postingKey = await getDecryptedKey('posting');
      if (!postingKey) {
        addToast({ type: 'error', message: 'Posting key not available. Please add it in Settings.' });
        return;
      }

      const rewardHive = String(activeAccountData.reward_hive_balance || '0.000 HIVE');
      const rewardHbd = String(activeAccountData.reward_hbd_balance || '0.000 HBD');
      const rewardVests = String(activeAccountData.reward_vesting_balance || '0.000000 VESTS');

      await broadcastClaimRewards(
        activeAccountName,
        rewardHive,
        rewardHbd,
        rewardVests,
        postingKey,
      );

      addToast({ type: 'success', message: 'Rewards claimed successfully!' });
      await refreshAccountData();
    } catch (err: any) {
      addToast({ type: 'error', message: err?.message || 'Failed to claim rewards.' });
    } finally {
      setClaiming(false);
    }
  }, [activeAccountName, activeAccountData, getDecryptedKey, addToast, refreshAccountData]);

  return (
    <View style={styles.container}>
      <Header />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.hive}
            colors={[colors.hive]}
          />
        }
      >
        <BiometricBanner
          visible={showBiometricBanner}
          onEnable={handleEnableBiometrics}
          onDismiss={() => setShowBiometricBanner(false)}
        />

        <BalanceCard
          totalUsd={formatUsd(balances.totalUsd)}
          hive={formatNumber(balances.hive)}
          hbd={formatNumber(balances.hbd)}
          priceChange24h={priceChange24h}
        />
        <ActionButtons />

        <RewardsBanner
          pending={hasPendingRewards}
          rewardHive={formatNumber(rewards.hive)}
          rewardHbd={formatNumber(rewards.hbd)}
          rewardHp={formatNumber(rewards.hp)}
          onClaim={handleClaimRewards}
          claiming={claiming}
        />

        <ResourceBar
          votingPower={resources.votingPower}
          resourceCredits={resources.resourceCredits}
        />

        <PriceChart currentPrice={hivePriceUsd} />

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  // Biometric Banner
  biometricBanner: {
    overflow: 'visible',
  },
  biometricBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  biometricBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(227,19,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricBannerText: {
    flex: 1,
  },
  biometricTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  biometricSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  biometricButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },

  // Balance Card
  balanceCard: {
    overflow: 'visible',
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
    marginBottom: 12,
  },
  balanceRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 12,
  },
  balanceToken: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tokenAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
  },

  // Action Buttons
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  actionItem: {
    width: (SCREEN_WIDTH - 32 - 24) / 3,
    alignItems: 'center',
    gap: 6,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  // Rewards Banner
  rewardsBanner: {
    overflow: 'visible',
  },
  rewardsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rewardsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,209,102,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardsText: {
    flex: 1,
  },
  rewardsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rewardsSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Resource Bar
  resourceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 14,
  },
  resourceRow: {
    gap: 14,
  },
  resourceItem: {
    gap: 6,
  },
  resourceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  resourceBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  resourceBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  resourceValue: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    alignSelf: 'flex-end',
  },

});

export default DashboardScreen;
