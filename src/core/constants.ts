/**
 * App-wide constants.
 *
 * API keys are loaded from environment variables (EXPO_PUBLIC_* prefix).
 * Users can override these in Settings, which takes precedence.
 */

const COINGECKO_FREE_URL = 'https://api.coingecko.com/api/v3';
const COINGECKO_PRO_URL = 'https://pro-api.coingecko.com/api/v3';

/** Default key from env var, used if user hasn't set one in Settings. */
const ENV_COINGECKO_API_KEY = process.env.EXPO_PUBLIC_COINGECKO_API_KEY || '';

/** Runtime key — user Settings override > env var default. */
let _coingeckoApiKey: string | null = ENV_COINGECKO_API_KEY || null;

/**
 * Configure CoinGecko with a Pro API key.
 * Call with null or empty string to fall back to the env var default
 * (or free tier if no env var is set).
 */
export function setCoingeckoApiKey(key: string | null): void {
  if (key && key.trim()) {
    _coingeckoApiKey = key.trim();
  } else {
    _coingeckoApiKey = ENV_COINGECKO_API_KEY || null;
  }
}

export function getCoingeckoApiKey(): string | null {
  return _coingeckoApiKey;
}

/**
 * Build a CoinGecko API URL (without the API key — use coingeckoFetch instead).
 */
function coingeckoBaseUrl(path: string): string {
  return _coingeckoApiKey
    ? `${COINGECKO_PRO_URL}${path}`
    : `${COINGECKO_FREE_URL}${path}`;
}

/**
 * Fetch from CoinGecko with proper authentication.
 * API key is sent via HTTP header (not query parameter) to avoid leaking in logs/caches.
 */
export async function coingeckoFetch(path: string): Promise<Response> {
  const url = coingeckoBaseUrl(path);
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (_coingeckoApiKey) {
    headers['x-cg-pro-api-key'] = _coingeckoApiKey;
  }

  return fetch(url, { headers });
}
