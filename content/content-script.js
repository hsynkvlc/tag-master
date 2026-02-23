/**
 * Tag Master - Content Script
 * Handles: DataLayer monitoring, GTM injection, code execution
 */

(function () {
  'use strict';

  console.log('[Tag Master] Content script execution started');

  // Idempotency check
  if (window.__tagMasterContentScriptLoaded) {
    return;
  }
  window.__tagMasterContentScriptLoaded = true;

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

  // Helper: Safe JSON serializer for circular references
  function safeSerialize(obj) {
    const cache = new Set();
    return JSON.parse(JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) {
          // Circular reference found, discard key
          return '[Circular]';
        }
        // Store value in our collection
        cache.add(value);
      }
      return value;
    }));
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.source !== 'tag-master-extension') {
      return;
    }

    const { type, payload } = event.data;
    const requestId = payload?.requestId;

    // Handle Selector messages specifically to ensure they are broadcasted
    if (type === 'SELECTOR_RESULT') {
      try {
        if (chrome.runtime?.id) {
          chrome.runtime.sendMessage({
            type: 'SELECTOR_RESULT',
            payload: payload
          });
        }
      } catch (e) { }
    }

    if (requestId && pendingCallbacks[requestId]) {
      pendingCallbacks[requestId](payload.data);
      delete pendingCallbacks[requestId];
    } else if (type === 'DATALAYER_EVENT') {
      try {
        if (chrome.runtime?.id) {
          // Use safeSerialize to prevent circular structure errors
          const safePayload = safeSerialize(payload);
          chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.DATALAYER_PUSH,
            data: {
              ...safePayload,
              url: window.location.href
            }
          });
        }
      } catch (e) {
        // Extension context invalidated - ignore
      }
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
        source: 'tag-master-extension-command',
        type,
        payload: { ...data, requestId }
      }, '*');

      // Timeout fallback (10s for interactive operations like selector, 15s for tech)
      const timeoutDuration = type.includes('SELECTOR') ? 30000 : (type === 'DETECT_TECH' ? 15000 : 8000);
      setTimeout(() => {
        if (pendingCallbacks[requestId]) {
          console.warn('[Tag Master] Command timed out:', type);
          pendingCallbacks[requestId](null);
          delete pendingCallbacks[requestId];
        }
      }, timeoutDuration);
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
        return await sendCommand('PUSH_DATALAYER', {
          data: message.data
        });

      case MESSAGE_TYPES.CODE_EXECUTE:
        return await sendCommand('EXECUTE_CODE', {
          code: message.code
        });

      case 'GET_CONSENT_STATE':
        return await sendCommand('GET_CONSENT_STATE');

      case 'GET_CSP':
        // Get CSP from meta tag (Content-Security-Policy header is not accessible from JS)
        const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        return { csp: cspMeta?.content || '' };

      case 'DETECT_TECH':
        return await sendCommand('DETECT_TECH');

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

      if (config && config.snippet) {
        await sendCommand('INJECT_GTM', {
          gtmId: config.gtmId,
          options: {
            snippet: config.snippet,
            ...config.options
          }
        });
      }
    } catch (e) {
      console.error('[Tag Master] Auto-inject error:', e);
    }
  }

  checkAutoInject();
})();
