import {
  cleanUsername,
  describeRequest,
  formatAssetAmount,
  isDAppRequestType,
  normalizeRole,
  requiredAuthority,
  substituteSigner,
} from '../src/core/dapp/requests';
import type { DAppRequest } from '../src/core/types';

function req(type: DAppRequest['type'], payload: any): DAppRequest {
  return { id: 'r1', type, payload, origin: 'peakd.com', timestamp: 0 };
}

describe('normalizeRole / cleanUsername / formatAssetAmount', () => {
  it('normalises Keychain-style capitalised roles', () => {
    expect(normalizeRole('Posting', 'active')).toBe('posting');
    expect(normalizeRole('ACTIVE', 'posting')).toBe('active');
    expect(normalizeRole(undefined, 'memo')).toBe('memo');
    expect(normalizeRole('bogus', 'posting')).toBe('posting');
  });

  it('cleans usernames', () => {
    expect(cleanUsername(' @Alice ')).toBe('alice');
    expect(cleanUsername('')).toBeNull();
    expect(cleanUsername(null)).toBeNull();
  });

  it('formats chain amounts', () => {
    expect(formatAssetAmount(1, 'hive')).toBe('1.000 HIVE');
    expect(formatAssetAmount('2.5 HBD', 'HBD')).toBe('2.500 HBD');
    expect(formatAssetAmount('x', 'HIVE')).toBe('0.000 HIVE');
  });

  it('recognises request types', () => {
    expect(isDAppRequestType('TRANSFER')).toBe(true);
    expect(isDAppRequestType('EXPORT_KEY')).toBe(false);
  });
});

describe('requiredAuthority', () => {
  it('needs active for money-moving operations', () => {
    expect(requiredAuthority([['transfer', {}]])).toBe('active');
    expect(requiredAuthority([['vote', {}], ['delegate_vesting_shares', {}]])).toBe('active');
    expect(requiredAuthority([['account_witness_vote', {}]])).toBe('active');
  });

  it('needs active for custom_json with required_auths', () => {
    expect(requiredAuthority([['custom_json', { required_auths: ['alice'], required_posting_auths: [] }]])).toBe('active');
    expect(requiredAuthority([['custom_json', { required_auths: [], required_posting_auths: ['alice'] }]])).toBe('posting');
  });

  it('defaults to posting', () => {
    expect(requiredAuthority([['vote', {}], ['comment', {}]])).toBe('posting');
    expect(requiredAuthority(undefined)).toBe('posting');
  });
});

describe('substituteSigner', () => {
  it('replaces the hive-uri placeholder everywhere', () => {
    const ops = [['transfer', { from: '__signer', to: '__signer', memo: 'hi', nested: { who: '__signer' } }]];
    expect(substituteSigner(ops, 'alice')).toEqual([
      ['transfer', { from: 'alice', to: 'alice', memo: 'hi', nested: { who: 'alice' } }],
    ]);
  });

  it('leaves other values untouched', () => {
    expect(substituteSigner({ a: 1, b: null, c: '__signer_x' }, 'alice')).toEqual({ a: 1, b: null, c: '__signer_x' });
  });
});

describe('describeRequest', () => {
  it('describes a transfer as active-key and sensitive', () => {
    const d = describeRequest(req('TRANSFER', { from: 'alice', to: 'bob', amount: '1.000 HIVE', memo: 'thanks' }));
    expect(d.title).toBe('Transfer');
    expect(d.keyRole).toBe('active');
    expect(d.username).toBe('alice');
    expect(d.isSensitive).toBe(true);
    expect(d.fields.map((f) => f.label)).toEqual(['To', 'Amount', 'Memo']);
  });

  it('describes a vote as posting-key', () => {
    const d = describeRequest(req('VOTE', { voter: 'alice', author: 'bob', permlink: 'post', weight: 10000 }));
    expect(d.title).toBe('Upvote');
    expect(d.keyRole).toBe('posting');
    expect(d.isSensitive).toBe(false);
  });

  it('uses the sign-buffer title for logins', () => {
    const d = describeRequest(req('SIGN_BUFFER', { username: 'alice', message: 'nonce', role: 'posting', title: 'Sign in' }));
    expect(d.title).toBe('Sign in');
    expect(d.fields[0].code).toBe(true);
  });

  it('infers the authority for raw broadcasts when none is given', () => {
    const posting = describeRequest(req('BROADCAST', { username: 'alice', operations: [['vote', {}]] }));
    const active = describeRequest(req('BROADCAST', { username: 'alice', operations: [['transfer', {}]] }));
    expect(posting.keyRole).toBe('posting');
    expect(active.keyRole).toBe('active');
    expect(active.isSensitive).toBe(true);
  });

  it('respects an explicit role on broadcasts', () => {
    const d = describeRequest(req('BROADCAST', { username: 'alice', role: 'active', operations: [['vote', {}]] }));
    expect(d.keyRole).toBe('active');
  });

  it('treats custom_json with active as sensitive', () => {
    const d = describeRequest(req('CUSTOM_JSON', { username: 'alice', id: 'ssc-mainnet-hive', json: '{}', role: 'active' }));
    expect(d.keyRole).toBe('active');
    expect(d.isSensitive).toBe(true);
    expect(d.fields.find((f) => f.label === 'JSON')?.value).toBe('{}');
  });

  it('leaves the account open when the dApp did not name one', () => {
    const d = describeRequest(req('SIGN_BUFFER', { username: null, message: 'x', role: 'posting' }));
    expect(d.username).toBeNull();
  });

  it('flags unknown types as sensitive', () => {
    const d = describeRequest(req('NOPE' as any, {}));
    expect(d.title).toBe('Unknown Request');
    expect(d.isSensitive).toBe(true);
  });
});
