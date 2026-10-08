const state = {
  settings: null,
  mode: 'video',
  sourceUrl: '',
  picker: null
};

const els = {
  apiStatus: document.querySelector('#apiStatus'),
  mediaUrl: document.querySelector('#mediaUrl'),
  pasteButton: document.querySelector('#pasteButton'),
  settingsButton: document.querySelector('#settingsButton'),
  downloadButton: document.querySelector('#downloadButton'),
  message: document.querySelector('#message'),
  videoQuality: document.querySelector('#videoQuality'),
  audioFormat: document.querySelector('#audioFormat'),
  pickerSection: document.querySelector('#pickerSection'),
  pickerList: document.querySelector('#pickerList'),
  downloadAllButton: document.querySelector('#downloadAllButton'),
  recentList: document.querySelector('#recentList'),
  clearHistoryButton: document.querySelector('#clearHistoryButton'),
  segments: Array.from(document.querySelectorAll('.segment'))
};

init().catch((error) => setMessage(error.message, 'error'));

async function init() {
  state.settings = await send('getSettings');
  state.mode = state.settings.defaultMode;
  els.videoQuality.value = state.settings.videoQuality;
  els.audioFormat.value = state.settings.audioFormat;
  applyMode();
  renderRecent();
  bindEvents();
  await detectCurrentTab();
  testApi();
}

function bindEvents() {
  els.segments.forEach((button) => {
    button.addEventListener('click', () => {
      state.mode = button.dataset.mode;
      applyMode();
    });
  });

  els.pasteButton.addEventListener('click', async () => {
    try {
      els.mediaUrl.value = await navigator.clipboard.readText();
      setMessage('Pasted from clipboard.', 'ok');
    } catch {
      setMessage('Clipboard access was blocked by the browser.', 'error');
    }
  });

  els.settingsButton.addEventListener('click', () => send('openOptions'));
  els.downloadButton.addEventListener('click', downloadCurrent);
  els.downloadAllButton.addEventListener('click', downloadAllPickerItems);
  els.clearHistoryButton.addEventListener('click', async () => {
    state.settings = await send('clearHistory');
    renderRecent();
  });
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes.settings?.newValue) return;
    state.settings = changes.settings.newValue;
    renderRecent();
  });
}

async function detectCurrentTab() {
  const [tab] = await chromePromise(chrome.tabs.query, { active: true, currentWindow: true });
  if (tab?.url && /^https?:\/\//.test(tab.url)) {
    els.mediaUrl.value = tab.url;
    state.sourceUrl = tab.url;
  }
}

async function testApi() {
  els.apiStatus.textContent = 'Checking API';
  els.apiStatus.className = 'status pending';
  try {
    const info = await send('testApi');
    els.apiStatus.textContent = `API ${info.version || 'online'}`;
    els.apiStatus.className = 'status ok';
  } catch (error) {
    els.apiStatus.textContent = 'API unavailable';
    els.apiStatus.className = 'status error';
  }
}

async function downloadCurrent() {
  const sourceUrl = els.mediaUrl.value.trim();
  if (!sourceUrl) {
    setMessage('Enter a media URL first.', 'error');
    return;
  }
  setLoading(true);
  setMessage('Preparing download...', '');
  hidePicker();

  try {
    const result = await send('download', {
      sourceUrl,
      mode: state.mode,
      videoQuality: els.videoQuality.value,
      audioFormat: els.audioFormat.value
    });
    if (result.type === 'picker') {
      state.picker = result.response;
      renderPicker(result.response, sourceUrl);
      setMessage(`${result.response.picker.length} item${result.response.picker.length === 1 ? '' : 's'} available.`, 'ok');
    } else {
      setMessage('Download started. Completion is tracked in recent downloads.', 'ok');
      state.settings = await send('getSettings');
      renderRecent();
    }
  } catch (error) {
    setMessage(error.message, 'error');
  } finally {
    setLoading(false);
  }
}

function renderPicker(response, sourceUrl) {
  els.pickerList.replaceChildren();
  const items = response.audio
    ? [{ type: 'audio', url: response.audio, filename: response.audioFilename, thumb: '' }, ...response.picker]
    : response.picker;

  items.forEach((item, index) => {
    const row = document.createElement('article');
    row.className = 'picker-item';

    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    if (item.thumb) {
      const image = document.createElement('img');
      image.alt = '';
      image.src = item.thumb;
      thumb.append(image);
    } else {
      thumb.textContent = item.type;
    }

    const body = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'item-title';
    title.textContent = item.filename || `${capitalize(item.type)} ${index + 1}`;
    const meta = document.createElement('div');
    meta.className = 'item-meta';
    meta.textContent = item.url;
    body.append(title, meta);

    const button = document.createElement('button');
    button.className = 'mini-button';
    button.type = 'button';
    button.title = 'Download item';
    button.setAttribute('aria-label', `Download ${title.textContent}`);
    button.textContent = '↓';
    button.addEventListener('click', () => downloadPickerItems([item], sourceUrl));

    row.append(thumb, body, button);
    els.pickerList.append(row);
  });

  els.pickerSection.classList.remove('hidden');
}

async function downloadAllPickerItems() {
  if (!state.picker) return;
  const sourceUrl = els.mediaUrl.value.trim();
  const items = state.picker.audio
    ? [{ type: 'audio', url: state.picker.audio, filename: state.picker.audioFilename }, ...state.picker.picker]
    : state.picker.picker;
  await downloadPickerItems(items, sourceUrl);
}

async function downloadPickerItems(items, sourceUrl) {
  setLoading(true);
  try {
    await send('downloadPickerItem', { items, sourceUrl });
    setMessage(`${items.length} download${items.length === 1 ? '' : 's'} started.`, 'ok');
    state.settings = await send('getSettings');
    renderRecent();
  } catch (error) {
    setMessage(error.message, 'error');
  } finally {
    setLoading(false);
  }
}

function hidePicker() {
  state.picker = null;
  els.pickerSection.classList.add('hidden');
  els.pickerList.replaceChildren();
}

function renderRecent() {
  const recent = state.settings?.recentDownloads || [];
  els.recentList.replaceChildren();
  els.recentList.classList.toggle('empty', recent.length === 0);
  if (recent.length === 0) {
    els.recentList.textContent = 'No downloads yet';
    return;
  }

  for (const item of recent.slice(0, 5)) {
    const row = document.createElement('article');
    row.className = 'recent-item';

    const badge = document.createElement('div');
    badge.className = 'thumb';
    badge.textContent = statusLabel(item.status);

    const body = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'item-title';
    title.textContent = item.filename || 'Cobalt download';
    const meta = document.createElement('div');
    meta.className = 'item-meta';
    meta.textContent = item.error || new Date(item.updatedAt || item.createdAt).toLocaleString();
    body.append(title, meta);

    row.append(badge, body);
    els.recentList.append(row);
  }
}

function applyMode() {
  els.segments.forEach((button) => button.classList.toggle('active', button.dataset.mode === state.mode));
  els.videoQuality.disabled = state.mode === 'audio';
  els.audioFormat.disabled = state.mode !== 'audio';
}

function setLoading(isLoading) {
  els.downloadButton.disabled = isLoading;
  els.downloadButton.querySelector('span').textContent = isLoading ? 'Working...' : 'Download';
}

function setMessage(message, kind) {
  els.message.textContent = message;
  els.message.className = `message ${kind || ''}`.trim();
}

function statusLabel(status) {
  if (status === 'complete') return 'Done';
  if (status === 'failed') return 'Fail';
  return 'Run';
}

function capitalize(value) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : 'Item';
}

function send(type, payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else if (!response?.ok) reject(new Error(response?.error || 'Extension request failed.'));
      else resolve(response.result);
    });
  });
}

function chromePromise(fn, ...args) {
  return new Promise((resolve, reject) => {
    fn.call(chrome.tabs, ...args, (result) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(result);
    });
  });
}
