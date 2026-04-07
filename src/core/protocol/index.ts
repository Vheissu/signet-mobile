export interface ProtocolLoginRequest {
  type: 'login';
  username: string;
  callback: string;
  requestId?: string;
  rawUrl: string;
}

export interface ProtocolCallbackPayload {
  status: 'success' | 'error';
  username?: string;
  posting_key?: string;
  request_id?: string;
  error?: string;
  message?: string;
}

function normalizePathname(pathname: string): string {
  return pathname.replace(/^\/+/, '').toLowerCase();
}

function normalizeUsername(username: string): string {
  return username.replace(/^@/, '').trim().toLowerCase();
}

function getRequestPath(url: URL): string {
  const pathname = normalizePathname(url.pathname);
  if (pathname) return pathname;
  return url.host.trim().toLowerCase();
}

export function parseProtocolRequest(rawUrl: string): ProtocolLoginRequest | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'signet:') {
      return null;
    }

    if (getRequestPath(url) !== 'login') {
      return null;
    }

    const callback =
      url.searchParams.get('callback')
      || url.searchParams.get('redirect_uri')
      || url.searchParams.get('return_url');
    const username = normalizeUsername(url.searchParams.get('username') || '');
    const requestId = url.searchParams.get('request_id') || undefined;

    if (!callback || !username) {
      return null;
    }

    new URL(callback);

    return {
      type: 'login',
      username,
      callback,
      requestId,
      rawUrl,
    };
  } catch {
    return null;
  }
}

export function buildProtocolCallbackUrl(
  callback: string,
  payload: ProtocolCallbackPayload,
): string {
  const url = new URL(callback);

  url.searchParams.set('status', payload.status);

  if (payload.username) {
    url.searchParams.set('username', payload.username);
  }
  if (payload.posting_key) {
    url.searchParams.set('posting_key', payload.posting_key);
  }
  if (payload.request_id) {
    url.searchParams.set('request_id', payload.request_id);
  }
  if (payload.error) {
    url.searchParams.set('error', payload.error);
  }
  if (payload.message) {
    url.searchParams.set('message', payload.message);
  }

  return url.toString();
}

export function getProtocolRequesterLabel(callback: string): string {
  try {
    const url = new URL(callback);
    const protocol = url.protocol.replace(/:$/, '');

    if (protocol === 'http' || protocol === 'https') {
      if (url.hostname) {
        return url.hostname;
      }
      if (url.host) {
        return url.host;
      }
    }

    return protocol;
  } catch {
    return callback;
  }
}
