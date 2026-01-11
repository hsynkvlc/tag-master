/**
 * Swiss Knife for Google - Content Script
 * Handles: DataLayer monitoring, GTM injection, code execution
 */

(function() {
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
  // Inject Page Script for DataLayer Access
  // ============================================
  function injectPageScript() {
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        'use strict';

        const SWISS_KNIFE_ID = 'swiss-knife-for-google';

        // Store original dataLayer array
        window.__swissKnife = window.__swissKnife || {
          originalPush: null,
          events: [],
          containers: []
        };

        // Initialize dataLayer if not exists
        window.dataLayer = window.dataLayer || [];

        // Capture existing events
        window.dataLayer.forEach((event, index) => {
          sendEvent('existing', event, index);
        });

        // Override push method
        if (!window.__swissKnife.originalPush) {
          window.__swissKnife.originalPush = window.dataLayer.push.bind(window.dataLayer);

          window.dataLayer.push = function(...args) {
            args.forEach((arg, index) => {
              sendEvent('push', arg, window.dataLayer.length + index);
            });
            return window.__swissKnife.originalPush(...args);
          };
        }

        // Send event to content script
        function sendEvent(type, data, index) {
          const eventName = data?.event || data?.['0'] || 'unknown';
          window.postMessage({
            source: SWISS_KNIFE_ID,
            type: 'DATALAYER_EVENT',
            payload: {
              eventType: type,
              eventName: eventName,
              data: JSON.parse(JSON.stringify(data)),
              index: index,
              timestamp: Date.now(),
              pageUrl: window.location.href
            }
          }, '*');
        }

        // Detect GTM containers
        function detectGTMContainers() {
          const containers = [];

          // Check for google_tag_manager object
          if (window.google_tag_manager) {
            for (const key in window.google_tag_manager) {
              if (key.startsWith('GTM-') || key.startsWith('G-')) {
                const gtm = window.google_tag_manager[key];
                containers.push({
                  id: key,
                  type: key.startsWith('GTM-') ? 'GTM' : 'GA4',
                  dataLayer: gtm?.dataLayer?.name || 'dataLayer'
                });
              }
            }
          }

          // Check for GTM script tags
          document.querySelectorAll('script[src*="googletagmanager.com"]').forEach(script => {
            const match = script.src.match(/[?&]id=(GTM-[A-Z0-9]+)/);
            if (match && !containers.find(c => c.id === match[1])) {
              containers.push({
                id: match[1],
                type: 'GTM',
                source: script.src
              });
            }
          });

          // Check for gtag script tags
          document.querySelectorAll('script[src*="gtag/js"]').forEach(script => {
            const match = script.src.match(/[?&]id=(G-[A-Z0-9]+)/);
            if (match && !containers.find(c => c.id === match[1])) {
              containers.push({
                id: match[1],
                type: 'GA4',
                source: script.src
              });
            }
          });

          return containers;
        }

        // Get GTM container info
        function getGTMInfo(containerId) {
          if (!window.google_tag_manager || !window.google_tag_manager[containerId]) {
            return null;
          }

          const gtm = window.google_tag_manager[containerId];
          return {
            id: containerId,
            dataLayer: gtm.dataLayer,
            onHtmlSuccess: gtm.onHtmlSuccess,
            googleAnalytics: gtm.googleAnalytics
          };
        }

        // Listen for commands from content script
        window.addEventListener('message', (event) => {
          if (event.source !== window || event.data?.source !== SWISS_KNIFE_ID + '-command') {
            return;
          }

          const { type, payload } = event.data;

          switch (type) {
            case 'DETECT_GTM':
              const containers = detectGTMContainers();
              window.postMessage({
                source: SWISS_KNIFE_ID,
                type: 'GTM_CONTAINERS',
                payload: containers
              }, '*');
              break;

            case 'GET_GTM_INFO':
              const info = getGTMInfo(payload.containerId);
              window.postMessage({
                source: SWISS_KNIFE_ID,
                type: 'GTM_INFO',
                payload: info
              }, '*');
              break;

            case 'GET_DATALAYER':
              window.postMessage({
                source: SWISS_KNIFE_ID,
                type: 'DATALAYER_SNAPSHOT',
                payload: JSON.parse(JSON.stringify(window.dataLayer))
              }, '*');
              break;

            case 'PUSH_DATALAYER':
              window.dataLayer.push(payload.data);
              window.postMessage({
                source: SWISS_KNIFE_ID,
                type: 'PUSH_SUCCESS',
                payload: { success: true }
              }, '*');
              break;

            case 'EXECUTE_CODE':
              try {
                const result = eval(payload.code);
                window.postMessage({
                  source: SWISS_KNIFE_ID,
                  type: 'CODE_RESULT',
                  payload: { success: true, result: JSON.parse(JSON.stringify(result || null)) }
                }, '*');
              } catch (error) {
                window.postMessage({
                  source: SWISS_KNIFE_ID,
                  type: 'CODE_RESULT',
                  payload: { success: false, error: error.message }
                }, '*');
              }
              break;

            case 'INJECT_GTM':
              injectGTM(payload.gtmId, payload.options);
              break;

            case 'REMOVE_GTM':
              removeGTM(payload.gtmId);
              break;
          }
        });

        // Inject GTM container
        function injectGTM(gtmId, options = {}) {
          const {
            initDataLayer = true,
            position = 'head',
            preview = false
          } = options;

          // Remove existing if override
          if (options.override) {
            removeGTM(gtmId);
          }

          // Initialize dataLayer
          if (initDataLayer) {
            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({
              'gtm.start': new Date().getTime(),
              event: 'gtm.js'
            });
          }

          // Create script
          const script = document.createElement('script');
          script.async = true;
          script.id = 'swiss-knife-gtm-' + gtmId;
          script.src = 'https://www.googletagmanager.com/gtm.js?id=' + gtmId;

          if (preview) {
            script.src += '&gtm_preview=env-1&gtm_auth=&gtm_debug=x';
          }

          // Insert script
          if (position === 'head') {
            document.head.insertBefore(script, document.head.firstChild);
          } else {
            document.body.insertBefore(script, document.body.firstChild);
          }

          // Create noscript iframe
          const noscript = document.createElement('noscript');
          noscript.id = 'swiss-knife-gtm-noscript-' + gtmId;
          const iframe = document.createElement('iframe');
          iframe.src = 'https://www.googletagmanager.com/ns.html?id=' + gtmId;
          iframe.height = '0';
          iframe.width = '0';
          iframe.style.cssText = 'display:none;visibility:hidden';
          noscript.appendChild(iframe);
          document.body.insertBefore(noscript, document.body.firstChild);

          window.postMessage({
            source: SWISS_KNIFE_ID,
            type: 'GTM_INJECTED',
            payload: { gtmId, success: true }
          }, '*');
        }

        // Remove GTM container
        function removeGTM(gtmId) {
          const script = document.getElementById('swiss-knife-gtm-' + gtmId);
          const noscript = document.getElementById('swiss-knife-gtm-noscript-' + gtmId);

          if (script) script.remove();
          if (noscript) noscript.remove();

          // Note: Cannot fully remove GTM once loaded, would need page reload

          window.postMessage({
            source: SWISS_KNIFE_ID,
            type: 'GTM_REMOVED',
            payload: { gtmId, success: true }
          }, '*');
        }

        console.log('[Swiss Knife] Page script initialized');
      })();
    `;

    // Inject as early as possible
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }

  // ============================================
  // Message Handling from Page Script
  // ============================================
  let pendingCallbacks = {};

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.source !== 'swiss-knife-for-google') {
      return;
    }

    const { type, payload } = event.data;

    switch (type) {
      case 'DATALAYER_EVENT':
        // Forward to background
        chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.DATALAYER_PUSH,
          data: payload
        });
        break;

      case 'GTM_CONTAINERS':
      case 'GTM_INFO':
      case 'DATALAYER_SNAPSHOT':
      case 'PUSH_SUCCESS':
      case 'CODE_RESULT':
      case 'GTM_INJECTED':
      case 'GTM_REMOVED':
        // Resolve pending callback
        if (pendingCallbacks[type]) {
          pendingCallbacks[type](payload);
          delete pendingCallbacks[type];
        }
        break;
    }
  });

  // ============================================
  // Send Command to Page Script
  // ============================================
  function sendCommand(type, payload = {}) {
    return new Promise((resolve) => {
      pendingCallbacks[getResponseType(type)] = resolve;

      window.postMessage({
        source: 'swiss-knife-for-google-command',
        type,
        payload
      }, '*');

      // Timeout fallback
      setTimeout(() => {
        if (pendingCallbacks[getResponseType(type)]) {
          pendingCallbacks[getResponseType(type)](null);
          delete pendingCallbacks[getResponseType(type)];
        }
      }, 5000);
    });
  }

  function getResponseType(commandType) {
    const mapping = {
      'DETECT_GTM': 'GTM_CONTAINERS',
      'GET_GTM_INFO': 'GTM_INFO',
      'GET_DATALAYER': 'DATALAYER_SNAPSHOT',
      'PUSH_DATALAYER': 'PUSH_SUCCESS',
      'EXECUTE_CODE': 'CODE_RESULT',
      'INJECT_GTM': 'GTM_INJECTED',
      'REMOVE_GTM': 'GTM_REMOVED'
    };
    return mapping[commandType];
  }

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

      default:
        return { error: 'Unknown message type' };
    }
  }

  // ============================================
  // Initialize
  // ============================================
  injectPageScript();
  console.log('[Swiss Knife] Content script initialized');

})();
