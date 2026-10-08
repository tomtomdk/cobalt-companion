import {
  AUDIO_FORMATS,
  DEFAULT_API_URL,
  FILENAME_STYLES,
  THEMES,
  VIDEO_CONTAINERS,
  VIDEO_QUALITIES,
  makeId,
  normalizeApiUrl,
  nowIso
} from './utils.js';

export const DEFAULT_SETTINGS = Object.freeze({
  activeInstanceId: 'default',
  apiInstances: [
    {
      id: 'default',
      name: 'Default Cobalt',
      url: DEFAULT_API_URL,
      authScheme: 'none',
      apiKey: ''
    }
  ],
  defaultMode: 'video',
  videoQuality: '1080',
  audioFormat: 'mp3',
  videoContainer: 'auto',
  filenameStyle: 'basic',
  historyLimit: 25,
  saveAs: false,
  theme: 'dark',
  compactMode: false,
  notifications: true,
  recentDownloads: []
});

const SETTINGS_KEY = 'settings';

export async function getSettings(chromeApi = globalThis.chrome) {
  const stored = await chromeStorageGet(SETTINGS_KEY, chromeApi);
  return sanitizeSettings(stored?.[SETTINGS_KEY]);
}

export async function saveSettings(nextSettings, chromeApi = globalThis.chrome) {
  const settings = sanitizeSettings(nextSettings);
  await chromeStorageSet({ [SETTINGS_KEY]: settings }, chromeApi);
  return settings;
}

export async function updateSettings(patch, chromeApi = globalThis.chrome) {
  const current = await getSettings(chromeApi);
  return saveSettings({ ...current, ...patch }, chromeApi);
}

export async function getActiveInstance(chromeApi = globalThis.chrome) {
  const settings = await getSettings(chromeApi);
  return settings.apiInstances.find((instance) => instance.id === settings.activeInstanceId)
    ?? settings.apiInstances[0];
}

export async function addRecentDownload(entry, chromeApi = globalThis.chrome) {
  const settings = await getSettings(chromeApi);
  const safeEntry = {
    id: entry.id ?? makeId('history'),
    sourceUrl: entry.sourceUrl ?? '',
    filename: entry.filename ?? '',
    status: entry.status ?? 'started',
    error: entry.error ?? '',
    createdAt: entry.createdAt ?? nowIso(),
    updatedAt: nowIso()
  };
  const recentDownloads = [
    safeEntry,
    ...settings.recentDownloads.filter((item) => item.id !== safeEntry.id)
  ].slice(0, settings.historyLimit);
  await saveSettings({ ...settings, recentDownloads }, chromeApi);
  return safeEntry;
}

export async function updateRecentDownload(id, patch, chromeApi = globalThis.chrome) {
  const settings = await getSettings(chromeApi);
  const recentDownloads = settings.recentDownloads.map((item) => (
    item.id === id ? { ...item, ...patch, updatedAt: nowIso() } : item
  ));
  await saveSettings({ ...settings, recentDownloads }, chromeApi);
}

export async function clearRecentDownloads(chromeApi = globalThis.chrome) {
  const settings = await getSettings(chromeApi);
  await saveSettings({ ...settings, recentDownloads: [] }, chromeApi);
}

export function sanitizeSettings(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const defaultInstance = DEFAULT_SETTINGS.apiInstances[0];
  const apiInstances = Array.isArray(source.apiInstances) && source.apiInstances.length > 0
    ? source.apiInstances.map(sanitizeInstance)
    : [defaultInstance];
  const activeInstanceId = apiInstances.some((instance) => instance.id === source.activeInstanceId)
    ? source.activeInstanceId
    : apiInstances[0].id;

  return {
    activeInstanceId,
    apiInstances,
    defaultMode: source.defaultMode === 'audio' ? 'audio' : 'video',
    videoQuality: VIDEO_QUALITIES.includes(source.videoQuality) ? source.videoQuality : DEFAULT_SETTINGS.videoQuality,
    audioFormat: AUDIO_FORMATS.includes(source.audioFormat) ? source.audioFormat : DEFAULT_SETTINGS.audioFormat,
    videoContainer: VIDEO_CONTAINERS.includes(source.videoContainer) ? source.videoContainer : DEFAULT_SETTINGS.videoContainer,
    filenameStyle: FILENAME_STYLES.includes(source.filenameStyle) ? source.filenameStyle : DEFAULT_SETTINGS.filenameStyle,
    historyLimit: clampNumber(source.historyLimit, 1, 100, DEFAULT_SETTINGS.historyLimit),
    saveAs: Boolean(source.saveAs),
    theme: THEMES.includes(source.theme) ? source.theme : DEFAULT_SETTINGS.theme,
    compactMode: Boolean(source.compactMode),
    notifications: source.notifications !== false,
    recentDownloads: Array.isArray(source.recentDownloads)
      ? source.recentDownloads.slice(0, clampNumber(source.historyLimit, 1, 100, DEFAULT_SETTINGS.historyLimit))
      : []
  };
}

export function sanitizeInstance(instance = {}) {
  const id = typeof instance.id === 'string' && instance.id ? instance.id : makeId('api');
  const name = typeof instance.name === 'string' && instance.name.trim() ? instance.name.trim() : 'Cobalt API';
  const url = normalizeApiUrl(instance.url || DEFAULT_API_URL);
  const authScheme = ['none', 'api-key', 'bearer'].includes(instance.authScheme) ? instance.authScheme : 'none';
  const apiKey = authScheme === 'none' ? '' : String(instance.apiKey ?? '').trim();
  return { id, name, url, authScheme, apiKey };
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function chromeStorageGet(key, chromeApi) {
  return new Promise((resolve, reject) => {
    chromeApi.storage.local.get(key, (result) => {
      const error = chromeApi.runtime?.lastError;
      if (error) reject(new Error(error.message));
      else resolve(result);
    });
  });
}

function chromeStorageSet(value, chromeApi) {
  return new Promise((resolve, reject) => {
    chromeApi.storage.local.set(value, () => {
      const error = chromeApi.runtime?.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}
