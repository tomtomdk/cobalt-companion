import test from 'node:test';
import assert from 'node:assert/strict';
import { humanizeErrorCode, normalizeApiUrl, sanitizeFilename } from '../lib/utils.js';

test('normalizes HTTPS API URLs with trailing slash', () => {
  assert.equal(normalizeApiUrl('https://your-cobalt-instance.example'), 'https://your-cobalt-instance.example/');
});

test('allows HTTP only for local or private API URLs', () => {
  assert.equal(normalizeApiUrl('http://localhost:9000/api'), 'http://localhost:9000/api/');
  assert.equal(normalizeApiUrl('http://192.168.1.20:9000'), 'http://192.168.1.20:9000/');
  assert.throws(() => normalizeApiUrl('http://example.com'), /HTTP API URLs/);
});

test('sanitizes filenames for browser downloads', () => {
  assert.equal(sanitizeFilename('a/b:c*video?.mp4'), 'a_b_c_video_.mp4');
  assert.equal(sanitizeFilename('CON'), 'cobalt-download');
});

test('humanizes Cobalt short-link fetch errors', () => {
  assert.match(humanizeErrorCode('error.api.fetch.short_link'), /short link/i);
});
