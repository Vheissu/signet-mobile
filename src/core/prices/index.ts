/**
 * Price history for HIVE/HBD (CoinGecko) and Hive Engine tokens (the
 * Hive Engine history API). Everything is real market data; when a source
 * is unavailable the caller gets null and should say so rather than draw
 * something made up.
 *
 * Responses are cached in AsyncStorage so repeated screen visits do not
 * hammer the free CoinGecko tier.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { coingeckoFetch } from '../constants';

export interface PricePoint {
  time: number; // ms since epoch
  price: number;
}

export type PriceRange = '1h' | '24h' | '1w' | '1m' | '1y';

export const PRICE_RANGES: PriceRange[] = ['1h', '24h', '1w', '1m', '1y'];

const HE_HISTORY = 'https://history.hive-engine.com/marketHistory';

const COIN_IDS: Record<string, string> = {
  HIVE: 'hive',
  HBD: 'hive_dollar',
};

// CoinGecko only accepts whole days; the 1h range is trimmed client side.
const RANGE_DAYS: Record<PriceRange, number> = {
  '1h': 1,
  '24h': 1,
  '1w': 7,
  '1m': 30,
  '1y': 365,
};

const CACHE_TTL: Record<PriceRange, number> = {
  '1h': 2 * 60_000,
  '24h': 5 * 60_000,
  '1w': 30 * 60_000,
  '1m': 60 * 60_000,
  '1y': 6 * 60 * 60_000,
};

interface CacheEntry {
  at: number;
  points: PricePoint[];
}

const memoryCache = new Map<string, CacheEntry>();

async function readCache(key: string): Promise<CacheEntry | null> {
  const mem = memoryCache.get(key);
  if (mem) return mem;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const entry = JSON.parse(raw) as CacheEntry;
      if (entry && Array.isArray(entry.points)) {
        memoryCache.set(key, entry);
        return entry;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

async function writeCache(key: string, points: PricePoint[]): Promise<void> {
  const entry = { at: Date.now(), points };
  memoryCache.set(key, entry);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // ignore
  }
}

function withTimeout(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

/**
 * Turn CoinGecko's [[ms, price], ...] into points, trimmed to the range.
 */
export function parseCoinGeckoSeries(raw: unknown, range: PriceRange, now = Date.now()): PricePoint[] {
  const prices = (raw as any)?.prices;
  if (!Array.isArray(prices)) return [];

  const points: PricePoint[] = prices
    .filter((p: any) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map((p: any) => ({ time: Number(p[0]), price: Number(p[1]) }))
    .sort((a: PricePoint, b: PricePoint) => a.time - b.time);

  if (range === '1h') {
    const cutoff = now - 60 * 60_000;
    const recent = points.filter((p) => p.time >= cutoff);
    // Always keep at least a dozen points so the line is drawable
    return recent.length >= 2 ? recent : points.slice(-12);
  }
  return points;
}

/**
 * Fetch USD price history for HIVE or HBD.
 * Returns null when the data cannot be fetched (and nothing is cached).
 */
export async function fetchPriceHistory(
  symbol: 'HIVE' | 'HBD',
  range: PriceRange,
  fetchImpl: (path: string) => Promise<Response> = coingeckoFetch
): Promise<PricePoint[] | null> {
  const coinId = COIN_IDS[symbol];
  if (!coinId) return null;

  const key = `signet_price_history_${symbol}_${range}`;
  const cached = await readCache(key);
  if (cached && Date.now() - cached.at < CACHE_TTL[range]) {
    return cached.points;
  }

  try {
    const response = await fetchImpl(
      `/coins/${coinId}/market_chart?vs_currency=usd&days=${RANGE_DAYS[range]}`
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const points = parseCoinGeckoSeries(await response.json(), range);
    if (points.length < 2) throw new Error('Not enough data');
    await writeCache(key, points);
    return points;
  } catch {
    // A stale cache beats nothing
    return cached?.points ?? null;
  }
}

/**
 * Parse Hive Engine daily candles into close-price points (HIVE per token).
 */
export function parseHiveEngineSeries(raw: unknown): PricePoint[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c: any) => c && Number.isFinite(Number(c.timestamp)) && Number.isFinite(parseFloat(c.closePrice)))
    .map((c: any) => ({ time: Number(c.timestamp) * 1000, price: parseFloat(c.closePrice) }))
    .sort((a, b) => a.time - b.time);
}

/**
 * Fetch daily price history for a Hive Engine token, priced in HIVE.
 * Returns null when unavailable. Tokens with no market have an empty array.
 */
export async function fetchTokenPriceHistory(
  symbol: string,
  days = 30,
  fetchImpl: typeof fetch = fetch
): Promise<PricePoint[] | null> {
  const key = `signet_he_price_history_${symbol}_${days}`;
  const cached = await readCache(key);
  if (cached && Date.now() - cached.at < 60 * 60_000) {
    return cached.points;
  }

  try {
    const start = Math.floor(Date.now() / 1000) - days * 86_400;
    const url = `${HE_HISTORY}?symbol=${encodeURIComponent(symbol)}&timestampStart=${start}`;
    const response = await fetchImpl(url, { signal: withTimeout(10_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const points = parseHiveEngineSeries(await response.json());
    await writeCache(key, points);
    return points;
  } catch {
    return cached?.points ?? null;
  }
}

/**
 * Percentage change from the first to the last point.
 */
export function percentChange(points: PricePoint[]): number {
  if (points.length < 2) return 0;
  const first = points[0].price;
  const last = points[points.length - 1].price;
  if (first === 0) return 0;
  return ((last - first) / first) * 100;
}

/**
 * Format a timestamp for an axis label in a given range.
 */
export function formatTick(time: number, range: PriceRange | 'days'): string {
  const d = new Date(time);
  if (range === '1h' || range === '24h') {
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  if (range === '1y') {
    return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
