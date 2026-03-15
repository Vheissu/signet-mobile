/**
 * Hive Engine Sidechain API Client
 *
 * Hive Engine tokens run on a sidechain. All queries go through
 * the contracts RPC, and all writes are custom_json operations
 * broadcast to the Hive mainchain with id "ssc-mainnet-hive".
 */

const HE_API = 'https://api.hive-engine.com/rpc/contracts';
const HE_HISTORY = 'https://history.hive-engine.com/accountHistory';

export interface HEToken {
  symbol: string;
  name: string;
  issuer: string;
  precision: number;
  maxSupply: string;
  circulatingSupply: string;
  metadata: {
    url?: string;
    icon?: string;
    desc?: string;
  };
}

export interface HEBalance {
  account: string;
  symbol: string;
  balance: string;
  stake: string;
  pendingUnstake: string;
  delegationsIn: string;
  delegationsOut: string;
  pendingUndelegations: string;
}

export interface HEMarketPrice {
  symbol: string;
  lastPrice: string;
  lowestAsk: string;
  highestBid: string;
  priceChangePercent: string;
  volume: string;
}

export interface HETransaction {
  blockNumber: number;
  transactionId: string;
  timestamp: number;
  operation: string;
  from: string;
  to: string;
  symbol: string;
  quantity: string;
  memo?: string;
}

/**
 * Make an RPC call to the Hive Engine contracts API.
 */
async function rpc(method: string, params: Record<string, any>): Promise<any> {
  const response = await fetch(HE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
  });

  const data = await response.json();
  return data.result;
}

/**
 * Get all token balances for an account.
 */
export async function getTokenBalances(account: string): Promise<HEBalance[]> {
  const result = await rpc('find', {
    contract: 'tokens',
    table: 'balances',
    query: { account },
    limit: 1000,
    offset: 0,
  });
  return result || [];
}

/**
 * Get token info for specific symbols.
 */
export async function getTokenInfo(symbols: string[]): Promise<HEToken[]> {
  const result = await rpc('find', {
    contract: 'tokens',
    table: 'tokens',
    query: { symbol: { $in: symbols } },
    limit: 1000,
  });
  return (result || []).map((t: any) => ({
    ...t,
    metadata: typeof t.metadata === 'string' ? JSON.parse(t.metadata || '{}') : (t.metadata || {}),
  }));
}

/**
 * Get market metrics (price, volume) for tokens.
 */
export async function getMarketMetrics(symbols: string[]): Promise<HEMarketPrice[]> {
  const result = await rpc('find', {
    contract: 'market',
    table: 'metrics',
    query: { symbol: { $in: symbols } },
    limit: 1000,
  });
  return result || [];
}

/**
 * Get market price for a single token.
 */
export async function getTokenPrice(symbol: string): Promise<number> {
  const [metric] = await getMarketMetrics([symbol]);
  return metric ? parseFloat(metric.lastPrice) : 0;
}

/**
 * Get transaction history for an account on Hive Engine.
 */
export async function getTokenHistory(
  account: string,
  symbol?: string,
  limit: number = 50
): Promise<HETransaction[]> {
  try {
    const params = new URLSearchParams({
      account,
      limit: String(limit),
      offset: '0',
    });
    if (symbol) params.append('symbol', symbol);

    const response = await fetch(`${HE_HISTORY}?${params}`);
    const data = await response.json();
    return data || [];
  } catch {
    return [];
  }
}

/**
 * Get all token balances with token info and prices merged.
 */
export async function getFullTokenData(account: string): Promise<Array<{
  balance: HEBalance;
  token: HEToken | null;
  price: number;
  valueHive: number;
}>> {
  const balances = await getTokenBalances(account);
  if (balances.length === 0) return [];

  const symbols = balances.map((b) => b.symbol);

  const [tokens, metrics] = await Promise.all([
    getTokenInfo(symbols),
    getMarketMetrics(symbols),
  ]);

  const tokenMap = new Map(tokens.map((t) => [t.symbol, t]));
  const priceMap = new Map(metrics.map((m) => [m.symbol, parseFloat(m.lastPrice)]));

  return balances
    .map((balance) => {
      const token = tokenMap.get(balance.symbol) || null;
      const price = priceMap.get(balance.symbol) || 0;
      const totalBalance =
        parseFloat(balance.balance) +
        parseFloat(balance.stake || '0');
      const valueHive = totalBalance * price;

      return { balance, token, price, valueHive };
    })
    .sort((a, b) => b.valueHive - a.valueHive);
}

// --- Hive Engine Operations (custom_json payloads) ---

/**
 * Build a custom_json payload for a Hive Engine operation.
 */
export function buildHEOperation(
  contractName: string,
  contractAction: string,
  payload: Record<string, any>
): string {
  return JSON.stringify({
    contractName,
    contractAction,
    contractPayload: payload,
  });
}

/**
 * Build a token transfer payload.
 */
export function buildTransferPayload(
  symbol: string,
  to: string,
  quantity: string,
  memo: string = ''
): string {
  return buildHEOperation('tokens', 'transfer', { symbol, to, quantity, memo });
}

/**
 * Build a token stake payload.
 */
export function buildStakePayload(
  symbol: string,
  to: string,
  quantity: string
): string {
  return buildHEOperation('tokens', 'stake', { to, symbol, quantity });
}

/**
 * Build a token unstake payload.
 */
export function buildUnstakePayload(symbol: string, quantity: string): string {
  return buildHEOperation('tokens', 'unstake', { symbol, quantity });
}

/**
 * Build a token delegate payload.
 */
export function buildDelegatePayload(
  symbol: string,
  to: string,
  quantity: string
): string {
  return buildHEOperation('tokens', 'delegate', { to, symbol, quantity });
}

/**
 * Build a token undelegate payload.
 */
export function buildUndelegatePayload(
  symbol: string,
  from: string,
  quantity: string
): string {
  return buildHEOperation('tokens', 'undelegate', { from, symbol, quantity });
}

/**
 * The custom_json ID used for all Hive Engine operations.
 */
export const HE_ID = 'ssc-mainnet-hive';
