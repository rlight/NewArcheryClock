'use strict';
// Password protection for other devices on the network. Requests from the clock computer itself
// (loopback) never need a password. Everyone else logs in once per device (30-day cookie).
// The password is stored only as a scrypt hash in data/auth.json — never in settings, which are
// broadcast to every screen.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./config');

const AUTH_FILE = path.join(DATA_DIR, 'auth.json');
const DEFAULT_PASSWORD = 'archery';
const COOKIE = 'ac_session';
const SESSION_DAYS = 30;

function hash(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(String(password), salt, 32).toString('hex') };
}

function load() {
  try {
    const a = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
    if (a && a.salt && a.hash) return { sessions: {}, required: true, ...a };
  } catch { /* first run */ }
  const a = { ...hash(DEFAULT_PASSWORD), isDefault: true, required: true, sessions: {} };
  save(a);
  return a;
}
function save(a) {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  fs.writeFileSync(AUTH_FILE + '.tmp', JSON.stringify(a, null, 2));
  fs.renameSync(AUTH_FILE + '.tmp', AUTH_FILE);
}

let state = load();

function isLocal(req) {
  const ip = req.socket.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function pruneSessions() {
  const now = Date.now();
  for (const [k, exp] of Object.entries(state.sessions)) if (exp < now) delete state.sessions[k];
}

function isAuthed(req) {
  if (isLocal(req) || !state.required) return true;
  const tok = cookies(req)[COOKIE];
  if (!tok) return false;
  const key = crypto.createHash('sha256').update(tok).digest('hex');
  const exp = state.sessions[key];
  return !!exp && exp > Date.now();
}

// simple per-address throttle: after 5 failures, one attempt every 5 s for 10 minutes
const failures = new Map();
function throttled(ip) {
  const f = failures.get(ip);
  if (!f) return false;
  if (Date.now() - f.last > 10 * 60 * 1000) { failures.delete(ip); return false; }
  return f.count >= 5 && Date.now() - f.last < 5000;
}

function checkPassword(password) {
  const { hash: h } = hash(password, state.salt);
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(state.hash, 'hex'));
}

/** Returns a Set-Cookie header value on success, or throws with a user-facing message. */
function login(req, password) {
  const ip = req.socket.remoteAddress || '?';
  if (throttled(ip)) throw new Error('Too many attempts. Wait a few seconds and try again.');
  if (typeof password !== 'string' || !checkPassword(password)) {
    const f = failures.get(ip) || { count: 0, last: 0 };
    failures.set(ip, { count: f.count + 1, last: Date.now() });
    throw new Error('Wrong password.');
  }
  failures.delete(ip);
  const tok = crypto.randomBytes(32).toString('base64url');
  pruneSessions();
  state.sessions[crypto.createHash('sha256').update(tok).digest('hex')] = Date.now() + SESSION_DAYS * 864e5;
  save(state);
  return `${COOKIE}=${tok}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}

function logout(req) {
  const tok = cookies(req)[COOKIE];
  if (tok) { delete state.sessions[crypto.createHash('sha256').update(tok).digest('hex')]; save(state); }
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** Changing the password signs every other device out. */
function setPassword(password) {
  if (typeof password !== 'string' || password.length < 4 || password.length > 100) {
    throw new Error('The password must be 4 to 100 characters.');
  }
  state = { ...hash(password), isDefault: password === DEFAULT_PASSWORD, required: state.required, sessions: {} };
  save(state);
}

function setRequired(required) {
  state.required = !!required;
  save(state);
}

function info(req) {
  return { local: isLocal(req), authed: isAuthed(req), required: state.required, isDefault: !!state.isDefault };
}

module.exports = { isLocal, isAuthed, login, logout, setPassword, setRequired, info, DEFAULT_PASSWORD };
