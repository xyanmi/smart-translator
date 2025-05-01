/**
 * Initialize settings page when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements
  const apiSelect = document.getElementById('api-select');
  const apiSettings = document.querySelectorAll('.api-setting');
  const enableCustomKey = document.getElementById('enable-custom-key');
  const customKeySettings = document.getElementById('custom-key-settings');
  const saveBtn = document.getElementById('save-btn');
  const resetBtn = document.getElementById('reset-btn');
  
  // Default settings configuration
  const defaultSettings = {
    translateMode: 'instant',
    triggerMethods: {
      copy: false,
      f1: true,
      customKey: false
    },
    customKey: {
      modifier: 'alt',
      keyCode: 84 // T key
    },
    api: {
      type: 'google',
      google: {},
      bing: {
        apiKey: ''
      },
      deepl: {
        apiKey: ''
      },
      openai: {
        apiKey: '',
        model: 'gpt-3.5-turbo'
      },
      deepseek: {
        apiKey: '',
        model: 'deepseek-chat'
      },
      gemini: {
        apiKey: '',
        model: 'gemini-pro'
      },
      customApis: [
        {
          id: 'custom1',
          name: 'Custom API 1',
          url: '',
          apiKey: '',
          method: 'POST',
          headers: ''
        }
      ]
    },
    display: {
      position: 'near',
      autoClose: 0
    }
  };
  
  /**
   * Load settings from storage
   */
  function loadSettings() {
    chrome.storage.sync.get('translationSettings', function(data) {
      const settings = data.translationSettings || defaultSettings;
      
      // Set translation mode
      document.querySelector(`input[name="translate-mode"][value="${settings.translateMode}"]`).checked = true;
      
      // Set trigger methods
      document.getElementById('enable-copy').checked = settings.triggerMethods.copy;
      document.getElementById('enable-f1').checked = settings.triggerMethods.f1;
      document.getElementById('enable-custom-key').checked = settings.triggerMethods.customKey;
      
      if (settings.customKey) {
        customKeySettings.style.display = 'block';
        const keyDisplay = document.getElementById('key-display');
        const keyCode = document.getElementById('custom-key-code');
        
        // 将keyCode转换为可读的按键名称
        const key = String.fromCharCode(settings.customKey.keyCode);
        keyDisplay.value = key;
        keyCode.value = settings.customKey.keyCode;
        
        // 更新description显示
        // const description = keyDisplay.parentElement.nextElementSibling;
        // console.log('Description:', description); 
        // description.textContent = `点击输入框并按下想要设置的按键（当前设置：${key}）`;
      }
      
      document.getElementById('custom-key').value = settings.customKey.modifier;
      document.getElementById('custom-key-code').value = settings.customKey.keyCode;
      
      // Set API type
      console.log('API type:', settings.api.type);
      apiSelect.value = settings.api.type;
      showApiSettings(settings.api.type);
      
      // Fill API settings
      if (settings.api.bing.apiKey) {
        document.getElementById('bing-api-key').value = settings.api.bing.apiKey;
      }
      
      if (settings.api.deepl.apiKey) {
        document.getElementById('deepl-api-key').value = settings.api.deepl.apiKey;
      }
      
      if (settings.api.openai.apiKey) {
        document.getElementById('openai-api-key').value = settings.api.openai.apiKey;
        document.getElementById('openai-model').value = settings.api.openai.model;
      }
      
      if (settings.api.deepseek.apiKey) {
        document.getElementById('deepseek-api-key').value = settings.api.deepseek.apiKey;
        document.getElementById('deepseek-model').value = settings.api.deepseek.model;
      }
      
      if (settings.api.gemini.apiKey) {
        document.getElementById('gemini-api-key').value = settings.api.gemini.apiKey;
        document.getElementById('gemini-model').value = settings.api.gemini.model;
      }
      
      if (settings.api.custom && settings.api.custom.url) {
        document.getElementById('custom-api-url').value = settings.api.custom.url;
        document.getElementById('custom-api-key').value = settings.api.custom.apiKey;
        document.getElementById('custom-method').value = settings.api.custom.method;
      }
      
      // Set display options
      document.getElementById('display-position').value = settings.display.position;
      document.getElementById('auto-close').value = settings.display.autoClose;
    });
  }
  
  /**
   * Render custom API settings
   */
  function renderCustomApis() {
    const container = document.getElementById('custom-apis-container');
    container.innerHTML = ''; // Clear container
    
    chrome.storage.sync.get('translationSettings', function(data) {
      const settings = data.translationSettings || defaultSettings;
      const customApis = settings.api.customApis || [];
      
      if (customApis.length === 0) {
        // Add a default custom API if none exists
        customApis.push({
          id: 'custom1',
          name: 'Custom API 1',
          url: '',
          apiKey: '',
          method: 'POST',
          useCustomHeaders: false,
          headers: ''
        });
        
        // Save updated settings
        settings.api.customApis = customApis;
        chrome.storage.sync.set({ translationSettings: settings });
      }
      
      // Create settings form for each custom API
      customApis.forEach((api, index) => {
        const apiDiv = document.createElement('div');
        apiDiv.className = 'custom-api-item';
        apiDiv.dataset.id = api.id;
        
        apiDiv.innerHTML = `
          <div class="custom-api-header">
            <h4>${api.name}</h4>
            <div class="custom-api-actions">
              <button class="edit-api-name-btn" title="Edit Name">✏️</button>
              <button class="delete-api-btn" title="Delete" ${customApis.length === 1 ? 'disabled' : ''}>🗑️</button>
            </div>
          </div>
          <div class="custom-api-content">
            <label>
              <span>API URL:</span>
              <input type="text" class="custom-api-url" value="${api.url}" placeholder="Enter API URL" ${api.useCustomHeaders ? 'disabled' : ''}>
            </label>
            <label style="margin-top: 10px;">
              <span>API Key:</span>
              <input type="text" class="custom-api-key" value="${api.apiKey}" placeholder="Enter API key (if needed)" ${api.useCustomHeaders ? 'disabled' : ''}>
            </label>
            <label style="margin-top: 10px;">
              <span>Request Method:</span>
              <select class="custom-api-method" ${api.useCustomHeaders ? 'disabled' : ''}>
                <option value="POST" ${api.method === 'POST' ? 'selected' : ''}>POST</option>
                <option value="GET" ${api.method === 'GET' ? 'selected' : ''}>GET</option>
              </select>
            </label>
            <label style="margin-top: 10px;">
              <input type="checkbox" class="use-custom-headers" ${api.useCustomHeaders ? 'checked' : ''}> Use custom headers
            </label>
            <label style="margin-top: 10px; display: ${api.useCustomHeaders ? 'block' : 'none'}" class="custom-headers-container">
              <span>Custom Headers:</span>
              <textarea class="custom-api-headers" placeholder="One header per line, format: Name: Value">${api.headers || ''}</textarea>
            </label>
          </div>
        `;
        
        container.appendChild(apiDiv);
        
        // Add custom headers checkbox event listener
        const useCustomHeadersCheckbox = apiDiv.querySelector('.use-custom-headers');
        const customHeadersContainer = apiDiv.querySelector('.custom-headers-container');
        const apiUrlInput = apiDiv.querySelector('.custom-api-url');
        const apiKeyInput = apiDiv.querySelector('.custom-api-key');
        const apiMethodSelect = apiDiv.querySelector('.custom-api-method');
        
        useCustomHeadersCheckbox.addEventListener('change', function() {
          const isChecked = this.checked;
          
          // Show/hide custom headers input area
          customHeadersContainer.style.display = isChecked ? 'block' : 'none';
          
          // Enable/disable other input fields
          apiUrlInput.disabled = isChecked;
          apiKeyInput.disabled = isChecked;
          apiMethodSelect.disabled = isChecked;
        });
        
        // Add edit name button event listener
        const editNameBtn = apiDiv.querySelector('.edit-api-name-btn');
        editNameBtn.addEventListener('click', function() {
          const nameElement = apiDiv.querySelector('h4');
          const currentName = nameElement.textContent;
          const newName = prompt('Enter new API name:', currentName);
          
          if (newName && newName.trim() !== '') {
            nameElement.textContent = newName.trim();
            // Save settings
            saveSettings();
            // Update selector options
            updateApiSelectOptions();
          }
        });
        
        // Add delete button event listener
        const deleteBtn = apiDiv.querySelector('.delete-api-btn');
        deleteBtn.addEventListener('click', function() {
          if (confirm(`Are you sure you want to delete "${apiDiv.querySelector('h4').textContent}"?`)) {
            // Remove from DOM
            container.removeChild(apiDiv);
            // Save settings
            saveSettings();
            // Update selector options
            updateApiSelectOptions();
            
            // Disable all delete buttons if only one API remains
            if (container.querySelectorAll('.custom-api-item').length === 1) {
              container.querySelectorAll('.delete-api-btn').forEach(btn => {
                btn.disabled = true;
              });
            }
          }
        });
      });
    });
  }
  
  /**
   * Update API selector options
   */
  function updateApiSelectOptions() {
    chrome.storage.sync.get('translationSettings', function(data) {
      const settings = data.translationSettings || defaultSettings;
      const customApis = settings.api.customApis || [];
      
      // Save current selected value
      const currentValue = apiSelect.value;
      
      // Remove all custom API options
      Array.from(apiSelect.options).forEach(option => {
        if (option.value !== 'google' && option.value !== 'bing' && 
            option.value !== 'deepl' && option.value !== 'openai'
            && option.value !== 'gemini' 
            && option.value !== 'deepseek'
          ) {
          apiSelect.removeChild(option);
        }
      });
      
      // Add custom API options
      customApis.forEach(api => {
        const option = document.createElement('option');
        option.value = api.id;
        option.textContent = api.name;
        apiSelect.appendChild(option);
      });
      
      // Restore selected value (if it still exists)
      if (Array.from(apiSelect.options).some(option => option.value === currentValue)) {
        apiSelect.value = currentValue;
      } else {
        apiSelect.value = 'google';
      }
    });
  }
  
  /**
   * Add new API button click handler
   */
  document.getElementById('add-api-btn').addEventListener('click', function() {
    chrome.storage.sync.get('translationSettings', function(data) {
      const settings = data.translationSettings || defaultSettings;
      const customApis = settings.api.customApis || [];
      
      // Generate new ID and name
      const newId = 'custom' + (customApis.length + 1);
      const newName = 'Custom API ' + (customApis.length + 1);
      
      // Add new API
      customApis.push({
        id: newId,
        name: newName,
        url: '',
        apiKey: '',
        method: 'POST'
      });
      
      settings.api.customApis = customApis;
      
      // Save settings
      chrome.storage.sync.set({ translationSettings: settings }, function() {
        // Re-render custom APIs
        renderCustomApis();
        
        // Update selector
        updateApiSelectOptions();
        
        // Enable all delete buttons
        document.querySelectorAll('.delete-api-btn').forEach(btn => {
          btn.disabled = false;
        });
      });
    });
  });
  
  /**
   * Save settings to storage
   */
  function saveSettings() {
    // Collect custom API settings
    const customApis = [];
    document.querySelectorAll('.custom-api-item').forEach(item => {
      const useCustomHeaders = item.querySelector('.use-custom-headers').checked;
      
      customApis.push({
        id: item.dataset.id,
        name: item.querySelector('h4').textContent,
        url: item.querySelector('.custom-api-url').value,
        apiKey: item.querySelector('.custom-api-key').value,
        method: item.querySelector('.custom-api-method').value,
        useCustomHeaders: useCustomHeaders,
        headers: item.querySelector('.custom-api-headers').value
      });
    });
    
    const settings = {
      translateMode: document.querySelector('input[name="translate-mode"]:checked').value,
      triggerMethods: {
        copy: document.getElementById('enable-copy').checked,
        f1: document.getElementById('enable-f1').checked,
        customKey: document.getElementById('enable-custom-key').checked
      },
      customKey: {
        modifier: document.getElementById('custom-key').value,
        keyCode: parseInt(document.getElementById('custom-key-code').value)
      },
      api: {
        type: apiSelect.value,
        google: {},
        bing: {
          apiKey: document.getElementById('bing-api-key').value
        },
        deepl: {
          apiKey: document.getElementById('deepl-api-key').value
        },
        openai: {
          apiKey: document.getElementById('openai-api-key').value,
          model: document.getElementById('openai-model').value
        },
        deepseek: {
          apiKey: document.getElementById('deepseek-api-key').value,
          model: document.getElementById('deepseek-model').value
        },
        gemini: {
          apiKey: document.getElementById('gemini-api-key').value,
          model: document.getElementById('gemini-model').value
        },
        customApis: customApis  // Only keep new customApis array
      },
      display: {
        position: document.getElementById('display-position').value,
        autoClose: parseInt(document.getElementById('auto-close').value)
      }
    };
    
    chrome.storage.sync.set({ translationSettings: settings }, function() {
      // Show save success message
      const saveMessage = document.createElement('div');
      saveMessage.textContent = 'Settings saved!';
      saveMessage.style.position = 'fixed';
      saveMessage.style.top = '20px';
      saveMessage.style.left = '50%';
      saveMessage.style.transform = 'translateX(-50%)';
      saveMessage.style.padding = '10px 20px';
      saveMessage.style.backgroundColor = '#4CAF50';
      saveMessage.style.color = 'white';
      saveMessage.style.borderRadius = '4px';
      saveMessage.style.zIndex = '1000';
      
      document.body.appendChild(saveMessage);
      
      setTimeout(function() {
        document.body.removeChild(saveMessage);
      }, 2000);
    });
  }
  
  /**
   * Show API settings based on selected API type
   * @param {string} apiType - The selected API type
   */
  function showApiSettings(apiType) {
    apiSettings.forEach(setting => {
      setting.style.display = 'none';
    });
    
    // Check if it's a built-in API
    if (apiType === 'google' || apiType === 'bing' || 
        apiType === 'deepl' || apiType === 'openai' ||
        apiType === 'deepseek' || apiType === 'gemini') {
      document.getElementById(`${apiType}-settings`).style.display = 'block';
    } else {
      // Show custom API settings
      document.getElementById('custom-settings').style.display = 'block';
    }
  }
  
  // Event listeners
  apiSelect.addEventListener('change', function() {
    showApiSettings(this.value);
  });
  
  enableCustomKey.addEventListener('change', function() {
    customKeySettings.style.display = this.checked ? 'block' : 'none';
  });
  
  saveBtn.addEventListener('click', saveSettings);
  
  resetBtn.addEventListener('click', function() {
    if (confirm('Are you sure you want to restore default settings? This will overwrite all your custom settings.')) {
      chrome.storage.sync.set({ translationSettings: defaultSettings }, function() {
        loadSettings();
        
        // Show reset success message
        const resetMessage = document.createElement('div');
        resetMessage.textContent = 'Default settings restored!';
        resetMessage.style.position = 'fixed';
        resetMessage.style.top = '20px';
        resetMessage.style.left = '50%';
        resetMessage.style.transform = 'translateX(-50%)';
        resetMessage.style.padding = '10px 20px';
        resetMessage.style.backgroundColor = '#2196F3';
        resetMessage.style.color = 'white';
        resetMessage.style.borderRadius = '4px';
        resetMessage.style.zIndex = '1000';
        
        document.body.appendChild(resetMessage);
        
        setTimeout(function() {
          document.body.removeChild(resetMessage);
        }, 2000);
      });
    }
  });
  
  /**
   * Add Ctrl+S shortcut to save settings
   */
  document.addEventListener('keydown', function(event) {
    // Detect Ctrl+S key combination
    if (event.ctrlKey && event.key === 's') {
      // Prevent browser's default save page behavior
      event.preventDefault();
      // Call save settings function
      saveSettings();
    }
  });
  
  // Initialize
  loadSettings();
  renderCustomApis();
  updateApiSelectOptions();
  showApiSettings(apiSelect.value);
});

/**
 * Add API test button event listeners
 */
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.test-api-btn').forEach(button => {
    button.addEventListener('click', function() {
      const apiType = this.getAttribute('data-api');
      if (apiType) {
        window.location.href = `api-test.html?api=${apiType}`;
      }
    });
  });
});

/**
 * Load special sites list
 * @param {Object} settings - Translation settings object
 */
function loadSpecialSites(settings) {
  const specialSitesList = document.getElementById('special-sites-list');
  specialSitesList.innerHTML = '';
  
  if (settings.specialSites && settings.specialSites.length > 0) {
    settings.specialSites.forEach((site, index) => {
      const siteItem = document.createElement('div');
      siteItem.className = 'special-site-item';
      siteItem.style.display = 'flex';
      siteItem.style.justifyContent = 'space-between';
      siteItem.style.alignItems = 'center';
      siteItem.style.padding = '8px';
      siteItem.style.marginBottom = '5px';
      siteItem.style.backgroundColor = '#f5f5f5';
      siteItem.style.borderRadius = '4px';
      
      siteItem.innerHTML = `
        <span>${site}</span>
        <button class="remove-site" data-index="${index}" style="background-color: #ff4d4d; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Remove</button>
      `;
      specialSitesList.appendChild(siteItem);
    });
    
    // Add delete event listeners
    document.querySelectorAll('.remove-site').forEach(button => {
      button.addEventListener('click', function() {
        const index = parseInt(this.getAttribute('data-index'));
        chrome.storage.sync.get('translationSettings', function(data) {
          const settings = data.translationSettings;
          settings.specialSites.splice(index, 1);
          chrome.storage.sync.set({ translationSettings: settings }, function() {
            loadSpecialSites(settings);
          });
        });
      });
    });
  } else {
    specialSitesList.innerHTML = '<p>No special sites</p>';
  }
}

/**
 * Add special site button click handler
 */
document.getElementById('add-special-site').addEventListener('click', function() {
  const newSiteInput = document.getElementById('new-special-site');
  const newSite = newSiteInput.value.trim();
  
  if (newSite) {
    chrome.storage.sync.get('translationSettings', function(data) {
      const settings = data.translationSettings;
      
      if (!settings.specialSites) {
        settings.specialSites = [];
      }
      
      // Check if already exists
      if (!settings.specialSites.includes(newSite)) {
        settings.specialSites.push(newSite);
        chrome.storage.sync.set({ translationSettings: settings }, function() {
          loadSpecialSites(settings);
          newSiteInput.value = '';
        });
      } else {
        alert('This site is already in the list!');
      }
    });
  }
});

/**
 * Initialize settings on page load
 */
document.addEventListener('DOMContentLoaded', function() {
  // Load all settings
  chrome.storage.sync.get('translationSettings', function(data) {
    if (data.translationSettings) {
      const settings = data.translationSettings;
      
      // Load other settings...
      
      // Load special sites list
      loadSpecialSites(settings);
    }
  });
  
  // Other initialization code...
});

/**
 * Initialize key capture functionality
 */
const keyDisplay = document.getElementById('key-display');
const customKeyCode = document.getElementById('custom-key-code');

keyDisplay.addEventListener('click', function() {
  keyDisplay.value = '请按下按键...';
  keyDisplay.focus();
});

keyDisplay.addEventListener('keydown', function(e) {
  e.preventDefault();
  const key = e.key.toUpperCase();
  keyDisplay.value = key;
  customKeyCode.value = e.keyCode;
});

keyDisplay.addEventListener('blur', function() {
  if (!keyDisplay.value || keyDisplay.value === '请按下按键...') {
    keyDisplay.value = '';
    customKeyCode.value = 84; // 默认为 T 键
  }
});
