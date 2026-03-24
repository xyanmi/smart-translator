importScripts('shared/translation-api.js');

const {
  createDefaultSettings,
  normalizeTranslationSettings,
  translateByProvider,
  applySecretsToSettings,
  stripSecretsFromSettings,
  extractSecretsFromSettings,
  createDefaultSecrets
} = SmartTranslatorApi;

function loadMergedSettings(callback) {
  chrome.storage.sync.get('translationSettings', function(syncData) {
    chrome.storage.local.get('translationSecrets', function(localData) {
      const syncSettings = normalizeTranslationSettings(syncData.translationSettings);
      const localSecrets = localData.translationSecrets || createDefaultSecrets();
      const migratedSecrets = extractSecretsFromSettings(syncSettings);
      const mergedSecrets = applySecretsToSettings(
        createDefaultSettings(),
        localSecrets
      );
      const normalizedSecrets = extractSecretsFromSettings(
        applySecretsToSettings(syncSettings, localSecrets)
      );

      const nextSecrets = {
        api: {
          bing: {
            apiKey: migratedSecrets.api.bing.apiKey || mergedSecrets.api.bing.apiKey || ''
          },
          deepl: {
            apiKey: migratedSecrets.api.deepl.apiKey || mergedSecrets.api.deepl.apiKey || ''
          },
          openai: {
            apiKey: migratedSecrets.api.openai.apiKey || mergedSecrets.api.openai.apiKey || ''
          },
          deepseek: {
            apiKey: migratedSecrets.api.deepseek.apiKey || mergedSecrets.api.deepseek.apiKey || ''
          },
          gemini: {
            apiKey: migratedSecrets.api.gemini.apiKey || mergedSecrets.api.gemini.apiKey || ''
          }
        },
        customApiKeys: {
          ...localSecrets.customApiKeys,
          ...migratedSecrets.customApiKeys,
          ...normalizedSecrets.customApiKeys
        }
      };

      const sanitizedSettings = stripSecretsFromSettings(syncSettings);

      chrome.storage.local.set({ translationSecrets: nextSecrets }, function() {
        chrome.storage.sync.set({ translationSettings: sanitizedSettings }, function() {
          callback(applySecretsToSettings(sanitizedSettings, nextSecrets));
        });
      });
    });
  });
}

/**
 * Initialize settings when extension is installed
 */
chrome.runtime.onInstalled.addListener(function() {
  const defaultSettings = createDefaultSettings();

  // Save default settings if not already set
  chrome.storage.sync.get('translationSettings', function(data) {
    if (!data.translationSettings) {
      chrome.storage.sync.set({ translationSettings: stripSecretsFromSettings(defaultSettings) });
    } else {
      const sanitizedSettings = stripSecretsFromSettings(data.translationSettings);
      if (JSON.stringify(sanitizedSettings) !== JSON.stringify(normalizeTranslationSettings(data.translationSettings))) {
        chrome.storage.sync.set({ translationSettings: sanitizedSettings });
      }
    }
  });

  chrome.storage.local.get('translationSecrets', function(data) {
    if (!data.translationSecrets) {
      chrome.storage.local.set({ translationSecrets: createDefaultSecrets() });
    }
  });

  // Create context menu for translation
  chrome.contextMenus.removeAll(function() {
    chrome.contextMenus.create({
      id: 'translate-selection',
      title: 'Translate Selected Text',
      contexts: ['selection']
    });
  });
});

/**
 * Handle context menu click events
 */
chrome.contextMenus.onClicked.addListener(function(info, tab) {
  if (info.menuItemId === 'translate-selection') {
    // Add error handling
    try {
      // First check if tab exists and is valid
      if (!tab || tab.id < 0) {
        console.error('Invalid tab ID');
        
        // Try to get current active tab
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs && tabs.length > 0) {
            const activeTab = tabs[0];
            sendTranslationMessage(activeTab.id, info.selectionText);
          } else {
            console.error('Unable to get current active tab');
          }
        });
        return;
      }

      sendTranslationMessage(tab.id, info.selectionText);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }
});

/**
 * Send translation message to tab
 * @param {number} tabId - ID of the tab to send message to
 * @param {string} text - Text to translate
 */
function sendTranslationMessage(tabId, text) {
  // For PDF files and special websites, use executeScript to inject code
  if (tabId) {
    // Get special sites list
    chrome.storage.sync.get('translationSettings', function(data) {
      const settings = data.translationSettings;
      const specialSites = settings.specialSites || [];
      
      // Check page type first
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        function: (specialSitesArray) => {
          // Check if current URL matches any special site in the list
          const currentUrl = window.location.href;
          const isPDF = document.querySelector('embed[type="application/pdf"]') !== null || 
                        currentUrl.toLowerCase().includes('.pdf');
          
          // Check if it's a special site
          let isSpecialSite = false;
          for (const site of specialSitesArray) {
            if (currentUrl.includes(site)) {
              isSpecialSite = true;
              break;
            }
          }
          
          return {
            isPDF: isPDF,
            isSpecialSite: isSpecialSite,
            url: currentUrl
          };
        },
        args: [specialSites]
      }).then(results => {
        if (results && results[0] && (results[0].result.isPDF || results[0].result.isSpecialSite)) {
          // For PDF or special sites, execute translation directly in the page
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            function: (textToTranslate) => {
              // Create a temporary translation result display element
              const translationDiv = document.createElement('div');
              translationDiv.style.position = 'fixed';
              translationDiv.style.top = '50px';
              translationDiv.style.right = '50px';
              translationDiv.style.maxWidth = '300px';
              translationDiv.style.backgroundColor = 'white';
              translationDiv.style.padding = '10px';
              translationDiv.style.borderRadius = '4px';
              translationDiv.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
              translationDiv.style.zIndex = '9999';
              translationDiv.style.fontFamily = 'Arial, sans-serif';
              translationDiv.style.fontSize = '14px';
              
              translationDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span>翻译结果</span>
                  <span style="cursor: pointer; font-size: 18px;" id="close-translation">×</span>
                </div>
                <div>Translating...</div>
              `;
              
              document.body.appendChild(translationDiv);
              
              // Add close button event
              document.getElementById('close-translation').addEventListener('click', () => {
                document.body.removeChild(translationDiv);
              });
              
              // Get translation result through background script
              chrome.runtime.sendMessage({
                action: 'translate',
                text: textToTranslate,
                sourceLang: 'auto',
                targetLang: 'zh-CN'
              }, function(response) {
                if (response && response.success) {
                  translationDiv.querySelector('div:last-child').textContent = response.translatedText;
                } else {
                  translationDiv.querySelector('div:last-child').textContent = 'Translation failed: ' + (response ? response.error : 'Unknown error');
                }
              });
            },
            args: [text]
          }).catch(err => {
            console.error('Failed to execute script on special page:', err);
          });
        } else {
          // For regular pages, use standard message passing
          chrome.tabs.sendMessage(tabId, {
            action: 'translate',
            text: text
          }, function(response) {
            if (chrome.runtime.lastError) {
              console.error('Failed to send message:', chrome.runtime.lastError);
            }
          });
        }
      }).catch(error => {
        console.error('Failed to check page type:', error);
      });
    });
  }
}

/**
 * Listen for messages from content scripts
 */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'getSettings') {
    loadMergedSettings(function(merged) {
      sendResponse(merged);
    });
    return true; // Keep message channel open for async response
  } else if (request.action === 'translate') {
    loadMergedSettings(function(settings) {
      const apiType = request.test ? request.apiType : settings.api.type;
      const customApiId = request.customApiId || settings.api.customSelectedId;

      translateByProvider(
        apiType,
        {
          text: request.text,
          sourceLang: request.sourceLang,
          targetLang: request.targetLang,
          customApiId: customApiId
        },
        settings
      ).then(sendResponse);
    });
    return true; // Keep message channel open for async response
  }
});

/**
 * Google Translate API (free version, using public API)
 * @param {string} text - Text to translate
 * @param {string} sourceLang - Source language code
 * @param {string} targetLang - Target language code
 * @param {function} callback - Callback function to handle result
 */
function translateWithGoogle(text, sourceLang, targetLang, callback) {

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang || 'auto'}&tl=${targetLang || 'zh-CN'}&dt=t&q=${encodeURIComponent(text)}`;
  

  const fallbackUrls = [
    'https://translate.google.cn/translate_a/single',  // 中国大陆镜像
    'https://translate.google.com.hk/translate_a/single',  // 香港镜像
    'https://translate.google.co.jp/translate_a/single'  // 日本镜像
  ];
  

  function tryTranslate(urlIndex = 0) {
    const currentUrl = urlIndex === 0 ? url : `${fallbackUrls[urlIndex - 1]}?client=gtx&sl=${sourceLang || 'auto'}&tl=${targetLang || 'zh-CN'}&dt=t&q=${encodeURIComponent(text)}`;
    
    fetch(currentUrl)
      .then(response => response.json())
      .then(data => {
        let translatedText = '';
        if (data && data[0]) {
          data[0].forEach(item => {
            if (item[0]) {
              translatedText += item[0];
            }
          });
        }
        callback({ success: true, translatedText });
      })
      .catch(error => {
        console.error(`Translation error with URL ${currentUrl}:`, error);
    
        if (urlIndex < fallbackUrls.length) {
          tryTranslate(urlIndex + 1);
        } else {
          callback({ success: false, error: '所有翻译API均无法访问' });
        }
      });
  }
  tryTranslate();
}

/**
 * Bing Translator API
 * @param {string} text - Text to translate
 * @param {string} sourceLang - Source language code
 * @param {string} targetLang - Target language code
 * @param {string} apiKey - Bing API key
 * @param {function} callback - Callback function to handle result
 */
function translateWithBing(text, sourceLang, targetLang, apiKey, callback) {
  if (!apiKey) {
    callback({ success: false, error: 'Missing Bing Translator API key' });
    return;
  }
  
  // Using Bing Translator API, requires valid API key
  const url = 'https://api.cognitive.microsofttranslator.com/translate';
  const params = new URLSearchParams({
    'api-version': '3.0',
    'from': sourceLang || 'auto',
    'to': targetLang || 'zh-Hans'
  });
  
  fetch(`${url}?${params.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': apiKey,
      'Ocp-Apim-Subscription-Region': 'global'
    },
    body: JSON.stringify([{ Text: text }])
  })
    .then(response => response.json())
    .then(data => {
      if (data && data[0] && data[0].translations && data[0].translations[0]) {
        callback({ success: true, translatedText: data[0].translations[0].text });
      } else {
        callback({ success: false, error: 'Invalid translation result format', data: data });
      }
    })
    .catch(error => {
      console.error('Bing translation error:', error);
      callback({ success: false, error: 'Translation request failed' });
    });
}

/**
 * DeepL Translation API
 * @param {string} text - Text to translate
 * @param {string} sourceLang - Source language code
 * @param {string} targetLang - Target language code
 * @param {string} apiKey - DeepL API key
 * @param {function} callback - Callback function to handle result
 */
function translateWithDeepL(text, sourceLang, targetLang, apiKey, callback) {
  if (!apiKey) {
    callback({ success: false, error: 'Missing DeepL API key' });
    return;
  }
  
  const url = 'https://api-free.deepl.com/v2/translate';
  const formData = new FormData();
  formData.append('auth_key', apiKey);
  formData.append('text', text);
  formData.append('source_lang', sourceLang || '');
  formData.append('target_lang', targetLang || 'ZH');
  
  fetch(url, {
    method: 'POST',
    body: formData
  })
    .then(response => response.json())
    .then(data => {
      if (data && data.translations && data.translations[0]) {
        callback({ success: true, translatedText: data.translations[0].text });
      } else {
        callback({ success: false, error: 'Invalid translation result format', data: data });
      }
    })
    .catch(error => {
      console.error('DeepL translation error:', error);
      callback({ success: false, error: 'Translation request failed' });
    });
}



/**
 * OpenRouter Translation
 * @param {string} text - Text to translate
 * @param {string} sourceLang - Source language code
 * @param {string} targetLang - Target language code
 * @param {object} settings - OpenRouter API settings
 * @param {function} callback - Callback function to handle result
 */
function translateWithOpenAI(text, sourceLang, targetLang, settings, callback) {
  if (!settings.apiKey) {
    callback({ success: false, error: 'Missing OpenAI API key' });
    return;
  }
  
  // const url = 'https://api.openai.com/v1/chat/completions';
  const url = 'https://openrouter.ai/api/v1/chat/completions'
  const targetLanguage = targetLang || 'Chinese';
  
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        {
          role: 'user',
          content:`你是一名翻译助理。请将下面的文本翻译为 ${targetLanguage}. 请只输出翻译结果，不要添加任何其他内容。我的文本是：\n ${text}`
        }
      ],
      temperature: 0.3
    })
  })
    .then(response => response.json())
    .then(data => {
      if (data && data.choices && data.choices[0] && data.choices[0].message) {
        callback({ success: true, translatedText: data.choices[0].message.content.trim(), data: data });
      } else {
        callback({ success: false, error: data.error ? data.error.message : 'Invalid translation result format', data: data });
      }
    })
    .catch(error => {
      console.error('OpenAI translation error:', error);
      callback({ success: false, error: 'Translation request failed', data: error });
    });
}

/**
 * Custom API Translation
 * @param {string} text - Text to translate
 * @param {string} sourceLang - Source language code
 * @param {string} targetLang - Target language code
 * @param {object} settings - Custom API settings
 * @param {function} callback - Callback function to handle result
 */
function translateWithCustomAPI(text, sourceLang, targetLang, settings, callback) {
  // If using custom headers, only use custom headers
  if (settings.useCustomHeaders) {
    if (!settings.headers) {
      callback({ success: false, error: 'Missing custom headers' });
      return;
    }
    
    const headers = {};
    
    // Process custom headers
    if (settings.headers) {
      const headerLines = settings.headers.split('\n');
      headerLines.forEach(line => {
        if (line.trim()) {
          const [name, value] = line.split(':', 2);
          if (name && value) {
            headers[name.trim()] = value.trim();
          }
        }
      });
    }
    
    const body = JSON.stringify({
      text: text,
      source_language: sourceLang || 'auto',
      target_language: targetLang || 'zh'
    });
    
    fetch(settings.url || 'https://api.example.com/translate', {
      method: settings.method || 'POST',
      headers: headers,
      body: settings.method === 'GET' ? null : body
    })
      .then(response => response.json())
      .then(data => {
        // Since custom API return format is uncertain, assume format is { translatedText: "..." }
        if (data && (data.translatedText || data.translated_text || data.translation)) {
          callback({ 
            success: true, 
            translatedText: data.translatedText || data.translated_text || data.translation 
          });
        } else {
          callback({ success: false, error: 'Unable to parse translation result, please check API return format' });
        }
      })
      .catch(error => {
        console.error('Custom API translation error:', error);
        callback({ success: false, error: 'Translation request failed' });
      });
  } else {
    // Original logic
    if (!settings.url) {
      callback({ success: false, error: 'Missing custom API URL' });
      return;
    }
    
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (settings.apiKey) {
      headers['Authorization'] = `Bearer ${settings.apiKey}`;
    }
    
    // Process custom headers
    if (settings.headers) {
      const headerLines = settings.headers.split('\n');
      headerLines.forEach(line => {
        if (line.trim()) {
          const [name, value] = line.split(':', 2);
          if (name && value) {
            headers[name.trim()] = value.trim();
          }
        }
      });
    }
    
    const body = JSON.stringify({
      text: text,
      source_language: sourceLang || 'auto',
      target_language: targetLang || 'zh'
    });
    
    fetch(settings.url, {
      method: settings.method || 'POST',
      headers: headers,
      body: settings.method === 'GET' ? null : body
    })
      .then(response => response.json())
      .then(data => {
        // Since custom API return format is uncertain, assume format is { translatedText: "..." }
        if (data && (data.translatedText || data.translated_text || data.translation)) {
          callback({ 
            success: true, 
            translatedText: data.translatedText || data.translated_text || data.translation 
          });
        } else {
          callback({ success: false, error: 'Unable to parse translation result, please check API return format' });
        }
      })
      .catch(error => {
        console.error('Custom API translation error:', error);
        callback({ success: false, error: 'Translation request failed' });
      });
  }
}

/**
 * DeepSeek Translation API
 * @param {string} text - Text to translate
 * @param {string} sourceLang - Source language code
 * @param {string} targetLang - Target language code
 * @param {object} settings - DeepSeek API settings
 * @param {function} callback - Callback function to handle result
 */
function translateWithDeepSeek(text, sourceLang, targetLang, settings, callback) {
  if (!settings.apiKey) {
    callback({ success: false, error: 'Missing DeepSeek API key' });
    return;
  }
  
  const url = 'https://api.deepseek.com/v1/chat/completions';
  
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        {
          role: "system",
          content: `You are a translation assistant. Please translate the user's text from ${sourceLang || 'auto-detect'} to ${targetLang || 'Chinese'}`
        },
        {
          role: "user",
          content: text
        }
      ]
    })
  })
    .then(response => response.json())
    .then(data => {
      if (data && data.choices && data.choices[0] && data.choices[0].message) {
        callback({ success: true, translatedText: data.choices[0].message.content.trim() });
      } else {
        callback({ success: false, error: 'Invalid translation result format', data: data });
      }
    })
    .catch(error => {
      console.error('DeepSeek translation error:', error);
      callback({ success: false, error: 'Translation request failed' });
    });
}

/**
 * Gemini Translation API
 * @param {string} text - Text to translate
 * @param {string} sourceLang - Source language code
 * @param {string} targetLang - Target language code
 * @param {object} settings - Gemini API settings
 * @param {function} callback - Callback function to handle result
 */
function translateWithGemini(text, sourceLang, targetLang, settings, callback) {
  if (!settings.apiKey) {
    callback({ success: false, error: 'Missing Gemini API key' });
    return;
  }
  
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
  
  fetch(`${url}?key=${settings.apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `Please translate the following text from ${sourceLang || 'auto-detect'} to ${targetLang || 'Chinese'}:\n${text}(output translation result only)`
        }]
      }]
    })
  })
    .then(response => response.json())
    .then(data => {
      if (data && data.candidates && data.candidates[0] && data.candidates[0].content) {
        callback({ success: true, translatedText: data.candidates[0].content.parts[0].text.trim()});
      } else {
        callback({ success: false, error: 'Invalid translation result format', data: data });
      }
    })
    .catch(error => {
      console.error('Gemini translation error:', error);
      callback({ success: false, error: 'Translation request failed' });
    });
}
