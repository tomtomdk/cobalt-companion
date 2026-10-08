const activeBlobUrls = new Set();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'offscreenFetchBlobUrl') {
    fetchBlobUrl(message.payload)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === 'offscreenRevokeBlobUrl') {
    revokeBlobUrl(message.payload?.blobUrl);
    sendResponse({ ok: true });
  }

  return false;
});

async function fetchBlobUrl(payload = {}) {
  const headers = new Headers();
  for (const header of payload.headers || []) {
    if (header?.name && typeof header.value === 'string') headers.set(header.name, header.value);
  }

  const response = await fetch(payload.url, { method: 'GET', headers });
  if (!response.ok) throw new Error(`Cobalt tunnel returned HTTP ${response.status}.`);

  const contentType = response.headers.get('Content-Type') || '';
  if (contentType.includes('application/json') || contentType.startsWith('text/')) {
    const text = await response.text();
    throw new Error(text.slice(0, 240) || 'Cobalt tunnel returned text instead of media.');
  }

  const blob = await response.blob();
  if (blob.size === 0) throw new Error('Cobalt tunnel returned 0 bytes.');

  const blobUrl = URL.createObjectURL(blob);
  activeBlobUrls.add(blobUrl);
  return {
    blobUrl,
    size: blob.size,
    type: blob.type || contentType,
    filename: payload.filename || ''
  };
}

function revokeBlobUrl(blobUrl) {
  if (!blobUrl || !activeBlobUrls.has(blobUrl)) return;
  URL.revokeObjectURL(blobUrl);
  activeBlobUrls.delete(blobUrl);
}
