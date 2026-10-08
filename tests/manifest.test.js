import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));

test('manifest is MV3 and references existing files', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.background.type, 'module');
  const references = [
    manifest.background.service_worker,
    manifest.action.default_popup,
    manifest.options_page,
    'offscreen/offscreen.html',
    'offscreen/offscreen.js',
    ...Object.values(manifest.icons)
  ];
  for (const reference of references) {
    assert.equal(existsSync(join(root, reference)), true, `${reference} should exist`);
  }
});

test('manifest requests scoped default host permission and optional API permissions', () => {
  assert.deepEqual(manifest.host_permissions, []);
  assert.ok(manifest.optional_host_permissions.includes('https://*/*'));
  assert.ok(manifest.permissions.includes('downloads'));
  assert.ok(manifest.permissions.includes('contextMenus'));
  assert.ok(manifest.permissions.includes('offscreen'));
});

test('extension files avoid remote script loading and unsupported MV2 APIs', () => {
  const files = [
    'background.js',
    'popup/popup.html',
    'popup/popup.js',
    'options/options.html',
    'options/options.js'
  ];
  for (const file of files) {
    const text = readFileSync(join(root, file), 'utf8');
    assert.doesNotMatch(text, /<script[^>]+https?:\/\//i, `${file} should not load remote scripts`);
    assert.doesNotMatch(text, /chrome\.browserAction|chrome\.extension\.getBackgroundPage/, `${file} should not use MV2 APIs`);
  }
});
