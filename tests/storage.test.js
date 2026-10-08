import test from 'node:test';
import assert from 'node:assert/strict';
import { addRecentDownload, getSettings, saveSettings } from '../lib/storage.js';

test('persists and sanitizes settings in chrome.storage.local', async () => {
  const chrome = makeChromeStorage();
  await saveSettings({
    apiInstances: [{ id: 'one', name: 'Local', url: 'http://127.0.0.1:9000', authScheme: 'api-key', apiKey: 'abc' }],
    activeInstanceId: 'one',
    defaultMode: 'audio',
    audioFormat: 'opus',
    historyLimit: 2
  }, chrome);
  const settings = await getSettings(chrome);
  assert.equal(settings.activeInstanceId, 'one');
  assert.equal(settings.apiInstances[0].url, 'http://127.0.0.1:9000/');
  assert.equal(settings.apiInstances[0].apiKey, 'abc');
  assert.equal(settings.defaultMode, 'audio');
});

test('recent downloads respect the configured history limit', async () => {
  const chrome = makeChromeStorage();
  await saveSettings({ historyLimit: 1 }, chrome);
  await addRecentDownload({ id: 'a', url: 'https://cdn.example/a.mp4', filename: 'a.mp4' }, chrome);
  await addRecentDownload({ id: 'b', url: 'https://cdn.example/b.mp4', filename: 'b.mp4' }, chrome);
  const settings = await getSettings(chrome);
  assert.deepEqual(settings.recentDownloads.map((item) => item.id), ['b']);
});

function makeChromeStorage() {
  const data = {};
  return {
    runtime: {},
    storage: {
      local: {
        get(key, callback) {
          callback({ [key]: data[key] });
        },
        set(value, callback) {
          Object.assign(data, value);
          callback();
        }
      }
    }
  };
}
