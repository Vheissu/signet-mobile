/**
 * Execute an approved dApp or deep-link request.
 *
 * Given a request and a way to fetch decrypted keys, it signs/broadcasts
 * and returns a Keychain-shaped response. Used by the approval screen for
 * both the in-app browser and `signet://` / `hive://` links.
 */

import type { DAppRequest, DAppResponse, KeyRole } from '../types';
import { describeRequest, formatAssetAmount, normalizeRole, substituteSigner } from './requests';
import {
  getAccount,
  getDynamicGlobalProperties,
  broadcastOperations,
  broadcastTransfer,
  broadcastVote,
  broadcastComment,
  broadcastCustomJson,
  broadcastDelegateVestingShares,
  broadcastTransferToVesting,
  broadcastWithdrawVesting,
  broadcastWitnessVote,
  broadcastSetProxy,
  broadcastProposalVote,
  broadcastConvert,
  broadcastCollateralizedConvert,
  broadcastRecurrentTransfer,
  broadcastAccountAuthorityChange,
  broadcastSignedCall,
  signTransaction,
} from '../hive/client';
import { hpToVests, formatAmount } from '../hive/operations';
import { signBuffer, encodeMemo, decodeMemo, getPublicFromPrivate } from '../crypto/hive-keys';
import { buildTransferPayload, HE_ID } from '../hive-engine/api';

export type KeyProvider = (username: string, role: KeyRole) => Promise<string | null>;

export class MissingKeyError extends Error {
  constructor(public username: string, public role: KeyRole) {
    super(`No ${role} key stored for @${username}`);
    this.name = 'MissingKeyError';
  }
}

function ok(request: DAppRequest, result: any, extra: Partial<DAppResponse> = {}): DAppResponse {
  return {
    success: true,
    error: null,
    result,
    data: { type: request.type, ...request.payload },
    message: 'Request approved',
    request_id: request.id,
    ...extra,
  };
}

export function failure(request: DAppRequest, error: string, message?: string): DAppResponse {
  return {
    success: false,
    error,
    result: null,
    data: { type: request.type, ...request.payload },
    message: message || error,
    request_id: request.id,
  };
}

async function toVests(amount: string, unit: string | undefined): Promise<string> {
  const numeric = parseFloat(amount);
  if (!Number.isFinite(numeric)) throw new Error('Invalid amount');
  if ((unit || 'VESTS').toUpperCase() === 'HP') {
    const props = await getDynamicGlobalProperties();
    return formatAmount(hpToVests(numeric, props), 'VESTS', 6);
  }
  return formatAmount(numeric, 'VESTS', 6);
}

/**
 * Execute a request for a specific account. `username` is the account the
 * user picked in the approval screen (it may differ from the payload when
 * the dApp left it blank or a hive:// link used the __signer placeholder).
 */
export async function executeRequest(
  request: DAppRequest,
  username: string,
  getKey: KeyProvider
): Promise<DAppResponse> {
  const p = substituteSigner(request.payload || {}, username);
  const description = describeRequest(request);
  const role = description.keyRole;

  const key = await getKey(username, role);
  if (!key) throw new MissingKeyError(username, role);
  const publicKey = getPublicFromPrivate(key);

  switch (request.type) {
    case 'TRANSFER': {
      const result = await broadcastTransfer(username, p.to, p.amount, p.memo || '', key);
      return ok(request, result);
    }

    case 'VOTE': {
      const result = await broadcastVote(username, p.author, p.permlink, Number(p.weight), key);
      return ok(request, result);
    }

    case 'POST': {
      const result = await broadcastComment(
        {
          author: username,
          permlink: p.permlink,
          title: p.title || '',
          body: p.body || '',
          parent_author: p.parent_author || '',
          parent_permlink: p.parent_permlink || '',
          json_metadata:
            typeof p.json_metadata === 'string' ? p.json_metadata : JSON.stringify(p.json_metadata || {}),
        },
        p.comment_options || null,
        key
      );
      return ok(request, result);
    }

    case 'CUSTOM_JSON': {
      const json = typeof p.json === 'string' ? p.json : JSON.stringify(p.json);
      const result = await broadcastCustomJson(username, p.id, json, role === 'active', key);
      return ok(request, result);
    }

    case 'SIGN_BUFFER': {
      const signature = signBuffer(String(p.message ?? ''), key);
      return ok(request, signature, { publicKey, username });
    }

    case 'SIGN_TRANSACTION': {
      const signed = await signTransaction(p.tx || {}, key);
      return ok(request, signed, { publicKey, username });
    }

    case 'BROADCAST': {
      const result = await broadcastOperations(p.operations || [], key);
      return ok(request, result, { username });
    }

    case 'DELEGATE': {
      const vests = await toVests(String(p.amount), p.unit);
      const result = await broadcastDelegateVestingShares(username, p.delegatee, vests, key);
      return ok(request, result);
    }

    case 'POWER_UP': {
      const result = await broadcastTransferToVesting(
        username,
        p.to || username,
        formatAssetAmount(p.amount, 'HIVE'),
        key
      );
      return ok(request, result);
    }

    case 'POWER_DOWN': {
      const vests = await toVests(String(p.amount), p.unit || 'HP');
      const result = await broadcastWithdrawVesting(username, vests, key);
      return ok(request, result);
    }

    case 'WITNESS_VOTE': {
      const result = await broadcastWitnessVote(username, p.witness, !!p.approve, key);
      return ok(request, result);
    }

    case 'PROXY': {
      const result = await broadcastSetProxy(username, p.proxy || '', key);
      return ok(request, result);
    }

    case 'UPDATE_PROPOSAL_VOTE': {
      const ids = (Array.isArray(p.proposal_ids) ? p.proposal_ids : [p.proposal_ids]).map(Number);
      const result = await broadcastProposalVote(username, ids, !!p.approve, key);
      return ok(request, result);
    }

    case 'ENCODE_MEMO': {
      const receiver = await getAccount(p.receiver);
      if (!receiver) throw new Error(`Account @${p.receiver} not found`);
      const receiverRole = normalizeRole(p.role, 'memo');
      const receiverKey =
        receiverRole === 'memo' ? receiver.memo_key : (receiver as any)[receiverRole]?.key_auths?.[0]?.[0];
      if (!receiverKey) throw new Error(`@${p.receiver} has no ${receiverRole} key`);
      const encoded = encodeMemo(String(p.message ?? ''), key, String(receiverKey));
      return ok(request, encoded, { publicKey });
    }

    case 'DECODE_MEMO': {
      const decoded = decodeMemo(String(p.memo ?? ''), key);
      return ok(request, decoded, { publicKey });
    }

    case 'ADD_ACCOUNT_AUTHORITY': {
      const authRole = normalizeRole(p.role, 'posting');
      if (authRole !== 'posting' && authRole !== 'active') throw new Error('Role must be posting or active');
      const result = await broadcastAccountAuthorityChange(
        username,
        p.authorizedUsername,
        authRole,
        Number(p.weight) || 1,
        key
      );
      return ok(request, result);
    }

    case 'REMOVE_ACCOUNT_AUTHORITY': {
      const authRole = normalizeRole(p.role, 'posting');
      if (authRole !== 'posting' && authRole !== 'active') throw new Error('Role must be posting or active');
      const result = await broadcastAccountAuthorityChange(username, p.authorizedUsername, authRole, null, key);
      return ok(request, result);
    }

    case 'CONVERT': {
      const result = p.collateralized
        ? await broadcastCollateralizedConvert(username, p.amount, key)
        : await broadcastConvert(username, p.amount, key);
      return ok(request, result);
    }

    case 'RECURRENT_TRANSFER': {
      const result = await broadcastRecurrentTransfer(
        username,
        p.to,
        p.amount,
        p.memo || '',
        Number(p.recurrence),
        Number(p.executions),
        key
      );
      return ok(request, result);
    }

    case 'SEND_TOKEN': {
      const json = buildTransferPayload(String(p.currency).toUpperCase(), p.to, String(p.amount), p.memo || '');
      const result = await broadcastCustomJson(username, HE_ID, json, true, key);
      return ok(request, result);
    }

    case 'SIGNED_CALL': {
      const callRole = role === 'active' ? 'active' : 'posting';
      const params = typeof p.params === 'string' ? p.params : JSON.stringify(p.params ?? {});
      const result = await broadcastSignedCall(username, p.method, params, callRole, key);
      return ok(request, result);
    }

    default:
      return failure(request, 'unsupported', `Unsupported request type: ${request.type}`);
  }
}
