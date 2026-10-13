/**
 * Deep-link protocol.
 *
 * Other apps ask Signet to sign things by opening a URL. Keys never leave
 * the device: every request is turned into a DAppRequest, shown on the
 * approval screen, and answered with a signature or a broadcast result.
 *
 * Two schemes are accepted:
 *
 * 1. `signet://` (Signet native)
 *    - `signet://login?username=&callback=[&challenge=][&request_id=]`
 *      Signs a login challenge with the posting key. The callback receives
 *      `username`, `challenge`, `signature` and `public_key`; the app
 *      verifies the signature against the account's posting authority.
 *    - `signet://sign?message=&callback=[&username=][&role=posting|active|memo][&request_id=]`
 *      Signs an arbitrary message.
 *
 * 2. `hive://sign/...` (the hive-uri specification)
 *    `op`, `ops`, `tx` and the specialised aliases (transfer, follow, ...)
 *    with the `s` (signer), `a` (authority), `nb` (no broadcast) and `cb`
 *    (callback, templated with {{sig}} {{id}} {{block}} {{txn}}) params.
 */

import { decode as decodeHiveUri } from 'hive-uri';
import type { DAppRequest, DAppResponse } from '../types';
import { Buffer } from '@craftzdog/react-native-buffer';
import { cleanUsername, normalizeRole, SIGNER_PLACEHOLDER } from '../dapp/requests';

export type ProtocolSource = 'signet' | 'hive-uri';

export interface ProtocolRequest {
  /** The request the approval screen shows and executes. */
  request: DAppRequest;
  /** Where to send the answer. Null for links without a callback. */
  callback: string | null;
  /** Echoed back to the caller when supplied. */
  requestId?: string;
  /** Short label for the requester ("peakd.com", "myapp"). */
  label: string;
  source: ProtocolSource;
  /** A signet://login request: the callback gets the signed challenge. */
  isLogin: boolean;
  rawUrl: string;
}

let counter = 0;

function nextId(): string {
  counter += 1;
  return `link_${Date.now()}_${counter}`;
}

function randomToken(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 16; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function normalizePathname(pathname: string): string {
  return pathname.replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
}

function requestPath(url: URL): string {
  const pathname = normalizePathname(url.pathname);
  if (pathname) return pathname;
  return url.host.trim().toLowerCase();
}

function validCallback(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol === 'http:') return null; // only https for web callbacks
    if (url.protocol === 'signet:' || url.protocol === 'hive:') return null; // no loops
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Label for the app behind a callback URL.
 */
export function getProtocolRequesterLabel(callback: string | null): string {
  if (!callback) return 'a hive:// link';
  try {
    const url = new URL(callback);
    const protocol = url.protocol.replace(/:$/, '');
    if (protocol === 'https' && url.hostname) return url.hostname;
    return protocol;
  } catch {
    return callback;
  }
}

function parseSignet(url: URL, rawUrl: string): ProtocolRequest | null {
  const path = requestPath(url);
  const params = url.searchParams;
  const callback = validCallback(
    params.get('callback') || params.get('redirect_uri') || params.get('return_url')
  );
  const requestId = params.get('request_id') || undefined;
  const username = cleanUsername(params.get('username'));

  if (path === 'login') {
    if (!callback || !username) return null;
    const challenge = params.get('challenge') || `signet-login:${username}:${Date.now()}:${randomToken()}`;
    return {
      request: {
        id: nextId(),
        type: 'SIGN_BUFFER',
        payload: { username, message: challenge, role: 'posting', title: 'Sign in' },
        origin: getProtocolRequesterLabel(callback),
        timestamp: Date.now(),
      },
      callback,
      requestId,
      label: getProtocolRequesterLabel(callback),
      source: 'signet',
      isLogin: true,
      rawUrl,
    };
  }

  if (path === 'sign') {
    const message = params.get('message');
    if (!callback || !message) return null;
    const role = normalizeRole(params.get('role'), 'posting');
    if (role === 'owner') return null;
    return {
      request: {
        id: nextId(),
        type: 'SIGN_BUFFER',
        payload: { username, message, role, title: params.get('title') || '' },
        origin: getProtocolRequesterLabel(callback),
        timestamp: Date.now(),
      },
      callback,
      requestId,
      label: getProtocolRequesterLabel(callback),
      source: 'signet',
      isLogin: false,
      rawUrl,
    };
  }

  return null;
}

const B64U_LOOKUP: Record<string, string> = { '-': '+', _: '/', '.': '=' };

function base64uDecode(str: string): string {
  const b64 = str.replace(/[-_.]/g, (m) => B64U_LOOKUP[m]);
  return Buffer.from(b64, 'base64').toString('utf8');
}

/**
 * The specialised aliases from the hive-uri spec. The reference library
 * only decodes op/ops/tx/msg, so these are expanded here first.
 */
function expandHiveUriAlias(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl.replace(/^hive:/, 'http:'));
  } catch {
    return null;
  }
  if (url.host !== 'sign') return null;
  const [action, ...rest] = url.pathname.split('/').slice(1).map((part) => decodeURIComponent(part));
  const query = url.search || '';

  const encode = (op: unknown) =>
    Buffer.from(JSON.stringify(op), 'utf8')
      .toString('base64')
      .replace(/[+/=]/g, (m) => ({ '+': '-', '/': '_', '=': '.' })[m] as string);

  if (action === 'transfer' && rest[0] && rest[1]) {
    let memo = '';
    if (rest[2]) {
      try {
        memo = base64uDecode(rest[2]);
      } catch {
        memo = rest[2];
      }
    }
    const op = ['transfer', { from: SIGNER_PLACEHOLDER, to: rest[0], amount: rest[1], memo }];
    return `hive://sign/op/${encode(op)}${query}`;
  }

  if (action === 'follow' && rest[0]) {
    const op = [
      'custom_json',
      {
        required_auths: [],
        required_posting_auths: [SIGNER_PLACEHOLDER],
        id: 'follow',
        json: JSON.stringify(['follow', { follower: SIGNER_PLACEHOLDER, following: rest[0], what: ['blog'] }]),
      },
    ];
    return `hive://sign/op/${encode(op)}${query}`;
  }

  return null;
}

function hiveUriAction(rawUrl: string): string {
  try {
    const url = new URL(rawUrl.replace(/^hive:/, 'http:'));
    return url.pathname.split('/')[1] || '';
  } catch {
    return '';
  }
}

function parseHiveUri(rawUrl: string): ProtocolRequest | null {
  const expanded = expandHiveUriAlias(rawUrl) || rawUrl;

  let decoded;
  try {
    decoded = decodeHiveUri(expanded);
  } catch {
    return null;
  }

  const { tx, params } = decoded;
  const callback = validCallback(params.callback || null);
  const username = cleanUsername(params.signer);
  const role = params.authority ? normalizeRole(params.authority, 'posting') : undefined;
  const label = getProtocolRequesterLabel(callback);
  const base = { callback, label, source: 'hive-uri' as const, isLogin: false, rawUrl };

  // hive://sign/msg/<base64u(JSON message)>: sign a message, nothing is broadcast.
  if (hiveUriAction(expanded) === 'msg') {
    const message = typeof tx === 'string' ? tx : JSON.stringify(tx);
    if (!message) return null;
    if (role === 'owner') return null;
    return {
      ...base,
      request: {
        id: nextId(),
        type: 'SIGN_BUFFER',
        payload: { username, message, role: role || 'posting', title: '' },
        origin: label,
        timestamp: Date.now(),
      },
    };
  }

  const operations = Array.isArray(tx?.operations) ? tx.operations : [];
  if (operations.length === 0) return null;

  const request: DAppRequest = params.no_broadcast
    ? {
        id: nextId(),
        type: 'SIGN_TRANSACTION',
        payload: {
          username,
          role,
          tx: {
            operations,
            extensions: Array.isArray(tx.extensions) ? tx.extensions : [],
            // Placeholder fields are dropped; signTransaction fills real ones.
            ...(typeof tx.ref_block_num === 'number' ? { ref_block_num: tx.ref_block_num } : {}),
            ...(typeof tx.ref_block_prefix === 'number' ? { ref_block_prefix: tx.ref_block_prefix } : {}),
            ...(typeof tx.expiration === 'string' && !tx.expiration.startsWith('__')
              ? { expiration: tx.expiration }
              : {}),
          },
        },
        origin: label,
        timestamp: Date.now(),
      }
    : {
        id: nextId(),
        type: 'BROADCAST',
        payload: { username, role, operations },
        origin: label,
        timestamp: Date.now(),
      };

  return { ...base, request };
}

/**
 * Parse an incoming URL. Returns null for anything that is not a
 * well-formed request (so unrelated links are ignored).
 */
export function parseProtocolRequest(rawUrl: string): ProtocolRequest | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol === 'signet:') return parseSignet(url, rawUrl);
  if (url.protocol === 'hive:') return parseHiveUri(rawUrl);
  return null;
}

export interface ProtocolCallbackPayload {
  status: 'success' | 'error';
  request_id?: string;
  username?: string;
  challenge?: string;
  signature?: string;
  public_key?: string;
  /** Transaction id, block and position when a transaction was broadcast. */
  id?: string;
  block?: string;
  txn?: string;
  error?: string;
  message?: string;
}

const TEMPLATE = /\{\{([a-z_]+)\}\}/g;

/**
 * Build the URL to open once a request is answered.
 *
 * hive-uri callbacks may carry {{sig}} / {{id}} / {{block}} / {{txn}}
 * placeholders; those are filled in and nothing else is appended. Plain
 * callbacks get the payload as query parameters.
 */
export function buildProtocolCallbackUrl(callback: string, payload: ProtocolCallbackPayload): string {
  const templateValues: Record<string, string> = {
    sig: payload.signature || '',
    id: payload.id || '',
    block: payload.block || '',
    txn: payload.txn || '',
    data: payload.message || '',
  };

  if (TEMPLATE.test(callback)) {
    TEMPLATE.lastIndex = 0;
    return callback.replace(TEMPLATE, (_m, key: string) =>
      encodeURIComponent(templateValues[key] ?? '')
    );
  }

  const url = new URL(callback);
  const entries: [keyof ProtocolCallbackPayload, string | undefined][] = [
    ['status', payload.status],
    ['request_id', payload.request_id],
    ['username', payload.username],
    ['challenge', payload.challenge],
    ['signature', payload.signature],
    ['public_key', payload.public_key],
    ['id', payload.id],
    ['block', payload.block],
    ['txn', payload.txn],
    ['error', payload.error],
    ['message', payload.message],
  ];
  for (const [key, value] of entries) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

/**
 * Turn an approval-screen response into the callback payload.
 */
export function callbackPayloadFromResponse(
  protocol: ProtocolRequest,
  response: DAppResponse
): ProtocolCallbackPayload {
  if (!response.success) {
    return {
      status: 'error',
      request_id: protocol.requestId,
      username: protocol.request.payload?.username || undefined,
      error: response.error || 'error',
      message: response.message,
    };
  }

  const base: ProtocolCallbackPayload = {
    status: 'success',
    request_id: protocol.requestId,
    username: response.username,
  };

  switch (protocol.request.type) {
    case 'SIGN_BUFFER':
      return {
        ...base,
        challenge: protocol.isLogin ? String(protocol.request.payload.message) : undefined,
        signature: String(response.result),
        public_key: response.publicKey,
      };
    case 'SIGN_TRANSACTION': {
      const sigs = Array.isArray(response.result?.signatures) ? response.result.signatures : [];
      return { ...base, signature: sigs[sigs.length - 1], public_key: response.publicKey };
    }
    case 'BROADCAST':
    default: {
      const r = response.result || {};
      return {
        ...base,
        id: r.id ? String(r.id) : undefined,
        block: r.block_num !== undefined ? String(r.block_num) : undefined,
        txn: r.trx_num !== undefined ? String(r.trx_num) : undefined,
      };
    }
  }
}
