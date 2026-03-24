/**
 * Get DOM elements for settings controls
 */
const translateModeRadios = document.querySelectorAll('input[name="translateMode"]');
const triggerF1Checkbox = document.getElementById('triggerF1');
const triggerCopyCheckbox = document.getElementById('triggerCopy');
const triggerCustomCheckbox = document.getElementById('triggerCustom');
const apiTypeSelect = document.getElementById('apiType');

/**
 * Load settings from storage and update UI elements
 */
function loadSettings() {
  chrome.storage.sync.get('translationSettings', function(data) {
    if (data.translationSettings) {
      const settings = SmartTranslatorApi.normalizeTranslationSettings(data.translationSettings);
      
      // Set translation mode
      const modeRadio = document.querySelector(`input[name="translateMode"][value="${settings.translateMode}"]`);
      if (modeRadio) modeRadio.checked = true;
      
      // Set trigger methods
      if (settings.triggerMethods) {
        triggerF1Checkbox.checked = settings.triggerMethods.f1;
        triggerCopyCheckbox.checked = settings.triggerMethods.copy;
        triggerCustomCheckbox.checked = settings.triggerMethods.customKey;
      }
      
      // Set API type and handle custom APIs
      if (settings.api && settings.api.type) {
        // Check for custom APIs
        if (settings.api.customApis && settings.api.customApis.length > 0) {
          // Update select options with custom APIs
          const customApis = settings.api.customApis;
          customApis.forEach(api => {
            const existingOption = apiTypeSelect.querySelector(`option[value="${api.id}"]`);
            if (!existingOption) {
              const option = document.createElement('option');
              option.value = api.id;
              option.textContent = api.name;
              apiTypeSelect.appendChild(option);
            }
          });
        }
        apiTypeSelect.value = settings.api.type;
      }
    }
  });
}

/**
 * Save current settings to storage
 */
function saveSettings() {
  chrome.storage.sync.get('translationSettings', function(data) {
    const settings = SmartTranslatorApi.normalizeTranslationSettings(data.translationSettings);
    console.log('Settings changed');
    
    // Get translation mode
    const selectedMode = document.querySelector('input[name="translateMode"]:checked');
    if (selectedMode) {
      settings.translateMode = selectedMode.value;
    }
    
    // Get trigger methods
    settings.triggerMethods = {
      f1: triggerF1Checkbox.checked,
      copy: triggerCopyCheckbox.checked,
      customKey: triggerCustomCheckbox.checked
    };
    
    // Get API type
    settings.api = settings.api || {};
    settings.api.type = apiTypeSelect.value;
    
    // Save to storage
    chrome.storage.sync.set({ translationSettings: settings });
  });
}

/**
 * Add event listeners for settings changes
 */
function addEventListeners() {
  // Translation mode change
  translateModeRadios.forEach(radio => {
    radio.addEventListener('change', saveSettings);
  });
  
  // Trigger methods change
  triggerF1Checkbox.addEventListener('change', saveSettings);
  triggerCopyCheckbox.addEventListener('change', saveSettings);
  triggerCustomCheckbox.addEventListener('change', saveSettings);
  
  // API type change
  apiTypeSelect.addEventListener('change', saveSettings);
}

/**
 * Initialize popup when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
  loadSettings();
  addEventListeners();
});
