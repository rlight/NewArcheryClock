'use strict';
// Music control for a private range: sends the computer's media keys (play/pause, next, previous)
// to whatever music app is running on the clock computer (e.g. the Amazon Music app), and can open
// that app. Only fixed commands are run — nothing from the request reaches a shell.

const { execFile, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const KEYS = { playPause: 'playPause', next: 'next', previous: 'previous' };

// Windows: virtual-key codes 179 play/pause, 176 next, 177 previous, sent with keybd_event.
const WIN_VK = { playPause: 0xB3, next: 0xB0, previous: 0xB1 };
function windowsKey(key) {
  const vk = WIN_VK[key];
  const ps = `Add-Type -Name K -Namespace M -MemberDefinition '[DllImport("user32.dll")] public static extern void keybd_event(byte b, byte s, int f, int e);';` +
    `[M.K]::keybd_event(${vk},0,1,0);[M.K]::keybd_event(${vk},0,3,0)`;
  return run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps]);
}

// macOS: post an NX_SYSDEFINED media-key event (16 play, 17 next, 18 previous) with JavaScript for
// Automation. macOS asks once for Accessibility permission for the app that runs the clock.
const MAC_NX = { playPause: 16, next: 17, previous: 18 };
function macKey(key) {
  const code = MAC_NX[key];
  const jxa = `ObjC.import('Cocoa');
function post(down) {
  const flags = down ? 0xa00 : 0xb00;
  const ev = $.NSEvent.otherEventWithTypeLocationModifierFlagsTimestampWindowNumberContextSubtypeData1Data2(
    14, $.NSMakePoint(0, 0), flags, 0, 0, $(), 8, (${code} << 16) | ((down ? 0xa : 0xb) << 8), -1);
  $.CGEventPost(0, ev.CGEvent);
}
post(true); post(false);`;
  return run('osascript', ['-l', 'JavaScript', '-e', jxa]);
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 8000, windowsHide: true }, (err, _out, stderr) => {
      if (err) reject(new Error((stderr || err.message || '').toString().trim().split('\n').pop() || 'media key failed'));
      else resolve();
    });
  });
}

function sendKey(key) {
  if (!KEYS[key]) return Promise.reject(new Error('unknown media key'));
  if (process.platform === 'win32') return windowsKey(key);
  if (process.platform === 'darwin') return macKey(key);
  return Promise.reject(new Error('Music control works on Windows and Mac only'));
}

// Open the Amazon Music desktop app (or, if it isn't installed, the web player in the default browser).
function openApp() {
  if (process.platform === 'win32') {
    const exe = path.join(process.env.LOCALAPPDATA || '', 'Amazon Music', 'Amazon Music.exe');
    if (fs.existsSync(exe)) return detach(exe, []);
    return detach('cmd.exe', ['/c', 'start', '', 'https://music.amazon.com/']);
  }
  if (process.platform === 'darwin') {
    const app = ['/Applications/Amazon Music.app', path.join(os.homedir(), 'Applications/Amazon Music.app')].find((p) => fs.existsSync(p));
    return detach('open', app ? ['-a', app] : ['https://music.amazon.com/']);
  }
  return Promise.reject(new Error('Music control works on Windows and Mac only'));
}

function detach(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true });
    p.on('error', reject);
    p.unref();
    setTimeout(resolve, 300);
  });
}

module.exports = { sendKey, openApp, KEYS };
