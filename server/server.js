'use strict';
// New ArcheryClock server. No npm dependencies: `node server/server.js`.
// Serves the display (/display/), the control GUI (/control/), the JSON API and an SSE stream.

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Engine } = require('./engine');
const cfg = require('./config');
const auth = require('./auth');
const media = require('./media');

const VERSION = require('../package.json').version;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const TICK_MS = 50;
const RUNNING_PUSH_MS = 250;

const monotonic = () => Number(process.hrtime.bigint() / 1000000n);

let settings = cfg.loadSettings();

// ---------------------------------------------------------------- national anthem
// The display PC plays the file; the server only tracks what is playing so every page agrees.
const ANTHEM_FILE = path.join(PUBLIC_DIR, 'anthem', 'anthems.json');
function listAnthems() {
  try { return JSON.parse(fs.readFileSync(ANTHEM_FILE, 'utf8')).filter((a) => a && a.id && a.file); } catch { return []; }
}
let anthem = null;          // { id, title, file, durationSec, startedAt }
let anthemTimer = null;
function anthemStop() {
  if (!anthem) return;
  anthem = null; clearTimeout(anthemTimer); anthemTimer = null;
  pushPending = true;
}
function anthemPlay(id) {
  const list = listAnthems();
  const a = list.find((x) => x.id === (id || settings.anthem.choice)) || list[0];
  if (!a) throw new Error('no anthem recordings found in public/anthem/');
  clearTimeout(anthemTimer);
  anthem = { id: a.id, title: a.title, file: a.file, durationSec: a.durationSec || 120, startedAt: Date.now() };
  anthemTimer = setTimeout(anthemStop, (anthem.durationSec + 2) * 1000);
  pushPending = true;
}
function anthemSnapshot() {
  return anthem ? { playing: true, ...anthem, volume: settings.anthem.volume } : { playing: false };
}
const clients = new Set();
let signalId = 0;
let pushPending = true;

const engine = new Engine(settings, monotonic(), {
  onSignal: (count) => { if (settings.sound.enabled) broadcast('signal', { id: ++signalId, count }); },
  onChange: () => { pushPending = true; },
});

// ---------------------------------------------------------------- SSE

let seq = 0;
function snapshot() {
  return { seq: ++seq, serverTime: Date.now(), ...engine.snapshot(monotonic()), anthem: anthemSnapshot() };
}
function sse(res, event, data) { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); }
function broadcast(event, data) { for (const res of clients) sse(res, event, data); }
function pushState() { pushPending = false; broadcast('state', snapshot()); }

let lastPush = 0;
setInterval(() => {
  const now = monotonic();
  engine.tick(now);
  const running = engine.deadline !== null && !engine.paused;
  if (pushPending || ((running || engine.phase === 'emergency') && now - lastPush >= RUNNING_PUSH_MS)) {
    lastPush = now;
    pushState();
  }
}, TICK_MS);

// keep proxies / Windows from dropping idle SSE connections
setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 15000);

// ---------------------------------------------------------------- settings changes

function applySettings(next, { resetRound }) {
  settings = cfg.validate(next);
  cfg.saveSettings(settings);
  engine.setSettings(settings, monotonic(), { resetRound });
  broadcast('settings', settings);
}

function updateSettings(patch) {
  const merged = cfg.deepMerge(cfg.clone(settings), patch);
  const roundChanged = JSON.stringify(cfg.validateRound(merged.round)) !== JSON.stringify(settings.round);
  if (roundChanged && !(patch.start && 'scenario' in patch.start)) merged.start.scenario = '--';
  applySettings(merged, { resetRound: roundChanged });
  return settings;
}

function loadRound(round) {
  applySettings({ ...settings, round: cfg.validateRound(round) }, { resetRound: true });
}

// ---------------------------------------------------------------- commands

const SERVER_COMMANDS = {
  toggleFormat() { updateSettings({ display: { timeFormat: settings.display.timeFormat === 'sec' ? 'min' : 'sec' } }); },
  toggleIcons() { updateSettings({ display: { hideIcons: !settings.display.hideIcons } }); },
  loadPreset(id) {
    const p = cfg.presetById(id);
    if (!p) throw new Error('unknown preset ' + id);
    loadRound(p.round);
  },
  loadScenario(slot) {
    const sc = cfg.readScenario(slot);
    if (sc) return loadRound(sc.round);
    const p = cfg.presetById('shift' + slot);
    if (!p) throw new Error('unknown scenario ' + slot);
    loadRound(p.round);
  },
  testSound() { broadcast('signal', { id: ++signalId, count: 1, test: true }); },
  anthemPlay(id) { anthemPlay(id); },
  anthemStop() { anthemStop(); },
};

function runCommand(cmd, arg) {
  if (typeof cmd !== 'string') throw new Error('cmd required');
  if (SERVER_COMMANDS[cmd]) SERVER_COMMANDS[cmd](arg);
  else {
    if (cmd === 'emergency' || (cmd === 'pageUp' && engine.system !== 'finals')) anthemStop();
    engine.command(cmd, arg, monotonic());
  }
  pushState();
}

// ---------------------------------------------------------------- HTTP

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
  '.oga': 'audio/ogg', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.m4a': 'audio/mp4',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) { reject(new Error('body too large')); req.destroy(); } });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { reject(new Error('invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function listThemes() {
  const dir = path.join(PUBLIC_DIR, 'themes');
  let ids = [];
  try { ids = fs.readdirSync(dir); } catch { /* none */ }
  return ids.map((id) => {
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(dir, id, 'theme.json'), 'utf8'));
      return { id, name: meta.name || id, description: meta.description || '', order: meta.order || 99 };
    } catch { return null; }
  }).filter(Boolean).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

function lanUrls() {
  const port = server.address() ? server.address().port : settings.server.port;
  const urls = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) urls.push(`http://${a.address}:${port}/`);
  }
  urls.push(`http://${os.hostname()}:${port}/`);
  return urls;
}

function listCustomSounds() {
  try {
    return fs.readdirSync(path.join(PUBLIC_DIR, 'sounds', 'custom')).filter((f) => /\.wav$/i.test(f)).map((f) => 'file:' + f);
  } catch { return []; }
}

async function handleApi(req, res, url) {
  const p = url.pathname;
  try {
    if (p === '/api/session' && req.method === 'GET') return sendJson(res, 200, auth.info(req));
    if (p === '/api/login' && req.method === 'POST') {
      const body = await readBody(req);
      try {
        const cookie = auth.login(req, body.password);
        res.setHeader('Set-Cookie', cookie);
        return sendJson(res, 200, { ok: true });
      } catch (e) { return sendJson(res, 401, { ok: false, error: e.message }); }
    }
    if (p === '/api/logout' && req.method === 'POST') {
      res.setHeader('Set-Cookie', auth.logout(req));
      return sendJson(res, 200, { ok: true });
    }
    if (!auth.isAuthed(req)) return sendJson(res, 401, { ok: false, error: 'login required' });
    if (p === '/api/password' && req.method === 'PUT') {
      const body = await readBody(req);
      // from another device, the current password is needed too
      if (!auth.isLocal(req)) {
        try { auth.login(req, body.current); } catch { return sendJson(res, 403, { ok: false, error: 'The current password is wrong.' }); }
      }
      if (typeof body.required === 'boolean') {
        if (!auth.isLocal(req) && body.required === false) return sendJson(res, 403, { ok: false, error: 'Turning the password off is only possible on the clock computer.' });
        auth.setRequired(body.required);
      }
      if (body.password != null) {
        auth.setPassword(body.password);                       // signs every device out...
        if (!auth.isLocal(req)) res.setHeader('Set-Cookie', auth.login(req, body.password));   // ...except this one
      }
      return sendJson(res, 200, { ok: true, ...auth.info(req) });
    }
    if (p === '/api/state' && req.method === 'GET') return sendJson(res, 200, snapshot());
    if (p === '/api/command' && req.method === 'POST') {
      const body = await readBody(req);
      if (body.cmd === 'musicKey' || body.cmd === 'musicOpen') {
        if (settings.venue !== 'private') return sendJson(res, 403, { ok: false, error: 'Music is only available when Location is set to Private range.' });
        try {
          if (body.cmd === 'musicOpen') await media.openApp();
          else await media.sendKey(body.arg);
          return sendJson(res, 200, { ok: true, snapshot: snapshot() });
        } catch (e) { return sendJson(res, 500, { ok: false, error: 'Music control failed: ' + e.message }); }
      }
      runCommand(body.cmd, body.arg);
      return sendJson(res, 200, { ok: true, snapshot: snapshot() });
    }
    if (p === '/api/settings' && req.method === 'GET') return sendJson(res, 200, settings);
    if (p === '/api/settings' && req.method === 'PUT') {
      const body = await readBody(req);
      return sendJson(res, 200, updateSettings(body));
    }
    if (p === '/api/presets' && req.method === 'GET') {
      return sendJson(res, 200, cfg.PRESETS.map((x) => ({ ...x, summary: cfg.summarize(x.round) })));
    }
    if (p === '/api/scenarios' && req.method === 'GET') return sendJson(res, 200, cfg.listScenarios());
    const m = p.match(/^\/api\/scenarios\/(F(?:[1-9]|1[0-2]))$/);
    if (m && req.method === 'PUT') {
      const body = await readBody(req);
      const existing = cfg.readScenario(m[1]);
      const sc = cfg.writeScenario(m[1], body.name || (existing && existing.name) || m[1], body.round || settings.round);
      return sendJson(res, 200, { ...sc, summary: cfg.summarize(sc.round) });
    }
    if (m && req.method === 'DELETE') { cfg.deleteScenario(m[1]); return sendJson(res, 200, { ok: true }); }
    if (p === '/api/themes' && req.method === 'GET') return sendJson(res, 200, listThemes());
    if (p === '/api/anthems' && req.method === 'GET') return sendJson(res, 200, listAnthems());
    if (p === '/api/sounds' && req.method === 'GET') return sendJson(res, 200, { custom: listCustomSounds() });
    if (p === '/api/info' && req.method === 'GET') return sendJson(res, 200, { version: VERSION, urls: lanUrls(), hostname: os.hostname() });
    return sendJson(res, 404, { ok: false, error: 'not found' });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: e.message });
  }
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') { res.writeHead(302, { Location: '/control/' }); return res.end(); }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      // /display and /control without trailing slash
      if (!rel.includes('.') && fs.existsSync(path.join(file, 'index.html'))) { res.writeHead(302, { Location: rel + '/' }); return res.end(); }
      res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found');
    }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    // byte ranges: browsers need them to seek in audio (Safari will not play media without them)
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && (range[1] || range[2])) {
      let start = range[1] ? Number(range[1]) : Math.max(0, st.size - Number(range[2]));
      let end = range[1] && range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
      if (start >= st.size || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${st.size}`,
        'Content-Length': end - start + 1, 'Cache-Control': 'no-cache' });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': st.size, 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

// Open without logging in: the login page itself and the session/login API.
const PUBLIC_PATHS = /^\/(login(\/.*)?|api\/(session|login|logout)|favicon\.ico)$/;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!PUBLIC_PATHS.test(url.pathname) && !auth.isAuthed(req)) {
    if (url.pathname.startsWith('/api/') || url.pathname === '/events') return sendJson(res, 401, { ok: false, error: 'login required' });
    res.writeHead(302, { Location: '/login/?next=' + encodeURIComponent(url.pathname + url.search) });
    return res.end();
  }
  if (url.pathname === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 1000\n\n');
    sse(res, 'settings', settings);
    sse(res, 'state', snapshot());
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  return serveStatic(req, res, url);
});

const port = Number(process.env.PORT) || settings.server.port;
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`Port ${port} is already used by another program. Change "server.port" in data/settings.json (or set PORT) and start again.`);
  else console.error(e.message);
  process.exit(1);
});
server.listen(port, '0.0.0.0', () => {
  console.log(`New ArcheryClock ${VERSION}`);
  console.log(`  Display:  http://localhost:${port}/display/`);
  for (const u of lanUrls()) console.log(`  Control:  ${u}`);
});

module.exports = { server, engine };
