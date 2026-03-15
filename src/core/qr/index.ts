/**
 * QR Code utilities for Hive transfers.
 *
 * Two URI formats supported:
 *   1. Signet native:  hive://transfer?to=USERNAME&amount=AMOUNT&currency=CURRENCY&memo=MEMO
 *   2. Hivesigner:     https://hivesigner.com/sign/transfer?to=USERNAME&amount=AMOUNT%20CURRENCY&memo=MEMO
 *
 * For QR code rendering on React Native, use the react-native-qrcode-svg
 * component directly in your UI. This module provides the URI/value
 * generation and parsing functions.
 *
 * For QR code scanning, use expo-camera's barcode scanner directly
 * in a component. This module provides parseTransferUri to decode
 * the scanned value.
 */

export interface HiveTransferQR {
  to: string;
  amount?: string;
  currency?: string;
  memo?: string;
}

/**
 * Build a Signet-native hive:// transfer URI.
 * Best for Signet-to-Signet transfers.
 */
export function buildTransferUri(data: HiveTransferQR): string {
  const params = new URLSearchParams();
  params.set('to', data.to);
  if (data.amount) params.set('amount', data.amount);
  if (data.currency) params.set('currency', data.currency);
  if (data.memo) params.set('memo', data.memo);
  return `hive://transfer?${params.toString()}`;
}

/**
 * Build a Hivesigner URL for the transfer.
 * Works on mobile -- opens in any browser, user signs via Hivesigner.
 */
export function buildHivesignerUrl(data: HiveTransferQR): string {
  const params = new URLSearchParams();
  params.set('to', data.to);
  if (data.amount && data.currency) {
    params.set('amount', `${data.amount} ${data.currency}`);
  }
  if (data.memo) params.set('memo', data.memo);
  return `https://hivesigner.com/sign/transfer?${params.toString()}`;
}

/**
 * Build a simple receive URI (just the username).
 */
export function buildReceiveUri(username: string): string {
  return `hive://transfer?to=${encodeURIComponent(username)}`;
}

/**
 * Parse a transfer URI back into structured data.
 * Supports: hive:// URIs, Hivesigner URLs, and plain usernames.
 */
export function parseTransferUri(uri: string): HiveTransferQR | null {
  try {
    // Handle Hivesigner URLs
    if (uri.includes('hivesigner.com')) {
      const url = new URL(uri);
      const params = url.searchParams;
      const to = params.get('to');
      if (!to) return null;

      // Hivesigner encodes amount as "10.000 HIVE" in a single param
      const amountRaw = params.get('amount') || '';
      const amountParts = amountRaw.trim().split(' ');

      return {
        to,
        amount: amountParts[0] || undefined,
        currency: amountParts[1] || undefined,
        memo: params.get('memo') || undefined,
      };
    }

    // Handle hive:// URIs
    const normalized = uri.replace('hive://', 'https://hive/');
    const url = new URL(normalized);
    const params = url.searchParams;

    const to = params.get('to');
    if (!to) return null;

    return {
      to,
      amount: params.get('amount') || undefined,
      currency: params.get('currency') || undefined,
      memo: params.get('memo') || undefined,
    };
  } catch {
    // Try simple username format
    const clean = uri.replace(/^@/, '').trim();
    if (clean && /^[a-z0-9.-]+$/.test(clean)) {
      return { to: clean };
    }
    return null;
  }
}

/**
 * Generate the QR value string for a receive request.
 * Pass this string to react-native-qrcode-svg's <QRCode value={...} />.
 */
export function generateReceiveQRValue(username: string): string {
  return buildReceiveUri(username);
}

/**
 * Generate the QR value string for a specific transfer request.
 * Pass this string to react-native-qrcode-svg's <QRCode value={...} />.
 */
export function generateTransferQRValue(data: HiveTransferQR): string {
  return buildTransferUri(data);
}

/**
 * Generate a QR value string from transfer data.
 * Returns the URI string for use with react-native-qrcode-svg.
 */
export function generateQRValue(data: HiveTransferQR): string {
  return buildTransferUri(data);
}
