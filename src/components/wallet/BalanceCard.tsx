import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../../theme';

interface BalanceCardProps {
  hiveBalance?: number;
  hbdBalance?: number;
  hpBalance?: number;
  hivePrice?: number;
  hbdPrice?: number;
  loading?: boolean;
}

const RING_SIZE = 100;
const STROKE_WIDTH = 10;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const DonutRing: React.FC<{ hivePercent: number }> = ({ hivePercent }) => {
  const hiveDash = (hivePercent / 100) * CIRCUMFERENCE;
  const hbdDash = CIRCUMFERENCE - hiveDash;

  return (
    <View style={styles.donutContainer}>
      <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
        {/* HBD segment (mint) */}
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          stroke={colors.success}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE}`}
          strokeLinecap="round"
          rotation={-90}
          origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
        />
        {/* HIVE segment (red) */}
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          stroke={colors.hive}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeDasharray={`${hiveDash} ${hbdDash}`}
          strokeLinecap="round"
          rotation={-90}
          origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
        />
      </Svg>
      <View style={styles.donutCenter}>
        <Text style={styles.donutPercent}>{Math.round(hivePercent)}%</Text>
        <Text style={styles.donutLabel}>HIVE</Text>
      </View>
    </View>
  );
};

const ShimmerBox: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => (
  <View
    style={[
      styles.shimmer,
      { width, height, borderRadius: height / 2 },
    ]}
  />
);

export const BalanceCard: React.FC<BalanceCardProps> = ({
  hiveBalance = 0,
  hbdBalance = 0,
  hpBalance = 0,
  hivePrice = 0,
  hbdPrice = 1,
  loading = false,
}) => {
  const { totalUsd, hivePercent } = useMemo(() => {
    const hiveUsd = hiveBalance * hivePrice;
    const hbdUsd = hbdBalance * hbdPrice;
    const hpUsd = hpBalance * hivePrice;
    const total = hiveUsd + hbdUsd + hpUsd;
    const pct = total > 0 ? ((hiveUsd + hpUsd) / total) * 100 : 50;
    return { totalUsd: total, hivePercent: pct };
  }, [hiveBalance, hbdBalance, hpBalance, hivePrice, hbdPrice]);

  const formatUsd = (value: number) =>
    `$${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatBalance = (value: number) =>
    value.toLocaleString('en-US', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });

  return (
    <View style={styles.card}>
      <View style={styles.topSection}>
        <DonutRing hivePercent={hivePercent} />
        <View style={styles.valueSection}>
          <Text style={styles.portfolioLabel}>Portfolio Value</Text>
          {loading ? (
            <ShimmerBox width={140} height={28} />
          ) : (
            <Text style={styles.totalValue}>{formatUsd(totalUsd)}</Text>
          )}
        </View>
      </View>

      <View style={styles.balanceRow}>
        <View style={styles.balanceBox}>
          <View style={styles.balanceHeader}>
            <View style={[styles.dot, { backgroundColor: colors.hive }]} />
            <Text style={styles.balanceLabel}>HIVE</Text>
          </View>
          {loading ? (
            <ShimmerBox width={60} height={16} />
          ) : (
            <Text style={styles.balanceAmount}>
              {formatBalance(hiveBalance)}
            </Text>
          )}
        </View>

        <View style={[styles.balanceBox, styles.balanceBoxMiddle]}>
          <View style={styles.balanceHeader}>
            <View style={[styles.dot, { backgroundColor: colors.success }]} />
            <Text style={styles.balanceLabel}>HBD</Text>
          </View>
          {loading ? (
            <ShimmerBox width={60} height={16} />
          ) : (
            <Text style={styles.balanceAmount}>
              {formatBalance(hbdBalance)}
            </Text>
          )}
        </View>

        <View style={styles.balanceBox}>
          <View style={styles.balanceHeader}>
            <View style={[styles.dot, { backgroundColor: colors.coral }]} />
            <Text style={styles.balanceLabel}>HP</Text>
          </View>
          {loading ? (
            <ShimmerBox width={60} height={16} />
          ) : (
            <Text style={styles.balanceAmount}>
              {formatBalance(hpBalance)}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 20,
  },
  donutContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutPercent: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  donutLabel: {
    color: colors.textTertiary,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 1,
  },
  valueSection: {
    flex: 1,
  },
  portfolioLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalValue: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  balanceRow: {
    flexDirection: 'row',
    gap: 0,
  },
  balanceBox: {
    flex: 1,
    backgroundColor: colors.surfaceOverlay,
    borderRadius: 12,
    padding: 12,
  },
  balanceBoxMiddle: {
    marginHorizontal: 8,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  balanceLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  balanceAmount: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  shimmer: {
    backgroundColor: colors.surfaceOverlay,
  },
});

export default BalanceCard;
