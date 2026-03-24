(function (root, factory) {
  const api = factory();
  root.SmartTranslatorApi = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  const BUILTIN_API_TYPES = ['google', 'bing', 'deepl', 'openai', 'deepseek', 'gemini'];

  function createDefaultCustomApi(index = 1) {
    return {
      id: `custom${index}`,
      name: `Custom API ${index}`,
      url: '',
      apiKey: '',
      model: '',
      requestMode: 'auto',
      maxTokens: 512,
      method: 'POST',
      useCustomHeaders: false,
      headers: '',
      responsePath: '',
      baseUrl: ''
    };
  }

  function createDefaultSecrets() {
    return {
      api: {
        bing: { apiKey: '' },
        deepl: { apiKey: '' },
        openai: { apiKey: '' },
        deepseek: { apiKey: '' },
        gemini: { apiKey: '' }
      },
      customApiKeys: {}
    };
  }

  function createDefaultSettings() {
    return {
      translateMode: 'instant',
      triggerMethods: {
        copy: false,
        f1: true,
        customKey: false
      },
      customKey: {
        modifier: 'alt',
        keyCode: 84
      },
      api: {
        type: 'google',
        customSelectedId: '',
        google: {},
        bing: {
          apiKey: '',
          baseUrl: 'https://api.cognitive.microsofttranslator.com',
          region: ''
        },
        deepl: {
          apiKey: '',
          baseUrl: 'https://api-free.deepl.com/v2'
        },
        openai: {
          apiKey: '',
          model: 'gpt-3.5-turbo',
          baseUrl: 'https://openrouter.ai/api/v1'
        },
        deepseek: {
          apiKey: '',
          model: 'deepseek-chat',
          baseUrl: 'https://api.deepseek.com/v1'
        },
        gemini: {
          apiKey: '',
          model: 'gemini-pro'
        },
        customApis: [createDefaultCustomApi()]
      },
      display: {
        position: 'near',
        autoClose: 0
      },
      specialSites: [
        'arxiv.org',
        'pdf',
        'scholar.google.com',
        'github.com',
        'gitlab.com'
      ]
    };
  }

  function deepClone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function mergeDeep(base, overrides) {
    const result = Array.isArray(base) ? base.slice() : { ...base };

    if (!overrides || typeof overrides !== 'object') {
      return result;
    }

    Object.keys(overrides).forEach((key) => {
      const overrideValue = overrides[key];
      const baseValue = result[key];

      if (Array.isArray(overrideValue)) {
        result[key] = overrideValue.slice();
      } else if (
        overrideValue &&
        typeof overrideValue === 'object' &&
        !Array.isArray(overrideValue) &&
        baseValue &&
        typeof baseValue === 'object' &&
        !Array.isArray(baseValue)
      ) {
        result[key] = mergeDeep(baseValue, overrideValue);
      } else {
        result[key] = overrideValue;
      }
    });

    return result;
  }

  function normalizeCustomApi(api, index = 1) {
    const fallback = createDefaultCustomApi(index);
    const normalized = mergeDeep(fallback, api || {});

    normalized.id = normalized.id || fallback.id;
    normalized.name = normalized.name || fallback.name;
    normalized.url = normalized.url || '';
    normalized.apiKey = normalized.apiKey || '';
    normalized.model = normalized.model || '';
    normalized.requestMode = normalized.requestMode || 'auto';
    normalized.maxTokens = Number.isFinite(Number(normalized.maxTokens)) && Number(normalized.maxTokens) > 0
      ? Math.floor(Number(normalized.maxTokens))
      : 512;
    normalized.method = (normalized.method || 'POST').toUpperCase();
    normalized.useCustomHeaders = Boolean(normalized.useCustomHeaders);
    normalized.headers = normalized.headers || '';
    normalized.responsePath = normalized.responsePath || '';
    normalized.baseUrl = normalized.baseUrl || '';

    return normalized;
  }

  function normalizeSecrets(secrets) {
    const normalized = mergeDeep(createDefaultSecrets(), secrets || {});
    normalized.api.bing = mergeDeep(createDefaultSecrets().api.bing, normalized.api.bing);
    normalized.api.deepl = mergeDeep(createDefaultSecrets().api.deepl, normalized.api.deepl);
    normalized.api.openai = mergeDeep(createDefaultSecrets().api.openai, normalized.api.openai);
    normalized.api.deepseek = mergeDeep(createDefaultSecrets().api.deepseek, normalized.api.deepseek);
    normalized.api.gemini = mergeDeep(createDefaultSecrets().api.gemini, normalized.api.gemini);
    normalized.customApiKeys = normalized.customApiKeys && typeof normalized.customApiKeys === 'object'
      ? normalized.customApiKeys
      : {};
    return normalized;
  }

  function extractSecretsFromSettings(settings) {
    const normalized = normalizeTranslationSettings(settings);
    const customApiKeys = {};

    normalized.api.customApis.forEach((api) => {
      if (api.apiKey) {
        customApiKeys[api.id] = api.apiKey;
      }
    });

    return normalizeSecrets({
      api: {
        bing: { apiKey: normalized.api.bing.apiKey || '' },
        deepl: { apiKey: normalized.api.deepl.apiKey || '' },
        openai: { apiKey: normalized.api.openai.apiKey || '' },
        deepseek: { apiKey: normalized.api.deepseek.apiKey || '' },
        gemini: { apiKey: normalized.api.gemini.apiKey || '' }
      },
      customApiKeys
    });
  }

  function applySecretsToSettings(settings, secrets) {
    const normalized = normalizeTranslationSettings(settings);
    const normalizedSecrets = normalizeSecrets(secrets);
    const merged = deepClone(normalized);

    merged.api.bing.apiKey = normalizedSecrets.api.bing.apiKey || '';
    merged.api.deepl.apiKey = normalizedSecrets.api.deepl.apiKey || '';
    merged.api.openai.apiKey = normalizedSecrets.api.openai.apiKey || '';
    merged.api.deepseek.apiKey = normalizedSecrets.api.deepseek.apiKey || '';
    merged.api.gemini.apiKey = normalizedSecrets.api.gemini.apiKey || '';

    merged.api.customApis = merged.api.customApis.map((api) => ({
      ...api,
      apiKey: normalizedSecrets.customApiKeys[api.id] || api.apiKey || ''
    }));

    return normalizeTranslationSettings(merged);
  }

  function stripSecretsFromSettings(settings) {
    const normalized = normalizeTranslationSettings(settings);
    const stripped = deepClone(normalized);

    stripped.api.bing.apiKey = '';
    stripped.api.deepl.apiKey = '';
    stripped.api.openai.apiKey = '';
    stripped.api.deepseek.apiKey = '';
    stripped.api.gemini.apiKey = '';
    stripped.api.customApis = stripped.api.customApis.map((api) => ({
      ...api,
      apiKey: ''
    }));

    return stripped;
  }

  function normalizeTranslationSettings(settings) {
    const normalized = mergeDeep(createDefaultSettings(), settings || {});

    normalized.triggerMethods = mergeDeep(createDefaultSettings().triggerMethods, normalized.triggerMethods);
    normalized.customKey = mergeDeep(createDefaultSettings().customKey, normalized.customKey);
    normalized.display = mergeDeep(createDefaultSettings().display, normalized.display);
    normalized.api = mergeDeep(createDefaultSettings().api, normalized.api);
    normalized.api.google = mergeDeep(createDefaultSettings().api.google, normalized.api.google);
    normalized.api.bing = mergeDeep(createDefaultSettings().api.bing, normalized.api.bing);
    normalized.api.deepl = mergeDeep(createDefaultSettings().api.deepl, normalized.api.deepl);
    normalized.api.openai = mergeDeep(createDefaultSettings().api.openai, normalized.api.openai);
    normalized.api.deepseek = mergeDeep(createDefaultSettings().api.deepseek, normalized.api.deepseek);
    normalized.api.gemini = mergeDeep(createDefaultSettings().api.gemini, normalized.api.gemini);

    const customApis = Array.isArray(normalized.api.customApis) && normalized.api.customApis.length
      ? normalized.api.customApis
      : createDefaultSettings().api.customApis;
    normalized.api.customApis = customApis.map((api, index) => normalizeCustomApi(api, index + 1));

    if (!normalized.api.customApis.length) {
      normalized.api.customApis = [createDefaultCustomApi(1)];
    }

    const firstCustomApi = normalized.api.customApis[0];
    const hasTypeMatch = BUILTIN_API_TYPES.includes(normalized.api.type)
      || normalized.api.customApis.some((api) => api.id === normalized.api.type);
    const hasSelectedMatch = normalized.api.customSelectedId
      ? normalized.api.customApis.some((api) => api.id === normalized.api.customSelectedId)
      : false;

    if (normalized.api.type === 'custom' || !hasTypeMatch) {
      normalized.api.type = hasSelectedMatch
        ? normalized.api.customSelectedId
        : (firstCustomApi ? firstCustomApi.id : 'google');
    }

    if (normalized.api.customSelectedId && !hasSelectedMatch) {
      normalized.api.customSelectedId = firstCustomApi ? firstCustomApi.id : '';
    }

    if (!normalized.api.customSelectedId && firstCustomApi && !BUILTIN_API_TYPES.includes(normalized.api.type)) {
      normalized.api.customSelectedId = normalized.api.type;
    }

    return normalized;
  }

  function isBuiltinApiType(apiType) {
    return BUILTIN_API_TYPES.includes(apiType);
  }

  function resolveCustomApi(settings, apiId) {
    const normalized = normalizeTranslationSettings(settings);
    const candidateId = apiId || normalized.api.customSelectedId || normalized.api.type;
    const customApi = normalized.api.customApis.find((api) => api.id === candidateId) || null;

    return customApi;
  }

  function resolveProviderSelection(settings, providerType, requestCustomApiId) {
    const normalized = normalizeTranslationSettings(settings);

    if (isBuiltinApiType(providerType)) {
      return {
        kind: 'builtin',
        apiType: providerType,
        settings: normalized
      };
    }

    const customApi = resolveCustomApi(normalized, requestCustomApiId || providerType);

    if (!customApi) {
      return {
        kind: 'missing-custom',
        apiType: providerType,
        settings: normalized,
        error: 'Custom API not found'
      };
    }

    return {
      kind: 'custom',
      apiType: customApi.id,
      settings: normalized,
      customApi
    };
  }

  function parseHeaderLines(headerText) {
    const headers = {};

    if (!headerText) {
      return headers;
    }

    headerText.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return;
      }

      const separatorIndex = trimmed.indexOf(':');
      if (separatorIndex === -1) {
        return;
      }

      const name = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();

      if (name && value) {
        headers[name] = value;
      }
    });

    return headers;
  }

  function getByPath(object, path) {
    if (!object || !path) {
      return undefined;
    }

    const normalizedPath = path
      .replace(/\[(\d+)\]/g, '.$1')
      .replace(/^\./, '');

    return normalizedPath.split('.').reduce((current, segment) => {
      if (current === undefined || current === null) {
        return undefined;
      }

      return current[segment];
    }, object);
  }

  function extractTranslationText(payload) {
    if (payload === null || payload === undefined) {
      return '';
    }

    if (typeof payload === 'string') {
      return payload.trim();
    }

    if (Array.isArray(payload)) {
      let text = '';

      payload.forEach((item) => {
        const itemText = extractTranslationText(item);
        if (itemText) {
          text += itemText;
        }
      });

      if (text.trim()) {
        return text.trim();
      }

      return '';
    }

    const directKeys = ['translatedText', 'translated_text', 'translation', 'result', 'output_text', 'content', 'text', 'answer'];
    for (const key of directKeys) {
      const value = payload[key];
      const text = extractTranslationText(value);
      if (text) {
        return text;
      }
    }

    if (payload.message) {
      const messageText = extractTranslationText(payload.message.content || payload.message);
      if (messageText) {
        return messageText;
      }
    }

    if (payload.choices && payload.choices[0] && payload.choices[0].message) {
      const choice = payload.choices[0];
      const content = choice.message.content;
      const contentText = extractTranslationText(content);
      if (contentText) {
        return contentText;
      }

      const deltaText = extractTranslationText(choice.delta && choice.delta.content);
      if (deltaText) {
        return deltaText;
      }

      if (typeof choice.text === 'string' && choice.text.trim()) {
        return choice.text.trim();
      }
    }

    if (payload.candidates && payload.candidates[0] && payload.candidates[0].content) {
      const parts = payload.candidates[0].content.parts || [];
      const text = parts
        .map((part) => (part && typeof part.text === 'string' ? part.text : ''))
        .join('');
      if (text.trim()) {
        return text.trim();
      }
    }

    if (payload.output && Array.isArray(payload.output)) {
      for (const item of payload.output) {
        const itemText = extractTranslationText(item);
        if (itemText) {
          return itemText;
        }
      }
    }

    if (payload.data) {
      const nestedText = extractTranslationText(payload.data);
      if (nestedText) {
        return nestedText;
      }
    }

    return '';
  }

  function normalizeDeepLTargetLanguage(targetLang) {
    const normalized = (targetLang || 'ZH').toString().trim();
    const upper = normalized.toUpperCase();

    if (upper === 'ZH' || upper === 'ZH-CN' || upper === 'ZH-HANS') {
      return 'ZH';
    }

    return upper;
  }

  function normalizeBingTargetLanguage(targetLang) {
    const normalized = (targetLang || 'zh-Hans').toString().trim();

    if (!normalized) {
      return 'zh-Hans';
    }

    if (normalized.toLowerCase() === 'zh-cn' || normalized.toLowerCase() === 'zh-hans') {
      return 'zh-Hans';
    }

    return normalized;
  }

  async function fetchJson(fetchImpl, url, options) {
    const response = await fetchImpl(url, options);
    const responseText = await response.text();

    let data;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
      data = responseText;
    }

    if (!response.ok) {
      const errorMessage = typeof data === 'object' && data !== null && data.error
        ? (data.error.message || JSON.stringify(data.error))
        : responseText || response.statusText || 'Request failed';
      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  function buildTranslationPrompt(text, sourceLang, targetLang) {
    const sourceLabel = sourceLang && sourceLang !== 'auto' ? sourceLang : 'auto-detect';
    const targetLabel = targetLang || 'Chinese';

    return [
      `You are a translation assistant.`,
      `Translate the following text from ${sourceLabel} to ${targetLabel}.`,
      `Return only the translated text.`,
      '',
      text
    ].join('\n');
  }

  function buildOpenAiCompatibleBody(request, customApi) {
    const maxTokens = Number.isFinite(Number(customApi.maxTokens)) && Number(customApi.maxTokens) > 0
      ? Math.floor(Number(customApi.maxTokens))
      : 512;

    return {
      model: customApi.model || 'DeepSeek-R1-Distill-Qwen-7B',
      messages: [
        {
          role: 'system',
          content: 'You are a translation assistant. Do not explain, think step by step, or add notes. Return only the translated text.'
        },
        {
          role: 'user',
          content: buildTranslationPrompt(request.text || '', request.sourceLang, request.targetLang)
        }
      ],
      frequency_penalty: 0,
      max_tokens: maxTokens,
      presence_penalty: 0,
      response_format: {
        type: 'text'
      },
      stop: null,
      stream: false,
      temperature: 0,
      top_p: 1
    };
  }

  async function translateGoogle(request, fetchImpl) {
    const text = request.text || '';
    const sourceLang = request.sourceLang || 'auto';
    const targetLang = request.targetLang || 'zh-CN';

    const params = new URLSearchParams({
      client: 'gtx',
      sl: sourceLang,
      tl: targetLang,
      dt: 't',
      q: text
    });

    const data = await fetchJson(
      fetchImpl,
      `https://translate.googleapis.com/translate_a/single?${params.toString()}`,
      { method: 'GET' }
    );

    const translatedText = extractTranslationText(data);
    if (!translatedText) {
      throw new Error('Unable to parse Google translation response');
    }

    return { success: true, translatedText, data };
  }

  async function translateBing(request, apiSettings, fetchImpl) {
    if (!apiSettings.apiKey) {
      return { success: false, error: 'Missing Bing Translator API key' };
    }

    const params = new URLSearchParams({
      'api-version': '3.0',
      to: normalizeBingTargetLanguage(request.targetLang)
    });

    if (request.sourceLang && request.sourceLang !== 'auto') {
      params.set('from', request.sourceLang);
    }

    const baseUrl = (apiSettings.baseUrl || 'https://api.cognitive.microsofttranslator.com').replace(/\/$/, '');
    const headers = {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': apiSettings.apiKey
    };

    if (apiSettings.region) {
      headers['Ocp-Apim-Subscription-Region'] = apiSettings.region;
    }

    const data = await fetchJson(fetchImpl, `${baseUrl}/translate?${params.toString()}`, {
      method: 'POST',
      headers,
      body: JSON.stringify([{ Text: request.text || '' }])
    });

    const translatedText = data && data[0] && data[0].translations && data[0].translations[0]
      ? data[0].translations[0].text
      : '';

    if (!translatedText) {
      throw new Error('Invalid Bing translation response');
    }

    return { success: true, translatedText, data };
  }

  async function translateDeepL(request, apiSettings, fetchImpl) {
    if (!apiSettings.apiKey) {
      return { success: false, error: 'Missing DeepL API key' };
    }

    const baseUrl = (apiSettings.baseUrl || 'https://api-free.deepl.com/v2').replace(/\/$/, '');
    const formData = new FormData();
    formData.append('auth_key', apiSettings.apiKey);
    formData.append('text', request.text || '');
    formData.append('target_lang', normalizeDeepLTargetLanguage(request.targetLang));

    if (request.sourceLang && request.sourceLang !== 'auto') {
      formData.append('source_lang', request.sourceLang);
    }

    const data = await fetchJson(fetchImpl, `${baseUrl}/translate`, {
      method: 'POST',
      body: formData
    });

    const translatedText = data && data.translations && data.translations[0]
      ? data.translations[0].text
      : '';

    if (!translatedText) {
      throw new Error('Invalid DeepL translation response');
    }

    return { success: true, translatedText, data };
  }

  async function translateOpenAiCompatible(request, apiSettings, fetchImpl) {
    if (!apiSettings.apiKey) {
      return { success: false, error: 'Missing API key' };
    }

    const baseUrl = (apiSettings.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
    const data = await fetchJson(fetchImpl, `${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiSettings.apiKey}`
      },
      body: JSON.stringify({
        model: apiSettings.model,
        messages: [
          {
            role: 'system',
            content: 'You are a translation assistant. Do not explain, think step by step, or add notes. Return only the translated text.'
          },
          {
            role: 'user',
            content: buildTranslationPrompt(request.text || '', request.sourceLang, request.targetLang)
          }
        ],
        frequency_penalty: 0,
        max_tokens: 512,
        presence_penalty: 0,
        response_format: {
          type: 'text'
        },
        stop: null,
        stream: false,
        temperature: 0,
        top_p: 1
      })
    });

    const translatedText = extractTranslationText(data);
    if (!translatedText) {
      throw new Error('Invalid OpenAI-compatible translation response');
    }

    return { success: true, translatedText, data };
  }

  async function translateGemini(request, apiSettings, fetchImpl) {
    if (!apiSettings.apiKey) {
      return { success: false, error: 'Missing Gemini API key' };
    }

    const model = apiSettings.model || 'gemini-pro';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiSettings.apiKey)}`;
    const data = await fetchJson(fetchImpl, url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: buildTranslationPrompt(request.text || '', request.sourceLang, request.targetLang)
              }
            ]
          }
        ]
      })
    });

    const translatedText = extractTranslationText(data);
    if (!translatedText) {
      throw new Error('Invalid Gemini translation response');
    }

    return { success: true, translatedText, data };
  }

  async function translateCustom(request, customApi, fetchImpl) {
    if (!customApi) {
      return { success: false, error: 'Custom API not found' };
    }

    if (!customApi.url) {
      return { success: false, error: 'Missing custom API URL' };
    }

    const method = (customApi.method || 'POST').toUpperCase();
    const requestUrl = new URL(customApi.url);
    const shouldUseOpenAiCompatibleBody = /\/chat\/completions(?:\?|$)/i.test(requestUrl.pathname)
      || customApi.requestMode === 'openai';

    const headers = customApi.useCustomHeaders ? parseHeaderLines(customApi.headers) : {
      'Content-Type': 'application/json'
    };

    if (!customApi.useCustomHeaders && customApi.apiKey) {
      headers.Authorization = `Bearer ${customApi.apiKey}`;
    }

    let body = null;
    if (method === 'GET') {
      if (shouldUseOpenAiCompatibleBody) {
        const openAiBody = buildOpenAiCompatibleBody(request, customApi);
        Object.keys(openAiBody).forEach((key) => {
          if (openAiBody[key] !== null && openAiBody[key] !== undefined) {
            requestUrl.searchParams.set(key, typeof openAiBody[key] === 'string'
              ? openAiBody[key]
              : JSON.stringify(openAiBody[key]));
          }
        });
      } else {
        const payload = {
          text: request.text || '',
          source_language: request.sourceLang || 'auto',
          target_language: request.targetLang || 'zh-CN'
        };

        Object.keys(payload).forEach((key) => {
          if (payload[key]) {
            requestUrl.searchParams.set(key, payload[key]);
          }
        });
      }
    } else if (shouldUseOpenAiCompatibleBody) {
      if (!customApi.model) {
        return {
          success: false,
          error: 'Missing custom API model for OpenAI-compatible endpoint'
        };
      }

      body = JSON.stringify(buildOpenAiCompatibleBody(request, customApi));
    } else {
      body = JSON.stringify({
        text: request.text || '',
        source_language: request.sourceLang || 'auto',
        target_language: request.targetLang || 'zh-CN'
      });
    }

    const response = await fetchImpl(requestUrl.toString(), {
      method,
      headers,
      body
    });

    const rawText = await response.text();
    let data;
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (error) {
      data = rawText;
    }

    if (!response.ok) {
      const message = typeof data === 'object' && data !== null && data.error
        ? (data.error.message || JSON.stringify(data.error))
        : rawText || response.statusText || 'Request failed';
      return {
        success: false,
        error: message,
        data,
        rawResponse: rawText
      };
    }

    const responsePathText = customApi.responsePath ? getByPath(data, customApi.responsePath) : undefined;
    const translatedText = typeof responsePathText === 'string' && responsePathText.trim()
      ? responsePathText.trim()
      : extractTranslationText(data);

    if (!translatedText) {
      return {
        success: false,
        error: 'Unable to parse translation result from custom API',
        data,
        rawResponse: rawText
      };
    }

    return { success: true, translatedText, data, rawResponse: rawText };
  }

  async function translateByProvider(providerType, request, settings, fetchImpl = globalThis.fetch) {
    const normalizedSettings = normalizeTranslationSettings(settings);
    const selection = resolveProviderSelection(
      normalizedSettings,
      providerType,
      request && request.customApiId
    );

    if (selection.kind === 'missing-custom') {
      return { success: false, error: selection.error };
    }

    try {
      switch (selection.kind === 'custom' ? 'custom' : providerType) {
        case 'google':
          return await translateGoogle(request || {}, fetchImpl);
        case 'bing':
          return await translateBing(request || {}, normalizedSettings.api.bing, fetchImpl);
        case 'deepl':
          return await translateDeepL(request || {}, normalizedSettings.api.deepl, fetchImpl);
        case 'openai':
          return await translateOpenAiCompatible(request || {}, normalizedSettings.api.openai, fetchImpl);
        case 'deepseek':
          return await translateOpenAiCompatible(request || {}, normalizedSettings.api.deepseek, fetchImpl);
        case 'gemini':
          return await translateGemini(request || {}, normalizedSettings.api.gemini, fetchImpl);
        default:
          return await translateCustom(request || {}, selection.customApi, fetchImpl);
      }
    } catch (error) {
      return {
        success: false,
        error: error && error.message ? error.message : 'Translation request failed',
        data: error && error.data !== undefined ? error.data : undefined
      };
    }
  }

  function buildRequestPreview(providerType, request, settings) {
    const normalizedSettings = normalizeTranslationSettings(settings);
    const selection = resolveProviderSelection(
      normalizedSettings,
      providerType,
      request && request.customApiId
    );

    const preview = {
      providerType,
      resolvedType: selection.kind === 'custom' ? selection.customApi.id : providerType,
      customApiId: selection.kind === 'custom' && selection.customApi ? selection.customApi.id : '',
      request: request || {},
      settings: normalizedSettings
    };

    if (selection.kind === 'custom' && selection.customApi) {
      preview.endpoint = selection.customApi.url;
      preview.method = selection.customApi.method || 'POST';
      preview.requestMode = selection.customApi.requestMode || 'auto';
      preview.model = selection.customApi.model || '';
      preview.maxTokens = selection.customApi.maxTokens || 512;
      preview.headers = selection.customApi.useCustomHeaders
        ? parseHeaderLines(selection.customApi.headers)
        : {
            'Content-Type': 'application/json',
            ...(selection.customApi.apiKey ? { Authorization: 'Bearer ***' } : {})
          };
      preview.body = /\/chat\/completions(?:\?|$)/i.test(selection.customApi.url)
        ? buildOpenAiCompatibleBody(request, selection.customApi)
        : {
            text: request.text || '',
            source_language: request.sourceLang || 'auto',
            target_language: request.targetLang || 'zh-CN'
          };
    } else if (providerType === 'google') {
      preview.endpoint = 'https://translate.googleapis.com/translate_a/single';
      preview.method = 'GET';
    } else if (providerType === 'bing') {
      const baseUrl = (normalizedSettings.api.bing.baseUrl || 'https://api.cognitive.microsofttranslator.com').replace(/\/$/, '');
      preview.endpoint = `${baseUrl}/translate`;
      preview.method = 'POST';
    } else if (providerType === 'deepl') {
      const baseUrl = (normalizedSettings.api.deepl.baseUrl || 'https://api-free.deepl.com/v2').replace(/\/$/, '');
      preview.endpoint = `${baseUrl}/translate`;
      preview.method = 'POST';
    } else if (providerType === 'openai') {
      const baseUrl = (normalizedSettings.api.openai.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
      preview.endpoint = `${baseUrl}/chat/completions`;
      preview.method = 'POST';
    } else if (providerType === 'deepseek') {
      const baseUrl = (normalizedSettings.api.deepseek.baseUrl || 'https://api.deepseek.com/v1').replace(/\/$/, '');
      preview.endpoint = `${baseUrl}/chat/completions`;
      preview.method = 'POST';
    } else if (providerType === 'gemini') {
      preview.endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${normalizedSettings.api.gemini.model || 'gemini-pro'}:generateContent`;
      preview.method = 'POST';
    }

    return preview;
  }

  return {
    BUILTIN_API_TYPES,
    createDefaultSettings,
    createDefaultCustomApi,
    createDefaultSecrets,
    normalizeTranslationSettings,
    normalizeCustomApi,
    normalizeSecrets,
    isBuiltinApiType,
    resolveCustomApi,
    resolveProviderSelection,
    parseHeaderLines,
    getByPath,
    extractTranslationText,
    extractSecretsFromSettings,
    applySecretsToSettings,
    stripSecretsFromSettings,
    buildTranslationPrompt,
    buildRequestPreview,
    translateByProvider
  };
});
