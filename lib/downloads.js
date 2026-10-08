import { assertMediaUrl, sanitizeFilename } from './utils.js';

export function createDownloadOptions(url, filename = '', saveAs = false, headers = []) {
  const options = {
    url: assertMediaUrl(url),
    saveAs: Boolean(saveAs),
    conflictAction: 'uniquify'
  };
  if (filename) options.filename = sanitizeFilename(filename);
  if (headers.length) options.headers = headers;
  return options;
}

export function startDownload(chromeApi, url, filename = '', saveAs = false, headers = []) {
  const options = createDownloadOptions(url, filename, saveAs, headers);
  return new Promise((resolve, reject) => {
    chromeApi.downloads.download(options, (downloadId) => {
      const error = chromeApi.runtime?.lastError;
      if (error) reject(new Error(error.message));
      else if (typeof downloadId !== 'number') reject(new Error('Chrome did not return a download ID.'));
      else resolve({ downloadId, options });
    });
  });
}

export function getDownloadItem(chromeApi, downloadId) {
  return new Promise((resolve, reject) => {
    chromeApi.downloads.search({ id: downloadId }, (items) => {
      const error = chromeApi.runtime?.lastError;
      if (error) reject(new Error(error.message));
      else resolve(items?.[0] || null);
    });
  });
}

export function reduceDownloadItem(previous = {}, item = {}) {
  const next = { ...previous };
  if (item.filename) next.filename = item.filename;
  if (item.state === 'complete') {
    if (item.bytesReceived === 0) {
      next.status = 'failed';
      next.error = 'The browser saved an empty 0-byte response instead of media.';
    } else {
      next.status = 'complete';
      next.error = '';
    }
  }
  if (item.state === 'interrupted') {
    next.status = 'failed';
    next.error = item.error || 'Download was interrupted.';
  }
  return next;
}

export function reduceDownloadState(previous = {}, delta = {}) {
  const next = { ...previous };
  if (delta.bytesReceived?.current === 0 && delta.state?.current === 'complete') {
    next.status = 'failed';
    next.error = 'The browser saved an empty 0-byte response instead of media.';
    return next;
  }
  if (delta.filename?.current) next.filename = delta.filename.current;
  if (delta.state?.current === 'complete') {
    next.status = 'complete';
    next.error = '';
  }
  if (delta.state?.current === 'interrupted') {
    next.status = 'failed';
    next.error = delta.error?.current || previous.error || 'Download was interrupted.';
  }
  if (delta.error?.current && next.status !== 'complete') {
    next.status = 'failed';
    next.error = delta.error.current;
  }
  return next;
}
