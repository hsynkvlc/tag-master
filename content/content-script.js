/**
 * Swiss Knife for Google - Content Script
 * Handles: DataLayer monitoring, GTM injection, code execution
 */

(function () {
  'use strict';

  const MESSAGE_TYPES = {
    DATALAYER_PUSH: 'DATALAYER_PUSH',
    DATALAYER_INIT: 'DATALAYER_INIT',
    DATALAYER_GET: 'DATALAYER_GET',
    GTM_INJECT: 'GTM_INJECT',
    GTM_REMOVE: 'GTM_REMOVE',
    GTM_DETECT: 'GTM_DETECT',
    GTM_INFO: 'GTM_INFO',
    CODE_EXECUTE: 'CODE_EXECUTE',
    CODE_RESULT: 'CODE_RESULT'
  };



  // ============================================
  // Message Handling from Page Script
  // ============================================
  let pendingCallbacks = {};

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.source !== 'swiss-knife-for-google') {
      return;
    }

    const { type, payload } = event.data;
    const requestId = payload?.requestId;

    // Handle Selector messages specifically to ensure they are broadcasted
    if (type === 'SELECTOR_RESULT') {
      chrome.runtime.sendMessage({
        type: 'SELECTOR_RESULT',
        payload: payload
      });
    }

    if (requestId && pendingCallbacks[requestId]) {
      pendingCallbacks[requestId](payload.data);
      delete pendingCallbacks[requestId];
    } else if (type === 'DATALAYER_EVENT') {
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.DATALAYER_PUSH,
        data: payload
      });
    }
  });

  // ============================================
  // Send Command to Page Script
  // ============================================
  function sendCommand(type, data = {}) {
    return new Promise((resolve) => {
      const requestId = Math.random().toString(36).substring(7);
      pendingCallbacks[requestId] = resolve;

      window.postMessage({
        source: 'swiss-knife-for-google-command',
        type,
        payload: { ...data, requestId }
      }, '*');

      // Timeout fallback
      setTimeout(() => {
        if (pendingCallbacks[requestId]) {
          console.warn('[Swiss Knife] Command timed out:', type);
          pendingCallbacks[requestId](null);
          delete pendingCallbacks[requestId];
        }
      }, 5000);
    });
  }

  // Helper no longer needed but keeping clean

  // ============================================
  // Message Handling from Extension
  // ============================================
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleExtensionMessage(message).then(sendResponse);
    return true;
  });

  async function handleExtensionMessage(message) {
    switch (message.type) {
      case MESSAGE_TYPES.GTM_INJECT:
        return await sendCommand('INJECT_GTM', {
          gtmId: message.gtmId,
          options: message.options
        });

      case MESSAGE_TYPES.GTM_REMOVE:
        return await sendCommand('REMOVE_GTM', {
          gtmId: message.gtmId
        });

      case MESSAGE_TYPES.GTM_DETECT:
        return await sendCommand('DETECT_GTM');

      case MESSAGE_TYPES.GTM_INFO:
        return await sendCommand('GET_GTM_INFO', {
          containerId: message.containerId
        });

      case MESSAGE_TYPES.DATALAYER_GET:
        return await sendCommand('GET_DATALAYER');

      case MESSAGE_TYPES.DATALAYER_PUSH:
        console.log('[Swiss Knife] Pushing to DataLayer:', message.data);
        return await sendCommand('PUSH_DATALAYER', {
          data: message.data
        });

      case MESSAGE_TYPES.CODE_EXECUTE:
        return await sendCommand('EXECUTE_CODE', {
          code: message.code
        });

      case 'GET_CONSENT_STATE':
        return await sendCommand('GET_CONSENT_STATE');

      case 'GET_PERFORMANCE_METRICS':
        return await sendCommand('GET_PERFORMANCE_METRICS');

      case 'SELECTOR_START':
        return await sendCommand('SELECTOR_START');

      case 'SELECTOR_STOP':
        return await sendCommand('SELECTOR_STOP');

      case 'SELECTOR_FROM_HIGHLIGHT':
        return await sendCommand('SELECTOR_FROM_HIGHLIGHT');

      default:
        return { error: 'Unknown message type' };
    }
  }

  // ============================================
  // Initialize
  // ============================================

  // Check for auto-injection (persistence)
  async function checkAutoInject() {
    try {
      const hostname = window.location.hostname;
      const key = 'gtm_inject_' + hostname;
      const stored = await chrome.storage.local.get(key);
      const config = stored[key];

      if (config) {
        console.log('[Swiss Knife] Auto-injecting GTM:', config.gtmId);
        // Add small delay to ensure page script is ready
        setTimeout(async () => {
          await sendCommand('INJECT_GTM', {
            gtmId: config.gtmId,
            options: config.options
          });
        }, 500);
      }
    } catch (e) {
      console.error('[Swiss Knife] Auto-inject error:', e);
    }
  }

  checkAutoInject();

  console.log('[Swiss Knife] Content script initialized');

})();
