import { encodeMsg, encodeOp, encodeOps } from 'hive-uri';
import {
  buildProtocolCallbackUrl,
  callbackPayloadFromResponse,
  getProtocolRequesterLabel,
  parseProtocolRequest,
} from '../src/core/protocol';

describe('parseProtocolRequest: signet://login', () => {
  it('turns a login link into a posting-key signature request', () => {
    const parsed = parseProtocolRequest(
      'signet://login?username=Alice&callback=myapp%3A%2F%2Fauth&request_id=req-123',
    );

    expect(parsed).not.toBeNull();
    expect(parsed!.isLogin).toBe(true);
    expect(parsed!.callback).toBe('myapp://auth');
    expect(parsed!.requestId).toBe('req-123');
    expect(parsed!.request.type).toBe('SIGN_BUFFER');
    expect(parsed!.request.payload.username).toBe('alice');
    expect(parsed!.request.payload.role).toBe('posting');
    expect(parsed!.request.payload.message).toMatch(/^signet-login:alice:\d+:[a-z0-9]{16}$/);
  });

  it('uses the caller-supplied challenge when given', () => {
    const parsed = parseProtocolRequest(
      'signet://login?username=alice&callback=https%3A%2F%2Fpeakd.com%2Fcb&challenge=nonce-42',
    );
    expect(parsed!.request.payload.message).toBe('nonce-42');
    expect(parsed!.label).toBe('peakd.com');
  });

  it('accepts redirect_uri and the signet:///login path form', () => {
    expect(parseProtocolRequest('signet://login?username=alice&redirect_uri=myapp%3A%2F%2Fauth')?.callback).toBe('myapp://auth');
    expect(parseProtocolRequest('signet:///login?username=alice&callback=myapp%3A%2F%2Fauth')?.request.payload.username).toBe('alice');
  });

  it('never produces a request that would export a key', () => {
    const parsed = parseProtocolRequest('signet://login?username=alice&callback=myapp%3A%2F%2Fauth');
    expect(JSON.stringify(parsed)).not.toMatch(/posting_key/);
  });

  it('rejects missing callback or username, plain http callbacks and self-referencing callbacks', () => {
    expect(parseProtocolRequest('signet://login?username=alice')).toBeNull();
    expect(parseProtocolRequest('signet://login?callback=myapp%3A%2F%2Fauth')).toBeNull();
    expect(parseProtocolRequest('signet://login?username=alice&callback=not a url')).toBeNull();
    expect(parseProtocolRequest('signet://login?username=alice&callback=http%3A%2F%2Fevil.com')).toBeNull();
    expect(parseProtocolRequest('signet://login?username=alice&callback=signet%3A%2F%2Flogin')).toBeNull();
  });
});

describe('parseProtocolRequest: signet://sign', () => {
  it('signs an arbitrary message with the requested role', () => {
    const parsed = parseProtocolRequest(
      'signet://sign?message=hello&role=ACTIVE&callback=myapp%3A%2F%2Fsigned&username=bob',
    );
    expect(parsed!.isLogin).toBe(false);
    expect(parsed!.request.type).toBe('SIGN_BUFFER');
    expect(parsed!.request.payload).toMatchObject({ username: 'bob', message: 'hello', role: 'active' });
  });

  it('lets the user choose the account when none is given', () => {
    const parsed = parseProtocolRequest('signet://sign?message=hello&callback=myapp%3A%2F%2Fsigned');
    expect(parsed!.request.payload.username).toBeNull();
  });

  it('refuses owner-key signing and unknown actions', () => {
    expect(parseProtocolRequest('signet://sign?message=x&role=owner&callback=myapp%3A%2F%2Fs')).toBeNull();
    expect(parseProtocolRequest('signet://export?username=alice&callback=myapp%3A%2F%2Fs')).toBeNull();
  });
});

describe('parseProtocolRequest: hive-uri', () => {
  const vote = ['vote', { voter: '__signer', author: 'bar', permlink: 'baz', weight: 10000 }] as any;
  const transfer = ['transfer', { from: '__signer', to: 'bar', amount: '1.000 HIVE', memo: '' }] as any;

  it('decodes hive://sign/op into a broadcast request', () => {
    const parsed = parseProtocolRequest(encodeOp(vote));
    expect(parsed!.source).toBe('hive-uri');
    expect(parsed!.request.type).toBe('BROADCAST');
    expect(parsed!.request.payload.operations).toEqual([vote]);
    expect(parsed!.callback).toBeNull();
  });

  it('decodes hive://sign/ops with signer, authority and callback params', () => {
    const link = encodeOps([vote, transfer], {
      signer: 'alice',
      authority: 'active',
      callback: 'https://example.com/done?tx={{id}}',
    });
    const parsed = parseProtocolRequest(link);
    expect(parsed!.request.payload.username).toBe('alice');
    expect(parsed!.request.payload.role).toBe('active');
    expect(parsed!.request.payload.operations).toHaveLength(2);
    expect(parsed!.callback).toBe('https://example.com/done?tx={{id}}');
    expect(parsed!.label).toBe('example.com');
  });

  it('decodes a no-broadcast link into a sign-only request', () => {
    const link = encodeOp(vote, { no_broadcast: true, callback: 'myapp://sig/{{sig}}' });
    const parsed = parseProtocolRequest(link);
    expect(parsed!.request.type).toBe('SIGN_TRANSACTION');
    expect(parsed!.request.payload.tx.operations).toEqual([vote]);
    expect(parsed!.request.payload.tx.expiration).toBeUndefined();
  });

  it('decodes the transfer alias, with and without a base64u memo', () => {
    const parsed = parseProtocolRequest('hive://sign/transfer/bar/1.000%20HIVE');
    expect(parsed!.request.type).toBe('BROADCAST');
    expect(parsed!.request.payload.operations[0][0]).toBe('transfer');
    expect(parsed!.request.payload.operations[0][1]).toEqual({ from: '__signer', to: 'bar', amount: '1.000 HIVE', memo: '' });

    const withMemo = parseProtocolRequest('hive://sign/transfer/bar/1.000%20HIVE/aGVsbG8.?s=alice');
    expect(withMemo!.request.payload.operations[0][1].memo).toBe('hello');
    expect(withMemo!.request.payload.username).toBe('alice');
  });

  it('decodes the follow alias into a posting custom_json', () => {
    const parsed = parseProtocolRequest('hive://sign/follow/bob');
    const [name, body] = parsed!.request.payload.operations[0];
    expect(name).toBe('custom_json');
    expect(body.required_posting_auths).toEqual(['__signer']);
    expect(JSON.parse(body.json)).toEqual(['follow', { follower: '__signer', following: 'bob', what: ['blog'] }]);
  });

  it('decodes hive://sign/msg into a message signature request', () => {
    const parsed = parseProtocolRequest(encodeMsg('prove it', { signer: 'alice', authority: 'active' }));
    expect(parsed!.request.type).toBe('SIGN_BUFFER');
    expect(parsed!.request.payload).toMatchObject({ username: 'alice', message: 'prove it', role: 'active' });
  });

  it('ignores hive:// links that are not signing requests', () => {
    expect(parseProtocolRequest('hive://transfer?to=alice')).toBeNull();
    expect(parseProtocolRequest('hive://sign/op/not-base64')).toBeNull();
  });
});

describe('buildProtocolCallbackUrl', () => {
  it('appends a signed login result as query params', () => {
    const url = buildProtocolCallbackUrl('myapp://auth?source=test', {
      status: 'success',
      username: 'alice',
      challenge: 'nonce',
      signature: 'deadbeef',
      public_key: 'STM1234',
      request_id: 'req-123',
    });
    expect(url).toContain('source=test');
    expect(url).toContain('status=success');
    expect(url).toContain('username=alice');
    expect(url).toContain('challenge=nonce');
    expect(url).toContain('signature=deadbeef');
    expect(url).toContain('public_key=STM1234');
    expect(url).toContain('request_id=req-123');
  });

  it('fills hive-uri templates instead of appending', () => {
    const url = buildProtocolCallbackUrl('https://example.com/done?tx={{id}}&b={{block}}', {
      status: 'success',
      id: 'abc123',
      block: '99',
    });
    expect(url).toBe('https://example.com/done?tx=abc123&b=99');
  });

  it('reports errors', () => {
    const url = buildProtocolCallbackUrl('myapp://auth', {
      status: 'error',
      error: 'user_cancel',
      message: 'Rejected',
    });
    expect(url).toContain('status=error');
    expect(url).toContain('error=user_cancel');
  });
});

describe('callbackPayloadFromResponse', () => {
  const login = parseProtocolRequest(
    'signet://login?username=alice&callback=myapp%3A%2F%2Fauth&request_id=r1',
  )!;

  it('returns the challenge, signature and public key for a login', () => {
    const payload = callbackPayloadFromResponse(login, {
      success: true,
      error: null,
      result: 'sig',
      data: null,
      message: 'ok',
      request_id: login.request.id,
      publicKey: 'STMpub',
      username: 'alice',
    });
    expect(payload).toEqual({
      status: 'success',
      request_id: 'r1',
      username: 'alice',
      challenge: login.request.payload.message,
      signature: 'sig',
      public_key: 'STMpub',
    });
  });

  it('returns the transaction id for a broadcast', () => {
    const parsed = parseProtocolRequest(encodeOp(['vote', { voter: '__signer', author: 'a', permlink: 'p', weight: 1 }]))!;
    const payload = callbackPayloadFromResponse(parsed, {
      success: true,
      error: null,
      result: { id: 'tx1', block_num: 5, trx_num: 2 },
      data: null,
      message: 'ok',
      request_id: parsed.request.id,
      username: 'alice',
    });
    expect(payload).toMatchObject({ status: 'success', id: 'tx1', block: '5', txn: '2' });
  });

  it('maps failures', () => {
    const payload = callbackPayloadFromResponse(login, {
      success: false,
      error: 'user_cancel',
      result: null,
      data: null,
      message: 'User rejected the request',
      request_id: login.request.id,
    });
    expect(payload).toMatchObject({ status: 'error', error: 'user_cancel', username: 'alice' });
  });
});

describe('getProtocolRequesterLabel', () => {
  it('prefers hostname for https callbacks', () => {
    expect(getProtocolRequesterLabel('https://peakd.com/auth/callback')).toBe('peakd.com');
  });

  it('falls back to the scheme for custom callbacks', () => {
    expect(getProtocolRequesterLabel('myapp://auth')).toBe('myapp');
  });

  it('describes links without a callback', () => {
    expect(getProtocolRequesterLabel(null)).toBe('a hive:// link');
  });
});
