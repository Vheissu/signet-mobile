import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Layers,
  PiggyBank,
  Users,
  Award,
  ArrowLeftRight,
  HelpCircle,
  ExternalLink,
} from 'lucide-react-native';
import { colors } from '../../theme';
import { logger } from '../../core/logger';

interface TransactionRecord {
  id: string;
  type: string;
  timestamp: string;
  amount?: string;
  from?: string;
  to?: string;
  memo?: string;
  asset?: string;
}

interface TransactionItemProps {
  tx: TransactionRecord;
  currentUser: string;
}

interface TxDisplay {
  icon: React.FC<{ size: number; color: string }>;
  label: string;
  color: string;
  bgColor: string;
}

function getTxDisplay(
  type: string,
  tx: TransactionRecord,
  currentUser: string,
): TxDisplay {
  const isSender =
    tx.from?.toLowerCase() === currentUser.toLowerCase();

  switch (type) {
    case 'transfer':
      if (isSender) {
        return {
          icon: ArrowUpRight,
          label: 'Sent',
          color: colors.hive,
          bgColor: 'rgba(227,19,55,0.12)',
        };
      }
      return {
        icon: ArrowDownLeft,
        label: 'Received',
        color: colors.success,
        bgColor: 'rgba(92,234,160,0.12)',
      };

    case 'transfer_to_vesting':
    case 'power_up':
      return {
        icon: Layers,
        label: 'Power Up',
        color: colors.coral,
        bgColor: 'rgba(244,132,95,0.12)',
      };

    case 'withdraw_vesting':
    case 'power_down':
      return {
        icon: Layers,
        label: 'Power Down',
        color: colors.warning,
        bgColor: 'rgba(255,209,102,0.12)',
      };

    case 'transfer_to_savings':
      return {
        icon: PiggyBank,
        label: 'To Savings',
        color: colors.info,
        bgColor: 'rgba(99,179,237,0.12)',
      };

    case 'transfer_from_savings':
      return {
        icon: PiggyBank,
        label: 'From Savings',
        color: colors.info,
        bgColor: 'rgba(99,179,237,0.12)',
      };

    case 'delegate_vesting_shares':
      return {
        icon: Users,
        label: isSender ? 'Delegated' : 'Received Delegation',
        color: colors.warning,
        bgColor: 'rgba(255,209,102,0.12)',
      };

    case 'claim_reward_balance':
      return {
        icon: Award,
        label: 'Claim Rewards',
        color: colors.success,
        bgColor: 'rgba(92,234,160,0.12)',
      };

    case 'convert':
    case 'collateralized_convert':
      return {
        icon: ArrowLeftRight,
        label: 'Convert',
        color: colors.coralLight,
        bgColor: 'rgba(247,160,132,0.12)',
      };

    default:
      return {
        icon: HelpCircle,
        label: type.replace(/_/g, ' '),
        color: colors.textSecondary,
        bgColor: 'rgba(169,155,191,0.12)',
      };
  }
}

function getSubtitle(
  tx: TransactionRecord,
  currentUser: string,
): string {
  const isSender =
    tx.from?.toLowerCase() === currentUser.toLowerCase();

  if (tx.type === 'transfer') {
    if (isSender) {
      return `To @${tx.to || 'unknown'}`;
    }
    return `From @${tx.from || 'unknown'}`;
  }

  if (tx.type === 'delegate_vesting_shares') {
    if (isSender) {
      return `To @${tx.to || 'unknown'}`;
    }
    return `From @${tx.from || 'unknown'}`;
  }

  if (tx.type === 'claim_reward_balance') {
    return 'Claimed pending rewards';
  }

  if (tx.memo) {
    return tx.memo.length > 40
      ? tx.memo.substring(0, 40) + '...'
      : tx.memo;
  }

  return '';
}

function formatTimeAgo(timestamp: string): string {
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

function isNegativeAmount(
  tx: TransactionRecord,
  currentUser: string,
): boolean {
  const isSender =
    tx.from?.toLowerCase() === currentUser.toLowerCase();

  switch (tx.type) {
    case 'transfer':
    case 'transfer_to_vesting':
    case 'power_up':
    case 'transfer_to_savings':
    case 'delegate_vesting_shares':
      return isSender;
    case 'withdraw_vesting':
    case 'power_down':
      return true;
    default:
      return false;
  }
}

export const TransactionItem: React.FC<TransactionItemProps> = ({
  tx,
  currentUser,
}) => {
  const display = getTxDisplay(tx.type, tx, currentUser);
  const subtitle = getSubtitle(tx, currentUser);
  const timeAgo = formatTimeAgo(tx.timestamp);
  const negative = isNegativeAmount(tx, currentUser);
  const Icon = display.icon;

  const handleOpenExplorer = useCallback(() => {
    const url = `https://hivehub.dev/tx/${tx.id}`;
    Linking.openURL(url).catch((err) => {
      logger.warn('[Signet] Failed to open explorer URL:', err);
    });
  }, [tx.id]);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handleOpenExplorer}
      activeOpacity={0.7}
    >
      <View
        style={[styles.iconContainer, { backgroundColor: display.bgColor }]}
      >
        <Icon size={18} color={display.color} />
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.label} numberOfLines={1}>
            {display.label}
          </Text>
          {tx.amount && (
            <Text
              style={[
                styles.amount,
                negative ? styles.amountNegative : styles.amountPositive,
              ]}
            >
              {negative ? '-' : '+'}
              {tx.amount} {tx.asset || ''}
            </Text>
          )}
        </View>
        <View style={styles.bottomRow}>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
          <View style={styles.timeRow}>
            <Text style={styles.time}>{timeAgo}</Text>
            <ExternalLink size={10} color={colors.textTertiary} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  amount: {
    fontSize: 14,
    fontWeight: '700',
  },
  amountPositive: {
    color: colors.success,
  },
  amountNegative: {
    color: colors.hive,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    flex: 1,
    marginRight: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  time: {
    color: colors.textTertiary,
    fontSize: 11,
  },
});

export default TransactionItem;
