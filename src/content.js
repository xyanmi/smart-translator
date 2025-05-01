let translationDiv = null;
let settings = null;
let isTranslating = false;

/**
 * Initialize the translation functionality
 * Fetches settings and sets up event listeners
 */
function initialize() {
  // Get settings from background script
  chrome.runtime.sendMessage({ action: 'getSettings' }, function(response) {
    settings = response;
    setupEventListeners();
  });
}

/**
 * Set up all event listeners for translation triggers
 */
function setupEventListeners() {
  // Listen for mouse selection events
  document.addEventListener('mouseup', handleMouseUp);
  
  // Listen for keyboard events
  document.addEventListener('keydown', handleKeyDown);
  
  // Listen for copy events if enabled in settings
  if (settings && settings.triggerMethods && settings.triggerMethods.copy) {
    document.addEventListener('copy', handleCopy);
  }
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'translate') {
      translateText(request.text);
    }
  });
}

/**
 * Handle mouse selection events
 * @param {MouseEvent} event - The mouse event object
 */
function handleMouseUp(event) {
  const selectedText = window.getSelection().toString().trim();
  
  // Return if no text is selected or translation is in progress
  if (!selectedText || isTranslating) return;
  
  // Translate immediately if instant mode is enabled
  if (settings && settings.translateMode === 'instant') {
    translateText(selectedText, event);
  }
}

/**
 * Handle keyboard events for translation triggers
 * @param {KeyboardEvent} event - The keyboard event object
 */
function handleKeyDown(event) {
  const selectedText = window.getSelection().toString().trim();
  
  // Return if no text is selected
  if (!selectedText) return;
  
  // F1 key translation trigger
  if (settings && settings.triggerMethods && settings.triggerMethods.f1 && event.key === 'F1') {
    event.preventDefault();
    translateText(selectedText, event);
  }
  
  // Custom keyboard shortcut translation trigger
  if (settings && settings.triggerMethods && settings.triggerMethods.customKey) {
    const customModifier = settings.customKey.modifier;
    const customKeyCode = settings.customKey.keyCode;
    
    if ((customModifier === 'ctrl' && event.ctrlKey) ||
        (customModifier === 'alt' && event.altKey) ||
        (customModifier === 'shift' && event.shiftKey)) {
      if (event.keyCode === customKeyCode) {
        event.preventDefault();
        translateText(selectedText, event);
      }
    }
  }
}

/**
 * Handle copy events for translation
 * @param {ClipboardEvent} event - The clipboard event object
 */
function handleCopy(event) {
  if (settings && settings.triggerMethods && settings.triggerMethods.copy) {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
      // Don't prevent default copy behavior, trigger translation after copy
      setTimeout(() => {
        translateText(selectedText, event);
      }, 10);
    }
  }
}

/**
 * Translate the selected text
 * @param {string} text - The text to translate
 * @param {Event} event - The event that triggered translation (optional)
 */
function translateText(text, event = null) {
  if (!text || isTranslating) return;
  
  isTranslating = true;
  
  // Show loading indicator
  showTranslationDiv('正在翻译...', event);
  // Send translation request to background script
  chrome.runtime.sendMessage({
    action: 'translate',
    text: text,
    sourceLang: 'auto',
    targetLang: 'zh-CN'
  }, function(response) {
    
    if (response && response.success) {
      showTranslationDiv(response.translatedText, event);
    } else {
      showTranslationDiv('翻译失败: ' + (response ? response.error : '未知错误') + '（如果是大模型，一般是请求量过多，可以重试）', event);
      console.log(response)
    }
    isTranslating = false;
  });
}

/**
 * Display the translation result in a popup div
 * @param {string} content - The content to display
 * @param {Event} event - The event that triggered translation (optional)
 */
function showTranslationDiv(content, event) {
  // Remove existing translation div if present
  removeTranslationDiv();
  
  // Create translation result div
  translationDiv = document.createElement('div');
  translationDiv.className = 'chrome-translator-result';
  translationDiv.innerHTML = `
    <div class="chrome-translator-header">
      <span>翻译结果</span>
      <span class="chrome-translator-close">×</span>
    </div>
    <div class="chrome-translator-content">${content}</div>
  `;
  
  // Set styles
  const style = document.createElement('style');
  style.textContent = `
    .chrome-translator-result {
      position: absolute;
      max-width: 300px;
      background-color: white;
      border-radius: 4px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      z-index: 9999;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 14px;
      overflow: hidden;
    }
    .chrome-translator-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 10px;
      background-color: #f5f5f5;
      border-bottom: 1px solid #ddd;
    }
    .chrome-translator-close {
      cursor: pointer;
      font-size: 18px;
      color: #666;
    }
    .chrome-translator-close:hover {
      color: #333;
    }
    .chrome-translator-content {
      padding: 10px;
      max-height: 200px;
      overflow-y: auto;
    }
  `;
  document.head.appendChild(style);
  
  // Add close button event
  translationDiv.querySelector('.chrome-translator-close').addEventListener('click', removeTranslationDiv);
  
  // Add to page
  document.body.appendChild(translationDiv);
  
  // Set position
  positionTranslationDiv(event);
  
  // Auto-close if configured in settings
  if (settings && settings.display && settings.display.autoClose > 0) {
    setTimeout(removeTranslationDiv, settings.display.autoClose * 1000);
  }
}

/**
 * Position the translation div based on event or selection
 * @param {Event} event - The event that triggered translation (optional)
 */
function positionTranslationDiv(event) {
  if (!translationDiv) return;
  
  // Default position (screen center)
  let left = window.innerWidth / 2 - 150;
  let top = window.innerHeight / 2 - 100;
  
  // If event exists, position based on event or selection
  if (event) {
    const selection = window.getSelection();
    
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // Position based on settings
      if (settings && settings.display && settings.display.position === 'near') {
        // Position near selected text
        left = rect.right;
        top = rect.bottom + window.scrollY;
        
        // Ensure div stays within screen bounds
        if (left + 300 > window.innerWidth) {
          left = rect.left - 300;
          if (left < 0) left = 0;
        }
      } else {
        // Use mouse position
        left = event.pageX + 10;
        top = event.pageY + 10;
        
        // Ensure div stays within screen bounds
        if (left + 300 > window.innerWidth) {
          left = event.pageX - 310;
        }
      }
    } else {
      // If no selection range, use mouse position
      left = event.pageX + 10;
      top = event.pageY + 10;
    }
  }
  
  // Apply position
  translationDiv.style.left = `${left}px`;
  translationDiv.style.top = `${top}px`;
}

/**
 * Remove the translation div from the page
 */
function removeTranslationDiv() {
  if (translationDiv && translationDiv.parentNode) {
    translationDiv.parentNode.removeChild(translationDiv);
    translationDiv = null;
  }
}

/**
 * Check if the current page is a PDF document
 * @returns {boolean} True if the page is a PDF document
 */
function isPDF() {
  return document.querySelector('embed[type="application/pdf"]') !== null;
}

// Handle initialization for PDF documents
if (isPDF()) {
  // Wait for PDF viewer to load
  const checkPDFViewer = setInterval(() => {
    const pdfViewer = document.querySelector('.textLayer');
    if (pdfViewer) {
      clearInterval(checkPDFViewer);
      // Initialize translation functionality when PDF is loaded
      initialize();
    }
  }, 1000);
} else {
  // Initialize immediately for regular web pages
  initialize();
}

