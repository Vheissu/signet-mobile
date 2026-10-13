import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { colors } from '../../theme';
import {
  fetchPriceHistory,
  formatTick,
  percentChange,
  PRICE_RANGES,
  type PricePoint,
  type PriceRange,
} from '../../core/prices';

interface PriceChartProps {
  currentPrice: number;
  symbol?: 'HIVE' | 'HBD';
}

const RANGE_LABELS: Record<PriceRange, string> = {
  '1h': '1H',
  '24h': '24H',
  '1w': '1W',
  '1m': '1M',
  '1y': '1Y',
};

const CHART_HEIGHT = 150;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;
const PAD_X = 6;

interface Geometry {
  linePath: string;
  areaPath: string;
  last: { x: number; y: number };
  ticks: { x: number; label: string; anchor: 'start' | 'middle' | 'end' }[];
}

function buildGeometry(data: PricePoint[], width: number, range: PriceRange): Geometry | null {
  if (data.length < 2 || width <= 0) return null;

  const innerW = width - PAD_X * 2;
  const innerH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const t0 = data[0].time;
  const t1 = data[data.length - 1].time;
  const span = t1 - t0 || 1;
  let min = Infinity;
  let max = -Infinity;
  for (const p of data) {
    if (p.price < min) min = p.price;
    if (p.price > max) max = p.price;
  }
  const pad = (max - min) * 0.08 || max * 0.01 || 1;
  min -= pad;
  max += pad;

  const x = (t: number) => PAD_X + ((t - t0) / span) * innerW;
  const y = (v: number) => PAD_TOP + (1 - (v - min) / (max - min)) * innerH;

  // Monotone-ish smoothing with quadratic midpoints
  let d = `M ${x(data[0].time).toFixed(2)} ${y(data[0].price).toFixed(2)}`;
  for (let i = 1; i < data.length; i += 1) {
    const prev = data[i - 1];
    const curr = data[i];
    const cx = ((x(prev.time) + x(curr.time)) / 2).toFixed(2);
    d += ` Q ${cx} ${y(prev.price).toFixed(2)} ${x(curr.time).toFixed(2)} ${y(curr.price).toFixed(2)}`;
  }
  const baseline = PAD_TOP + innerH;
  const areaPath = `${d} L ${x(t1).toFixed(2)} ${baseline} L ${x(t0).toFixed(2)} ${baseline} Z`;

  const ticks = [t0, (t0 + t1) / 2, t1].map((t, i) => ({
    x: x(t),
    label: formatTick(t, range),
    anchor: (i === 0 ? 'start' : i === 2 ? 'end' : 'middle') as 'start' | 'middle' | 'end',
  }));

  return {
    linePath: d,
    areaPath,
    last: { x: x(t1), y: y(data[data.length - 1].price) },
    ticks,
  };
}

/**
 * Real market history from CoinGecko. Shows a plain message when the data
 * cannot be loaded instead of inventing a line.
 */
export const PriceChart: React.FC<PriceChartProps> = ({ currentPrice, symbol = 'HIVE' }) => {
  const [range, setRange] = useState<PriceRange>('24h');
  const [data, setData] = useState<PricePoint[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    fetchPriceHistory(symbol, range).then((points) => {
      if (cancelled) return;
      if (points && points.length >= 2) {
        setData(points);
        setStatus('ready');
      } else {
        setData(null);
        setStatus('error');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [symbol, range]);

  const geometry = useMemo(
    () => (data && status === 'ready' ? buildGeometry(data, width, range) : null),
    [data, status, width, range],
  );

  const change = data && status === 'ready' ? percentChange(data) : null;
  const isUp = (change ?? 0) >= 0;
  const lineColor = isUp ? colors.success : colors.error;
  const decimals = currentPrice >= 1 ? 3 : 4;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.symbolLabel}>{symbol} price</Text>
          <Text style={styles.priceText}>${currentPrice.toFixed(decimals)}</Text>
        </View>
        {change !== null && (
          <View style={[styles.changeBadge, isUp ? styles.changeUp : styles.changeDown]}>
            <Text style={[styles.changeText, { color: lineColor }]}>
              {isUp ? '+' : ''}
              {change.toFixed(2)}%
            </Text>
            <Text style={styles.changeRange}>{RANGE_LABELS[range]}</Text>
          </View>
        )}
      </View>

      <View style={styles.chartArea} onLayout={onLayout}>
        {status === 'loading' && (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color={colors.textTertiary} />
          </View>
        )}
        {status === 'error' && (
          <View style={styles.centered}>
            <Text style={styles.unavailable}>Price history unavailable right now</Text>
          </View>
        )}
        {geometry && (
          <Svg width={width} height={CHART_HEIGHT}>
            <Path d={geometry.areaPath} fill={lineColor} fillOpacity={0.12} />
            <Path
              d={geometry.linePath}
              fill="none"
              stroke={lineColor}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Line
              x1={PAD_X}
              x2={width - PAD_X}
              y1={CHART_HEIGHT - PAD_BOTTOM}
              y2={CHART_HEIGHT - PAD_BOTTOM}
              stroke={colors.border}
              strokeWidth={1}
            />
            <Circle cx={geometry.last.x} cy={geometry.last.y} r={4} fill={lineColor} stroke={colors.surfaceElevated} strokeWidth={2} />
          </Svg>
        )}
        {geometry && (
          <View style={styles.ticks} pointerEvents="none">
            {geometry.ticks.map((tick) => (
              <Text
                key={`${tick.x}-${tick.label}`}
                style={[
                  styles.tick,
                  tick.anchor === 'start'
                    ? { left: tick.x }
                    : tick.anchor === 'end'
                    ? { right: width - tick.x }
                    : { left: tick.x - 30, width: 60, textAlign: 'center' },
                ]}
              >
                {tick.label}
              </Text>
            ))}
          </View>
        )}
      </View>

      <View style={styles.rangeSelector}>
        {PRICE_RANGES.map((r) => {
          const isActive = range === r;
          return (
            <TouchableOpacity
              key={r}
              style={[styles.rangeButton, isActive && styles.rangeButtonActive]}
              onPress={() => setRange(r)}
              activeOpacity={0.7}
            >
              <Text style={[styles.rangeButtonText, isActive && styles.rangeButtonTextActive]}>
                {RANGE_LABELS[r]}
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
    marginBottom: 8,
  },
  symbolLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  priceText: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  changeUp: {
    backgroundColor: 'rgba(92,234,160,0.12)',
  },
  changeDown: {
    backgroundColor: 'rgba(239,71,111,0.12)',
  },
  changeText: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  changeRange: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  chartArea: {
    height: CHART_HEIGHT,
    marginHorizontal: -4,
    marginBottom: 10,
  },
  centered: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unavailable: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  ticks: {
    ...StyleSheet.absoluteFillObject,
  },
  tick: {
    position: 'absolute',
    bottom: 2,
    fontSize: 10,
    color: colors.textTertiary,
    fontVariant: ['tabular-nums'],
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
