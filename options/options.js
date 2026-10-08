import { makeId } from '../lib/utils.js';

let settings;

const $ = (selector) => document.querySelector(selector);
const els = {
  saveState: $('#saveState'),
  saveButton: $('#saveButton'),
  testButton: $('#testButton'),
  activeInstance: $('#activeInstance'),
  instanceName: $('#instanceName'),
  apiUrl: $('#apiUrl'),
  authScheme: $('#authScheme'),
  apiKey: $('#apiKey'),
  apiResult: $('#apiResult'),
  addInstanceButton: $('#addInstanceButton'),
  removeInstanceButton: $('#removeInstanceButton'),
  defaultMode: $('#defaultMode'),
  videoQuality: $('#videoQuality'),
  audioFormat: $('#audioFormat'),
  videoContainer: $('#videoContainer'),
  filenameStyle: $('#filenameStyle'),
  historyLimit: $('#historyLimit'),
  saveAs: $('#saveAs'),
  theme: $('#theme'),
  compactMode: $('#compactMode'),
  notifications: $('#notifications')
};

init().catch((error) => showSaveState(error.message, 'error'));

async function init() {
  settings = await send('getSettings');
  render();
  bind();
}

function bind() {
  els.activeInstance.addEventListener('change', () => {
    collectActiveInstance();
    settings.activeInstanceId = els.activeInstance.value;
    renderInstance();
  });
  els.authScheme.addEventListener('change', () => {
    els.apiKey.disabled = els.authScheme.value === 'none';
    if (els.authScheme.value === 'none') els.apiKey.value = '';
  });
  els.addInstanceButton.addEventListener('click', () => {
    collectForm();
    const id = makeId('api');
    settings.apiInstances.push({
      id,
      name: 'New Cobalt API',
      url: 'https://',
      authScheme: 'none',
      apiKey: ''
    });
    settings.activeInstanceId = id;
    render();
  });
  els.removeInstanceButton.addEventListener('click', () => {
    if (settings.apiInstances.length <= 1) {
      showApiResult('Keep at least one Cobalt instance.', 'error');
      return;
    }
    settings.apiInstances = settings.apiInstances.filter((item) => item.id !== settings.activeInstanceId);
    settings.activeInstanceId = settings.apiInstances[0].id;
    render();
  });
  els.saveButton.addEventListener('click', save);
  els.testButton.addEventListener('click', testApi);
}

function render() {
  els.activeInstance.replaceChildren();
  for (const instance of settings.apiInstances) {
    const option = document.createElement('option');
    option.value = instance.id;
    option.textContent = instance.name;
    els.activeInstance.append(option);
  }
  els.activeInstance.value = settings.activeInstanceId;
  renderInstance();

  els.defaultMode.value = settings.defaultMode;
  els.videoQuality.value = settings.videoQuality;
  els.audioFormat.value = settings.audioFormat;
  els.videoContainer.value = settings.videoContainer;
  els.filenameStyle.value = settings.filenameStyle;
  els.historyLimit.value = settings.historyLimit;
  els.saveAs.checked = settings.saveAs;
  els.theme.value = settings.theme;
  els.compactMode.checked = settings.compactMode;
  els.notifications.checked = settings.notifications;
}

function renderInstance() {
  const instance = getActiveInstance();
  els.instanceName.value = instance.name;
  els.apiUrl.value = instance.url;
  els.authScheme.value = instance.authScheme;
  els.apiKey.value = instance.apiKey || '';
  els.apiKey.disabled = instance.authScheme === 'none';
  els.removeInstanceButton.disabled = settings.apiInstances.length <= 1;
}

async function save() {
  try {
    collectForm();
    settings = await send('saveSettings', { settings });
    render();
    showSaveState('Settings saved.', 'ok');
  } catch (error) {
    showSaveState(error.message, 'error');
  }
}

async function testApi() {
  try {
    collectActiveInstance();
    showApiResult('Testing connection...', '');
    const info = await send('testApi', { instance: getActiveInstance() });
    const services = info.services.length ? ` · ${info.services.length} services` : '';
    showApiResult(`Connected to Cobalt ${info.version || 'API'}${services}.`, 'ok');
  } catch (error) {
    showApiResult(error.message, 'error');
  }
}

function collectForm() {
  collectActiveInstance();
  settings.defaultMode = els.defaultMode.value;
  settings.videoQuality = els.videoQuality.value;
  settings.audioFormat = els.audioFormat.value;
  settings.videoContainer = els.videoContainer.value;
  settings.filenameStyle = els.filenameStyle.value;
  settings.historyLimit = Number(els.historyLimit.value);
  settings.saveAs = els.saveAs.checked;
  settings.theme = els.theme.value;
  settings.compactMode = els.compactMode.checked;
  settings.notifications = els.notifications.checked;
}

function collectActiveInstance() {
  const instance = getActiveInstance();
  if (!instance) return;
  instance.name = els.instanceName.value;
  instance.url = els.apiUrl.value;
  instance.authScheme = els.authScheme.value;
  instance.apiKey = els.authScheme.value === 'none' ? '' : els.apiKey.value;
}

function getActiveInstance() {
  return settings.apiInstances.find((item) => item.id === settings.activeInstanceId);
}

function showSaveState(message, kind) {
  els.saveState.textContent = message;
  els.saveState.className = kind || '';
}

function showApiResult(message, kind) {
  els.apiResult.textContent = message;
  els.apiResult.className = `output ${kind || ''}`.trim();
}

function send(type, payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...(payload || {}) }, (response) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else if (!response?.ok) reject(new Error(response?.error || 'Extension request failed.'));
      else resolve(response.result);
    });
  });
}
