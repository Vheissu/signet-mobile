/**
 * useNetworkStatus Hook
 *
 * Lightweight network connectivity check without extra dependencies.
 * Pings the active RPC node periodically to detect offline state.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';

const CHECK_INTERVAL = 20_000; // 20 seconds
const FETCH_TIMEOUT = 5_000;   // 5 seconds

export function useNetworkStatus() {
  const activeRpc = useStore((s) => s.settings.activeRpc);
  const [isConnected, setIsConnected] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkConnection = useCallback(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      // Lightweight HEAD request to the RPC node
      await fetch(activeRpc, {
        method: 'HEAD',
        signal: controller.signal,
      });
      setIsConnected(true);
    } catch {
      setIsConnected(false);
    } finally {
      clearTimeout(timeout);
    }
  }, [activeRpc]);

  useEffect(() => {
    checkConnection();
    intervalRef.current = setInterval(checkConnection, CHECK_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkConnection]);

  return { isConnected };
}

export default useNetworkStatus;
