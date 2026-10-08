export const DEFAULT_API_URL = 'https://your-cobalt-instance.example/';

export const VIDEO_QUALITIES = ['144', '240', '360', '480', '720', '1080', '1440', '2160', 'max'];
export const AUDIO_FORMATS = ['best', 'mp3', 'ogg', 'wav', 'opus'];
export const VIDEO_CONTAINERS = ['auto', 'mp4', 'webm', 'mkv'];
export const FILENAME_STYLES = ['classic', 'pretty', 'basic', 'nerdy'];
export const THEMES = ['dark', 'light', 'system'];
export const AUTH_SCHEMES = ['none', 'api-key', 'bearer'];

export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isLikelyUrl(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function assertMediaUrl(value) {
  if (!isLikelyUrl(value)) {
    throw new Error('Enter a valid http:// or https:// media URL.');
  }
  return value.trim();
}

export function isLocalOrPrivateHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '::1') return true;
  if (host === '127.0.0.1' || host.startsWith('127.')) return true;
  if (host.startsWith('10.')) return true;
  if (host.startsWith('192.168.')) return true;
  const match = host.match(/^172\.(\d{1,2})\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

export function normalizeApiUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) throw new Error('Cobalt API URL is required.');

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Cobalt API URL must be a valid URL.');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Cobalt API URL must use HTTPS, or HTTP for local/private development.');
  }

  if (parsed.protocol === 'http:' && !isLocalOrPrivateHost(parsed.hostname)) {
    throw new Error('HTTP API URLs are only allowed for localhost or private-LAN development servers.');
  }

  parsed.hash = '';
  parsed.search = '';
  if (!parsed.pathname.endsWith('/')) parsed.pathname += '/';
  return parsed.toString();
}

export function apiOriginPattern(apiUrl) {
  const parsed = new URL(normalizeApiUrl(apiUrl));
  return `${parsed.protocol}//${parsed.host}/*`;
}

export function sanitizeFilename(filename, fallback = 'cobalt-download') {
  const raw = typeof filename === 'string' ? filename : '';
  const withoutControls = raw.replace(/[\u0000-\u001f\u007f]/g, '');
  const withoutSeparators = withoutControls.replace(/[<>:"/\\|?*]+/g, '_');
  const collapsed = withoutSeparators.replace(/\s+/g, ' ').replace(/\.+$/g, '').trim();
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
  const safe = collapsed && !reserved.test(collapsed) ? collapsed : fallback;
  return safe.slice(0, 180);
}

export function humanizeErrorCode(code, context = {}) {
  const known = {
    'error.api.fetch.fail': 'Could not reach the Cobalt API. Check the server URL and your connection.',
    'error.api.fetch.unauthorized': 'The Cobalt API requires authentication. Check the saved API key or bearer token.',
    'error.api.fetch.rate': 'The Cobalt API rate limit was reached. Try again after the rate limit resets.',
    'error.api.fetch.cloudflare': 'The request was blocked by bot protection or a network challenge.',
    'error.api.fetch.short_link': 'Cobalt could not resolve that short link. Open the final video page in the browser, then download the resolved URL.',
    'error.api.response.invalid': 'The Cobalt API returned an unexpected response.',
    'error.api.response.missing-url': 'Cobalt did not return a usable download URL.',
    'error.download.failed': 'The browser download failed.',
    'error.local-processing.unsupported': 'This response requires local remuxing/transcoding, which a browser extension cannot safely perform.',
    'api.auth.api-key.missing': 'This Cobalt instance requires an API key.',
    'api.auth.bearer.missing': 'This Cobalt instance requires a bearer token.',
    'error.api.auth.api-key.missing': 'This Cobalt instance requires an API key.',
    'error.api.auth.bearer.missing': 'This Cobalt instance requires a bearer token.',
    'error.api.link.unsupported': 'This service or URL is not supported by the Cobalt instance.',
    'error.api.link.invalid': 'Cobalt could not process that media URL.',
    'error.api.link.private': 'The media appears to require authentication or is private.',
    'error.api.link.expired': 'The media URL expired. Open the source page and try again.',
    'error.api.youtube.login': 'YouTube requires authentication for this item.',
    'error.api.rate-limit': 'The Cobalt API rate limit was reached.'
  };

  if (known[code]) return known[code];
  if (context?.service) return `Cobalt reported ${code} for ${context.service}.`;
  return code ? `Cobalt reported ${code}.` : 'Something went wrong while contacting Cobalt.';
}

export function makeId(prefix = 'id') {
  const bytes = new Uint32Array(2);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
    return `${prefix}-${bytes[0].toString(16)}${bytes[1].toString(16)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function nowIso() {
  return new Date().toISOString();
}
