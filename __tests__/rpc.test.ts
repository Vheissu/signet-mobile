/**
 * Tests for RPC node health checking and latency testing.
 */

import { testAllNodes, findFastestNode, type RPCNode } from '../src/core/hive/rpc';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('testAllNodes', () => {
  it('returns results for all nodes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ result: {} }),
    });

    const nodes = ['https://node1.com', 'https://node2.com'];
    const results = await testAllNodes(nodes);

    expect(results.length).toBe(2);
  });

  it('marks failed nodes as unhealthy', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: {} }),
      })
      .mockRejectedValueOnce(new Error('timeout'));

    const results = await testAllNodes(['https://healthy.com', 'https://down.com']);

    const healthy = results.find((n) => n.url === 'https://healthy.com');
    const down = results.find((n) => n.url === 'https://down.com');

    expect(healthy?.isHealthy).toBe(true);
    expect(healthy?.latency).toBeGreaterThanOrEqual(0);
    expect(down?.isHealthy).toBe(false);
    expect(down?.latency).toBeNull();
  });

  it('sorts by latency with unhealthy nodes last', async () => {
    // Simulate different response times
    mockFetch
      .mockImplementationOnce(async () => {
        await new Promise((r) => setTimeout(r, 10));
        return { ok: true, json: async () => ({ result: {} }) };
      })
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: {} }),
      });

    const results = await testAllNodes([
      'https://slow.com',
      'https://down.com',
      'https://fast.com',
    ]);

    // Down node should be last
    expect(results[results.length - 1].url).toBe('https://down.com');
    expect(results[results.length - 1].isHealthy).toBe(false);
  });

  it('uses default nodes when none provided', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ result: {} }),
    });

    const results = await testAllNodes();

    // Should test default 5 nodes
    expect(results.length).toBe(5);
    expect(results[0].url).toContain('https://');
  });

  it('handles HTTP error responses', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
    });

    const results = await testAllNodes(['https://error.com']);
    expect(results[0].isHealthy).toBe(false);
  });
});

describe('findFastestNode', () => {
  it('returns the fastest healthy node', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ result: {} }),
    });

    const fastest = await findFastestNode(['https://node1.com', 'https://node2.com']);
    expect(fastest).toContain('https://');
  });

  it('falls back to default node when all fail', async () => {
    mockFetch.mockRejectedValue(new Error('all down'));

    const fastest = await findFastestNode(['https://down1.com', 'https://down2.com']);
    expect(fastest).toBe('https://api.hive.blog');
  });
});
