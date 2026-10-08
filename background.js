import { fetchInstanceInfo, requestCobalt } from './lib/cobalt-api.js';
import { getDownloadItem, reduceDownloadItem, startDownload, reduceDownloadState } from './lib/downloads.js';
import {
  addRecentDownload,
  clearRecentDownloads,
  getActiveInstance,
  getSettings,
  saveSettings,
  updateRecentDownload
} from './lib/storage.js';
import { apiOriginPattern, humanizeErrorCode, sanitizeFilename } from './lib/utils.js';

const MENUS = [
  { id: 'download-page', title: 'Download page with Cobalt', contexts: ['page'] },
  { id: 'download-link', title: 'Download link with Cobalt', contexts: ['link'] },
  { id: 'download-video', title: 'Download video with Cobalt', contexts: ['video'] },
  { id: 'download-audio', title: 'Download audio with Cobalt', contexts: ['audio'] }
];

chrome.runtime.onInstalled.addListener(async () => {
  await getSettings(chrome);
  chrome.contextMenus.removeAll(() => {
    for (const menu of MENUS) chrome.contextMenus.create(menu);
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const sourceUrl = info.linkUrl || info.srcUrl || info.pageUrl || tab?.url || '';
  const mode = info.menuItemId === 'download-audio' ? 'audio' : undefined;
  handleDownloadRequest({ sourceUrl, mode, origin: 'context-menu' }).catch((error) => {
    notify('Cobalt download failed', error.message);
  });
});

chrome.downloads.onChanged.addListener(async (delta) => {
  if (!delta?.id) return;
  const settings = await getSettings(chrome);
  const entry = settings.recentDownloads.find((item) => item.downloadId === delta.id);
  if (!entry) return;
  const next = reduceDownloadState(entry, delta);
  await updateRecentDownload(entry.id, next, chrome);
  if (next.status === 'complete') notify('Cobalt download complete', next.filename || 'Download finished.');
  if (next.status === 'failed') notify('Cobalt download failed', humanizeDownloadError(next.error));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  routeMessage(message, sender)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

async function routeMessage(message) {
  switch (message?.type) {
    case 'getSettings':
      return getSettings(chrome);
    case 'saveSettings':
      return saveSettings(message.settings, chrome);
    case 'clearHistory':
      await clearRecentDownloads(chrome);
      return getSettings(chrome);
    case 'testApi':
      return testActiveApi(message.instance);
    case 'download':
      return handleDownloadRequest(message.payload);
    case 'downloadPickerItem':
      return downloadPickerItem(message.payload);
    case 'openOptions':
      chrome.runtime.openOptionsPage();
      return true;
    default:
      throw new Error('Unknown extension message.');
  }
}

async function testActiveApi(instanceOverride) {
  const instance = instanceOverride || await getActiveInstance(chrome);
  await ensureApiPermission(instance.url);
  const info = await fetchInstanceInfo(instance, fetch);
  return {
    version: info.cobalt.version,
    url: info.cobalt.url,
    services: info.cobalt.services || [],
    turnstileSitekey: info.cobalt.turnstileSitekey || ''
  };
}

async function handleDownloadRequest(payload = {}) {
  const settings = await getSettings(chrome);
  const instance = settings.apiInstances.find((item) => item.id === settings.activeInstanceId) || settings.apiInstances[0];
  const sourceUrl = payload.sourceUrl || payload.url;
  await ensureApiPermission(instance.url);
  const cobaltResponse = await requestCobalt(instance, sourceUrl, settings, {
    mode: payload.mode,
    videoQuality: payload.videoQuality,
    audioFormat: payload.audioFormat
  }, fetch);

  if (cobaltResponse.status === 'error') throw new Error(cobaltResponse.message);
  if (cobaltResponse.status === 'local-processing') {
    throw new Error(humanizeErrorCode('error.local-processing.unsupported'));
  }
  if (cobaltResponse.status === 'picker') {
    return { type: 'picker', response: cobaltResponse };
  }

  const download = await createTrackedDownload({
    downloadUrl: cobaltResponse.url,
    sourceUrl,
    filename: cobaltResponse.filename,
    saveAs: settings.saveAs,
    headers: buildDownloadHeaders(cobaltResponse.url, instance),
    instance
  });
  return { type: 'download', download };
}

async function downloadPickerItem(payload = {}) {
  const settings = await getSettings(chrome);
  const sourceUrl = payload.sourceUrl || '';
  const items = Array.isArray(payload.items) ? payload.items : [payload.item];
  const downloads = [];

  for (const [index, item] of items.filter(Boolean).entries()) {
    const filename = item.filename || inferPickerFilename(item, index + 1);
    downloads.push(await createTrackedDownload({
      downloadUrl: item.url,
      sourceUrl,
      filename,
      saveAs: settings.saveAs && items.length === 1,
      headers: buildDownloadHeaders(item.url)
    }));
  }

  return { type: 'download', downloads };
}

async function createTrackedDownload({ downloadUrl, sourceUrl, filename, saveAs, headers = [], instance = null }) {
  const prepared = await prepareDownloadUrl(downloadUrl, filename, headers, instance);
  const { downloadId, options } = await startDownload(chrome, prepared.url, filename, saveAs, prepared.headers);
  const entry = await addRecentDownload({
    downloadId,
    sourceUrl,
    filename: options.filename || sanitizeFilename(filename || 'cobalt-download'),
    status: 'started'
  }, chrome);
  await syncDownloadState(downloadId, entry.id);
  if (prepared.blobUrl) scheduleBlobRevoke(prepared.blobUrl, downloadId);
  notify('Cobalt download started', entry.filename || 'Download started.');
  return entry;
}

async function prepareDownloadUrl(downloadUrl, filename, headers, instance) {
  if (!shouldBlobFetch(downloadUrl, instance)) return { url: downloadUrl, headers };
  await ensureOffscreenDocument();
  const response = await chrome.runtime.sendMessage({
    type: 'offscreenFetchBlobUrl',
    payload: { url: downloadUrl, filename, headers }
  });
  if (!response?.ok) throw new Error(response?.error || 'Could not fetch Cobalt tunnel.');
  return { url: response.result.blobUrl, headers: [], blobUrl: response.result.blobUrl };
}

function shouldBlobFetch(downloadUrl, instance) {
  if (!instance) return false;
  try {
    const download = new URL(downloadUrl);
    const api = new URL(instance.url);
    return download.origin === api.origin && download.pathname.startsWith('/tunnel');
  } catch {
    return false;
  }
}

async function ensureOffscreenDocument() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen/offscreen.html',
    reasons: [chrome.offscreen.Reason.BLOBS],
    justification: 'Fetch Cobalt tunnel responses as blobs so empty or error bodies are not saved as media.'
  });
}

function scheduleBlobRevoke(blobUrl, downloadId) {
  const listener = (delta) => {
    if (delta.id !== downloadId || !delta.state?.current) return;
    chrome.runtime.sendMessage({ type: 'offscreenRevokeBlobUrl', payload: { blobUrl } });
    chrome.downloads.onChanged.removeListener(listener);
  };
  chrome.downloads.onChanged.addListener(listener);
}

async function syncDownloadState(downloadId, entryId) {
  const item = await getDownloadItem(chrome, downloadId);
  if (!item) return;
  const next = reduceDownloadItem({}, item);
  if (next.status || next.filename) await updateRecentDownload(entryId, next, chrome);
  if (next.status === 'failed') notify('Cobalt download failed', humanizeDownloadError(next.error));
}

function buildDownloadHeaders(downloadUrl, instance = null) {
  const headers = [{ name: 'Accept', value: '*/*' }];
  if (!instance) return headers;
  const download = new URL(downloadUrl);
  const api = new URL(instance.url);
  if (download.origin !== api.origin) return headers;

  const token = typeof instance.apiKey === 'string' ? instance.apiKey.trim() : '';
  if (token && instance.authScheme === 'api-key') headers.push({ name: 'Authorization', value: `Api-Key ${token}` });
  if (token && instance.authScheme === 'bearer') headers.push({ name: 'Authorization', value: `Bearer ${token}` });
  return headers;
}

function inferPickerFilename(item, number) {
  try {
    const parsed = new URL(item.url);
    const last = parsed.pathname.split('/').filter(Boolean).pop();
    if (last) return sanitizeFilename(last);
  } catch {
    // Fall through to generated name.
  }
  const extension = item.type === 'photo' ? 'jpg' : item.type === 'gif' ? 'gif' : 'mp4';
  return `cobalt-item-${String(number).padStart(2, '0')}.${extension}`;
}

async function ensureApiPermission(apiUrl) {
  const pattern = apiOriginPattern(apiUrl);
  const hasPermission = await new Promise((resolve) => {
    chrome.permissions.contains({ origins: [pattern] }, resolve);
  });
  if (hasPermission) return true;
  const granted = await new Promise((resolve) => {
    chrome.permissions.request({ origins: [pattern] }, resolve);
  });
  if (!granted) throw new Error(`Permission is required to contact ${new URL(apiUrl).origin}.`);
  return true;
}

async function notify(title, message) {
  const settings = await getSettings(chrome);
  if (!settings.notifications) return;
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title,
    message: String(message || '')
  });
}

function humanizeDownloadError(error) {
  if (!error) return humanizeErrorCode('error.download.failed');
  return `${humanizeErrorCode('error.download.failed')} (${error})`;
}
