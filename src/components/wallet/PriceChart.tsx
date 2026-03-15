import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { TrendingUp, TrendingDown } from 'lucide-react-native';
import { colors } from '../../theme';
import { coingeckoFetch } from '../../core/constants';

type TimeRange = '1h' | '24h' | '1w' | '1m' | '1y';

interface PriceChartProps {
  currentPrice: number;
  symbol?: string;
}

const TIME_RANGES: { key: TimeRange; label: string; days: string }[] = [
  { key: '1h', label: '1H', days: '0.042' },  // ~1 hour
  { key: '24h', label: '24H', days: '1' },
  { key: '1w', label: '1W', days: '7' },
  { key: '1m', label: '1M', days: '30' },
  { key: '1y', label: '1Y', days: '365' },
];

const CHART_WIDTH = 320;
const CHART_HEIGHT = 140;
const CHART_PADDING = 4;

function buildLinePath(
  data: number[],
  width: number,
  height: number,
): { linePath: string; areaPath: string; min: number; max: number } {
  if (data.length === 0) {
    return { linePath: '', areaPath: '', min: 0, max: 0 };
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const xStep = (width - CHART_PADDING * 2) / (data.length - 1);

  const points = data.map((value, i) => {
    const x = CHART_PADDING + i * xStep;
    const y =
      CHART_PADDING + (1 - (value - min) / range) * (height - CHART_PADDING * 2);
    return { x, y };
  });

  // Build smooth line path using quadratic bezier curves
  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    linePath += ` Q ${cpx} ${prev.y} ${curr.x} ${curr.y}`;
  }

  // Build area path (same line + close to bottom)
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const areaPath = `${linePath} L ${lastPoint.x} ${height} L ${firstPoint.x} ${height} Z`;

  return { linePath, areaPath, min, max };
}

async function fetchPriceHistory(days: string): Promise<number[] | null> {
  try {
    const response = await coingeckoFetch(
      `/coins/hive/market_chart?vs_currency=usd&days=${days}`,
    );
    if (!response.ok) return null;
    const data = await response.json();
    // data.prices is [[timestamp, price], ...]
    const prices: number[] = data?.prices?.map((p: [number, number]) => p[1]) ?? [];
    return prices.length > 2 ? prices : null;
  } catch {
    return null;
  }
}

export const PriceChart: React.FC<PriceChartProps> = ({
  currentPrice,
  symbol = 'HIVE',
}) => {
  const [activeRange, setActiveRange] = useState<TimeRange>('24h');
  const [priceData, setPriceData] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const rangeConfig = TIME_RANGES.find((r) => r.key === activeRange)!;
    fetchPriceHistory(rangeConfig.days).then((data) => {
      if (cancelled) return;
      if (data) {
        setPriceData(data);
      } else {
        // Use current price as flat line if API fails
        setPriceData([currentPrice, currentPrice]);
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [activeRange, currentPrice]);

  const { linePath, areaPath } = useMemo(
    () => buildLinePath(priceData, CHART_WIDTH, CHART_HEIGHT),
    [priceData],
  );

  const startPrice = priceData[0] || currentPrice;
  const endPrice = priceData.length > 0 ? priceData[priceData.length - 1] : currentPrice;
  const changePercent =
    startPrice > 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0;
  const isPositive = changePercent >= 0;

  const handleRangePress = useCallback((range: TimeRange) => {
    setActiveRange(range);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.symbolLabel}>{symbol} Price</Text>
          <Text style={styles.priceText}>
            ${currentPrice.toFixed(4)}
          </Text>
        </View>
        <View
          style={[
            styles.changeBadge,
            isPositive ? styles.changeBadgePositive : styles.changeBadgeNegative,
          ]}
        >
          {isPositive ? (
            <TrendingUp size={12} color={colors.success} />
          ) : (
            <TrendingDown size={12} color={colors.error} />
          )}
          <Text
            style={[
              styles.changeText,
              { color: isPositive ? colors.success : colors.error },
            ]}
          >
            {isPositive ? '+' : ''}
            {changePercent.toFixed(2)}%
          </Text>
        </View>
      </View>

      <View style={styles.chartContainer}>
        {loading ? (
          <View style={styles.chartLoading}>
            <ActivityIndicator size="small" color={colors.textTertiary} />
          </View>
        ) : (
          <Svg
            width="100%"
            height={CHART_HEIGHT}
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            preserveAspectRatio="none"
          >
            <Defs>
              <LinearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <Stop
                  offset="0"
                  stopColor={isPositive ? colors.success : colors.hive}
                  stopOpacity="0.25"
                />
                <Stop
                  offset="1"
                  stopColor={isPositive ? colors.success : colors.hive}
                  stopOpacity="0"
                />
              </LinearGradient>
            </Defs>
            {areaPath ? (
              <Path d={areaPath} fill="url(#areaGradient)" />
            ) : null}
            {linePath ? (
              <Path
                d={linePath}
                fill="none"
                stroke={isPositive ? colors.success : colors.hive}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
          </Svg>
        )}
      </View>

      <View style={styles.rangeSelector}>
        {TIME_RANGES.map((range) => {
          const isActive = activeRange === range.key;
          return (
            <TouchableOpacity
              key={range.key}
              style={[
                styles.rangeButton,
                isActive && styles.rangeButtonActive,
              ]}
              onPress={() => handleRangePress(range.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.rangeButtonText,
                  isActive && styles.rangeButtonTextActive,
                ]}
              >
                {range.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  symbolLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  priceText: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  changeBadgePositive: {
    backgroundColor: 'rgba(92,234,160,0.12)',
  },
  changeBadgeNegative: {
    backgroundColor: 'rgba(227,19,55,0.12)',
  },
  changeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  chartContainer: {
    marginHorizontal: -8,
    marginBottom: 12,
  },
  chartLoading: {
    height: CHART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeSelector: {
    flexDirection: 'row',
    gap: 6,
  },
  rangeButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  rangeButtonActive: {
    backgroundColor: colors.surfaceOverlay,
  },
  rangeButtonText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
  },
  rangeButtonTextActive: {
    color: colors.textPrimary,
  },
});

export default PriceChart;
