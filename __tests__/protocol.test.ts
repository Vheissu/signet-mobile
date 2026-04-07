import {
  buildProtocolCallbackUrl,
  getProtocolRequesterLabel,
  parseProtocolRequest,
} from '../src/core/protocol';

describe('parseProtocolRequest', () => {
  it('parses signet login links', () => {
    const request = parseProtocolRequest(
      'signet://login?username=Alice&callback=myapp%3A%2F%2Fauth&request_id=req-123',
    );

    expect(request).toEqual({
      type: 'login',
      username: 'alice',
      callback: 'myapp://auth',
      requestId: 'req-123',
      rawUrl: 'signet://login?username=Alice&callback=myapp%3A%2F%2Fauth&request_id=req-123',
    });
  });

  it('accepts redirect_uri as a callback alias', () => {
    const request = parseProtocolRequest(
      'signet://login?username=alice&redirect_uri=myapp%3A%2F%2Fauth',
    );

    expect(request?.callback).toBe('myapp://auth');
  });

  it('parses signet:///login path form', () => {
    const request = parseProtocolRequest(
      'signet:///login?username=alice&callback=myapp%3A%2F%2Fauth',
    );

    expect(request?.username).toBe('alice');
  });

  it('returns null when callback is missing', () => {
    expect(parseProtocolRequest('signet://login?username=alice')).toBeNull();
  });

  it('returns null when username is missing', () => {
    expect(parseProtocolRequest('signet://login?callback=myapp%3A%2F%2Fauth')).toBeNull();
  });

  it('returns null when callback is not a valid URL', () => {
    expect(parseProtocolRequest('signet://login?username=alice&callback=not a url')).toBeNull();
  });

  it('returns null for non-signet schemes', () => {
    expect(
      parseProtocolRequest('hive://login?username=alice&callback=myapp%3A%2F%2Fauth'),
    ).toBeNull();
  });
});

describe('buildProtocolCallbackUrl', () => {
  it('appends success payload fields', () => {
    const callbackUrl = buildProtocolCallbackUrl('myapp://auth', {
      status: 'success',
      username: 'alice',
      posting_key: '5postingkey',
      request_id: 'req-123',
    });

    expect(callbackUrl).toContain('status=success');
    expect(callbackUrl).toContain('username=alice');
    expect(callbackUrl).toContain('posting_key=5postingkey');
    expect(callbackUrl).toContain('request_id=req-123');
  });

  it('preserves existing callback query parameters', () => {
    const callbackUrl = buildProtocolCallbackUrl('myapp://auth?source=test', {
      status: 'error',
      error: 'user_rejected',
      message: 'Rejected',
    });

    expect(callbackUrl).toContain('source=test');
    expect(callbackUrl).toContain('status=error');
    expect(callbackUrl).toContain('error=user_rejected');
  });
});

describe('getProtocolRequesterLabel', () => {
  it('prefers hostname for https callbacks', () => {
    expect(getProtocolRequesterLabel('https://peakd.com/auth/callback')).toBe('peakd.com');
  });

  it('falls back to the scheme for custom callbacks', () => {
    expect(getProtocolRequesterLabel('myapp://auth')).toBe('myapp');
  });
});
