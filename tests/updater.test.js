'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { compareVersions, parseShaFile, sha256 } = require('../server/updater');

test('version comparison', () => {
  assert.ok(compareVersions('0.1.1', '0.1.0') > 0);
  assert.ok(compareVersions('v0.2.0', '0.1.9') > 0);
  assert.ok(compareVersions('1.0.0', '0.99.99') > 0);
  assert.equal(compareVersions('0.1.0', '0.1.0'), 0);
  assert.ok(compareVersions('0.1.0', '0.1.1') < 0);
  assert.equal(compareVersions('garbage', '0.1.0'), 0); // unparseable never counts as newer
});

test('checksum file parsing and hashing', () => {
  const h = sha256(Buffer.from('archery'));
  assert.equal(h.length, 64);
  assert.equal(parseShaFile(`${h}  NewArcheryClock-0.1.1.zip\n`), h);
  assert.equal(parseShaFile(h.toUpperCase()), h);
  assert.equal(parseShaFile('nothing here'), null);
});
