import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Zap, Cpu } from 'lucide-react-native';
import { colors } from '../../theme';

interface ResourceBarProps {
  votingPower?: number;
  resourceCredits?: number;
  loading?: boolean;
}

interface SingleBarProps {
  label: string;
  percent: number;
  color: string;
  icon: React.ReactNode;
  loading?: boolean;
}

const SingleBar: React.FC<SingleBarProps> = ({
  label,
  percent,
  color,
  icon,
  loading = false,
}) => {
  const animWidth = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!loading) {
      Animated.timing(animWidth, {
        toValue: percent,
        duration: 800,
        useNativeDriver: false,
      }).start();
    }
  }, [percent, loading, animWidth]);

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: false,
          }),
        ]),
      ).start();
    } else {
      shimmerAnim.stopAnimation();
      shimmerAnim.setValue(0);
    }
  }, [loading, shimmerAnim]);

  const barWidth = animWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const getStatusColor = (pct: number): string => {
    if (pct >= 80) return colors.success;
    if (pct >= 50) return colors.warning;
    return colors.error;
  };

  const statusColor = loading ? colors.textTertiary : getStatusColor(percent);

  return (
    <View style={styles.barContainer}>
      <View style={styles.barHeader}>
        <View style={styles.barLabelRow}>
          {icon}
          <Text style={styles.barLabel}>{label}</Text>
        </View>
        {loading ? (
          <Animated.View
            style={[styles.shimmerBadge, { opacity: shimmerOpacity }]}
          />
        ) : (
          <Text style={[styles.barPercent, { color: statusColor }]}>
            {percent.toFixed(1)}%
          </Text>
        )}
      </View>
      <View style={styles.barTrack}>
        {loading ? (
          <Animated.View
            style={[
              styles.barFill,
              {
                width: '60%',
                backgroundColor: colors.surfaceOverlay,
                opacity: shimmerOpacity,
              },
            ]}
          />
        ) : (
          <Animated.View
            style={[
              styles.barFill,
              {
                width: barWidth,
                backgroundColor: color,
              },
            ]}
          />
        )}
      </View>
    </View>
  );
};

export const ResourceBar: React.FC<ResourceBarProps> = ({
  votingPower = 0,
  resourceCredits = 0,
  loading = false,
}) => {
  return (
    <View style={styles.container}>
      <SingleBar
        label="Voting Power"
        percent={votingPower}
        color={colors.hive}
        icon={<Zap size={14} color={colors.hive} />}
        loading={loading}
      />
      <SingleBar
        label="Resource Credits"
        percent={resourceCredits}
        color={colors.success}
        icon={<Cpu size={14} color={colors.success} />}
        loading={loading}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 16,
  },
  barContainer: {
    gap: 8,
  },
  barHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  barLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  barLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  barPercent: {
    fontSize: 13,
    fontWeight: '700',
  },
  barTrack: {
    height: 6,
    backgroundColor: colors.surfaceOverlay,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  shimmerBadge: {
    width: 40,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.surfaceOverlay,
  },
});

export default ResourceBar;
