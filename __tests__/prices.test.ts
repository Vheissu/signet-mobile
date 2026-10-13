import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchPriceHistory,
  fetchTokenPriceHistory,
  parseCoinGeckoSeries,
  parseHiveEngineSeries,
  percentChange,
} from '../src/core/prices';

const now = 1_700_000_000_000;

function response(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => body } as unknown as Response;
}

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
});

describe('parseCoinGeckoSeries', () => {
  it('sorts and keeps numeric pairs only', () => {
    const points = parseCoinGeckoSeries(
      { prices: [[now, 0.3], [now - 1000, 0.2], ['bad', 1], [now - 500, null]] },
      '24h',
      now,
    );
    expect(points).toEqual([
      { time: now - 1000, price: 0.2 },
      { time: now, price: 0.3 },
    ]);
  });

  it('trims the 1h range to the last hour and falls back to a dozen points', () => {
    const prices = Array.from({ length: 30 }, (_, i) => [now - (30 - i) * 5 * 60_000, 0.1 + i / 100]);
    const points = parseCoinGeckoSeries({ prices }, '1h', now);
    expect(points.every((p) => p.time >= now - 60 * 60_000)).toBe(true);
    expect(points.length).toBeGreaterThanOrEqual(12);

    const stale = parseCoinGeckoSeries({ prices: prices.slice(0, 20) }, '1h', now + 24 * 3_600_000);
    expect(stale.length).toBe(12);
  });

  it('returns an empty list for garbage', () => {
    expect(parseCoinGeckoSeries(null, '1w')).toEqual([]);
    expect(parseCoinGeckoSeries({ prices: 'nope' }, '1w')).toEqual([]);
  });
});

describe('fetchPriceHistory', () => {
  it('fetches, parses and caches', async () => {
    const fetchImpl = jest.fn(async () => response({ prices: [[now - 1000, 1], [now, 2]] }));
    const points = await fetchPriceHistory('HIVE', '1w', fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith('/coins/hive/market_chart?vs_currency=usd&days=7');
    expect(points).toHaveLength(2);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('signet_price_history_HIVE_1w', expect.any(String));

    // Second call within the TTL is served from memory
    const again = await fetchPriceHistory('HIVE', '1w', fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(again).toEqual(points);
  });

  it('returns null, never fabricated data, when the API fails and nothing is cached', async () => {
    const fetchImpl = jest.fn(async () => response({}, false));
    expect(await fetchPriceHistory('HBD', '1y', fetchImpl)).toBeNull();
  });

  it('falls back to a stale cache when the API fails', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({ at: 0, points: [{ time: 1, price: 1 }, { time: 2, price: 2 }] }),
    );
    const fetchImpl = jest.fn(async () => {
      throw new Error('offline');
    });
    const points = await fetchPriceHistory('HBD', '1m', fetchImpl);
    expect(points).toHaveLength(2);
  });
});

describe('Hive Engine history', () => {
  it('parses daily candles to close prices in HIVE', () => {
    const points = parseHiveEngineSeries([
      { timestamp: 1_700_000_000, closePrice: '0.5' },
      { timestamp: 1_699_900_000, closePrice: '0.4' },
      { timestamp: 'x', closePrice: '1' },
    ]);
    expect(points).toEqual([
      { time: 1_699_900_000_000, price: 0.4 },
      { time: 1_700_000_000_000, price: 0.5 },
    ]);
  });

  it('fetches with the symbol and a start timestamp', async () => {
    const fetchImpl = jest.fn(async () => response([{ timestamp: 1, closePrice: '2' }]));
    const points = await fetchTokenPriceHistory('BEE', 30, fetchImpl as any);
    const url = String((fetchImpl.mock.calls[0] as any)[0]);
    expect(url).toContain('symbol=BEE');
    expect(url).toMatch(/timestampStart=\d+/);
    expect(points).toEqual([{ time: 1000, price: 2 }]);
  });
});

describe('percentChange', () => {
  it('computes first-to-last change', () => {
    expect(percentChange([{ time: 1, price: 2 }, { time: 2, price: 3 }])).toBeCloseTo(50);
    expect(percentChange([{ time: 1, price: 0 }, { time: 2, price: 3 }])).toBe(0);
    expect(percentChange([])).toBe(0);
  });
});
