import { INJECTED_BRIDGE, deliverScript, parseBridgeMessage } from '../src/core/dapp/inject';

describe('browser bridge', () => {
  it('parses well-formed bridge messages and ignores everything else', () => {
    expect(
      parseBridgeMessage(JSON.stringify({ target: 'signet', requestId: 'web_1', type: 'VOTE', payload: { a: 1 } })),
    ).toEqual({ target: 'signet', requestId: 'web_1', type: 'VOTE', payload: { a: 1 } });

    expect(parseBridgeMessage('not json')).toBeNull();
    expect(parseBridgeMessage(JSON.stringify({ target: 'other', requestId: 'x', type: 'VOTE' }))).toBeNull();
    expect(parseBridgeMessage(JSON.stringify({ target: 'signet', type: 'VOTE' }))).toBeNull();
  });

  it('builds a delivery script that survives line separators', () => {
    const script = deliverScript('web_1', { success: true, message: 'ok done' });
    expect(script).toContain('window.__signetDeliver("web_1"');
    expect(script).not.toContain(' ');
    expect(script).toContain('\\u2028');
  });

  it('defines the Keychain surface and announces itself', () => {
    const page: any = {
      addEventListener: jest.fn(),
      readyState: 'complete',
    };
    const dispatched: string[] = [];
    const win: any = {
      document: page,
      ReactNativeWebView: { postMessage: jest.fn() },
      dispatchEvent: (e: any) => dispatched.push(e.type),
      setTimeout,
    };
    // Run the bridge against a fake window.
    const fn = new Function('window', 'document', 'CustomEvent', 'setTimeout', 'console', INJECTED_BRIDGE);
    fn(win, page, class { type: string; constructor(type: string) { this.type = type; } }, setTimeout, console);

    const keychain = win.hive_keychain;
    expect(typeof keychain.requestSignBuffer).toBe('function');
    expect(typeof keychain.requestVote).toBe('function');
    expect(typeof keychain.requestTransfer).toBe('function');
    expect(dispatched).toContain('hive_keychain_installed');

    // Keychain's vote order is (account, permlink, author, weight)
    keychain.requestVote('alice', 'my-post', 'bob', 10000, () => {});
    const sent = JSON.parse(win.ReactNativeWebView.postMessage.mock.calls[0][0]);
    expect(sent.type).toBe('VOTE');
    expect(sent.payload).toEqual({ voter: 'alice', author: 'bob', permlink: 'my-post', weight: 10000 });

    // Responses reach the original callback
    const cb = jest.fn();
    keychain.requestTransfer('alice', 'bob', '1', 'memo', 'HIVE', cb, false);
    const transfer = JSON.parse(win.ReactNativeWebView.postMessage.mock.calls[1][0]);
    expect(transfer.payload.amount).toBe('1.000 HIVE');
    win.__signetDeliver(transfer.requestId, { success: true });
    expect(cb).toHaveBeenCalledWith({ success: true });
  });
});
