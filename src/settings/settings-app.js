document.addEventListener('DOMContentLoaded', function () {
  const DEFAULT_STATUS_CLEAR_MS = 2500;
  const BUILTIN_API_FIELDS = {
    bing: {
      apiKey: 'bing-api-key',
      baseUrl: 'bing-base-url'
    },
    deepl: {
      apiKey: 'deepl-api-key',
      baseUrl: 'deepl-base-url'
    },
    openai: {
      apiKey: 'openai-api-key',
      model: 'openai-model',
      baseUrl: 'openai-base-url'
    },
    deepseek: {
      apiKey: 'deepseek-api-key',
      model: 'deepseek-model',
      baseUrl: 'deepseek-base-url'
    },
    gemini: {
      apiKey: 'gemini-api-key',
      model: 'gemini-model'
    }
  };

  const state = {
    settings: SmartTranslatorApi.normalizeTranslationSettings(SmartTranslatorApi.createDefaultSettings()),
    secrets: SmartTranslatorApi.createDefaultSecrets(),
    statusTimer: null
  };

  const refs = {
    translateModeRadios: Array.from(document.querySelectorAll('input[name="translate-mode"]')),
    enableCopy: document.getElementById('enable-copy'),
    enableF1: document.getElementById('enable-f1'),
    enableCustomKey: document.getElementById('enable-custom-key'),
    customKeySelect: document.getElementById('custom-key'),
    customKeyCode: document.getElementById('custom-key-code'),
    keyDisplay: document.getElementById('key-display'),
    apiSelect: document.getElementById('api-select'),
    apiPanels: {
      google: document.getElementById('google-settings'),
      bing: document.getElementById('bing-settings'),
      deepl: document.getElementById('deepl-settings'),
      openai: document.getElementById('openai-settings'),
      deepseek: document.getElementById('deepseek-settings'),
      gemini: document.getElementById('gemini-settings'),
      custom: document.getElementById('custom-settings')
    },
    displayPosition: document.getElementById('display-position'),
    autoClose: document.getElementById('auto-close'),
    customApisContainer: document.getElementById('custom-apis-container'),
    addApiBtn: document.getElementById('add-api-btn'),
    testActiveCustomApiBtn: document.getElementById('test-active-custom-api'),
    specialSitesList: document.getElementById('special-sites-list'),
    newSpecialSite: document.getElementById('new-special-site'),
    addSpecialSiteBtn: document.getElementById('add-special-site'),
    clearSecretsBtn: document.getElementById('clear-secrets-btn'),
    resetBtn: document.getElementById('reset-btn'),
    saveBtn: document.getElementById('save-btn')
  };

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function getCurrentSelectedMode() {
    const selected = refs.translateModeRadios.find(function (radio) {
      return radio.checked;
    });
    return selected ? selected.value : state.settings.translateMode;
  }

  function getSecretPlaceholder(hasSecret) {
    return hasSecret
      ? 'Stored locally. Leave blank to keep the existing key.'
      : 'Enter API key';
  }

  function setSecretInputState(input, hasSecret) {
    if (!input) {
      return;
    }

    input.value = '';
    input.dataset.hasSecret = hasSecret ? 'true' : 'false';
    input.placeholder = getSecretPlaceholder(hasSecret);
    input.autocomplete = 'new-password';
  }

  function ensureSecretClearButton(input, onClear) {
    if (!input) {
      return;
    }

    const existingButton = input.parentElement && input.parentElement.querySelector(
      `button[data-clear-for="${input.id || input.dataset.field || ''}"]`
    );
    if (existingButton) {
      existingButton.onclick = onClear;
      return;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Clear';
    button.className = 'secondary-btn';
    button.dataset.clearFor = input.id || input.dataset.field || '';
    button.style.marginTop = '8px';
    button.style.marginLeft = '8px';
    button.onclick = onClear;
    input.insertAdjacentElement('afterend', button);
  }

  function readSecretInputValue(input, previousValue) {
    if (!input) {
      return previousValue || '';
    }

    const nextValue = input.value.trim();
    if (nextValue) {
      return nextValue;
    }

    return input.dataset.hasSecret === 'true' ? (previousValue || '') : '';
  }

  function getApiSecretValue(settings, provider) {
    return settings.api && settings.api[provider] && settings.api[provider].apiKey
      ? settings.api[provider].apiKey
      : '';
  }

  function getCustomApiSecretValue(settings, apiId) {
    const api = SmartTranslatorApi.resolveCustomApi(settings, apiId);
    return api && api.apiKey ? api.apiKey : '';
  }

  function showStatus(message, isError) {
    let statusEl = document.getElementById('settings-status');

    if (!statusEl) {
      statusEl = document.createElement('div');
      statusEl.id = 'settings-status';
      statusEl.style.position = 'sticky';
      statusEl.style.top = '12px';
      statusEl.style.zIndex = '20';
      statusEl.style.margin = '0 0 16px 0';
      statusEl.style.padding = '10px 12px';
      statusEl.style.borderRadius = '8px';
      statusEl.style.fontSize = '14px';
      statusEl.style.display = 'none';
      statusEl.style.pointerEvents = 'none';
      const container = document.querySelector('.container');
      container.insertBefore(statusEl, container.firstElementChild);
    }

    statusEl.textContent = message;
    statusEl.style.display = 'block';
    statusEl.style.background = isError ? '#fdecea' : '#e8f5e9';
    statusEl.style.color = isError ? '#b71c1c' : '#1b5e20';
    statusEl.style.border = isError ? '1px solid #f5c6cb' : '1px solid #c8e6c9';
    statusEl.style.boxShadow = isError
      ? '0 8px 18px rgba(183, 28, 28, 0.12)'
      : '0 8px 18px rgba(27, 94, 32, 0.12)';

    if (state.statusTimer) {
      clearTimeout(state.statusTimer);
    }

    state.statusTimer = setTimeout(function () {
      statusEl.style.display = 'none';
    }, DEFAULT_STATUS_CLEAR_MS);
  }

  function ensureClearSecretsButton() {
    if (refs.clearSecretsBtn) {
      return refs.clearSecretsBtn;
    }

    const footer = document.querySelector('.footer');
    if (!footer) {
      return null;
    }

    const button = document.createElement('button');
    button.id = 'clear-secrets-btn';
    button.type = 'button';
    button.className = 'secondary-btn';
    button.textContent = 'Clear local keys';
    footer.insertBefore(button, refs.resetBtn);
    refs.clearSecretsBtn = button;
    return button;
  }

  function getSettingsFromStorage() {
    return new Promise(function (resolve) {
      chrome.runtime.sendMessage({ action: 'getSettings' }, function (response) {
        if (chrome.runtime.lastError || !response) {
          chrome.storage.sync.get('translationSettings', function (syncData) {
            chrome.storage.local.get('translationSecrets', function (localData) {
              const merged = SmartTranslatorApi.applySecretsToSettings(
                syncData.translationSettings,
                localData.translationSecrets
              );
              resolve(merged);
            });
          });
          return;
        }

        resolve(response);
      });
    });
  }

  function setSettingsToStorage(settings) {
    const normalized = SmartTranslatorApi.normalizeTranslationSettings(settings);
    const secrets = SmartTranslatorApi.extractSecretsFromSettings(normalized);
    const publicSettings = SmartTranslatorApi.stripSecretsFromSettings(normalized);

    return new Promise(function (resolve, reject) {
      chrome.storage.local.set({ translationSecrets: secrets }, function () {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        chrome.storage.sync.set({ translationSettings: publicSettings }, function () {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }

          state.settings = SmartTranslatorApi.applySecretsToSettings(publicSettings, secrets);
          state.secrets = secrets;
          resolve(state.settings);
        });
      });
    });
  }

  function syncCustomApiOptions() {
    const currentValue = refs.apiSelect.value;
    const builtinOptions = Array.from(refs.apiSelect.querySelectorAll('option')).filter(function (option) {
      return SmartTranslatorApi.isBuiltinApiType(option.value);
    });

    refs.apiSelect.innerHTML = '';
    builtinOptions.forEach(function (option) {
      refs.apiSelect.appendChild(option);
    });

    state.settings.api.customApis.forEach(function (api) {
      const option = document.createElement('option');
      option.value = api.id;
      option.textContent = `Custom: ${api.name || api.id}`;
      refs.apiSelect.appendChild(option);
    });

    const availableValues = Array.from(refs.apiSelect.options).map(function (option) {
      return option.value;
    });
    const nextValue = availableValues.includes(currentValue)
      ? currentValue
      : (availableValues.includes(state.settings.api.type) ? state.settings.api.type : refs.apiSelect.options[0].value);

    refs.apiSelect.value = nextValue;
    state.settings.api.type = nextValue;
    if (!SmartTranslatorApi.isBuiltinApiType(nextValue)) {
      state.settings.api.customSelectedId = nextValue;
    }
  }

  function renderTranslateMode() {
    refs.translateModeRadios.forEach(function (radio) {
      radio.checked = radio.value === state.settings.translateMode;
    });
  }

  function renderTriggerMethods() {
    refs.enableCopy.checked = Boolean(state.settings.triggerMethods.copy);
    refs.enableF1.checked = Boolean(state.settings.triggerMethods.f1);
    refs.enableCustomKey.checked = Boolean(state.settings.triggerMethods.customKey);
    refs.customKeySelect.value = state.settings.customKey.modifier || 'alt';
    refs.customKeyCode.value = String(state.settings.customKey.keyCode || 84);
    refs.keyDisplay.value = keyCodeToLabel(state.settings.customKey.keyCode || 84);
    refs.keyDisplay.dataset.keyCode = String(state.settings.customKey.keyCode || 84);
    document.getElementById('custom-key-settings').style.display = refs.enableCustomKey.checked ? 'block' : 'none';
  }

  function keyCodeToLabel(keyCode) {
    const code = Number(keyCode) || 84;
    if (code >= 65 && code <= 90) {
      return String.fromCharCode(code);
    }
    return `Key ${code}`;
  }

  function renderBuiltinSettings() {
    Object.keys(BUILTIN_API_FIELDS).forEach(function (provider) {
      const config = BUILTIN_API_FIELDS[provider];
      const providerState = state.settings.api[provider] || {};
      const secretInput = document.getElementById(config.apiKey);
      setSecretInputState(secretInput, Boolean(getApiSecretValue(state.settings, provider)));
      ensureSecretClearButton(secretInput, function () {
        setSecretInputState(secretInput, false);
      });

      if (config.baseUrl) {
        const baseUrlInput = document.getElementById(config.baseUrl);
        if (baseUrlInput) {
          baseUrlInput.value = providerState.baseUrl || '';
        }
      }

      if (config.model) {
        const modelInput = document.getElementById(config.model);
        if (modelInput) {
          modelInput.value = providerState.model || '';
        }
      }
    });
  }

  function renderDisplaySettings() {
    refs.displayPosition.value = state.settings.display.position || 'near';
    refs.autoClose.value = String(state.settings.display.autoClose || 0);
  }

  function renderCustomApiCard(api) {
    const card = document.createElement('div');
    card.className = 'custom-api-item';
    card.dataset.apiId = api.id;

    card.innerHTML = [
      '<div class="custom-api-header">',
      `  <h4>${escapeHtml(api.name || api.id)}</h4>`,
      '  <div class="custom-api-actions">',
      `    <button type="button" class="secondary-btn danger-btn" data-action="remove-custom" data-api-id="${escapeHtml(api.id)}">Delete</button>`,
      '  </div>',
      '</div>',
      '<div class="custom-api-content">',
      `  <label><span>Id</span><input type="text" data-field="id" value="${escapeAttribute(api.id)}" readonly></label>`,
      `  <label><span>Name</span><input type="text" data-field="name" value="${escapeAttribute(api.name || '')}" placeholder="Custom API name"></label>`,
      `  <label><span>URL</span><input type="text" data-field="url" value="${escapeAttribute(api.url || '')}" placeholder="https://example.com/translate"></label>`,
      '  <label><span>API Key</span><input type="password" data-field="apiKey"></label>',
      '  <label><span>Request Mode</span>',
      '    <select data-field="requestMode">',
      `      <option value="auto"${api.requestMode === 'auto' ? ' selected' : ''}>Auto</option>`,
      `      <option value="generic"${api.requestMode === 'generic' ? ' selected' : ''}>Generic JSON</option>`,
      `      <option value="openai"${api.requestMode === 'openai' ? ' selected' : ''}>OpenAI compatible</option>`,
      '    </select>',
      '  </label>',
      `  <label><span>Model</span><input type="text" data-field="model" value="${escapeAttribute(api.model || '')}" placeholder="Model name"></label>`,
      `  <label><span>Max Tokens</span><input type="number" min="1" data-field="maxTokens" value="${escapeAttribute(api.maxTokens || 512)}"></label>`,
      '  <label><span>Method</span>',
      '    <select data-field="method">',
      `      <option value="POST"${api.method === 'POST' ? ' selected' : ''}>POST</option>`,
      `      <option value="GET"${api.method === 'GET' ? ' selected' : ''}>GET</option>`,
      '    </select>',
      '  </label>',
      `  <label><span>Base URL</span><input type="text" data-field="baseUrl" value="${escapeAttribute(api.baseUrl || '')}" placeholder="Optional base URL"></label>`,
      '  <label><span>Use custom headers</span><input type="checkbox" data-field="useCustomHeaders"' + (api.useCustomHeaders ? ' checked' : '') + '></label>',
      `  <label><span>Headers</span><textarea data-field="headers" placeholder="Header: value">${escapeHtml(api.headers || '')}</textarea></label>`,
      `  <label><span>Response Path</span><input type="text" data-field="responsePath" value="${escapeAttribute(api.responsePath || '')}" placeholder="choices.0.message.content"></label>`,
      '</div>'
    ].join('');

    const apiKeyInput = card.querySelector('input[data-field="apiKey"]');
    setSecretInputState(apiKeyInput, Boolean(api.apiKey));
    ensureSecretClearButton(apiKeyInput, function () {
      setSecretInputState(apiKeyInput, false);
    });

    const deleteButton = card.querySelector('[data-action="remove-custom"]');
    if (deleteButton) {
      deleteButton.addEventListener('click', function (event) {
        event.preventDefault();
        removeCustomApi(api.id);
      });
    }

    return card;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function renderCustomApis() {
    refs.customApisContainer.innerHTML = '';

    state.settings.api.customApis.forEach(function (api) {
      refs.customApisContainer.appendChild(renderCustomApiCard(api));
    });
  }

  function renderSpecialSites() {
    refs.specialSitesList.innerHTML = '';

    state.settings.specialSites.forEach(function (site) {
      const row = document.createElement('div');
      row.className = 'custom-api-item';
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.innerHTML = [
        `<span>${escapeHtml(site)}</span>`,
        `<button type="button" class="secondary-btn" data-action="remove-site" data-site="${escapeAttribute(site)}">Delete</button>`
      ].join('');
      refs.specialSitesList.appendChild(row);
    });
  }

  function renderApiPanels() {
    const selected = refs.apiSelect.value;
    const isCustomSelection = !SmartTranslatorApi.isBuiltinApiType(selected);
    Object.keys(refs.apiPanels).forEach(function (key) {
      const panel = refs.apiPanels[key];
      if (!panel) {
        return;
      }

      if (key === 'custom') {
        panel.style.display = isCustomSelection ? 'block' : 'none';
        return;
      }

      panel.style.display = key === selected ? 'block' : 'none';
    });
  }

  function renderAll() {
    state.settings = SmartTranslatorApi.normalizeTranslationSettings(state.settings);
    state.secrets = SmartTranslatorApi.extractSecretsFromSettings(state.settings);
    renderTranslateMode();
    renderTriggerMethods();
    renderBuiltinSettings();
    renderDisplaySettings();
    syncCustomApiOptions();
    renderCustomApis();
    renderSpecialSites();
    renderApiPanels();
  }

  function collectBuiltinSettings(next) {
    next.translateMode = getCurrentSelectedMode();
    next.triggerMethods = {
      copy: Boolean(refs.enableCopy.checked),
      f1: Boolean(refs.enableF1.checked),
      customKey: Boolean(refs.enableCustomKey.checked)
    };
    next.customKey = {
      modifier: refs.customKeySelect.value || 'alt',
      keyCode: Number(refs.customKeyCode.value) || 84
    };
    next.display.position = refs.displayPosition.value || next.display.position;
    next.display.autoClose = Number(refs.autoClose.value) || 0;
    next.api.type = refs.apiSelect.value;
    next.api.customSelectedId = SmartTranslatorApi.isBuiltinApiType(next.api.type) ? next.api.customSelectedId : next.api.type;

    Object.keys(BUILTIN_API_FIELDS).forEach(function (provider) {
      const config = BUILTIN_API_FIELDS[provider];
      const providerState = next.api[provider] || {};
      const secretInput = document.getElementById(config.apiKey);
      const previousApiKey = getApiSecretValue(state.settings, provider);
      providerState.apiKey = readSecretInputValue(secretInput, previousApiKey);

      if (config.baseUrl) {
        const baseUrlInput = document.getElementById(config.baseUrl);
        providerState.baseUrl = baseUrlInput ? baseUrlInput.value.trim() : providerState.baseUrl;
      }

      if (config.model) {
        const modelInput = document.getElementById(config.model);
        providerState.model = modelInput ? modelInput.value.trim() : providerState.model;
      }

      next.api[provider] = providerState;
    });
  }

  function collectCustomApis(next) {
    const cards = Array.from(refs.customApisContainer.querySelectorAll('.custom-api-item'));
    const previousApis = state.settings.api.customApis || [];

    next.api.customApis = cards.map(function (card) {
      const id = card.dataset.apiId;
      const previous = previousApis.find(function (api) {
        return api.id === id;
      }) || SmartTranslatorApi.createDefaultCustomApi(1);

      const api = {
        id: id,
        name: card.querySelector('[data-field="name"]').value.trim() || previous.name || id,
        url: card.querySelector('[data-field="url"]').value.trim(),
        apiKey: readSecretInputValue(
          card.querySelector('[data-field="apiKey"]'),
          previous.apiKey || ''
        ),
        model: card.querySelector('[data-field="model"]').value.trim(),
        requestMode: card.querySelector('[data-field="requestMode"]').value,
        maxTokens: Number(card.querySelector('[data-field="maxTokens"]').value) || 512,
        method: card.querySelector('[data-field="method"]').value || 'POST',
        useCustomHeaders: Boolean(card.querySelector('[data-field="useCustomHeaders"]').checked),
        headers: card.querySelector('[data-field="headers"]').value,
        responsePath: card.querySelector('[data-field="responsePath"]').value.trim(),
        baseUrl: card.querySelector('[data-field="baseUrl"]').value.trim()
      };

      return SmartTranslatorApi.normalizeCustomApi(api);
    });
  }

  function collectSpecialSites(next) {
    next.specialSites = clone(state.settings.specialSites || []);
  }

  function buildNextSettings() {
    const next = SmartTranslatorApi.normalizeTranslationSettings(clone(state.settings));
    collectBuiltinSettings(next);
    collectCustomApis(next);
    collectSpecialSites(next);
    return SmartTranslatorApi.normalizeTranslationSettings(next);
  }

  async function saveCurrentSettings(showToast) {
    const nextSettings = buildNextSettings();
    const saved = await setSettingsToStorage(nextSettings);
    state.settings = saved;
    renderAll();
    if (showToast) {
      showStatus('Settings saved', false);
    }
  }

  async function saveCurrentSettingsWithStatus() {
    try {
      await saveCurrentSettings(true);
    } catch (error) {
      showStatus(error && error.message ? error.message : 'Failed to save settings', true);
    }
  }

  function openApiTestWindow(apiId) {
    const targetApi = apiId || getSelectedCustomApiId() || refs.apiSelect.value;
    const url = chrome.runtime.getURL(`src/settings/api-test.html?api=${encodeURIComponent(targetApi)}`);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function persistSettings(nextSettings, options) {
    const saved = await setSettingsToStorage(nextSettings);
    state.settings = saved;
    renderAll();

    if (options && options.message) {
      showStatus(options.message, Boolean(options.isError));
    }

    return saved;
  }

  function getSelectedCustomApiId() {
    const selected = refs.apiSelect.value;
    return SmartTranslatorApi.isBuiltinApiType(selected) ? (state.settings.api.customSelectedId || '') : selected;
  }

  function getNextCustomApiId() {
    const existing = new Set((state.settings.api.customApis || []).map(function (api) {
      return api.id;
    }));
    let index = existing.size + 1;
    let candidate = `custom${index}`;
    while (existing.has(candidate)) {
      index += 1;
      candidate = `custom${index}`;
    }
    return candidate;
  }

  function addCustomApi() {
    const next = buildNextSettings();
    next.api.customApis = Array.isArray(next.api.customApis) ? next.api.customApis.slice() : [];
    next.api.customApis.push(SmartTranslatorApi.createDefaultCustomApi(next.api.customApis.length + 1));
    next.api.customApis[next.api.customApis.length - 1].id = getNextCustomApiId();
    next.api.customSelectedId = next.api.customApis[next.api.customApis.length - 1].id;
    next.api.type = next.api.customApis[next.api.customApis.length - 1].id;
    persistSettings(SmartTranslatorApi.normalizeTranslationSettings(next), {
      message: 'Custom API added'
    }).catch(function (error) {
      showStatus(error && error.message ? error.message : 'Failed to add custom API', true);
    });
  }

  function removeCustomApi(apiId) {
    if (!window.confirm('Delete this custom API?')) {
      return;
    }

    const next = buildNextSettings();
    const removedSelected = next.api.type === apiId || next.api.customSelectedId === apiId;
    next.api.customApis = (next.api.customApis || []).filter(function (api) {
      return api.id !== apiId;
    });
    if (!next.api.customApis.length) {
      next.api.customApis = [SmartTranslatorApi.createDefaultCustomApi(1)];
    }
    next.api.customSelectedId = removedSelected ? next.api.customApis[0].id : (next.api.customSelectedId || next.api.customApis[0].id);
    if (!SmartTranslatorApi.isBuiltinApiType(next.api.type) || next.api.type === apiId) {
      next.api.type = next.api.customApis[0].id;
    }
    persistSettings(SmartTranslatorApi.normalizeTranslationSettings(next), {
      message: 'Custom API deleted'
    }).catch(function (error) {
      showStatus(error && error.message ? error.message : 'Failed to delete custom API', true);
    });
  }

  function addSpecialSite() {
    const site = refs.newSpecialSite.value.trim();
    if (!site) {
      return;
    }

    const next = buildNextSettings();
    next.specialSites = Array.from(new Set([...(next.specialSites || []), site]));
    refs.newSpecialSite.value = '';
    persistSettings(SmartTranslatorApi.normalizeTranslationSettings(next), {
      message: 'Special site added'
    }).catch(function (error) {
      showStatus(error && error.message ? error.message : 'Failed to add special site', true);
    });
  }

  function removeSpecialSite(site) {
    const next = buildNextSettings();
    next.specialSites = (next.specialSites || []).filter(function (item) {
      return item !== site;
    });
    persistSettings(SmartTranslatorApi.normalizeTranslationSettings(next), {
      message: 'Special site removed'
    }).catch(function (error) {
      showStatus(error && error.message ? error.message : 'Failed to remove special site', true);
    });
  }

  function selectApiType(apiType) {
    const next = clone(state.settings);
    next.api.type = apiType;
    if (!SmartTranslatorApi.isBuiltinApiType(apiType)) {
      next.api.customSelectedId = apiType;
    }
    state.settings = SmartTranslatorApi.normalizeTranslationSettings(next);
    renderApiPanels();
  }

  function updateKeyDisplayFromInput() {
    refs.keyDisplay.value = keyCodeToLabel(refs.customKeyCode.value);
  }

  function attachDynamicEvents() {
    refs.apiSelect.addEventListener('change', function () {
      selectApiType(refs.apiSelect.value);
    });

    refs.translateModeRadios.forEach(function (radio) {
      radio.addEventListener('change', function () {
        state.settings.translateMode = getCurrentSelectedMode();
      });
    });

    refs.enableCustomKey.addEventListener('change', function () {
      document.getElementById('custom-key-settings').style.display = refs.enableCustomKey.checked ? 'block' : 'none';
      state.settings.triggerMethods.customKey = refs.enableCustomKey.checked;
    });

    refs.keyDisplay.addEventListener('click', function () {
      refs.customKeyCode.focus();
    });

    refs.customKeyCode.addEventListener('input', function () {
      updateKeyDisplayFromInput();
    });

    refs.customApisContainer.addEventListener('input', function (event) {
      if (event.target && event.target.dataset && event.target.dataset.field === 'apiKey') {
        event.target.dataset.hasSecret = event.target.value.trim() ? 'true' : event.target.dataset.hasSecret;
      }
    });

    refs.newSpecialSite.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        addSpecialSite();
      }
    });

    refs.specialSitesList.addEventListener('click', function (event) {
      const action = event.target && event.target.dataset ? event.target.dataset.action : '';
      const site = event.target && event.target.dataset ? event.target.dataset.site : '';
      if (action === 'remove-site' && site) {
        removeSpecialSite(site);
      }
    });

    const clearSecretsBtn = ensureClearSecretsButton();
    if (clearSecretsBtn) {
      clearSecretsBtn.addEventListener('click', async function () {
        if (!window.confirm('Clear all locally stored API keys?')) {
          return;
        }

        const next = clone(state.settings);
        next.api.bing.apiKey = '';
        next.api.deepl.apiKey = '';
        next.api.openai.apiKey = '';
        next.api.deepseek.apiKey = '';
        next.api.gemini.apiKey = '';
        next.api.customApis = (next.api.customApis || []).map(function (api) {
          return Object.assign({}, api, { apiKey: '' });
        });

        try {
          await persistSettings(SmartTranslatorApi.normalizeTranslationSettings(next), {
            message: 'Local API keys cleared'
          });
        } catch (error) {
          showStatus(error && error.message ? error.message : 'Failed to clear local keys', true);
        }
      });
    }

    refs.addApiBtn.addEventListener('click', function (event) {
      event.preventDefault();
      addCustomApi();
    });

    refs.testActiveCustomApiBtn.addEventListener('click', function (event) {
      event.preventDefault();
      const activeId = getSelectedCustomApiId() || (state.settings.api.customApis[0] && state.settings.api.customApis[0].id);
      if (!activeId) {
        showStatus('No custom API configured', true);
        return;
      }
      openApiTestWindow(activeId);
    });

    document.querySelectorAll('.test-api-btn[data-api]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        openApiTestWindow(button.dataset.api);
      });
    });

    refs.saveBtn.addEventListener('click', function (event) {
      event.preventDefault();
      saveCurrentSettingsWithStatus();
    });

    refs.resetBtn.addEventListener('click', function (event) {
      event.preventDefault();
      if (!window.confirm('Reset all settings and clear stored API keys?')) {
        return;
      }

      const defaults = SmartTranslatorApi.createDefaultSettings();
      setSettingsToStorage(defaults).then(function () {
        state.settings = SmartTranslatorApi.applySecretsToSettings(
          SmartTranslatorApi.stripSecretsFromSettings(defaults),
          SmartTranslatorApi.createDefaultSecrets()
        );
        renderAll();
        showStatus('Settings reset', false);
      }).catch(function (error) {
        showStatus(error && error.message ? error.message : 'Failed to reset settings', true);
      });
    });

    document.addEventListener('keydown', function (event) {
      const isSaveShortcut = (event.ctrlKey || event.metaKey) && event.key && event.key.toLowerCase() === 's';
      if (!isSaveShortcut) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      saveCurrentSettingsWithStatus();
    }, true);
  }

  async function testCustomApi(apiId) {
    openApiTestWindow(apiId);
  }

  function migrateLegacySecretsIfNeeded(settings) {
    const normalized = SmartTranslatorApi.normalizeTranslationSettings(settings);
    const secrets = SmartTranslatorApi.extractSecretsFromSettings(normalized);
    const stripped = SmartTranslatorApi.stripSecretsFromSettings(normalized);

    return chrome.storage.sync.set({ translationSettings: stripped }, function () {
      chrome.storage.local.set({ translationSecrets: secrets }, function () {
        state.settings = SmartTranslatorApi.applySecretsToSettings(stripped, secrets);
        state.secrets = secrets;
        renderAll();
      });
    });
  }

  async function initialize() {
    const settings = await getSettingsFromStorage();
    const normalized = SmartTranslatorApi.normalizeTranslationSettings(settings);
    const secrets = SmartTranslatorApi.extractSecretsFromSettings(normalized);

    state.settings = SmartTranslatorApi.applySecretsToSettings(
      SmartTranslatorApi.stripSecretsFromSettings(normalized),
      secrets
    );
    state.secrets = secrets;

    const syncSettings = SmartTranslatorApi.stripSecretsFromSettings(normalized);
    const needsMigration = JSON.stringify(syncSettings) !== JSON.stringify(normalized);
    if (needsMigration) {
      await setSettingsToStorage(normalized);
    }

    renderAll();
    attachDynamicEvents();

    window.addEventListener('keydown', function (event) {
      const isSaveShortcut = (event.ctrlKey || event.metaKey) && event.key && event.key.toLowerCase() === 's';
      if (!isSaveShortcut) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      saveCurrentSettingsWithStatus();
    }, true);
  }

  initialize().catch(function (error) {
    console.error('Failed to initialize settings page:', error);
    showStatus(error && error.message ? error.message : 'Failed to load settings', true);
  });
});
