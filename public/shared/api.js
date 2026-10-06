// Small client for the New ArcheryClock server (see docs/architecture.md).
// Shared by the control GUI and anything else that needs the JSON API or the SSE stream.

// Other devices must sign in (the clock computer itself never does). When a session is
// missing or has expired, send the whole page to the login screen and come back afterwards.
export function toLogin() {
  const w = window.top || window;
  const here = w.location.pathname + w.location.search + w.location.hash;
  w.location.href = '/login/?next=' + encodeURIComponent(here);
}

async function request(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (res.status === 401) { toLogin(); throw new Error('Sign-in required'); }
  if (!res.ok) {
    const msg = (data && data.error) || `${method} ${path} failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  put: (path, body) => request('PUT', path, body),
  del: (path) => request('DELETE', path),
  post: (path, body) => request('POST', path, body),
  /** Send a clock command. Resolves to { ok, snapshot }; rejects when ok is false. */
  async command(cmd, arg) {
    const body = arg === undefined ? { cmd } : { cmd, arg };
    const res = await request('POST', '/api/command', body);
    if (res && res.ok === false) throw new Error(res.error || `Command ${cmd} refused`);
    return res;
  },
};

/**
 * Subscribe to /events. Reconnects automatically with backoff.
 * onStatus receives "connecting" | "open" | "reconnecting".
 * Returns { close() }.
 */
export function connect({ onState, onSettings, onSignal, onStatus } = {}) {
  let es = null;
  let closed = false;
  let retry = 500;
  let timer = null;
  let watchdog = null;
  let lastMsg = 0;

  const status = (s) => { try { onStatus && onStatus(s); } catch (e) { console.error(e); } };
  const handler = (fn) => (ev) => {
    lastMsg = Date.now();
    if (!fn) return;
    let data;
    try { data = JSON.parse(ev.data); } catch { return; }
    try { fn(data); } catch (e) { console.error(e); }
  };

  function open() {
    if (closed) return;
    status(es ? 'reconnecting' : 'connecting');
    es = new EventSource('/events');
    es.addEventListener('open', () => { retry = 500; lastMsg = Date.now(); status('open'); });
    es.addEventListener('state', handler(onState));
    es.addEventListener('settings', handler(onSettings));
    es.addEventListener('signal', handler(onSignal));
    es.addEventListener('message', () => { lastMsg = Date.now(); });
    es.addEventListener('error', () => {
      // EventSource retries by itself, but not after a hard close (e.g. HTTP error), and
      // its own retry can be slow; do it ourselves with a capped backoff.
      es.close();
      status('reconnecting');
      // a stream refused for want of a session looks like any other error: ask the server
      fetch('/api/session').then((r) => r.json()).then((s) => { if (s && !s.authed) toLogin(); }).catch(() => {});
      schedule();
    });
  }

  function schedule() {
    clearTimeout(timer);
    if (closed) return;
    timer = setTimeout(() => { timer = null; open(); }, retry);
    retry = Math.min(retry * 2, 5000);
  }

  // If the stream silently dies (sleeping phone, Wi-Fi hand-over) reconnect when the page
  // becomes visible again.
  const onVisible = () => {
    if (document.visibilityState === 'visible' && es && es.readyState === EventSource.CLOSED) {
      retry = 250; schedule();
    }
  };
  document.addEventListener('visibilitychange', onVisible);
  watchdog = setInterval(() => {
    if (es && es.readyState === EventSource.CLOSED && !timer) schedule();
  }, 3000);

  open();
  return {
    close() {
      closed = true;
      clearTimeout(timer);
      clearInterval(watchdog);
      document.removeEventListener('visibilitychange', onVisible);
      if (es) es.close();
    },
    get lastMessageAt() { return lastMsg; },
  };
}
