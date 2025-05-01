/**
 * Initialize API test functionality when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    // Get API type from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const apiType = urlParams.get('api');
    console.log(apiType);
    
    // Get DOM elements
    const testText = document.getElementById('test-text');
    const requestInfo = document.getElementById('request-info');
    const responseInfo = document.getElementById('response-info');
    const sendTestBtn = document.getElementById('send-test');

    /**
     * Load API settings and display initial request info
     */
    chrome.storage.sync.get('translationSettings', function(data) {
        const settings = data.translationSettings;
        const apiSettings = settings.api[apiType];
        
        // Display request information
        updateRequestInfo(apiType, apiSettings, testText.value);
    });
    
    /**
     * Update request info when test text changes
     */
    testText.addEventListener('input', function() {
        chrome.storage.sync.get('translationSettings', function(data) {
            const settings = data.translationSettings;
            const apiSettings = settings.api[apiType];
            updateRequestInfo(apiType, apiSettings, testText.value);
        });
    });
    
    /**
     * Handle test request submission
     */
    sendTestBtn.addEventListener('click', function() {
        responseInfo.textContent = 'Sending request...';
        
        chrome.storage.sync.get('translationSettings', function(data) {
            const settings = data.translationSettings;
            const apiSettings = settings.api[apiType];
            
            // Send translation request to background script
            chrome.runtime.sendMessage({
                test: true,
                apiType: apiType,
                action: 'translate',
                text: testText.value,
                sourceLang: 'auto',
                targetLang: 'zh-CN'
            }, function(response) {
                responseInfo.textContent = JSON.stringify(response, null, 2);
            });
        });
    });
    
    /**
     * Update request information display
     * @param {string} apiType - Type of translation API
     * @param {Object} apiSettings - API configuration settings
     * @param {string} text - Text to be translated
     */
    function updateRequestInfo(apiType, apiSettings, text) {
        let requestData = {
            apiType: apiType,
            settings: apiSettings,
            testText: text
        };
        console.log(requestData);
        requestInfo.textContent = JSON.stringify(requestData, null, 2);
    }
});