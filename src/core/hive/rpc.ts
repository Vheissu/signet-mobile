/**
 * RPC Node management and health checking.
 *
 * Uses fetch with AbortController instead of AbortSignal.timeout()
 * for React Native compatibility.
 */

export interface RPCNode {
  url: string;
  latency: number | null;
  isHealthy: boolean;
}

const DEFAULT_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://anyx.io',
  'https://api.openhive.network',
  'https://rpc.ausbit.dev',
];

/**
 * Test the latency of an RPC node by making a simple API call.
 * Uses AbortController with setTimeout for React Native compatibility.
 */
export async function testNodeLatency(url: string): Promise<number> {
  const start = performance.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'condenser_api.get_dynamic_global_properties',
        params: [],
        id: 1,
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    await response.json();
    return Math.round(performance.now() - start);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Test all configured RPC nodes and return sorted by latency.
 */
export async function testAllNodes(nodes?: string[]): Promise<RPCNode[]> {
  const urls = nodes || DEFAULT_NODES;

  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const latency = await testNodeLatency(url);
      return { url, latency, isHealthy: true };
    })
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return { url: urls[index], latency: null, isHealthy: false };
  }).sort((a, b) => {
    if (a.latency === null) return 1;
    if (b.latency === null) return -1;
    return a.latency - b.latency;
  });
}

/**
 * Find the fastest healthy node from a list.
 */
export async function findFastestNode(nodes?: string[]): Promise<string> {
  const tested = await testAllNodes(nodes);
  const fastest = tested.find((n) => n.isHealthy);
  return fastest?.url || DEFAULT_NODES[0];
}
