/**
 * Hive Blockchain Client
 *
 * Wrapper around @hiveio/dhive providing all blockchain interactions.
 * The dhive client works in React Native without modification.
 */

import { Client, ExtendedAccount, DynamicGlobalProperties, PrivateKey } from '@hiveio/dhive';
import type { DelegationInfo, TransactionRecord } from '../types';
import { logger } from '../logger';

const DEFAULT_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://anyx.io',
  'https://api.openhive.network',
  'https://rpc.ausbit.dev',
];

let client: Client | null = null;

export function getClient(nodes?: string[]): Client {
  if (!client) {
    client = new Client(nodes || DEFAULT_NODES, {
      timeout: 10000,
      failoverThreshold: 3,
    });
  }
  return client;
}

export function setNodes(nodes: string[]): void {
  client = new Client(nodes, {
    timeout: 10000,
    failoverThreshold: 3,
  });
}

export async function getAccount(username: string): Promise<ExtendedAccount | null> {
  const [account] = await getClient().database.getAccounts([username]);
  return account || null;
}

export async function getAccounts(usernames: string[]): Promise<ExtendedAccount[]> {
  return getClient().database.getAccounts(usernames);
}

export async function getDynamicGlobalProperties(): Promise<DynamicGlobalProperties> {
  return getClient().database.getDynamicGlobalProperties();
}

// Only show financial/monetary operations -- skip social and internal ops
const ALLOWED_OPS = new Set([
  'transfer',
  'transfer_to_vesting',
  'withdraw_vesting',
  'delegate_vesting_shares',
  'claim_reward_balance',
  'transfer_to_savings',
  'transfer_from_savings',
  'fill_convert_request',
  'fill_order',
  'curation_reward',
  'author_reward',
  'producer_reward',
  'custom_json', // parsed into HE ops below
]);

// Map Hive Engine contract actions to human-readable types
function parseHiveEngineOp(data: any): {
  type: string;
  from: string;
  to: string;
  amount: string;
  memo: string;
} | null {
  const from = data.required_posting_auths?.[0] || data.required_auths?.[0] || '';

  if (data.id !== 'ssc-mainnet-hive') return null;

  try {
    const parsed = JSON.parse(data.json);
    const action = parsed.contractAction;
    const payload = parsed.contractPayload || {};
    const symbol = payload.symbol || '';
    const quantity = payload.quantity || '';
    const to = payload.to || '';

    switch (action) {
      case 'transfer':
        return { type: 'he_transfer', from, to, amount: `${quantity} ${symbol}`, memo: payload.memo || '' };
      case 'stake':
        return { type: 'he_stake', from, to: to || from, amount: `${quantity} ${symbol}`, memo: '' };
      case 'unstake':
        return { type: 'he_unstake', from, to: '', amount: `${quantity} ${symbol}`, memo: '' };
      case 'delegate':
        return { type: 'he_delegate', from, to, amount: `${quantity} ${symbol}`, memo: '' };
      case 'undelegate':
        return { type: 'he_undelegate', from, to: payload.from || '', amount: `${quantity} ${symbol}`, memo: '' };
      case 'buy':
        return { type: 'he_market_buy', from, to: '', amount: `${quantity} ${symbol}`, memo: '' };
      case 'sell':
        return { type: 'he_market_sell', from, to: '', amount: `${quantity} ${symbol}`, memo: '' };
      default:
        // Skip unrecognized HE contract actions
        return null;
    }
  } catch (err) {
    logger.warn('[Signet] Failed to parse Hive Engine custom_json:', err);
    return null;
  }
}

export async function getAccountHistory(
  username: string,
  start: number = -1,
  limit: number = 100
): Promise<TransactionRecord[]> {
  const history = await getClient().database.getAccountHistory(username, start, limit);

  return history
    .map(([, op]: any) => {
      const [type, data] = op.op;

      // Only show financial operations
      if (!ALLOWED_OPS.has(type)) return null;

      let from = '';
      let to = '';
      let amount = '';
      let memo = '';
      let resolvedType = type;

      switch (type) {
        case 'transfer':
          from = data.from; to = data.to;
          amount = data.amount; memo = data.memo;
          break;
        case 'transfer_to_vesting':
          from = data.from; to = data.to;
          amount = data.amount;
          break;
        case 'withdraw_vesting':
          from = data.account;
          amount = data.vesting_shares;
          break;
        case 'delegate_vesting_shares':
          from = data.delegator; to = data.delegatee;
          amount = data.vesting_shares;
          break;
        case 'claim_reward_balance':
          from = data.account;
          amount = [data.reward_hive, data.reward_hbd, data.reward_vesting_balance]
            .filter((a: string) => a && !a.startsWith('0.000'))
            .join(' + ');
          break;
        case 'transfer_to_savings':
        case 'transfer_from_savings':
          from = data.from; to = data.to;
          amount = data.amount; memo = data.memo || '';
          break;
        case 'fill_convert_request':
          from = data.owner;
          amount = data.amount_out;
          break;
        case 'custom_json': {
          // Parse Hive Engine operations into proper types
          const heOp = parseHiveEngineOp(data);
          if (heOp) {
            resolvedType = heOp.type;
            from = heOp.from; to = heOp.to;
            amount = heOp.amount; memo = heOp.memo;
          } else {
            // Non-HE custom_json -- skip unless it's a known dApp
            return null;
          }
          break;
        }
        case 'curation_reward':
          from = data.curator;
          amount = data.reward;
          memo = data.comment_permlink;
          break;
        case 'author_reward':
          from = data.author;
          amount = [data.hive_payout, data.hbd_payout, data.vesting_payout]
            .filter((a: string) => a && !a.startsWith('0.000'))
            .join(' + ');
          memo = data.permlink;
          break;
        case 'producer_reward':
          from = data.producer;
          amount = data.vesting_shares;
          break;
        case 'fill_order':
          from = data.current_owner;
          amount = data.current_pays;
          break;
        default:
          // Skip anything we don't explicitly handle
          return null;
      }

      return {
        id: op.trx_id,
        type: resolvedType,
        timestamp: op.timestamp,
        from,
        to,
        amount,
        memo,
        block: op.block,
      };
    })
    .filter(Boolean)
    .reverse() as TransactionRecord[];
}

export async function getVestingDelegations(username: string): Promise<DelegationInfo[]> {
  return getClient().database.getVestingDelegations(username, '', 1000) as any;
}

export async function getWitnessesByVote(from: string, limit: number = 100) {
  return getClient().call('condenser_api', 'get_witnesses_by_vote', [from, limit]);
}

export async function getActiveWitnesses() {
  return getClient().call('condenser_api', 'get_active_witnesses', []);
}

export async function listProposals() {
  return getClient().call('condenser_api', 'list_proposals', [
    [],
    100,
    'by_total_votes',
    'descending',
    'active',
  ]);
}

export async function listProposalVotes(voter: string): Promise<Set<number>> {
  const result: any[] = await getClient().call('condenser_api', 'list_proposal_votes', [
    [voter],
    1000,
    'by_voter_proposal',
    'ascending',
    'active',
  ]);
  const ids = new Set<number>();
  for (const v of result) {
    if (v.voter === voter) {
      ids.add(v.proposal?.id ?? v.proposal?.proposal_id);
    }
  }
  return ids;
}

export async function getResourceCredits(username: string) {
  const result: any = await getClient().call('rc_api', 'find_rc_accounts', {
    accounts: [username],
  });
  return result.rc_accounts?.[0] || null;
}

export async function getCurrentMedianHistoryPrice() {
  return getClient().database.getCurrentMedianHistoryPrice();
}

export async function getRewardFund() {
  return getClient().call('condenser_api', 'get_reward_fund', ['post']);
}

// --- Broadcast Operations ---

export async function broadcastTransfer(
  from: string,
  to: string,
  amount: string,
  memo: string,
  activeKey: string
) {
  const key = PrivateKey.fromString(activeKey);
  return getClient().broadcast.transfer({ from, to, amount, memo }, key);
}

export async function broadcastVote(
  voter: string,
  author: string,
  permlink: string,
  weight: number,
  postingKey: string
) {
  const key = PrivateKey.fromString(postingKey);
  return getClient().broadcast.vote({ voter, author, permlink, weight }, key);
}

export async function broadcastTransferToVesting(
  from: string,
  to: string,
  amount: string,
  activeKey: string
) {
  const key = PrivateKey.fromString(activeKey);
  return getClient().broadcast.sendOperations(
    [['transfer_to_vesting', { from, to, amount }]],
    key
  );
}

export async function broadcastWithdrawVesting(
  account: string,
  vestingShares: string,
  activeKey: string
) {
  const key = PrivateKey.fromString(activeKey);
  return getClient().broadcast.sendOperations(
    [['withdraw_vesting', { account, vesting_shares: vestingShares }]],
    key
  );
}

export async function broadcastDelegateVestingShares(
  delegator: string,
  delegatee: string,
  vestingShares: string,
  activeKey: string
) {
  const key = PrivateKey.fromString(activeKey);
  return getClient().broadcast.delegateVestingShares(
    { delegator, delegatee, vesting_shares: vestingShares },
    key
  );
}

export async function broadcastWitnessVote(
  account: string,
  witness: string,
  approve: boolean,
  postingKey: string
) {
  const key = PrivateKey.fromString(postingKey);
  return getClient().broadcast.sendOperations(
    [
      [
        'account_witness_vote',
        { account, witness, approve },
      ],
    ],
    key
  );
}

export async function broadcastProposalVote(
  voter: string,
  proposalIds: number[],
  approve: boolean,
  postingKey: string
) {
  const key = PrivateKey.fromString(postingKey);
  return getClient().broadcast.sendOperations(
    [
      [
        'update_proposal_votes',
        { voter, proposal_ids: proposalIds, approve, extensions: [] },
      ],
    ],
    key
  );
}

export async function broadcastCustomJson(
  account: string,
  id: string,
  json: string,
  useActive: boolean,
  key: string
) {
  const privateKey = PrivateKey.fromString(key);
  return getClient().broadcast.sendOperations(
    [
      [
        'custom_json',
        {
          required_auths: useActive ? [account] : [],
          required_posting_auths: useActive ? [] : [account],
          id,
          json,
        },
      ],
    ],
    privateKey
  );
}

/**
 * Broadcast a VSC/Magi signed call as a custom_json operation.
 * The method becomes the custom_json id, and params becomes the json body.
 */
export async function broadcastSignedCall(
  account: string,
  method: string,
  params: string,
  keyRole: 'posting' | 'active',
  key: string
) {
  const privateKey = PrivateKey.fromString(key);
  return getClient().broadcast.sendOperations(
    [
      [
        'custom_json',
        {
          required_auths: keyRole === 'active' ? [account] : [],
          required_posting_auths: keyRole === 'posting' ? [account] : [],
          id: method,
          json: params,
        },
      ],
    ],
    privateKey
  );
}

export async function broadcastTransferToSavings(
  from: string,
  to: string,
  amount: string,
  memo: string,
  activeKey: string
) {
  const key = PrivateKey.fromString(activeKey);
  return getClient().broadcast.sendOperations(
    [['transfer_to_savings', { from, to, amount, memo }]],
    key
  );
}

export async function broadcastTransferFromSavings(
  from: string,
  requestId: number,
  to: string,
  amount: string,
  memo: string,
  activeKey: string
) {
  const key = PrivateKey.fromString(activeKey);
  return getClient().broadcast.sendOperations(
    [['transfer_from_savings', { from, request_id: requestId, to, amount, memo }]],
    key
  );
}

export async function broadcastClaimRewards(
  account: string,
  rewardHive: string,
  rewardHbd: string,
  rewardVests: string,
  postingKey: string
) {
  const key = PrivateKey.fromString(postingKey);
  return getClient().broadcast.sendOperations(
    [
      [
        'claim_reward_balance',
        {
          account,
          reward_hive: rewardHive,
          reward_hbd: rewardHbd,
          reward_vests: rewardVests,
        },
      ],
    ],
    key
  );
}

export async function broadcastSetProxy(
  account: string,
  proxy: string,
  postingKey: string
) {
  const key = PrivateKey.fromString(postingKey);
  return getClient().broadcast.sendOperations(
    [['account_witness_proxy', { account, proxy }]],
    key
  );
}

export async function broadcastConvert(
  owner: string,
  amount: string,
  activeKey: string
) {
  const key = PrivateKey.fromString(activeKey);
  const requestId = Math.floor(Math.random() * 2 ** 32);
  return getClient().broadcast.sendOperations(
    [['convert', { owner, requestid: requestId, amount }]],
    key
  );
}

export async function broadcastCollateralizedConvert(
  owner: string,
  amount: string,
  activeKey: string
) {
  const key = PrivateKey.fromString(activeKey);
  const requestId = Math.floor(Math.random() * 2 ** 32);
  return getClient().broadcast.sendOperations(
    [['collateralized_convert', { owner, requestid: requestId, amount }]],
    key
  );
}
