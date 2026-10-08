import test from 'node:test';
import assert from 'node:assert/strict';
import { createDownloadOptions, reduceDownloadState } from '../lib/downloads.js';

test('creates sanitized chrome.downloads options', () => {
  assert.deepEqual(
    createDownloadOptions('https://cdn.example/file.mp4', 'bad/name?.mp4', true),
    {
      url: 'https://cdn.example/file.mp4',
      saveAs: true,
      conflictAction: 'uniquify',
      filename: 'bad_name_.mp4'
    }
  );
});

test('passes safe request headers to chrome.downloads', () => {
  assert.deepEqual(
    createDownloadOptions('https://cdn.example/file.mp4', '', false, [{ name: 'Accept', value: '*/*' }]),
    {
      url: 'https://cdn.example/file.mp4',
      saveAs: false,
      conflictAction: 'uniquify',
      headers: [{ name: 'Accept', value: '*/*' }]
    }
  );
});

test('tracks download completion state', () => {
  assert.deepEqual(
    reduceDownloadState({ status: 'started' }, { state: { current: 'complete' } }),
    { status: 'complete', error: '' }
  );
});

test('tracks interrupted download failures', () => {
  assert.deepEqual(
    reduceDownloadState({ status: 'started' }, { state: { current: 'interrupted' }, error: { current: 'NETWORK_FAILED' } }),
    { status: 'failed', error: 'NETWORK_FAILED' }
  );
});

test('marks completed 0-byte downloads as failures', () => {
  assert.deepEqual(
    reduceDownloadState({ status: 'started' }, { bytesReceived: { current: 0 }, state: { current: 'complete' } }),
    {
      status: 'failed',
      error: 'The browser saved an empty 0-byte response instead of media.'
    }
  );
});
