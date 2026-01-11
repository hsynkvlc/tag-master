/**
 * Swiss Knife for Google - Page Script
 * Injected into the MAIN world to access window.dataLayer and Google objects
 */

(function () {
    'use strict';

    const SWISS_KNIFE_ID = 'swiss-knife-for-google';

    // Store original dataLayer array
    window.__swissKnife = window.__swissKnife || {
        originalPush: null,
        events: [],
        containers: [],
        initialized: false,
        dataLayerName: 'dataLayer'
    };

    // Detect standard DataLayer name from GTM
    if (window.google_tag_manager) {
        for (const key in window.google_tag_manager) {
            if (key.startsWith('GTM-') && window.google_tag_manager[key].dataLayer) {
                window.__swissKnife.dataLayerName = window.google_tag_manager[key].dataLayer.name || 'dataLayer';
                break;
            }
        }
    }

    const dlName = window.__swissKnife.dataLayerName;
    window[dlName] = window[dlName] || [];

    // Capture existing events
    if (!window.__swissKnife.initialized) {
        window[dlName].forEach((event, index) => {
            sendEvent('existing', event, index);
        });
        window.__swissKnife.initialized = true;
        console.log('[Swiss Knife] Monitoring DataLayer:', dlName);
    }

    // Periodically re-check for DataLayer name changes (e.g. if GTM loads late)
    setInterval(() => {
        if (window.google_tag_manager) {
            for (const key in window.google_tag_manager) {
                if (key.startsWith('GTM-') && window.google_tag_manager[key].dataLayer) {
                    const newName = window.google_tag_manager[key].dataLayer.name;
                    if (newName && newName !== window.__swissKnife.dataLayerName) {
                        console.log('[Swiss Knife] DataLayer name change detected:', newName);
                        window.__swissKnife.dataLayerName = newName;
                        // Trigger re-init logic if needed
                    }
                }
            }
        }
    }, 5000);

    // Override push method
    if (!window.__swissKnife.originalPush && typeof window[dlName].push === 'function') {
        window.__swissKnife.originalPush = window[dlName].push.bind(window[dlName]);

        window[dlName].push = function (...args) {
            args.forEach((arg, index) => {
                sendEvent('push', arg, window[dlName].length + index);
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
        const requestId = payload?.requestId;

        const reply = (msgType, data) => {
            window.postMessage({
                source: SWISS_KNIFE_ID,
                type: msgType,
                payload: {
                    requestId,
                    data
                }
            }, '*');
        };

        switch (type) {
            case 'DETECT_GTM':
                const containers = detectGTMContainers();
                reply('GTM_CONTAINERS', containers);
                break;

            case 'GET_GTM_INFO':
                const info = getGTMInfo(payload.containerId);
                reply('GTM_INFO', info);
                break;

            case 'GET_DATALAYER':
                reply('DATALAYER_SNAPSHOT', JSON.parse(JSON.stringify(window.dataLayer)));
                break;

            case 'PUSH_DATALAYER':
                try {
                    const targetDlName = window.__swissKnife.dataLayerName || 'dataLayer';
                    if (!window[targetDlName]) window[targetDlName] = [];

                    // Direct push
                    if (typeof window[targetDlName].push === 'function') {
                        window[targetDlName].push(payload.data);
                        reply('PUSH_SUCCESS', { success: true });
                    } else {
                        // If push is not a function (shouldn't happen with our override, but just in case)
                        window[targetDlName] = [payload.data];
                        reply('PUSH_SUCCESS', { success: true, note: 'Re-initialized array' });
                    }
                } catch (e) {
                    reply('PUSH_ERROR', { error: e.message });
                }
                break;

            case 'EXECUTE_CODE':
                try {
                    const result = eval(payload.code);
                    reply('CODE_RESULT', { success: true, result: JSON.parse(JSON.stringify(result || null)) });
                } catch (error) {
                    reply('CODE_RESULT', { success: false, error: error.message });
                }
                break;

            case 'INJECT_GTM':
                injectGTM(payload.gtmId, payload.options);
                reply('INJECT_RESULT', { success: true });
                break;

            case 'REMOVE_GTM':
                removeGTM(payload.gtmId);
                reply('REMOVE_RESULT', { success: true });
                break;

            case 'GET_CONSENT_STATE':
                reply('CONSENT_STATE', getConsentState());
                break;

            case 'GET_PERFORMANCE_METRICS':
                reply('PERFORMANCE_METRICS', getPerformanceMetrics());
                break;

            case 'CLEAR_GOOGLE_COOKIES':
                clearGoogleCookies();
                reply('COOKIES_CLEARED', { success: true });
                break;

            case 'BLOCK_GA4_HITS':
                toggleGA4Block(payload.enabled);
                reply('BLOCK_GA4_RESULT', { success: true, enabled: payload.enabled });
                break;

            case 'SELECTOR_START':
                enableSelectorMode(requestId);
                break;

            case 'SELECTOR_STOP':
                disableSelectorMode();
                break;

            case 'SELECTOR_FROM_HIGHLIGHT':
                captureFromHighlight(requestId);
                break;
        }
    });

    // ============================================
    // Visual Element Selector
    // ============================================
    let selectorActive = false;
    let lastRequestId = null;
    let highlightEl = null;

    function enableSelectorMode(requestId) {
        // Clear previous state if any
        disableSelectorMode();

        selectorActive = true;
        lastRequestId = requestId;

        console.log('[Swiss Knife] Selector mode active for req:', requestId);

        if (!highlightEl) {
            highlightEl = document.createElement('div');
            highlightEl.id = 'swiss-knife-selector-highlight';
            highlightEl.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;background:rgba(66,133,244,0.15);border:2px solid #4285f4;transition:all 0.05s ease;display:none;box-shadow: 0 0 0 9999px rgba(0,0,0,0.1);';
            document.body.appendChild(highlightEl);

            // Add a floating indicator
            const badge = document.createElement('div');
            badge.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:#4285f4;color:white;padding:8px 16px;border-radius:20px;font-family:sans-serif;font-size:12px;font-weight:bold;z-index:2147483647;box-shadow:0 4px 12px rgba(0,0,0,0.2);pointer-events:none;';
            badge.id = 'swiss-knife-selector-badge';
            badge.innerHTML = '<span style="margin-right:8px">🎯</span> Swiss Knife Selection Mode <span style="margin-left:8px;opacity:0.7;font-weight:normal">(ESC to cancel)</span>';
            document.body.appendChild(badge);
        } else {
            document.getElementById('swiss-knife-selector-badge').style.display = 'block';
        }

        document.addEventListener('mouseover', onSelectorHover, true);
        document.addEventListener('click', onSelectorClick, true);
        document.addEventListener('keydown', onSelectorKey, true);
        document.body.style.cursor = 'crosshair';
    }

    function disableSelectorMode() {
        selectorActive = false;
        if (highlightEl) highlightEl.style.display = 'none';
        const badge = document.getElementById('swiss-knife-selector-badge');
        if (badge) badge.style.display = 'none';

        document.removeEventListener('mouseover', onSelectorHover, true);
        document.removeEventListener('click', onSelectorClick, true);
        document.removeEventListener('keydown', onSelectorKey, true);
        document.body.style.cursor = '';
    }

    let hoverFrame = null;
    function onSelectorHover(e) {
        if (!selectorActive) return;
        if (hoverFrame) cancelAnimationFrame(hoverFrame);

        hoverFrame = requestAnimationFrame(() => {
            const target = e.target;
            if (target === highlightEl || target.id === 'swiss-knife-selector-badge') return;

            const rect = target.getBoundingClientRect();
            highlightEl.style.top = rect.top + 'px';
            highlightEl.style.left = rect.left + 'px';
            highlightEl.style.width = rect.width + 'px';
            highlightEl.style.height = rect.height + 'px';
            highlightEl.style.display = 'block';
        });
    }

    function onSelectorClick(e) {
        if (!selectorActive) return;
        e.preventDefault();
        e.stopPropagation();

        const target = e.target;
        const selector = getCssSelector(target);
        const jsPath = getJsPath(target);

        // Capture attributes for better trigger suggestions
        const attributes = {};
        for (const attr of target.attributes) {
            attributes[attr.name] = attr.value;
        }

        window.postMessage({
            source: SWISS_KNIFE_ID,
            type: 'SELECTOR_RESULT',
            payload: {
                requestId: lastRequestId,
                selector: selector,
                jsPath: jsPath,
                tagName: target.tagName,
                id: target.id,
                classes: Array.from(target.classList),
                attributes: attributes,
                innerText: target.innerText?.trim().substring(0, 100)
            }
        }, '*');

        disableSelectorMode();
    }

    function onSelectorKey(e) {
        if (e.key === 'Escape') disableSelectorMode();
    }

    function captureFromHighlight(requestId) {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            window.postMessage({
                source: SWISS_KNIFE_ID,
                type: 'SELECTOR_RESULT',
                payload: { requestId, error: 'No text selected.' }
            }, '*');
            return;
        }

        let target = selection.anchorNode;
        if (target.nodeType === 3) target = target.parentNode;

        // Find the best element based on selection
        const selector = getCssSelector(target);
        const jsPath = getJsPath(target);

        window.postMessage({
            source: SWISS_KNIFE_ID,
            type: 'SELECTOR_RESULT',
            payload: {
                requestId: requestId,
                selector: selector,
                jsPath: jsPath,
                tagName: target.tagName,
                innerText: target.innerText?.trim().substring(0, 100),
                fromSelection: true
            }
        }, '*');
    }

    function getCssSelector(el) {
        if (!(el instanceof Element)) return '';

        // 1. Try ID if stable
        if (el.id && !/^\d|ember|j_|[a-f0-9]{8}/i.test(el.id)) {
            return `#${el.id}`;
        }

        const path = [];
        let current = el;

        while (current && current.nodeType === Node.ELEMENT_NODE) {
            let selector = current.nodeName.toLowerCase();

            // Check for specific attributes that are highly reliable
            const reliableAttrs = ['data-gtm', 'data-testid', 'name', 'aria-label'];
            let attrMatch = null;
            for (const attr of reliableAttrs) {
                const val = current.getAttribute(attr);
                if (val && !val.includes('{')) { // Avoid templates
                    attrMatch = `[${attr}="${val}"]`;
                    break;
                }
            }

            if (attrMatch) {
                selector += attrMatch;
                // If this is unique enough, we can stop
                if (document.querySelectorAll(selector).length === 1) {
                    path.unshift(selector);
                    break;
                }
            } else if (current.id && !/^\d|ember|j_|[a-f0-9]{8}/i.test(current.id)) {
                selector = `#${current.id}`;
                path.unshift(selector);
                break;
            } else if (current.classList.length > 0) {
                // Use the most meaningful class
                const classes = Array.from(current.classList)
                    .filter(c => !/^(hover|active|focus|valid|invalid|ng-|ember|j_)/.test(c))
                    .join('.');
                if (classes) {
                    selector += '.' + classes;
                }
            }

            // Check if current relative path is unique
            const currentPath = selector + (path.length ? ' > ' + path.join(' > ') : '');
            if (document.querySelectorAll(currentPath).length === 1) {
                path.unshift(selector);
                break;
            }

            // Fallback to nth-child for precision
            let sibling = current.previousElementSibling;
            let nth = 1;
            while (sibling) {
                nth++;
                sibling = sibling.previousElementSibling;
            }
            selector += `:nth-child(${nth})`;

            path.unshift(selector);
            current = current.parentNode;

            // Optimization: Don't go above body
            if (current.nodeName === 'BODY' || current.nodeName === 'HTML') break;
        }

        return path.join(' > ');
    }

    function getJsPath(el) {
        if (!(el instanceof Element)) return '';
        const path = [];
        let current = el;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
            let index = 0;
            let sibling = current.previousElementSibling;
            while (sibling) {
                if (sibling.nodeName === current.nodeName) index++;
                sibling = sibling.previousElementSibling;
            }
            let tagName = current.nodeName.toLowerCase();
            let pathPart = (index ? `${tagName}[${index}]` : tagName);
            path.unshift(pathPart);
            current = current.parentNode;
        }
        return path.join('/');
    }

    // GA4 Blocking Logic
    function toggleGA4Block(enabled) {
        if (enabled) {
            window.sessionStorage.setItem('swissKnifeBlockGA4', 'true');
        } else {
            window.sessionStorage.removeItem('swissKnifeBlockGA4');
        }
        window.location.reload();
    }

    // Auto-block check for GA4
    if (window.sessionStorage.getItem('swissKnifeBlockGA4') === 'true') {
        console.warn('[Swiss Knife] Blocking GA4 Hits (Simulation Mode)');

        // Block sendBeacon
        const originalSendBeacon = navigator.sendBeacon;
        navigator.sendBeacon = function (url, data) {
            if (url && (url.includes('google-analytics.com') || url.includes('analytics.google.com'))) {
                console.info('[Swiss Knife] Blocked GA4 Beacon:', url);
                return true;
            }
            return originalSendBeacon.apply(this, arguments);
        };

        // Block Image (Pixel)
        const OriginalImage = window.Image;
        window.Image = function () {
            const img = new OriginalImage();
            Object.defineProperty(img, 'src', {
                set: function (url) {
                    if (url && (url.includes('google-analytics.com') || url.includes('analytics.google.com'))) {
                        console.info('[Swiss Knife] Blocked GA4 Pixel:', url);
                        return;
                    }
                    this.setAttribute('src', url);
                },
                get: function () { return this.getAttribute('src'); }
            });
            return img;
        }

        // Block Fetch
        const originalFetch = window.fetch;
        window.fetch = function (input, init) {
            const url = typeof input === 'string' ? input : input?.url;
            if (url && (url.includes('google-analytics.com') || url.includes('analytics.google.com'))) {
                console.info('[Swiss Knife] Blocked GA4 Fetch:', url);
                return Promise.resolve(new Response(null, { status: 200 }));
            }
            return originalFetch.apply(this, arguments);
        };

        // Block XHR
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url) {
            if (url && (typeof url === 'string') && (url.includes('google-analytics.com') || url.includes('analytics.google.com'))) {
                this._blocked = true;
                console.info('[Swiss Knife] Blocked GA4 XHR:', url);
            }
            return originalOpen.apply(this, arguments);
        };

        const originalSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function () {
            if (this._blocked) {
                // Fake success
                Object.defineProperty(this, 'status', { get: () => 200 });
                Object.defineProperty(this, 'readyState', { get: () => 4 });
                this.dispatchEvent(new Event('load'));
                this.dispatchEvent(new Event('readystatechange'));
                return;
            }
            return originalSend.apply(this, arguments);
        };
    }






    function clearGoogleCookies() {
        const cookies = document.cookie.split(';');
        const googlePatterns = ['_ga', '_gid', '_gat', '_gac', '_gcl', '__utm', 'FPLC'];

        let count = 0;
        cookies.forEach(cookie => {
            const name = cookie.split('=')[0].trim();
            if (googlePatterns.some(p => name.startsWith(p))) {
                // Clear for main domain and subdomains
                const domains = window.location.hostname.split('.');
                let domain = domains.join('.');

                document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.' + domain;

                while (domains.length > 1) {
                    domain = domains.join('.');
                    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.' + domain;
                    domains.shift();
                }
                count++;
            }
        });
        return count;
    }

    // Auto-block check on init


    function getConsentState() {
        const state = {
            ad_storage: 'unknown',
            analytics_storage: 'unknown',
            ad_user_data: 'unknown',
            ad_personalization: 'unknown',
            functionality_storage: 'unknown',
            personalization_storage: 'unknown',
            security_storage: 'unknown'
        };

        // 1. Try internal GTM data (most accurate)
        if (window.google_tag_data?.ics?.entries) {
            const entries = window.google_tag_data.ics.entries;
            Object.keys(entries).forEach(key => {
                if (state.hasOwnProperty(key)) {
                    state[key] = entries[key].current === 'granted' ? 'granted' : 'denied';
                }
            });
        }

        // 2. Fallback to dataLayer scan
        const targetDlName = window.__swissKnife.dataLayerName || 'dataLayer';
        if (Array.isArray(window[targetDlName])) {
            window[targetDlName].forEach(item => {
                if (item['0'] === 'consent' && (item['1'] === 'default' || item['1'] === 'update')) {
                    const status = item['2'] || {};
                    Object.keys(status).forEach(key => {
                        if (state.hasOwnProperty(key)) {
                            // Only update if not already set by GTM API or if it's an 'update'
                            if (state[key] === 'unknown' || item['1'] === 'update') {
                                state[key] = status[key];
                            }
                        }
                    });
                }
            });
        }

        return state;
    }

    function getPerformanceMetrics() {
        if (!window.performance || !window.performance.getEntriesByType) return null;

        const resources = window.performance.getEntriesByType('resource');
        const gtmResources = resources.filter(r => r.name.includes('googletagmanager.com/gtm.js') || r.name.includes('googletagmanager.com/gtag/js'));

        let totalTime = 0;
        let totalSize = 0;

        gtmResources.forEach(r => {
            totalTime += r.duration;
            totalSize += r.transferSize || 0;
        });

        return {
            containerCount: gtmResources.length,
            loadTimeMs: Math.round(totalTime),
            sizeKb: Math.round(totalSize / 1024),
            impactScore: totalTime > 500 ? 'High' : (totalTime > 200 ? 'Medium' : 'Low')
        };
    }

    // Detect GTM containers
    function detectGTMContainers() {
        const containers = [];

        // Check for google_tag_manager object
        if (window.google_tag_manager) {
            for (const key in window.google_tag_manager) {
                if (key.startsWith('GTM-') || key.startsWith('G-')) {
                    const gtm = window.google_tag_manager[key];

                    // Try to find Client ID for GA4
                    let cid = null;
                    if (key.startsWith('G-')) {
                        try {
                            // Use gtag get if available
                            if (typeof window.gtag === 'function') {
                                window.gtag('get', key, 'client_id', (r) => cid = r);
                            }
                        } catch (e) { }
                    }

                    containers.push({
                        id: key,
                        type: key.startsWith('GTM-') ? 'GTM' : 'GA4',
                        dataLayer: gtm?.dataLayer?.name || 'dataLayer',
                        cid: cid
                    });
                }
            }
        }
        return containers;
    }

    // Inject GTM container
    function injectGTM(gtmId, options = {}) {
        const {
            initDataLayer = true,
            position = 'head',
            preview = false
        } = options;

        if (options.override) {
            removeGTM(gtmId);
        }

        if (initDataLayer) {
            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({
                'gtm.start': new Date().getTime(),
                event: 'gtm.js'
            });
        }

        const script = document.createElement('script');
        script.async = true;
        script.id = 'swiss-knife-gtm-' + gtmId;
        script.src = 'https://www.googletagmanager.com/gtm.js?id=' + gtmId;

        if (preview) {
            script.src += '&gtm_debug=x';
        }

        if (position === 'head') {
            document.head.insertBefore(script, document.head.firstChild);
        } else {
            document.body.insertBefore(script, document.body.firstChild);
        }

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
