import {
  AUDIO_FORMATS,
  VIDEO_CONTAINERS,
  VIDEO_QUALITIES,
  assertMediaUrl,
  humanizeErrorCode,
  isLikelyUrl,
  isPlainObject,
  normalizeApiUrl
} from './utils.js';

export function buildCobaltRequestBody(mediaUrl, settings = {}, overrides = {}) {
  const mode = overrides.mode ?? settings.defaultMode ?? settings.mode ?? 'video';
  const body = {
    url: assertMediaUrl(mediaUrl),
    filenameStyle: overrides.filenameStyle ?? settings.filenameStyle ?? 'basic'
  };

  if (mode === 'audio') {
    body.downloadMode = 'audio';
    const audioFormat = overrides.audioFormat ?? settings.audioFormat;
    body.audioFormat = AUDIO_FORMATS.includes(audioFormat) ? audioFormat : 'mp3';
  } else {
    body.downloadMode = 'auto';
    const videoQuality = overrides.videoQuality ?? settings.videoQuality;
    const videoContainer = overrides.videoContainer ?? settings.videoContainer;
    body.videoQuality = VIDEO_QUALITIES.includes(videoQuality) ? videoQuality : '1080';
    body.youtubeVideoContainer = VIDEO_CONTAINERS.includes(videoContainer) ? videoContainer : 'auto';
  }

  return body;
}

export function buildAuthHeader(instance = {}) {
  const token = typeof instance.apiKey === 'string' ? instance.apiKey.trim() : '';
  if (!token || instance.authScheme === 'none') return null;
  if (instance.authScheme === 'api-key') return `Api-Key ${token}`;
  if (instance.authScheme === 'bearer') return `Bearer ${token}`;
  return null;
}

export function validateDownloadUrl(url) {
  if (!isLikelyUrl(url)) throw new Error(humanizeErrorCode('error.api.response.missing-url'));
  return url.trim();
}

export function parseCobaltResponse(data) {
  if (!isPlainObject(data) || typeof data.status !== 'string') {
    throw new Error(humanizeErrorCode('error.api.response.invalid'));
  }

  if (data.status === 'tunnel' || data.status === 'redirect') {
    return {
      status: data.status,
      url: validateDownloadUrl(data.url),
      filename: typeof data.filename === 'string' ? data.filename : ''
    };
  }

  if (data.status === 'picker') {
    if (!Array.isArray(data.picker)) throw new Error(humanizeErrorCode('error.api.response.invalid'));
    const picker = data.picker.map((item, index) => {
      if (!isPlainObject(item) || !['photo', 'video', 'gif'].includes(item.type) || !isLikelyUrl(item.url)) {
        throw new Error(`Picker item ${index + 1} is missing a valid media URL.`);
      }
      return {
        type: item.type,
        url: item.url.trim(),
        thumb: isLikelyUrl(item.thumb) ? item.thumb.trim() : '',
        filename: typeof item.filename === 'string' ? item.filename : ''
      };
    });
    return {
      status: 'picker',
      audio: isLikelyUrl(data.audio) ? data.audio.trim() : '',
      audioFilename: typeof data.audioFilename === 'string' ? data.audioFilename : '',
      picker
    };
  }

  if (data.status === 'local-processing') {
    return {
      status: 'local-processing',
      type: typeof data.type === 'string' ? data.type : '',
      service: typeof data.service === 'string' ? data.service : '',
      output: isPlainObject(data.output) ? data.output : null,
      tunnel: Array.isArray(data.tunnel) ? data.tunnel.filter(isLikelyUrl) : []
    };
  }

  if (data.status === 'error') {
    const code = isPlainObject(data.error) && typeof data.error.code === 'string'
      ? data.error.code
      : 'error.api.response.invalid';
    const context = isPlainObject(data.error?.context) ? data.error.context : {};
    return {
      status: 'error',
      error: { code, context },
      message: humanizeErrorCode(code, context)
    };
  }

  throw new Error(`Unsupported Cobalt response status: ${data.status}`);
}

export async function fetchInstanceInfo(instance, fetchImpl = globalThis.fetch) {
  const apiUrl = normalizeApiUrl(instance.url);
  const headers = { Accept: 'application/json' };
  const authorization = buildAuthHeader(instance);
  if (authorization) headers.Authorization = authorization;

  const response = await fetchImpl(apiUrl, { method: 'GET', headers });
  const data = await safeJson(response);
  if (!response.ok) throw responseToError(response, data);
  if (!isPlainObject(data?.cobalt)) throw new Error(humanizeErrorCode('error.api.response.invalid'));
  return data;
}

export async function requestCobalt(instance, mediaUrl, settings = {}, overrides = {}, fetchImpl = globalThis.fetch) {
  const apiUrl = normalizeApiUrl(instance.url);
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };
  const authorization = buildAuthHeader(instance);
  if (authorization) headers.Authorization = authorization;

  let response;
  try {
    response = await fetchImpl(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildCobaltRequestBody(mediaUrl, settings, overrides))
    });
  } catch (error) {
    const wrapped = new Error(humanizeErrorCode('error.api.fetch.fail'));
    wrapped.cause = error;
    throw wrapped;
  }

  const data = await safeJson(response);
  if (!response.ok) throw responseToError(response, data);
  return parseCobaltResponse(data);
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function responseToError(response, data) {
  const parsed = isPlainObject(data) ? parseCobaltResponse({ status: 'error', error: data.error ?? data }) : null;
  let code = parsed?.error?.code;
  if (!code) {
    if (response.status === 401 || response.status === 403) code = 'error.api.fetch.unauthorized';
    else if (response.status === 429) code = 'error.api.fetch.rate';
    else if (response.status >= 500) code = 'error.api.fetch.fail';
    else code = 'error.api.response.invalid';
  }
  const error = new Error(humanizeErrorCode(code, parsed?.error?.context));
  error.code = code;
  error.status = response.status;
  return error;
}
