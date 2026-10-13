/**
 * JavaScript injected into every page in the in-app browser.
 *
 * It defines `window.hive_keychain` (and `window.signet`) with the Hive
 * Keychain method signatures, so dApps written for Keychain work without
 * changes. Each call posts a message to React Native; the approval screen
 * answers through `window.__signetDeliver`.
 *
 * Kept as a plain string so it can be injected before the page's own
 * scripts run (`injectedJavaScriptBeforeContentLoaded`).
 */

export interface BridgeMessage {
  target: 'signet';
  requestId: string;
  type: string;
  payload: any;
}

export const BRIDGE_TARGET = 'signet';

export const INJECTED_BRIDGE = `
(function () {
  if (window.__signetBridgeInstalled) return;
  window.__signetBridgeInstalled = true;

  var pending = {};
  var counter = 0;
  var TIMEOUT = 10 * 60 * 1000;

  function post(type, payload, callback) {
    var requestId = 'web_' + (++counter) + '_' + Date.now();
    var settled = false;
    pending[requestId] = function (response) {
      if (settled) return;
      settled = true;
      delete pending[requestId];
      if (typeof callback === 'function') {
        try { callback(response); } catch (e) { console.error('[signet] callback threw', e); }
      }
    };
    setTimeout(function () {
      if (pending[requestId]) {
        pending[requestId]({
          success: false, error: 'timeout', result: null, data: payload,
          message: 'Request timed out', request_id: requestId
        });
      }
    }, TIMEOUT);
    window.ReactNativeWebView.postMessage(JSON.stringify({
      target: '${BRIDGE_TARGET}', requestId: requestId, type: type, payload: payload
    }));
    return requestId;
  }

  window.__signetDeliver = function (requestId, response) {
    var cb = pending[requestId];
    if (cb) cb(response);
  };

  function amount(value, currency, precision) {
    precision = precision || 3;
    var str = String(value == null ? '' : value).trim();
    var num = parseFloat(str);
    if (!isFinite(num)) return '0.' + new Array(precision + 1).join('0') + ' ' + currency;
    return num.toFixed(precision) + ' ' + String(currency).toUpperCase();
  }

  function lower(role, fallback) {
    return (typeof role === 'string' && role ? role : fallback).toLowerCase();
  }

  function splitUnit(value, fallback) {
    var parts = String(value).trim().split(' ');
    var unit = (parts[1] || '').toUpperCase();
    return { amount: parts[0], unit: unit === 'VESTS' || unit === 'HP' ? unit : fallback };
  }

  var keychain = {
    current_id: 1,
    requests: {},
    handshake_callback: null,

    requestHandshake: function (callback) {
      this.handshake_callback = callback || null;
      if (typeof callback === 'function') setTimeout(callback, 0);
    },
    requestVerifyKey: function (account, message, key, callback) {
      post('DECODE_MEMO', { username: account, memo: message, role: lower(key, 'memo') }, callback);
    },
    requestEncodeMessage: function (username, receiver, message, key, callback) {
      post('ENCODE_MEMO', { username: username, receiver: receiver, message: message, role: lower(key, 'memo') }, callback);
    },
    requestSignBuffer: function (account, message, key, callback, rpc, title) {
      post('SIGN_BUFFER', { username: account, message: message, role: lower(key, 'posting'), title: title || '' }, callback);
    },
    requestAddAccountAuthority: function (account, authorizedUsername, role, weight, callback) {
      post('ADD_ACCOUNT_AUTHORITY', { username: account, authorizedUsername: authorizedUsername, role: lower(role, 'posting'), weight: Number(weight) || 1 }, callback);
    },
    requestRemoveAccountAuthority: function (account, authorizedUsername, role, callback) {
      post('REMOVE_ACCOUNT_AUTHORITY', { username: account, authorizedUsername: authorizedUsername, role: lower(role, 'posting') }, callback);
    },
    requestBroadcast: function (account, operations, key, callback) {
      post('BROADCAST', { username: account, operations: operations, role: lower(key, 'posting') }, callback);
    },
    requestSignTx: function (account, tx, key, callback) {
      post('SIGN_TRANSACTION', { username: account, tx: tx, role: lower(key, 'active') }, callback);
    },
    requestSignedCall: function (account, method, params, key, callback) {
      post('SIGNED_CALL', { username: account, method: method, params: params, typeWif: lower(key, 'posting') }, callback);
    },
    requestPost: function (account, title, body, parent_perm, parent_account, json_metadata, permlink, comment_options, callback) {
      post('POST', {
        username: account, title: title, body: body, parent_permlink: parent_perm, parent_author: parent_account,
        json_metadata: typeof json_metadata === 'string' ? json_metadata : JSON.stringify(json_metadata || {}),
        permlink: permlink, comment_options: comment_options || null
      }, callback);
    },
    // Keychain's order is (account, permlink, author, weight).
    requestVote: function (account, permlink, author, weight, callback) {
      post('VOTE', { voter: account, author: author, permlink: permlink, weight: Number(weight) }, callback);
    },
    requestCustomJson: function (account, id, key, json, display_msg, callback) {
      post('CUSTOM_JSON', {
        username: account, id: id, json: typeof json === 'string' ? json : JSON.stringify(json),
        role: lower(key, 'posting'), display: display_msg || ''
      }, callback);
    },
    requestTransfer: function (account, to, amt, memo, currency, callback, enforce) {
      post('TRANSFER', { from: account, to: to, amount: amount(amt, currency), memo: memo || '', enforce: !!enforce }, callback);
    },
    requestSendToken: function (account, to, amt, memo, currency, callback) {
      post('SEND_TOKEN', { username: account, to: to, amount: String(amt), memo: memo || '', currency: currency }, callback);
    },
    requestDelegation: function (username, delegatee, amt, unit, callback) {
      var s = splitUnit(amt, (unit || 'VESTS').toUpperCase());
      post('DELEGATE', { delegator: username, delegatee: delegatee, amount: s.amount, unit: s.unit }, callback);
    },
    requestWitnessVote: function (username, witness, vote, callback) {
      post('WITNESS_VOTE', { account: username, witness: witness, approve: !!vote }, callback);
    },
    requestProxy: function (username, proxy, callback) {
      post('PROXY', { account: username, proxy: proxy || '' }, callback);
    },
    requestPowerUp: function (username, recipient, hive, callback) {
      post('POWER_UP', { from: username, to: recipient, amount: amount(hive, 'HIVE') }, callback);
    },
    requestPowerDown: function (username, hive_power, callback) {
      var s = splitUnit(hive_power, 'HP');
      post('POWER_DOWN', { account: username, amount: s.amount, unit: s.unit }, callback);
    },
    requestUpdateProposalVote: function (username, proposal_ids, approve, extensions, callback) {
      var ids = typeof proposal_ids === 'string' ? JSON.parse(proposal_ids) : proposal_ids;
      var ext = typeof extensions === 'string' ? JSON.parse(extensions || '[]') : (extensions || []);
      post('UPDATE_PROPOSAL_VOTE', { voter: username, proposal_ids: ids, approve: !!approve, extensions: ext }, callback);
    },
    requestRecurrentTransfer: function (username, to, amt, currency, memo, recurrence, executions, callback) {
      post('RECURRENT_TRANSFER', {
        from: username, to: to, amount: amount(amt, currency), memo: memo || '',
        recurrence: Number(recurrence), executions: Number(executions)
      }, callback);
    },
    requestConversion: function (username, amt, collaterized, callback) {
      post('CONVERT', { owner: username, amount: amount(amt, collaterized ? 'HIVE' : 'HBD'), collateralized: !!collaterized }, callback);
    }
  };

  window.hive_keychain = keychain;
  window.signet = { isInstalled: function () { return true; }, keychain: keychain };

  function announce() {
    try {
      window.dispatchEvent(new CustomEvent('hive_keychain_installed'));
      window.dispatchEvent(new CustomEvent('signet_installed'));
    } catch (e) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', announce);
  } else {
    announce();
  }
  announce();
})();
true;
`;

/**
 * Script that hands a response back to the page for a request id.
 */
export function deliverScript(requestId: string, response: unknown): string {
  // JSON.stringify output is a valid JS literal except for U+2028/9, which
  // are line terminators in JavaScript source.
  const json = JSON.stringify(response)
    .split(String.fromCharCode(0x2028)).join('\\u2028')
    .split(String.fromCharCode(0x2029)).join('\\u2029');
  const id = JSON.stringify(requestId);
  return `window.__signetDeliver && window.__signetDeliver(${id}, ${json}); true;`;
}

/**
 * Parse a message from the page. Returns null for anything that is not a
 * well-formed bridge message.
 */
export function parseBridgeMessage(raw: string): BridgeMessage | null {
  try {
    const data = JSON.parse(raw);
    if (!data || data.target !== BRIDGE_TARGET) return null;
    if (typeof data.requestId !== 'string' || typeof data.type !== 'string') return null;
    return { target: BRIDGE_TARGET, requestId: data.requestId, type: data.type, payload: data.payload ?? {} };
  } catch {
    return null;
  }
}
