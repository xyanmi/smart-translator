(function (root, factory) {
  const api = factory();
  root.SmartTranslatorSelection = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  function isTextInputElement(element) {
    if (!element || !element.tagName) {
      return false;
    }

    const tagName = element.tagName.toUpperCase();
    if (tagName === 'TEXTAREA') {
      return true;
    }

    if (tagName !== 'INPUT') {
      return false;
    }

    const type = (element.type || 'text').toLowerCase();
    return ![
      'button',
      'checkbox',
      'color',
      'file',
      'hidden',
      'image',
      'radio',
      'range',
      'reset',
      'submit'
    ].includes(type);
  }

  function getDocumentSelectionText(doc) {
    if (!doc || typeof doc.getSelection !== 'function') {
      return '';
    }

    const selection = doc.getSelection();
    return selection ? selection.toString().trim() : '';
  }

  function getInputSelectionText(doc) {
    if (!doc || !doc.activeElement || !isTextInputElement(doc.activeElement)) {
      return '';
    }

    const activeElement = doc.activeElement;
    const start = typeof activeElement.selectionStart === 'number' ? activeElement.selectionStart : -1;
    const end = typeof activeElement.selectionEnd === 'number' ? activeElement.selectionEnd : -1;

    if (start < 0 || end < 0 || end <= start) {
      return '';
    }

    return String(activeElement.value || '').slice(start, end).trim();
  }

  function getCurrentSelectionText(doc) {
    return getDocumentSelectionText(doc) || getInputSelectionText(doc);
  }

  function createSelectionTracker(doc, cacheWindowMs = 300) {
    let cachedText = '';
    let cachedAt = 0;

    function refresh() {
      const currentText = getCurrentSelectionText(doc);
      if (currentText) {
        cachedText = currentText;
        cachedAt = Date.now();
      }

      return currentText;
    }

    function getText(options = {}) {
      const currentText = getCurrentSelectionText(doc);
      if (currentText) {
        cachedText = currentText;
        cachedAt = Date.now();
        return currentText;
      }

      if (options.allowCache && cachedText && Date.now() - cachedAt <= (options.cacheWindowMs || cacheWindowMs)) {
        return cachedText;
      }

      return '';
    }

    function clear() {
      cachedText = '';
      cachedAt = 0;
    }

    return {
      refresh,
      getText,
      clear
    };
  }

  return {
    isTextInputElement,
    getDocumentSelectionText,
    getInputSelectionText,
    getCurrentSelectionText,
    createSelectionTracker
  };
});
