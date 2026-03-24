document.addEventListener('DOMContentLoaded', function () {
  const urlParams = new URLSearchParams(window.location.search);
  const requestedApiType = urlParams.get('api');

  const testText = document.getElementById('test-text');
  const requestInfo = document.getElementById('request-info');
  const responseInfo = document.getElementById('response-info');
  const sendTestBtn = document.getElementById('send-test');
  const apiSelector = document.getElementById('api-selector');
  const apiSummary = document.getElementById('api-summary');
  const customResponsePanel = document.createElement('div');
  customResponsePanel.style.marginTop = '20px';
  customResponsePanel.innerHTML = `
    <h3>Raw Response</h3>
    <pre id="raw-response-info">Waiting for response...</pre>
  `;

  const state = {
    settings: SmartTranslatorApi.normalizeTranslationSettings(SmartTranslatorApi.createDefaultSettings())
  };

  responseInfo.parentElement.appendChild(customResponsePanel);
  const rawResponseInfo = customResponsePanel.querySelector('#raw-response-info');

  function buildApiOptions(settings) {
    const options = [
      { value: 'google', label: 'Google翻译' },
      { value: 'bing', label: 'Bing翻译' },
      { value: 'deepl', label: 'DeepL翻译' },
      { value: 'openai', label: 'OpenRouter / OpenAI-compatible' },
      { value: 'deepseek', label: 'DeepSeek' },
      { value: 'gemini', label: 'Gemini' }
    ];

    (settings.api.customApis || []).forEach(function (api) {
      options.push({
        value: api.id,
        label: `Custom: ${api.name}`
      });
    });

    return options;
  }

  function renderApiSelector(settings) {
    const options = buildApiOptions(settings);
    const fallback = settings.api.customSelectedId || (settings.api.customApis[0] && settings.api.customApis[0].id) || 'google';
    const initialValue = options.some(function (option) { return option.value === requestedApiType; })
      ? requestedApiType
      : (options.some(function (option) { return option.value === settings.api.type; }) ? settings.api.type : fallback);

    apiSelector.innerHTML = '';
    options.forEach(function (option) {
      const el = document.createElement('option');
      el.value = option.value;
      el.textContent = option.label;
      apiSelector.appendChild(el);
    });

    apiSelector.value = initialValue;
  }

  function getSelectedApiType() {
    return apiSelector.value;
  }

  function updatePreview() {
    const selectedApi = getSelectedApiType();
    const preview = SmartTranslatorApi.buildRequestPreview(selectedApi, {
      text: testText.value,
      sourceLang: 'auto',
      targetLang: 'zh-CN',
      customApiId: selectedApi
    }, state.settings);

    const selectedCustom = SmartTranslatorApi.resolveCustomApi(state.settings, selectedApi);
    const isCustom = !SmartTranslatorApi.isBuiltinApiType(selectedApi);

    apiSummary.textContent = isCustom && selectedCustom
      ? `Testing custom API: ${selectedCustom.name} | ${selectedCustom.url || 'No URL set'}`
      : `Testing built-in provider: ${selectedApi}`;

    requestInfo.textContent = JSON.stringify({
      providerType: preview.providerType,
      resolvedType: preview.resolvedType,
      customApiId: preview.customApiId,
      endpoint: preview.endpoint,
      method: preview.method,
      requestMode: preview.requestMode,
      model: preview.model,
      maxTokens: preview.maxTokens,
      headers: preview.headers || {},
      body: preview.body || null,
      request: preview.request
    }, null, 2);
  }

  function loadSettings() {
    chrome.runtime.sendMessage({ action: 'getSettings' }, function (response) {
      if (chrome.runtime.lastError || !response) {
        chrome.storage.sync.get('translationSettings', function (data) {
          state.settings = SmartTranslatorApi.normalizeTranslationSettings(data.translationSettings);
          renderApiSelector(state.settings);
          updatePreview();
        });
        return;
      }

      state.settings = SmartTranslatorApi.normalizeTranslationSettings(response);
      renderApiSelector(state.settings);
      updatePreview();
    });
  }

  apiSelector.addEventListener('change', updatePreview);
  testText.addEventListener('input', updatePreview);

  sendTestBtn.addEventListener('click', async function () {
    responseInfo.textContent = 'Sending request...';
    rawResponseInfo.textContent = 'Waiting for response...';

    const selectedApi = getSelectedApiType();
    const result = await SmartTranslatorApi.translateByProvider(
      selectedApi,
      {
        text: testText.value,
        sourceLang: 'auto',
        targetLang: 'zh-CN',
        customApiId: selectedApi
      },
      state.settings
    );

    responseInfo.textContent = JSON.stringify(result, null, 2);
    rawResponseInfo.textContent = result && result.rawResponse
      ? result.rawResponse
      : (result && result.data ? JSON.stringify(result.data, null, 2) : 'No raw response available');
  });

  loadSettings();
});
