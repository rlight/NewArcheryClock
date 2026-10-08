'use strict';
// Self-update from GitHub Releases.
//
// check():   asks GitHub for the latest release, compares its version with ours, and remembers the
//            .zip and .zip.sha256 assets.
// install(): downloads the zip, verifies its SHA-256, copies the platform helper into data/update/
//            and starts it detached, then exits this server. The helper (windows/update.ps1 or
//            mac/update.command) waits for us to exit, backs the current app up to backup/<version>,
//            unpacks the new one (never touching data/), starts it and checks it answers with the new
//            version — otherwise it puts the backup back and starts the old version again.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const APP_DIR = path.join(__dirname, '..');

function parseVer(v) {
  const m = String(v || '').trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
/** >0 when a is newer than b. Unparseable versions never count as newer. */
function compareVersions(a, b) {
  const x = parseVer(a), y = parseVer(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}
function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
/** First 64-hex-digit token in a .sha256 file ("<hash>  <name>" or just the hash). */
function parseShaFile(text) {
  const m = String(text || '').match(/\b[0-9a-f]{64}\b/i);
  return m ? m[0].toLowerCase() : null;
}

function create({ version, dataDir, getSettings, canInstall, onChange = () => {} }) {
  const updDir = path.join(dataDir, 'update');
  const logFile = path.join(dataDir, 'update.log');
  const state = {
    current: version, latest: null, available: false, notes: '', name: '', publishedAt: null,
    checkedAt: null, status: 'idle', error: null, devCopy: fs.existsSync(path.join(APP_DIR, '.git')),
  };
  let assets = null;

  function log(msg) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.appendFileSync(logFile, `${new Date().toISOString()} [server ${version}] ${msg}\n`);
    } catch { /* logging must never break the clock */ }
  }
  function set(patch) { Object.assign(state, patch); onChange(); }

  function releaseUrl() {
    if (process.env.ARCHERYCLOCK_UPDATE_URL) return process.env.ARCHERYCLOCK_UPDATE_URL;
    const repo = (getSettings().update || {}).repo || 'rlight/NewArcheryClock';
    return `https://api.github.com/repos/${repo}/releases/latest`;
  }
  const headers = { 'User-Agent': `NewArcheryClock/${version}`, Accept: 'application/vnd.github+json' };

  async function check() {
    if (state.status === 'checking' || state.status === 'downloading' || state.status === 'installing') return state;
    set({ status: 'checking', error: null });
    try {
      const res = await fetch(releaseUrl(), { headers, signal: AbortSignal.timeout(10000) });
      if (res.status === 404) { assets = null; set({ status: 'idle', latest: null, available: false, checkedAt: Date.now() }); return state; }
      if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
      const rel = await res.json();
      const list = Array.isArray(rel.assets) ? rel.assets : [];
      const zip = list.find((a) => /\.zip$/i.test(a.name));
      const sha = list.find((a) => /\.sha256$/i.test(a.name));
      const latest = String(rel.tag_name || rel.name || '').replace(/^v/i, '');
      assets = zip && sha ? { zip: zip.browser_download_url, sha: sha.browser_download_url, zipName: zip.name } : null;
      set({
        status: 'idle', latest, checkedAt: Date.now(),
        available: !!assets && compareVersions(latest, version) > 0,
        notes: String(rel.body || '').slice(0, 4000), name: String(rel.name || ''), publishedAt: rel.published_at || null,
      });
      if (state.available) log(`update available: ${version} -> ${latest}`);
    } catch (e) {
      set({ status: 'idle', error: `Could not check for updates: ${e.message}`, checkedAt: Date.now() });
    }
    return state;
  }

  async function download(url) {
    const res = await fetch(url, { headers: { 'User-Agent': headers['User-Agent'] }, redirect: 'follow', signal: AbortSignal.timeout(180000) });
    if (!res.ok) throw new Error(`download failed (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }

  /** Returns null when the install has started (the server is about to exit), else an error string. */
  async function install({ port }) {
    if (state.devCopy) return 'This is a development copy (it has a .git folder). Update it with git pull instead.';
    if (['downloading', 'installing'].includes(state.status)) return 'An update is already being installed.';
    const busy = canInstall();
    if (busy) return busy;
    if (!state.available || !assets) return 'No update is available.';
    if (!['win32', 'darwin'].includes(process.platform)) return 'Automatic install works on Windows and Mac only.';
    const target = state.latest;
    set({ status: 'downloading', error: null });
    log(`downloading ${target}`);
    try {
      const want = parseShaFile((await download(assets.sha)).toString('utf8'));
      if (!want) throw new Error('the checksum file is empty or malformed');
      const zip = await download(assets.zip);
      const got = sha256(zip);
      if (got !== want) throw new Error(`checksum mismatch (expected ${want.slice(0, 12)}…, got ${got.slice(0, 12)}…); nothing was changed`);
      fs.rmSync(updDir, { recursive: true, force: true });
      fs.mkdirSync(updDir, { recursive: true });
      const zipPath = path.join(updDir, `NewArcheryClock-${target}.zip`);
      fs.writeFileSync(zipPath, zip);
      // run the helper from data/update so the copy in the app folder can be replaced while it runs
      const win = process.platform === 'win32';
      const helperSrc = path.join(APP_DIR, win ? 'windows/update.ps1' : 'mac/update.command');
      const helper = path.join(updDir, path.basename(helperSrc));
      fs.copyFileSync(helperSrc, helper);
      const args = [APP_DIR, zipPath, String(process.pid), String(port), version, target, dataDir];
      // The helper writes this file as its very first step. We only exit once it exists, so a helper
      // that fails to start can never leave the range without a clock.
      const started = path.join(updDir, 'helper-started');
      if (win) {
        // "start" gives PowerShell its own console and makes it independent of this process
        // (a child launched directly from node could die with it, or fail without a console).
        const q = (s) => `"${String(s).replace(/"/g, '')}"`;
        const ps = ['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', q(helper),
          '-AppDir', q(args[0]), '-Zip', q(args[1]), '-ServerPid', args[2], '-Port', args[3],
          '-OldVersion', q(args[4]), '-NewVersion', q(args[5]), '-DataDir', q(args[6])].join(' ');
        spawn('cmd.exe', ['/d', '/s', '/c', `"start "" /min ${ps}"`], { windowsVerbatimArguments: true, windowsHide: true, stdio: 'ignore' }).unref();
      } else {
        spawn('/bin/bash', [helper, ...args], { detached: true, stdio: 'ignore' }).unref();
      }
      log(`verified ${target} (sha256 ${got.slice(0, 12)}…), waiting for the installer to start`);
      set({ status: 'installing' });
      const t0 = Date.now();
      const wait = setInterval(() => {
        if (fs.existsSync(started)) {
          clearInterval(wait);
          log('installer started; server exiting');
          setTimeout(() => process.exit(0), 500);
        } else if (Date.now() - t0 > 15000) {
          clearInterval(wait);
          log('installer did not start within 15 s; update cancelled, clock keeps running');
          set({ status: 'idle', error: 'The installer did not start, so nothing was changed and the clock kept running. See data/update.log.' });
        }
      }, 250);
      return null;
    } catch (e) {
      log(`install failed: ${e.message}`);
      set({ status: 'idle', error: `Update failed: ${e.message}` });
      return state.error;
    }
  }

  return { check, install, state: () => ({ ...state }), log };
}

module.exports = { create, compareVersions, parseShaFile, sha256 };
