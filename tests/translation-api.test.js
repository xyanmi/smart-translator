const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadSmartTranslatorApi() {
  const filePath = path.resolve(process.cwd(), 'src/shared/translation-api.js');
  const code = fs.readFileSync(filePath, 'utf8');
  const module = { exports: {} };
  const context = {
    module,
    exports: module.exports,
    console,
    FormData,
    URL,
    URLSearchParams,
    fetch: globalThis.fetch,
    setTimeout,
    clearTimeout
  };

  context.globalThis = context;
  vm.runInNewContext(code, context, { filename: filePath });
  return context.module.exports || context.SmartTranslatorApi;
}

const SmartTranslatorApi = loadSmartTranslatorApi();

function loadSmartTranslatorSelection() {
  const filePath = path.resolve(process.cwd(), 'src/shared/selection-utils.js');
  const code = fs.readFileSync(filePath, 'utf8');
  const module = { exports: {} };
  const context = {
    module,
    exports: module.exports,
    console
  };

  context.globalThis = context;
  vm.runInNewContext(code, context, { filename: filePath });
  return context.module.exports || context.SmartTranslatorSelection;
}

const SmartTranslatorSelection = loadSmartTranslatorSelection();

function createFetchMock(handler) {
  const calls = [];

  const fetchMock = async function (url, options = {}) {
    calls.push({ url, options });
    return handler(url, options, calls);
  };

  fetchMock.calls = calls;
  return fetchMock;
}

async function run() {
  {
    const settings = SmartTranslatorApi.normalizeTranslationSettings({
      api: {
        type: 'custom',
        customApis: [
          {
            id: 'custom-alpha',
            name: 'Alpha',
            url: 'https://example.com/translate'
          }
        ]
      }
    });

    assert.equal(settings.api.type, 'custom-alpha');
    assert.equal(settings.api.customSelectedId, 'custom-alpha');
    assert.equal(settings.api.customApis[0].method, 'POST');
  }

  {
    const settings = SmartTranslatorApi.normalizeTranslationSettings({
      api: {
        bing: {
          apiKey: 'bing-secret'
        },
        customApis: [
          {
            id: 'custom-secret',
            name: 'Secret',
            url: 'https://example.com/translate',
            apiKey: 'custom-secret-key'
          }
        ]
      }
    });

    const secrets = SmartTranslatorApi.extractSecretsFromSettings(settings);
    const stripped = SmartTranslatorApi.stripSecretsFromSettings(settings);
    const merged = SmartTranslatorApi.applySecretsToSettings(stripped, secrets);

    assert.equal(stripped.api.bing.apiKey, '');
    assert.equal(stripped.api.customApis[0].apiKey, '');
    assert.equal(merged.api.bing.apiKey, 'bing-secret');
    assert.equal(merged.api.customApis[0].apiKey, 'custom-secret-key');
  }

  {
    const fetchMock = createFetchMock(async (url, options) => {
      assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.Authorization, 'Bearer test-key');

      const payload = JSON.parse(options.body);
      assert.equal(payload.model, 'gpt-test');
      assert.match(payload.messages[0].content, /Do not explain/);
      assert.match(payload.messages[1].content, /Translate the following text/);
      assert.match(payload.messages[1].content, /hello world/);
      assert.equal(payload.max_tokens, 512);
      assert.equal(payload.temperature, 0);

      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [
            {
              message: {
                content: 'hello translated'
              }
            }
          ]
        })
      };
    });

    const result = await SmartTranslatorApi.translateByProvider(
      'openai',
      {
        text: 'hello world',
        sourceLang: 'en',
        targetLang: 'zh-CN'
      },
      {
        api: {
          openai: {
            apiKey: 'test-key',
            model: 'gpt-test',
            baseUrl: 'https://openrouter.ai/api/v1'
          }
        }
      },
      fetchMock
    );

    assert.equal(result.success, true);
    assert.equal(result.translatedText, 'hello translated');
  }

  {
    const fetchMock = createFetchMock(async (url, options) => {
      assert.equal(url, 'https://api.scnet.cn/api/llm/v1/chat/completions');
      assert.equal(options.method, 'POST');
      const payload = JSON.parse(options.body);
      assert.equal(payload.model, 'Qwen2.5-72B-Instruct');
      assert.equal(payload.frequency_penalty, 0);
      assert.equal(payload.max_tokens, 384);
      assert.equal(payload.presence_penalty, 0);
      assert.deepEqual(payload.response_format, { type: 'text' });
      assert.equal(payload.stop, null);
      assert.equal(payload.stream, false);
      assert.equal(payload.temperature, 0);
      assert.equal(payload.top_p, 1);
      assert.equal(payload.messages[1].role, 'user');

      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [
            {
              message: {
                content: [
                  { type: 'text', text: 'SCNet translated text' }
                ]
              }
            }
          ]
        })
      };
    });

    const result = await SmartTranslatorApi.translateByProvider(
      'custom-scnet',
      {
        text: 'hello world',
        sourceLang: 'en',
        targetLang: 'zh-CN',
        customApiId: 'custom-scnet'
      },
      {
        api: {
          customApis: [
            {
              id: 'custom-scnet',
              name: 'SCNet',
              url: 'https://api.scnet.cn/api/llm/v1/chat/completions',
              method: 'POST',
              requestMode: 'auto',
              model: 'Qwen2.5-72B-Instruct',
              maxTokens: 384
            }
          ]
        }
      },
      fetchMock
    );

    assert.equal(result.success, true);
    assert.equal(result.translatedText, 'SCNet translated text');
  }

  {
    const fetchMock = createFetchMock(async (url, options) => {
      assert.equal(options.method, 'GET');
      assert.equal(options.headers['Content-Type'], 'application/json');

      const parsedUrl = new URL(url);
      assert.equal(parsedUrl.searchParams.get('text'), 'hello');
      assert.equal(parsedUrl.searchParams.get('source_language'), 'auto');
      assert.equal(parsedUrl.searchParams.get('target_language'), 'zh-CN');

      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          data: {
            result: {
              translation: 'hi translated'
            }
          }
        })
      };
    });

    const result = await SmartTranslatorApi.translateByProvider(
      'custom-1',
      {
        text: 'hello',
        sourceLang: 'auto',
        targetLang: 'zh-CN',
        customApiId: 'custom-1'
      },
      {
        api: {
          customApis: [
            {
              id: 'custom-1',
              name: 'Custom 1',
              url: 'https://example.com/translate',
              method: 'GET',
              responsePath: 'data.result.translation'
            }
          ]
        }
      },
      fetchMock
    );

    assert.equal(result.success, true);
    assert.equal(result.translatedText, 'hi translated');
  }

  {
    const preview = SmartTranslatorApi.buildRequestPreview(
      'custom-1',
      {
        text: 'hello',
        sourceLang: 'auto',
        targetLang: 'zh-CN',
        customApiId: 'custom-1'
      },
      {
        api: {
          customApis: [
            {
              id: 'custom-1',
              name: 'Custom 1',
              url: 'https://example.com/translate',
              method: 'POST',
              useCustomHeaders: true,
              headers: 'X-Test: 1'
            }
          ]
        }
      }
    );

    assert.equal(preview.endpoint, 'https://example.com/translate');
    assert.equal(preview.method, 'POST');
    assert.equal(preview.customApiId, 'custom-1');
    assert.equal(preview.headers['X-Test'], '1');
  }

  {
    const result = await SmartTranslatorApi.translateByProvider(
      'custom-bad',
      {
        text: 'hello',
        sourceLang: 'auto',
        targetLang: 'zh-CN',
        customApiId: 'custom-bad'
      },
      {
        api: {
          customApis: [
            {
              id: 'custom-bad',
              name: 'Bad',
              url: 'https://example.com/translate',
              method: 'POST',
              requestMode: 'generic'
            }
          ]
        }
      },
      createFetchMock(async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ unexpected: true })
      }))
    );

    assert.equal(result.success, false);
    assert.equal(result.error, 'Unable to parse translation result from custom API');
    assert.ok(result.rawResponse.includes('unexpected'));
  }

  {
    assert.equal(SmartTranslatorSelection.isTextInputElement({ tagName: 'input', type: 'text' }), true);
    assert.equal(SmartTranslatorSelection.isTextInputElement({ tagName: 'textarea' }), true);
    assert.equal(SmartTranslatorSelection.isTextInputElement({ tagName: 'input', type: 'button' }), false);
  }

  {
    const doc = {
      getSelection() {
        return {
          toString() {
            return '  document selection  ';
          }
        };
      },
      activeElement: null
    };

    assert.equal(SmartTranslatorSelection.getCurrentSelectionText(doc), 'document selection');
  }

  {
    const doc = {
      getSelection() {
        return {
          toString() {
            return '';
          }
        };
      },
      activeElement: {
        tagName: 'TEXTAREA',
        selectionStart: 0,
        selectionEnd: 5,
        value: 'hello world'
      }
    };

    assert.equal(SmartTranslatorSelection.getCurrentSelectionText(doc), 'hello');
  }

  {
    let selectionText = '';
    const doc = {
      getSelection() {
        return {
          toString() {
            return selectionText;
          }
        };
      },
      activeElement: null
    };

    const tracker = SmartTranslatorSelection.createSelectionTracker(doc, 1000);
    selectionText = 'cached text';
    assert.equal(tracker.refresh(), 'cached text');
    selectionText = '';
    assert.equal(tracker.getText({ allowCache: true, cacheWindowMs: 1000 }), 'cached text');
    assert.equal(tracker.getText({ allowCache: false }), '');
  }
}

run()
  .then(function () {
    console.log('All translation adapter tests passed.');
  })
  .catch(function (error) {
    console.error(error);
    process.exitCode = 1;
  });
