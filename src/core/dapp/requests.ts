/**
 * dApp request descriptions.
 *
 * Pure helpers shared by the in-app browser bridge, the deep-link parser
 * and the approval screen. Nothing in here touches the chain or any key
 * material, so it is unit tested in plain Node.
 */

/** The placeholder hive-uri links use for "whoever signs this". */
export const SIGNER_PLACEHOLDER = '__signer';

import type { DAppRequest, DAppRequestType, KeyRole } from '../types';

export interface RequestField {
  label: string;
  value: string;
  /** Render in a monospace block (JSON payloads, messages to sign). */
  code?: boolean;
}

export interface RequestDescription {
  /** Short title shown in the approval header, e.g. "Transfer". */
  title: string;
  /** One-line plain English summary. */
  summary: string;
  /** Detail rows for the approval card. */
  fields: RequestField[];
  /** The key the operation will be signed with. */
  keyRole: KeyRole;
  /** The account the operation acts on, or null if the user must choose. */
  username: string | null;
  /** True for operations that move funds or change authorities. */
  isSensitive: boolean;
}

const VALID_ROLES: KeyRole[] = ['posting', 'active', 'memo', 'owner'];

export function normalizeRole(role: unknown, fallback: KeyRole): KeyRole {
  if (typeof role !== 'string') return fallback;
  const lower = role.toLowerCase() as KeyRole;
  return VALID_ROLES.includes(lower) ? lower : fallback;
}

export function cleanUsername(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const clean = name.trim().replace(/^@/, '').trim().toLowerCase();
  return clean || null;
}

/** Operations that the chain only accepts with active (or owner) authority. */
const ACTIVE_OPS = new Set([
  'transfer',
  'transfer_to_vesting',
  'withdraw_vesting',
  'set_withdraw_vesting_route',
  'delegate_vesting_shares',
  'transfer_to_savings',
  'transfer_from_savings',
  'cancel_transfer_from_savings',
  'convert',
  'collateralized_convert',
  'limit_order_create',
  'limit_order_create2',
  'limit_order_cancel',
  'account_update',
  'account_update2',
  'account_witness_vote',
  'account_witness_proxy',
  'update_proposal_votes',
  'create_proposal',
  'update_proposal',
  'remove_proposal',
  'witness_update',
  'witness_set_properties',
  'recurrent_transfer',
  'escrow_transfer',
  'escrow_approve',
  'escrow_dispute',
  'escrow_release',
  'account_create',
  'claim_account',
  'create_claimed_account',
  'request_account_recovery',
  'recover_account',
  'change_recovery_account',
  'delegate_rc',
]);

/**
 * The lowest authority that can sign a set of operations. A custom_json
 * with required_auths needs active; everything else in ACTIVE_OPS does
 * too. Anything else is a posting-level operation.
 */
export function requiredAuthority(operations: unknown): KeyRole {
  if (!Array.isArray(operations)) return 'posting';
  for (const op of operations) {
    if (!Array.isArray(op)) continue;
    const [name, body] = op;
    if (name === 'custom_json') {
      if (Array.isArray(body?.required_auths) && body.required_auths.length > 0) return 'active';
      continue;
    }
    if (ACTIVE_OPS.has(String(name))) return 'active';
  }
  return 'posting';
}

/**
 * Replace every '__signer' string in a payload with the chosen account.
 * hive-uri links use the placeholder so one link works for anyone.
 */
export function substituteSigner<T>(value: T, username: string): T {
  if (value === SIGNER_PLACEHOLDER) return username as unknown as T;
  if (Array.isArray(value)) return value.map((v) => substituteSigner(v, username)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = substituteSigner(v, username);
    }
    return out as T;
  }
  return value;
}

function truncate(value: string, max = 160): string {
  if (value.length <= max) return value;
  return value.slice(0, max) + '…';
}

function prettyJson(input: unknown): string {
  if (typeof input !== 'string') {
    try {
      return JSON.stringify(input, null, 2);
    } catch {
      return String(input);
    }
  }
  try {
    return JSON.stringify(JSON.parse(input), null, 2);
  } catch {
    return input;
  }
}

/**
 * Describe a request for the approval screen.
 */
export function describeRequest(request: DAppRequest): RequestDescription {
  const p = request.payload || {};

  switch (request.type) {
    case 'TRANSFER':
      return {
        title: 'Transfer',
        summary: `Send ${p.amount} to @${p.to}`,
        fields: [
          { label: 'To', value: `@${p.to}` },
          { label: 'Amount', value: String(p.amount) },
          ...(p.memo ? [{ label: 'Memo', value: truncate(String(p.memo)) }] : []),
        ],
        keyRole: 'active',
        username: cleanUsername(p.from),
        isSensitive: true,
      };

    case 'VOTE': {
      const pct = (Number(p.weight) / 100).toFixed(0);
      return {
        title: Number(p.weight) < 0 ? 'Downvote' : 'Upvote',
        summary: `${pct}% vote on @${p.author}/${p.permlink}`,
        fields: [
          { label: 'Author', value: `@${p.author}` },
          { label: 'Permlink', value: String(p.permlink) },
          { label: 'Weight', value: `${pct}%` },
        ],
        keyRole: 'posting',
        username: cleanUsername(p.voter),
        isSensitive: false,
      };
    }

    case 'POST':
      return {
        title: p.parent_author ? 'Comment' : 'Post',
        summary: p.parent_author
          ? `Reply to @${p.parent_author}/${p.parent_permlink}`
          : `Publish "${truncate(String(p.title || ''), 60)}"`,
        fields: [
          ...(p.title ? [{ label: 'Title', value: truncate(String(p.title), 80) }] : []),
          { label: 'Body', value: truncate(String(p.body || ''), 300), code: true },
          ...(p.comment_options
            ? [{ label: 'Options', value: prettyJson(p.comment_options), code: true }]
            : []),
        ],
        keyRole: 'posting',
        username: cleanUsername(p.username),
        isSensitive: false,
      };

    case 'CUSTOM_JSON': {
      const role = normalizeRole(p.role, p.useActive ? 'active' : 'posting');
      return {
        title: 'Custom JSON',
        summary: p.display || `Broadcast "${p.id}" with ${role} authority`,
        fields: [
          { label: 'ID', value: String(p.id) },
          { label: 'JSON', value: prettyJson(p.json), code: true },
        ],
        keyRole: role,
        username: cleanUsername(p.username),
        isSensitive: role === 'active',
      };
    }

    case 'SIGN_BUFFER': {
      const role = normalizeRole(p.role, 'posting');
      return {
        title: p.title || 'Sign Message',
        summary: `Sign a message with your ${role} key`,
        fields: [{ label: 'Message', value: truncate(String(p.message ?? ''), 400), code: true }],
        keyRole: role,
        username: cleanUsername(p.username),
        isSensitive: role !== 'posting',
      };
    }

    case 'SIGN_TRANSACTION': {
      const ops = Array.isArray(p.tx?.operations) ? p.tx.operations : [];
      const role = normalizeRole(p.role, requiredAuthority(ops));
      return {
        title: 'Sign Transaction',
        summary: `Sign ${ops.length} operation${ops.length === 1 ? '' : 's'} (not broadcast)`,
        fields: [{ label: 'Operations', value: prettyJson(ops), code: true }],
        keyRole: role,
        username: cleanUsername(p.username),
        isSensitive: role !== 'posting',
      };
    }

    case 'BROADCAST': {
      const ops = Array.isArray(p.operations) ? p.operations : [];
      const role = normalizeRole(p.role, requiredAuthority(ops));
      const names = ops.map((op: any) => (Array.isArray(op) ? op[0] : '?')).join(', ');
      return {
        title: 'Broadcast',
        summary: `Broadcast ${ops.length} operation${ops.length === 1 ? '' : 's'}: ${names}`,
        fields: [{ label: 'Operations', value: prettyJson(ops), code: true }],
        keyRole: role,
        username: cleanUsername(p.username),
        isSensitive: role !== 'posting',
      };
    }

    case 'DELEGATE':
      return {
        title: 'Delegate Hive Power',
        summary: `Delegate ${p.amount} ${p.unit || 'VESTS'} to @${p.delegatee}`,
        fields: [
          { label: 'To', value: `@${p.delegatee}` },
          { label: 'Amount', value: `${p.amount} ${p.unit || 'VESTS'}` },
        ],
        keyRole: 'active',
        username: cleanUsername(p.delegator),
        isSensitive: true,
      };

    case 'POWER_UP':
      return {
        title: 'Power Up',
        summary: `Power up ${p.amount} to @${p.to}`,
        fields: [
          { label: 'To', value: `@${p.to}` },
          { label: 'Amount', value: String(p.amount) },
        ],
        keyRole: 'active',
        username: cleanUsername(p.from),
        isSensitive: true,
      };

    case 'POWER_DOWN':
      return {
        title: 'Power Down',
        summary: `Start powering down ${p.amount} ${p.unit || 'VESTS'}`,
        fields: [{ label: 'Amount', value: `${p.amount} ${p.unit || 'VESTS'}` }],
        keyRole: 'active',
        username: cleanUsername(p.account),
        isSensitive: true,
      };

    case 'WITNESS_VOTE':
      return {
        title: p.approve ? 'Vote for Witness' : 'Remove Witness Vote',
        summary: `${p.approve ? 'Approve' : 'Unapprove'} witness @${p.witness}`,
        fields: [{ label: 'Witness', value: `@${p.witness}` }],
        keyRole: 'active',
        username: cleanUsername(p.account),
        isSensitive: true,
      };

    case 'PROXY':
      return {
        title: p.proxy ? 'Set Voting Proxy' : 'Clear Voting Proxy',
        summary: p.proxy ? `Let @${p.proxy} vote on your behalf` : 'Remove your voting proxy',
        fields: [{ label: 'Proxy', value: p.proxy ? `@${p.proxy}` : '(none)' }],
        keyRole: 'active',
        username: cleanUsername(p.account),
        isSensitive: true,
      };

    case 'UPDATE_PROPOSAL_VOTE': {
      const ids = Array.isArray(p.proposal_ids) ? p.proposal_ids : [p.proposal_ids];
      return {
        title: p.approve ? 'Vote for Proposal' : 'Remove Proposal Vote',
        summary: `${p.approve ? 'Approve' : 'Unapprove'} proposal${ids.length === 1 ? '' : 's'} #${ids.join(', #')}`,
        fields: [{ label: 'Proposals', value: ids.map((id: any) => `#${id}`).join(', ') }],
        keyRole: 'active',
        username: cleanUsername(p.voter),
        isSensitive: true,
      };
    }

    case 'ENCODE_MEMO':
      return {
        title: 'Encrypt Message',
        summary: `Encrypt a message for @${p.receiver}`,
        fields: [
          { label: 'Recipient', value: `@${p.receiver}` },
          { label: 'Message', value: truncate(String(p.message ?? ''), 300), code: true },
        ],
        keyRole: normalizeRole(p.role, 'memo'),
        username: cleanUsername(p.username),
        isSensitive: false,
      };

    case 'DECODE_MEMO':
      return {
        title: 'Decrypt Message',
        summary: 'Decrypt an encrypted message with your key',
        fields: [{ label: 'Encrypted', value: truncate(String(p.memo ?? ''), 200), code: true }],
        keyRole: normalizeRole(p.role, 'memo'),
        username: cleanUsername(p.username),
        isSensitive: false,
      };

    case 'ADD_ACCOUNT_AUTHORITY':
      return {
        title: 'Add Account Authority',
        summary: `Give @${p.authorizedUsername} ${p.role} authority over your account`,
        fields: [
          { label: 'Account', value: `@${p.authorizedUsername}` },
          { label: 'Role', value: String(p.role) },
          { label: 'Weight', value: String(p.weight ?? 1) },
        ],
        keyRole: 'active',
        username: cleanUsername(p.username),
        isSensitive: true,
      };

    case 'REMOVE_ACCOUNT_AUTHORITY':
      return {
        title: 'Remove Account Authority',
        summary: `Revoke @${p.authorizedUsername}'s ${p.role} authority`,
        fields: [
          { label: 'Account', value: `@${p.authorizedUsername}` },
          { label: 'Role', value: String(p.role) },
        ],
        keyRole: 'active',
        username: cleanUsername(p.username),
        isSensitive: true,
      };

    case 'CONVERT':
      return {
        title: p.collateralized ? 'Convert HIVE to HBD' : 'Convert HBD to HIVE',
        summary: `Convert ${p.amount}`,
        fields: [{ label: 'Amount', value: String(p.amount) }],
        keyRole: 'active',
        username: cleanUsername(p.owner),
        isSensitive: true,
      };

    case 'RECURRENT_TRANSFER':
      return {
        title: 'Recurrent Transfer',
        summary: `Send ${p.amount} to @${p.to} every ${p.recurrence}h, ${p.executions} times`,
        fields: [
          { label: 'To', value: `@${p.to}` },
          { label: 'Amount', value: String(p.amount) },
          { label: 'Every', value: `${p.recurrence} hours` },
          { label: 'Executions', value: String(p.executions) },
          ...(p.memo ? [{ label: 'Memo', value: truncate(String(p.memo)) }] : []),
        ],
        keyRole: 'active',
        username: cleanUsername(p.from),
        isSensitive: true,
      };

    case 'SEND_TOKEN':
      return {
        title: 'Send Token',
        summary: `Send ${p.amount} ${p.currency} to @${p.to}`,
        fields: [
          { label: 'To', value: `@${p.to}` },
          { label: 'Amount', value: `${p.amount} ${p.currency}` },
          ...(p.memo ? [{ label: 'Memo', value: truncate(String(p.memo)) }] : []),
        ],
        keyRole: 'active',
        username: cleanUsername(p.username),
        isSensitive: true,
      };

    case 'SIGNED_CALL': {
      const role = normalizeRole(p.typeWif, 'posting');
      return {
        title: 'Smart Contract Call',
        summary: `Call "${p.method}" with ${role} authority`,
        fields: [
          { label: 'Method', value: String(p.method) },
          { label: 'Params', value: prettyJson(p.params), code: true },
        ],
        keyRole: role,
        username: cleanUsername(p.username),
        isSensitive: role !== 'posting',
      };
    }

    default:
      return {
        title: 'Unknown Request',
        summary: `Unsupported operation: ${(request as any).type}`,
        fields: [],
        keyRole: 'posting',
        username: null,
        isSensitive: true,
      };
  }
}

export const DAPP_REQUEST_TYPES: DAppRequestType[] = [
  'SIGN_TRANSACTION',
  'SIGN_BUFFER',
  'BROADCAST',
  'TRANSFER',
  'VOTE',
  'POST',
  'CUSTOM_JSON',
  'DELEGATE',
  'POWER_UP',
  'POWER_DOWN',
  'DECODE_MEMO',
  'ENCODE_MEMO',
  'ADD_ACCOUNT_AUTHORITY',
  'REMOVE_ACCOUNT_AUTHORITY',
  'WITNESS_VOTE',
  'PROXY',
  'UPDATE_PROPOSAL_VOTE',
  'CONVERT',
  'RECURRENT_TRANSFER',
  'SEND_TOKEN',
  'SIGNED_CALL',
];

export function isDAppRequestType(type: unknown): type is DAppRequestType {
  return typeof type === 'string' && (DAPP_REQUEST_TYPES as string[]).includes(type);
}

/**
 * Format an amount the way the chain expects: "1.000 HIVE".
 * Accepts numbers or strings with or without the currency.
 */
export function formatAssetAmount(amount: unknown, currency: string, precision = 3): string {
  const str = String(amount ?? '').trim();
  const numeric = parseFloat(str);
  if (!Number.isFinite(numeric)) return `0.${'0'.repeat(precision)} ${currency}`;
  return `${numeric.toFixed(precision)} ${currency.toUpperCase()}`;
}
