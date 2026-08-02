/**
 * Tag Master - Page Script
 * Injected into the MAIN world to access window.dataLayer and Google objects
 */

(function () {
    'use strict';

    const TAG_MASTER_ID = 'tag-master-extension';

    // Store original dataLayer array
    window.__tagMaster = window.__tagMaster || {
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
                window.__tagMaster.dataLayerName = window.google_tag_manager[key].dataLayer.name || 'dataLayer';
                break;
            }
        }
    }

    const dlName = window.__tagMaster.dataLayerName;
    window[dlName] = window[dlName] || [];

    // Capture existing events
    if (!window.__tagMaster.initialized) {
        window[dlName].forEach((event, index) => {
            sendEvent('existing', event, index);
        });
        window.__tagMaster.initialized = true;
    }

    // Periodically re-check for DataLayer name changes (e.g. if GTM loads late)
    setInterval(() => {
        if (window.google_tag_manager) {
            for (const key in window.google_tag_manager) {
                if (key.startsWith('GTM-') && window.google_tag_manager[key].dataLayer) {
                    const newName = window.google_tag_manager[key].dataLayer.name;
                    if (newName && newName !== window.__tagMaster.dataLayerName) {
                        window.__tagMaster.dataLayerName = newName;
                    }
                }
            }
        }
    }, 5000);

    // Override push method
    if (!window.__tagMaster.originalPush && typeof window[dlName].push === 'function') {
        window.__tagMaster.originalPush = window[dlName].push.bind(window[dlName]);

        window[dlName].push = function (...args) {
            args.forEach((arg, index) => {
                sendEvent('push', arg, window[dlName].length + index);
            });
            return window.__tagMaster.originalPush(...args);
        };
    }

    // Send event to content script
    function sendEvent(type, data, index) {
        const eventName = data?.event || data?.['0'] || 'unknown';
        window.postMessage({
            source: TAG_MASTER_ID,
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

        // Check for GTM script tags (path-based detection, no domain reference)
        document.querySelectorAll('script[src*="gtm.js"]').forEach(script => {
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
        if (event.source !== window || event.data?.source !== TAG_MASTER_ID + '-command') {
            return;
        }

        const { type, payload } = event.data;
        const requestId = payload?.requestId;

        const reply = (msgType, data) => {
            window.postMessage({
                source: TAG_MASTER_ID,
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
                    const targetDlName = window.__tagMaster.dataLayerName || 'dataLayer';
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
                // Code execution feature disabled for Chrome Web Store compliance
                reply('CODE_RESULT', { success: false, error: 'Code execution is disabled for security reasons' });
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
                try {
                    const consentData = getConsentState();
                    reply('CONSENT_STATE', consentData);
                } catch (error) {
                    reply('CONSENT_STATE', { error: error.message });
                }
                break;

            case 'DETECT_TECH':
                reply('TECH_DETECTED', { technologies: detectTechnologies() });
                break;

            case 'GET_PERFORMANCE_METRICS':
                reply('PERFORMANCE_METRICS', getPerformanceMetrics());
                break;

            case 'GET_PREVIEW_STATUS':
                reply('PREVIEW_STATUS', getPreviewStatus());
                break;

            case 'SET_PAGE_STORAGE':
                // Some platforms read their debug flag from localStorage at
                // init, so it has to be written in the page's own context.
                try {
                    if (payload.value === null) {
                        window.localStorage.removeItem(payload.key);
                    } else {
                        window.localStorage.setItem(payload.key, payload.value);
                    }
                    reply('PAGE_STORAGE_SET', { success: true });
                } catch (error) {
                    reply('PAGE_STORAGE_SET', { success: false, error: error.message });
                }
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


        if (!highlightEl) {
            highlightEl = document.createElement('div');
            highlightEl.id = 'tag-master-selector-highlight';
            highlightEl.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;background:rgba(66,133,244,0.15);border:2px solid #4285f4;transition:all 0.05s ease;display:none;box-shadow: 0 0 0 9999px rgba(0,0,0,0.1);';
            document.body.appendChild(highlightEl);

            // Add a floating indicator
            const badge = document.createElement('div');
            badge.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:#4285f4;color:white;padding:8px 16px;border-radius:20px;font-family:sans-serif;font-size:12px;font-weight:bold;z-index:2147483647;box-shadow:0 4px 12px rgba(0,0,0,0.2);pointer-events:none;';
            badge.id = 'tag-master-selector-badge';
            badge.textContent = '🎯 Tag Master Selection Mode (ESC to cancel)';
            document.body.appendChild(badge);
        } else {
            document.getElementById('tag-master-selector-badge').style.display = 'block';
        }

        document.addEventListener('mouseover', onSelectorHover, true);
        document.addEventListener('click', onSelectorClick, true);
        document.addEventListener('keydown', onSelectorKey, true);
        document.body.style.cursor = 'crosshair';
    }

    function disableSelectorMode() {
        selectorActive = false;
        if (highlightEl) highlightEl.style.display = 'none';
        const badge = document.getElementById('tag-master-selector-badge');
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
            if (target === highlightEl || target.id === 'tag-master-selector-badge') return;

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

        // Climb to the actionable ancestor: clicking the icon/span inside a
        // button should target the button — that's what a GTM click trigger needs
        const raw = e.target;
        const target = (raw.closest && raw.closest('a, button, [role="button"], [onclick], input[type="submit"], input[type="button"], label, [data-gtm]')) || raw;

        const selector = getCssSelector(target);
        const jsPath = getJsPath(target);

        // Capture attributes for better trigger suggestions
        const attributes = {};
        for (const attr of target.attributes) {
            attributes[attr.name] = attr.value;
        }

        window.postMessage({
            source: TAG_MASTER_ID,
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
        if (e.key === 'Escape') {
            // Tell the sidepanel so its pending pick doesn't hang until timeout
            window.postMessage({
                source: TAG_MASTER_ID,
                type: 'SELECTOR_RESULT',
                payload: { requestId: lastRequestId, error: 'Selection cancelled' }
            }, '*');
            disableSelectorMode();
        }
    }

    function captureFromHighlight(requestId) {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            window.postMessage({
                source: TAG_MASTER_ID,
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
            source: TAG_MASTER_ID,
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

    // querySelectorAll throws on malformed selectors — never let that kill the
    // picker (Tailwind's "hover:bg-blue-500" style classes used to do exactly that)
    function matchCount(selector) {
        try {
            return document.querySelectorAll(selector).length;
        } catch (e) {
            return -1; // invalid selector
        }
    }

    const cssEscape = (v) => (window.CSS && CSS.escape) ? CSS.escape(v) : v.replace(/([^a-zA-Z0-9_-])/g, '\\$1');

    function getCssSelector(el) {
        if (!(el instanceof Element)) return '';

        // 1. Try ID if stable
        if (el.id && !/^\d|ember|j_|[a-f0-9]{8}/i.test(el.id)) {
            const idSel = `#${cssEscape(el.id)}`;
            if (matchCount(idSel) === 1) return idSel;
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
                if (val && !val.includes('{') && !val.includes('"')) { // Avoid templates & quote breakage
                    attrMatch = `[${attr}="${val}"]`;
                    break;
                }
            }

            if (attrMatch) {
                selector += attrMatch;
                // If this is unique enough, we can stop
                if (matchCount(selector) === 1) {
                    path.unshift(selector);
                    break;
                }
            } else if (current.id && !/^\d|ember|j_|[a-f0-9]{8}/i.test(current.id)) {
                selector = `#${cssEscape(current.id)}`;
                path.unshift(selector);
                break;
            } else if (current.classList.length > 0) {
                // Use the most meaningful classes (escaped — Tailwind variants
                // like "hover:bg-blue-500" or "md:w-1/2" need it)
                const classes = Array.from(current.classList)
                    .filter(c => !/^(hover|active|focus|valid|invalid|ng-|ember|j_)/.test(c))
                    .slice(0, 3)
                    .map(cssEscape)
                    .join('.');
                if (classes) {
                    selector += '.' + classes;
                }
            }

            // Check if current relative path is unique
            const currentPath = selector + (path.length ? ' > ' + path.join(' > ') : '');
            if (matchCount(currentPath) === 1) {
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
            if (!current || current.nodeName === 'BODY' || current.nodeName === 'HTML') break;
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
        try {
            if (enabled) {
                window.sessionStorage.setItem('tagMasterBlockGA4', 'true');
            } else {
                window.sessionStorage.removeItem('tagMasterBlockGA4');
            }
            window.location.reload();
        } catch (e) {
            // sessionStorage access failed
        }
    }

    // Auto-block check for GA4
    let isGA4Blocked = false;
    try {
        isGA4Blocked = window.sessionStorage.getItem('tagMasterBlockGA4') === 'true';
    } catch (e) {
        // sessionStorage access denied (sandboxed iframe, etc.)
    }

    if (isGA4Blocked) {
        // Block sendBeacon
        const originalSendBeacon = navigator.sendBeacon;
        navigator.sendBeacon = function (url, data) {
            if (url && (url.includes('google-analytics.com') || url.includes('analytics.google.com'))) {
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
                return Promise.resolve(new Response(null, { status: 200 }));
            }
            return originalFetch.apply(this, arguments);
        };

        // Block XHR
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url) {
            if (url && (typeof url === 'string') && (url.includes('google-analytics.com') || url.includes('analytics.google.com'))) {
                this._blocked = true;
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

        let hasDefault = false;
        let hasUpdate = false;
        let waitForUpdate = false;

        // 1. Try internal GTM data (most accurate for V2)
        try {
            if (window.google_tag_data?.ics?.entries) {
                const entries = window.google_tag_data.ics.entries;
                for (const key in entries) {
                    if (state.hasOwnProperty(key)) {
                        // entries[key] can be an object with 'current' or just the string status
                        const val = entries[key];
                        const status = (typeof val === 'object' && val.current) ? val.current : val;

                        if (status === 'granted' || status === 'denied') {
                            state[key] = status;
                        }
                    }
                }

                // Check if in wait_for_update mode
                if (window.google_tag_data.ics.usedDefault) {
                    hasDefault = true;
                }
                if (window.google_tag_data.ics.usedUpdate) {
                    hasUpdate = true;
                }
                // If only default is set and no update, we're in blocking mode
                waitForUpdate = hasDefault && !hasUpdate;
            }
        } catch (e) {
            // Error reading GTM consent
        }

        // 1.5. Check window.google_tag_manager internal structures
        try {
            if (window.google_tag_manager) {
                Object.keys(window.google_tag_manager).forEach(key => {
                    if (key.startsWith('GTM-')) {
                        const container = window.google_tag_manager[key];
                        // Some GTM versions store consent state differently
                        if (container.consent && typeof container.consent === 'object') {
                            Object.keys(container.consent).forEach(ckey => {
                                if (state.hasOwnProperty(ckey) && state[ckey] === 'unknown') {
                                    state[ckey] = container.consent[ckey] ? 'granted' : 'denied';
                                }
                            });
                        }
                    }
                });
            }
        } catch (e) { }

        // 2. Fallback to dataLayer scan (Chronological Replay)
        const targetDlName = window.__tagMaster.dataLayerName || 'dataLayer';
        if (Array.isArray(window[targetDlName])) {
            window[targetDlName].forEach(item => {
                // Check standard arguments object (arguments[0] === 'consent') or pushed object
                let command, type, status;

                if (item && item['0'] === 'consent') {
                    // Gtag style: gtag('consent', 'default'|'update', {...})
                    type = item['1'];
                    status = item['2'];
                } else if (item && item.event === 'consent_default' || item.event === 'consent_update') {
                    // Custom event style
                    type = item.event.replace('consent_', '');
                    status = item;
                }

                if (status && type === 'default') {
                    hasDefault = true;
                    Object.keys(status).forEach(key => {
                        if (state.hasOwnProperty(key)) {
                            state[key] = status[key];
                        }
                        // Check for wait_for_update flag
                        if (key === 'wait_for_update' && status[key]) {
                            waitForUpdate = true;
                        }
                    });
                }

                if (status && type === 'update') {
                    hasUpdate = true;
                    Object.keys(status).forEach(key => {
                        if (state.hasOwnProperty(key)) {
                            state[key] = status[key];
                        }
                    });
                }
            });
        }

        // 3. Add metadata
        state._metadata = {
            hasDefault: hasDefault,
            hasUpdate: hasUpdate,
            waitForUpdate: waitForUpdate,
            isBlocking: waitForUpdate || (hasDefault && !hasUpdate),
            timestamp: Date.now()
        };

        return state;
    }

    // ============================================
    // GTM Preview Mode Detection
    // ============================================
    function getPreviewStatus() {
        const signals = [];
        try {
            const params = new URLSearchParams(window.location.search);
            if (params.has('gtm_debug')) signals.push('gtm_debug URL param');
        } catch (e) { }
        try {
            if (document.cookie.indexOf('gtm_debug=') !== -1) signals.push('gtm_debug cookie');
        } catch (e) { }
        try {
            if (document.referrer && document.referrer.indexOf('tagassistant.google.com') !== -1) {
                signals.push('opened from Tag Assistant');
            }
        } catch (e) { }
        try {
            if (document.getElementById('__TAG_ASSISTANT_BADGE') ||
                document.querySelector('iframe[src*="tagassistant.google.com"]')) {
                signals.push('Tag Assistant badge on page');
            }
        } catch (e) { }
        try {
            // Tag Assistant's connected debug session exposes this hook
            if (window.__TAG_ASSISTANT_API || window.__TAG_ASSISTANT) signals.push('Tag Assistant API hook');
        } catch (e) { }

        return {
            active: signals.length > 0,
            signals: signals,
            url: window.location.href
        };
    }

    function getPerformanceMetrics() {
        if (!window.performance || !window.performance.getEntriesByType) return null;

        const resources = window.performance.getEntriesByType('resource');
        // Check for GTM resources (path-based detection)
        const gtmResources = resources.filter(r => r.name.includes('/gtm.js') || r.name.includes('/gtag/js'));

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

    // Inject GTM container from snippet
    function injectGTM(gtmId, options = {}) {
        const { snippet, preview = false } = options;

        if (options.override) {
            removeGTM(gtmId);
        }

        // If snippet is provided, inject it directly
        if (snippet) {
            try {
                // Extract inline scripts
                const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
                const matches = [...snippet.matchAll(scriptRegex)];

                for (const [index, match] of matches.entries()) {
                    const scriptContent = match[1].trim();
                    // Inline snippets only. A <script src="..."> would mean this
                    // extension loading code from a remote URL, which the store
                    // does not allow; the standard GTM snippet is inline and
                    // creates its own gtm.js tag from the page's own context.
                    const openingTag = match[0].match(/^<script[^>]*>/i)?.[0] || '';
                    if (/\ssrc\s*=/i.test(openingTag)) {
                        continue;
                    }
                    if (scriptContent) {
                        let modifiedContent = scriptContent;
                        if (preview && scriptContent.includes('gtm.js')) {
                            // Ask GTM for preview mode when the user wants it
                            modifiedContent = scriptContent.replace(
                                /(gtm\.js\?id='\+i\+dl)/g,
                                "$1+'&gtm_debug=x'"
                            );
                        }
                        const script = document.createElement('script');
                        script.textContent = modifiedContent;
                        script.id = `tag-master-gtm-${gtmId}-inline-${index}`;
                        document.head.appendChild(script);
                    }
                }

                // Extract and inject noscript tags
                const noscriptRegex = /<noscript[^>]*>([\s\S]*?)<\/noscript>/gi;
                const noscriptMatches = [...snippet.matchAll(noscriptRegex)];

                noscriptMatches.forEach((match, index) => {
                    const noscript = document.createElement('noscript');
                    // Safely create iframe for GTM noscript fallback
                    const iframeMatch = match[1].match(/src="([^"]+)"/);
                    if (iframeMatch && iframeMatch[1].includes('ns.html')) {
                        const iframe = document.createElement('iframe');
                        iframe.src = iframeMatch[1];
                        iframe.height = '0';
                        iframe.width = '0';
                        iframe.style.cssText = 'display:none;visibility:hidden';
                        noscript.appendChild(iframe);
                    }
                    noscript.id = `tag-master-gtm-noscript-${gtmId}-${index}`;
                    if (document.body) {
                        document.body.insertBefore(noscript, document.body.firstChild);
                    }
                });

                window.postMessage({
                    source: TAG_MASTER_ID,
                    type: 'GTM_INJECTED',
                    payload: { gtmId, success: true }
                }, '*');

            } catch (error) {
                window.postMessage({
                    source: TAG_MASTER_ID,
                    type: 'GTM_INJECTED',
                    payload: { gtmId, success: false, error: error.message }
                }, '*');
            }
        } else {
            window.postMessage({
                source: TAG_MASTER_ID,
                type: 'GTM_INJECTED',
                payload: { gtmId, success: false, error: 'No snippet provided' }
            }, '*');
        }
    }

    // Remove GTM container
    function removeGTM(gtmId) {
        const script = document.getElementById('tag-master-gtm-' + gtmId);
        const noscript = document.getElementById('tag-master-gtm-noscript-' + gtmId);

        if (script) script.remove();
        if (noscript) noscript.remove();

        // Note: Cannot fully remove GTM once loaded, would need page reload

        window.postMessage({
            source: TAG_MASTER_ID,
            type: 'GTM_REMOVED',
            payload: { gtmId, success: true }
        }, '*');
    }

    // ============================================
    // Technology Stack Detection
    // ============================================
    function detectTechnologies() {
        const detected = [];

        // Wait for DOM to be ready
        if (!document.body) {
            return detected;
        }

        const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src.toLowerCase());
        const allScripts = Array.from(document.querySelectorAll('script')).map(s => s.innerHTML || '');
        const links = Array.from(document.querySelectorAll('link[href]')).map(l => l.href.toLowerCase());
        // 200 KB window: on heavy e-commerce pages platform markers (generator
        // meta rendered late, inline config blobs) often sit past the first 50 KB
        const html = document.documentElement.outerHTML.substring(0, 200000).toLowerCase();

        const TECH_SIGNATURES = {
            // JavaScript Frameworks
            'React': {
                globals: ['React', '__REACT_DEVTOOLS_GLOBAL_HOOK__', '__REACT_ERROR_OVERLAY_GLOBAL_HOOK__'],
                selector: '[data-reactroot], [data-reactid]',
                category: 'JavaScript Framework',
                getVersion: () => window.React?.version
            },
            'Vue.js': {
                globals: ['Vue', '__VUE__', '__VUE_DEVTOOLS_GLOBAL_HOOK__'],
                selector: '[data-v-], [v-cloak]',
                category: 'JavaScript Framework',
                getVersion: () => window.Vue?.version
            },
            'Angular': {
                globals: ['ng', 'angular', 'getAllAngularRootElements'],
                selector: '[ng-version], [ng-app], [_ngcontent], [_nghost]',
                category: 'JavaScript Framework',
                getVersion: () => document.querySelector('[ng-version]')?.getAttribute('ng-version')
            },
            'Next.js': {
                globals: ['__NEXT_DATA__', '__NEXT_LOADED_PAGES__'],
                selector: '#__next',
                category: 'JavaScript Framework',
                getVersion: () => window.__NEXT_DATA__?.nextExport ? 'SSG' : (window.__NEXT_DATA__ ? 'SSR' : null)
            },
            'Nuxt.js': {
                globals: ['__NUXT__', '$nuxt', '__NUXT_PATHS__'],
                category: 'JavaScript Framework',
            },
            'Gatsby': {
                globals: ['___gatsby', '___GATSBY_INITIAL_RENDER_COMPLETE'],
                selector: '#___gatsby',
                category: 'JavaScript Framework',
            },
            'jQuery': {
                globals: ['jQuery', 'jquery'],
                category: 'JavaScript Library',
                getVersion: () => window.jQuery?.fn?.jquery || window.jQuery?.prototype?.jquery
            },
            'Svelte': {
                globals: ['__svelte', '__SVELTE_HMR'],
                category: 'JavaScript Framework',
            },
            'Alpine.js': {
                globals: ['Alpine'],
                selector: '[x-data], [x-bind], [x-on]',
                category: 'JavaScript Framework',
                getVersion: () => window.Alpine?.version
            },
            'Ember.js': {
                globals: ['Ember', 'Em'],
                selector: '.ember-view, .ember-application',
                category: 'JavaScript Framework',
                getVersion: () => window.Ember?.VERSION
            },
            'Backbone.js': {
                globals: ['Backbone'],
                category: 'JavaScript Library',
                getVersion: () => window.Backbone?.VERSION
            },
            'Lodash': {
                globals: ['_'],
                category: 'JavaScript Library',
                getVersion: () => window._?.VERSION
            },
            'Axios': {
                globals: ['axios'],
                category: 'JavaScript Library',
                getVersion: () => window.axios?.VERSION
            },
            'Moment.js': {
                globals: ['moment'],
                category: 'JavaScript Library',
                getVersion: () => window.moment?.version
            },
            'GSAP': {
                globals: ['gsap', 'TweenMax', 'TweenLite'],
                category: 'JavaScript Library',
                getVersion: () => window.gsap?.version
            },
            'Three.js': {
                globals: ['THREE'],
                category: 'JavaScript Library',
                getVersion: () => window.THREE?.REVISION
            },
            'D3.js': {
                globals: ['d3'],
                category: 'JavaScript Library',
                getVersion: () => window.d3?.version
            },

            // CMS
            'WordPress': {
                selector: 'link[href*="wp-content"], link[href*="wp-includes"], meta[name="generator"][content*="WordPress"]',
                scripts: ['wp-content', 'wp-includes', 'wp-json'],
                category: 'CMS',
            },
            'Drupal': {
                globals: ['Drupal'],
                selector: 'meta[name="generator"][content*="Drupal"]',
                scripts: ['drupal.js'],
                category: 'CMS',
                getVersion: () => window.Drupal?.settings?.version
            },
            'Joomla': {
                selector: 'meta[name="generator"][content*="Joomla"]',
                scripts: ['joomla'],
                category: 'CMS',
            },
            'Shopify': {
                globals: ['Shopify', 'ShopifyAnalytics'],
                selector: 'meta[name="shopify-digital-wallet"], link[href*="cdn.shopify.com"]',
                scripts: ['cdn.shopify.com'],
                category: 'E-commerce',
                getVersion: () => window.Shopify?.theme?.name,
                getDetails: () => window.Shopify?.shop
            },
            'Webflow': {
                globals: ['Webflow'],
                selector: 'html[data-wf-site], .w-webflow-badge',
                category: 'CMS',
            },
            'Wix': {
                scripts: ['static.wixstatic.com', 'static.parastorage.com'],
                selector: 'meta[name="generator"][content*="Wix"]',
                category: 'CMS',
            },
            'Squarespace': {
                globals: ['Static', 'Squarespace'],
                selector: 'link[href*="squarespace"]',
                category: 'CMS',
            },
            'Ghost': {
                selector: 'meta[name="generator"][content*="Ghost"]',
                category: 'CMS',
            },
            'Contentful': {
                globals: ['contentful'],
                scripts: ['contentful'],
                category: 'CMS',
            },

            // Analytics & Tag Management
            'Google Tag Manager': {
                globals: ['google_tag_manager', 'google_tag_data'],
                scripts: ['gtm.js'],
                category: 'Tag Management',
                getDetails: () => {
                    const ids = Object.keys(window.google_tag_manager || {}).filter(k => k.startsWith('GTM-'));
                    return ids.length ? ids.join(', ') : null;
                }
            },
            'Google Analytics 4': {
                globals: ['gtag', 'google_tag_data'],
                scripts: ['gtag/js'],
                category: 'Analytics',
                getDetails: () => {
                    const gtagMatch = html.match(/gtag\(['"]config['"],\s*['"](G-[A-Z0-9]+)['"]/);
                    return gtagMatch ? gtagMatch[1] : null;
                }
            },
            'Google Analytics (UA)': {
                globals: ['ga', 'GoogleAnalyticsObject'],
                scripts: ['google-analytics.com/analytics.js', 'google-analytics.com/ga.js'],
                category: 'Analytics',
                getDetails: () => {
                    if (window.ga?.getAll) {
                        const trackers = window.ga.getAll();
                        return trackers.map(t => t.get('trackingId')).join(', ');
                    }
                    return null;
                }
            },
            'Facebook Pixel': {
                globals: ['fbq', '_fbq'],
                scripts: ['connect.facebook.net/en_US/fbevents.js'],
                category: 'Marketing',
                getDetails: () => window.fbq?.getState?.()?.pixelIDs?.join(', ')
            },
            'Meta Pixel': {
                globals: ['fbq'],
                scripts: ['connect.facebook.net'],
                category: 'Marketing',
            },
            'Hotjar': {
                globals: ['hj', 'hjSiteSettings', '_hjSettings'],
                scripts: ['static.hotjar.com'],
                category: 'Analytics',
                getDetails: () => window._hjSettings?.hjid
            },
            'Mixpanel': {
                globals: ['mixpanel'],
                scripts: ['cdn.mxpnl.com', 'mixpanel.com'],
                category: 'Analytics',
            },
            'Segment': {
                globals: ['analytics'],
                scripts: ['cdn.segment.com', 'segment.io'],
                category: 'Analytics',
            },
            'Amplitude': {
                globals: ['amplitude'],
                scripts: ['cdn.amplitude.com'],
                category: 'Analytics',
            },
            'Heap': {
                globals: ['heap'],
                scripts: ['heap-analytics.com', 'heapanalytics.com'],
                category: 'Analytics',
            },
            'Clarity': {
                globals: ['clarity'],
                scripts: ['clarity.ms'],
                category: 'Analytics',
            },
            'FullStory': {
                globals: ['FS', '_fs_host'],
                scripts: ['fullstory.com'],
                category: 'Analytics',
            },
            'LogRocket': {
                globals: ['LogRocket', '_lr_loaded'],
                scripts: ['cdn.logrocket.io', 'logrocket.com'],
                category: 'Analytics',
            },
            'Pendo': {
                globals: ['pendo'],
                scripts: ['pendo.io', 'cdn.pendo.io'],
                category: 'Analytics',
            },
            'Mouseflow': {
                globals: ['mouseflow', '_mfq'],
                scripts: ['mouseflow.com'],
                category: 'Analytics',
            },
            'Lucky Orange': {
                globals: ['__lo_site_id'],
                scripts: ['luckyorange.com'],
                category: 'Analytics',
            },
            'Plausible': {
                scripts: ['plausible.io'],
                category: 'Analytics',
            },
            'Matomo': {
                globals: ['_paq', 'Matomo', 'Piwik'],
                scripts: ['matomo', 'piwik'],
                category: 'Analytics',
            },

            // Advertising
            'Google Ads': {
                globals: ['google_trackConversion', 'gtag_report_conversion'],
                scripts: ['googleadservices.com', 'googlesyndication.com/pagead'],
                category: 'Advertising',
            },
            'Google AdSense': {
                globals: ['adsbygoogle'],
                scripts: ['pagead2.googlesyndication.com/pagead/js/adsbygoogle'],
                selector: 'ins.adsbygoogle',
                category: 'Advertising',
            },
            'LinkedIn Insight': {
                globals: ['_linkedin_data_partner_ids', 'lintrk'],
                scripts: ['snap.licdn.com'],
                category: 'Marketing',
            },
            'Twitter Pixel': {
                globals: ['twq'],
                scripts: ['static.ads-twitter.com'],
                category: 'Marketing',
            },
            'TikTok Pixel': {
                globals: ['ttq'],
                scripts: ['analytics.tiktok.com'],
                category: 'Marketing',
            },
            'Pinterest Tag': {
                globals: ['pintrk'],
                scripts: ['s.pinimg.com/ct'],
                category: 'Marketing',
            },
            'Snapchat Pixel': {
                globals: ['snaptr'],
                scripts: ['sc-static.net'],
                category: 'Marketing',
            },
            'Reddit Pixel': {
                globals: ['rdt'],
                scripts: ['reddit.com/pixel'],
                category: 'Marketing',
            },
            'Quora Pixel': {
                globals: ['qp'],
                scripts: ['quora.com/_/ad'],
                category: 'Marketing',
            },
            'Criteo': {
                globals: ['criteo_q'],
                scripts: ['static.criteo.net'],
                category: 'Advertising',
            },
            'Taboola': {
                globals: ['_tfa'],
                scripts: ['cdn.taboola.com'],
                category: 'Advertising',
            },
            'Outbrain': {
                globals: ['OB_ADV_ID'],
                scripts: ['outbrain.com'],
                category: 'Advertising',
            },

            // E-commerce
            'WooCommerce': {
                globals: ['woocommerce_params', 'wc_add_to_cart_params'],
                selector: '.woocommerce, link[href*="woocommerce"]',
                category: 'E-commerce',
            },
            'BigCommerce': {
                globals: ['BCData', 'stencilBootstrap'],
                category: 'E-commerce',
            },
            'Magento': {
                globals: ['Mage', 'mage'],
                selector: 'script[src*="mage"], .cms-index-index',
                category: 'E-commerce',
            },
            'PrestaShop': {
                globals: ['prestashop'],
                selector: 'meta[name="generator"][content*="PrestaShop"]',
                category: 'E-commerce',
            },
            'Salesforce Commerce': {
                globals: ['dw'],
                scripts: ['demandware.static'],
                category: 'E-commerce',
            },
            'T-Soft': {
                globals: ['TSoftBasket', 'TSoft', 'TSoftParams', 'TSoftObject', 'design_path', 'sub_folder'],
                scripts: ['tsoft.com.tr', 'tsoftcdn.com', 't-soft.com.tr', '/Theme/'],
                selector: 'meta[name="generator"][content*="T-Soft"], meta[name="generator"][content*="TSoft"], meta[name="author"][content*="T-Soft"], link[href*="tsoft"]',
                category: 'E-commerce',
            },
            'İdeaSoft': {
                globals: ['IdeasoftData', 'ideaJS', 'IdeaCart'],
                scripts: ['ideasoft.com.tr', 'mncdn.com/ideasoft', 'ideacdn.net'],
                selector: 'meta[name="generator"][content*="ideasoft" i], link[href*="ideacdn.net"]',
                category: 'E-commerce',
            },
            'Ticimax': {
                globals: ['Ticimax', 'TicimaxBasket', 'ticimax'],
                scripts: ['ticimax.com', 'ticimax.cloud', 'ticimaxcdn.com'],
                selector: 'meta[name="generator"][content*="Ticimax" i], link[href*="ticimax"]',
                category: 'E-commerce',
            },
            'ikas': {
                globals: ['ikas'],
                scripts: ['cdn.myikas.com', 'ikas.com'],
                selector: 'meta[name="generator"][content*="ikas" i]',
                category: 'E-commerce',
            },
            'N11': {
                scripts: ['n11.com', 'n11cdn.com'],
                selector: 'meta[property="og:site_name"][content*="n11"]',
                category: 'E-commerce',
            },
            'Hepsiburada': {
                scripts: ['hepsiburada.com', 'hepsicdn.com'],
                selector: 'meta[property="og:site_name"][content*="Hepsiburada"]',
                category: 'E-commerce',
            },
            'Gittigidiyor': {
                scripts: ['gittigidiyor.com', 'ggpht.com'],
                selector: 'meta[property="og:site_name"][content*="GittiGidiyor"]',
                category: 'E-commerce',
            },
            'OpenCart': {
                scripts: ['catalog/view/javascript'],
                selector: 'meta[name="generator"][content*="OpenCart"]',
                category: 'E-commerce',
            },
            'Klaviyo': {
                globals: ['klaviyo', '_learnq'],
                scripts: ['static.klaviyo.com'],
                category: 'Marketing',
            },

            // Customer Support
            'Intercom': {
                globals: ['Intercom', 'intercomSettings'],
                scripts: ['widget.intercom.io'],
                category: 'Customer Support',
            },
            'Zendesk': {
                globals: ['zE', 'zESettings', '$zopim'],
                scripts: ['static.zdassets.com', 'zopim.com'],
                category: 'Customer Support',
            },
            'Drift': {
                globals: ['drift', 'driftt'],
                scripts: ['js.driftt.com'],
                category: 'Customer Support',
            },
            'Crisp': {
                globals: ['$crisp', 'CRISP_WEBSITE_ID'],
                scripts: ['client.crisp.chat'],
                category: 'Customer Support',
            },
            'LiveChat': {
                globals: ['LiveChatWidget', '__lc'],
                scripts: ['cdn.livechatinc.com'],
                category: 'Customer Support',
            },
            'Tawk.to': {
                globals: ['Tawk_API', 'Tawk_LoadStart'],
                scripts: ['embed.tawk.to'],
                category: 'Customer Support',
            },
            'HubSpot': {
                globals: ['HubSpotConversations', '_hsq', 'hubspot'],
                scripts: ['js.hs-scripts.com', 'js.hubspot.com', 'hscta.net'],
                category: 'Marketing',
            },
            'Freshdesk': {
                globals: ['FreshWidget'],
                scripts: ['widget.freshworks.com'],
                category: 'Customer Support',
            },
            'Olark': {
                globals: ['olark'],
                scripts: ['static.olark.com'],
                category: 'Customer Support',
            },

            // CDN & Performance
            'Cloudflare': {
                scripts: ['cdnjs.cloudflare.com', 'cloudflare.com'],
                selector: 'script[src*="cloudflare"]',
                category: 'CDN',
            },
            'Fastly': {
                scripts: ['fastly.net'],
                category: 'CDN',
            },
            'Akamai': {
                scripts: ['akamai.net', 'akamaized.net', 'akstat.io'],
                category: 'CDN',
            },
            'jsDelivr': {
                scripts: ['cdn.jsdelivr.net'],
                category: 'CDN',
            },
            'unpkg': {
                scripts: ['unpkg.com'],
                category: 'CDN',
            },
            'New Relic': {
                globals: ['newrelic', 'NREUM'],
                scripts: ['js-agent.newrelic.com'],
                category: 'Analytics',
            },
            'Datadog RUM': {
                globals: ['DD_RUM'],
                scripts: ['datadoghq.com'],
                category: 'Analytics',
            },
            'Sentry': {
                globals: ['Sentry', '__SENTRY__'],
                scripts: ['browser.sentry-cdn.com', 'sentry.io'],
                category: 'Analytics',
            },
            'Bugsnag': {
                globals: ['bugsnag', 'Bugsnag'],
                scripts: ['bugsnag.com'],
                category: 'Analytics',
            },

            // A/B Testing
            'Optimizely': {
                globals: ['optimizely', 'optimizelyEdge'],
                scripts: ['cdn.optimizely.com'],
                category: 'A/B Testing',
            },
            'VWO': {
                globals: ['_vwo_code', 'VWO', '_vis_opt'],
                scripts: ['dev.visualwebsiteoptimizer.com'],
                category: 'A/B Testing',
            },
            'Google Optimize': {
                globals: ['google_optimize', 'dataLayer'],
                scripts: ['googleoptimize.com'],
                category: 'A/B Testing',
            },
            'AB Tasty': {
                globals: ['ABTasty'],
                scripts: ['abtasty.com'],
                category: 'A/B Testing',
            },
            'LaunchDarkly': {
                globals: ['LDClient'],
                scripts: ['launchdarkly.com'],
                category: 'A/B Testing',
            },
            'Split.io': {
                globals: ['splitio'],
                scripts: ['split.io'],
                category: 'A/B Testing',
            },

            // Payment
            'Stripe': {
                globals: ['Stripe'],
                scripts: ['js.stripe.com'],
                category: 'Payment',
            },
            'PayPal': {
                globals: ['paypal', 'PAYPAL'],
                scripts: ['paypal.com/sdk', 'paypalobjects.com'],
                category: 'Payment',
            },
            'Braintree': {
                globals: ['braintree'],
                scripts: ['js.braintreegateway.com'],
                category: 'Payment',
            },
            'Square': {
                globals: ['SqPaymentForm', 'Square'],
                scripts: ['squareup.com', 'square.com'],
                category: 'Payment',
            },
            'Klarna': {
                globals: ['Klarna', 'KlarnaOnsiteService'],
                scripts: ['klarna.com'],
                category: 'Payment',
            },
            'Afterpay': {
                globals: ['AfterPay', 'Afterpay'],
                scripts: ['afterpay.com', 'squarecdn.com/afterpay'],
                category: 'Payment',
            },

            // Security
            'reCAPTCHA': {
                globals: ['grecaptcha'],
                scripts: ['google.com/recaptcha', 'gstatic.com/recaptcha'],
                category: 'Security',
            },
            'hCaptcha': {
                globals: ['hcaptcha'],
                scripts: ['hcaptcha.com'],
                category: 'Security',
            },
            'Cloudflare Turnstile': {
                globals: ['turnstile'],
                scripts: ['challenges.cloudflare.com/turnstile'],
                category: 'Security',
            },

            // Fonts
            'Google Fonts': {
                selector: 'link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]',
                scripts: ['fonts.googleapis.com'],
                category: 'Fonts',
            },
            'Adobe Fonts': {
                globals: ['Typekit'],
                scripts: ['use.typekit.net'],
                category: 'Fonts',
            },
            'Font Awesome': {
                selector: 'link[href*="fontawesome"], .fa, .fas, .fab, .far',
                scripts: ['fontawesome'],
                category: 'Fonts',
            },

            // CSS Frameworks
            'Bootstrap': {
                selector: 'link[href*="bootstrap"]',
                scripts: ['bootstrap'],
                category: 'CSS Framework',
                getVersion: () => window.bootstrap?.Modal?.VERSION
            },
            'Tailwind CSS': {
                selector: '[class*="tw-"], .container, .flex, .grid, .bg-',
                category: 'CSS Framework',
            },
            'Bulma': {
                selector: 'link[href*="bulma"]',
                category: 'CSS Framework',
            },
            'Foundation': {
                globals: ['Foundation'],
                selector: 'link[href*="foundation"]',
                category: 'CSS Framework',
            },
            'Material UI': {
                selector: '[class*="MuiBox"], [class*="MuiButton"], [class*="makeStyles"]',
                category: 'CSS Framework',
            },
            'Chakra UI': {
                selector: '[class*="chakra-"]',
                category: 'CSS Framework',
            },
            'Ant Design': {
                selector: '[class*="ant-"], .antd',
                category: 'CSS Framework',
            },
            'Semantic UI': {
                selector: 'link[href*="semantic"], .ui.container, .ui.button',
                scripts: ['semantic.min.js', 'semantic-ui'],
                category: 'CSS Framework',
            },

            // JavaScript Frameworks & Libraries
            'React': {
                globals: ['__REACT_DEVTOOLS_GLOBAL_HOOK__', '__REACT_ERROR_OVERLAY_GLOBAL_HOOK__'],
                selector: '[data-reactroot], [data-reactid], #__next',
                category: 'JavaScript Framework',
                getVersion: () => {
                    const el = document.querySelector('[data-reactroot]');
                    if (el?._reactRootContainer) return 'v18+';
                    return null;
                }
            },
            'Next.js': {
                globals: ['__NEXT_DATA__', '__next'],
                selector: '#__next, script#__NEXT_DATA__',
                category: 'JavaScript Framework',
                getVersion: () => window.__NEXT_DATA__?.buildId ? 'detected' : null
            },
            'Vue.js': {
                globals: ['__VUE__', 'Vue', '__vue__'],
                selector: '[data-v-], #app[data-v-app], [data-server-rendered]',
                category: 'JavaScript Framework',
                getVersion: () => window.Vue?.version
            },
            'Nuxt.js': {
                globals: ['__NUXT__', '$nuxt'],
                selector: '#__nuxt, #__layout',
                category: 'JavaScript Framework',
            },
            'Angular': {
                globals: ['ng'],
                selector: '[ng-app], [data-ng-app], [ng-version], app-root',
                category: 'JavaScript Framework',
                getVersion: () => {
                    const el = document.querySelector('[ng-version]');
                    return el?.getAttribute('ng-version') || null;
                }
            },
            'Svelte': {
                selector: '[class*="svelte-"]',
                category: 'JavaScript Framework',
            },
            'SvelteKit': {
                globals: ['__sveltekit_data'],
                selector: '[data-sveltekit-preload-data]',
                category: 'JavaScript Framework',
            },
            'Gatsby': {
                globals: ['___gatsby', '___GATSBY_INITIAL_RENDER_COMPLETE'],
                selector: '#___gatsby, #gatsby-focus-wrapper',
                category: 'JavaScript Framework',
            },
            'Astro': {
                selector: '[data-astro-cid], astro-island, [class*="astro-"]',
                category: 'JavaScript Framework',
            },
            'Remix': {
                globals: ['__remixManifest', '__remixContext'],
                category: 'JavaScript Framework',
            },
            'Ember.js': {
                globals: ['Ember', 'Em'],
                selector: '.ember-view, .ember-application',
                category: 'JavaScript Framework',
                getVersion: () => window.Ember?.VERSION
            },
            'Backbone.js': {
                globals: ['Backbone'],
                category: 'JavaScript Library',
                getVersion: () => window.Backbone?.VERSION
            },
            'Alpine.js': {
                globals: ['Alpine'],
                selector: '[x-data], [x-bind], [x-on]',
                category: 'JavaScript Framework',
            },
            'HTMX': {
                selector: '[hx-get], [hx-post], [hx-trigger], [data-hx-get]',
                scripts: ['htmx.org', 'htmx.min.js'],
                category: 'JavaScript Library',
            },
            'jQuery': {
                globals: ['jQuery', '$'],
                category: 'JavaScript Library',
                getVersion: () => window.jQuery?.fn?.jquery
            },
            'jQuery UI': {
                globals: ['jQuery'],
                selector: 'link[href*="jquery-ui"], .ui-widget',
                scripts: ['jquery-ui'],
                category: 'JavaScript Library',
                getVersion: () => window.jQuery?.ui?.version
            },
            'Lodash': {
                globals: ['_'],
                scripts: ['lodash'],
                category: 'JavaScript Library',
                getVersion: () => window._?.VERSION
            },
            'Underscore.js': {
                globals: ['_'],
                scripts: ['underscore'],
                category: 'JavaScript Library',
            },
            'Moment.js': {
                globals: ['moment'],
                scripts: ['moment.min.js', 'moment-with-locales'],
                category: 'JavaScript Library',
            },
            'Three.js': {
                globals: ['THREE'],
                scripts: ['three.min.js', 'three.module'],
                category: 'JavaScript Library',
            },
            'GSAP': {
                globals: ['gsap', 'TweenMax', 'TweenLite', 'TimelineMax'],
                scripts: ['gsap', 'greensock'],
                category: 'JavaScript Library',
            },
            'Lottie': {
                globals: ['lottie', 'bodymovin'],
                scripts: ['lottie', 'bodymovin'],
                category: 'JavaScript Library',
            },
            'Socket.io': {
                globals: ['io'],
                scripts: ['socket.io'],
                category: 'JavaScript Library',
            },
            'Axios': {
                globals: ['axios'],
                scripts: ['axios.min.js', 'cdn.jsdelivr.net/npm/axios'],
                category: 'JavaScript Library',
            },
            'D3.js': {
                globals: ['d3'],
                scripts: ['d3.min.js', 'd3js.org'],
                category: 'JavaScript Library',
            },
            'Chart.js': {
                globals: ['Chart'],
                scripts: ['chart.js', 'chart.min.js', 'chartjs'],
                category: 'JavaScript Library',
            },
            'Highcharts': {
                globals: ['Highcharts'],
                scripts: ['highcharts.com', 'highcharts.js'],
                category: 'JavaScript Library',
            },
            'Swiper': {
                globals: ['Swiper'],
                selector: '.swiper, .swiper-container',
                scripts: ['swiper-bundle', 'swiper.min'],
                category: 'JavaScript Library',
            },
            'Slick Slider': {
                selector: '.slick-slider, .slick-initialized',
                scripts: ['slick.min.js', 'slick.js'],
                category: 'JavaScript Library',
            },
            'Owl Carousel': {
                selector: '.owl-carousel',
                scripts: ['owl.carousel'],
                category: 'JavaScript Library',
            },
            'Lightbox': {
                globals: ['Lightbox', 'lightGallery', 'GLightbox'],
                selector: '[data-lightbox], [data-fancybox]',
                scripts: ['lightbox', 'fancybox'],
                category: 'JavaScript Library',
            },
            'Lazy Load': {
                selector: '[loading="lazy"], .lazyload, .lazy, [data-src]',
                scripts: ['lazysizes', 'lazyload'],
                category: 'JavaScript Library',
            },

            // CMS (additions)
            'Ghost': {
                selector: 'meta[name="generator"][content*="Ghost"]',
                globals: ['ghost'],
                category: 'CMS',
            },
            'Webflow': {
                globals: ['Webflow'],
                selector: 'html[data-wf-site], .w-webflow-badge',
                scripts: ['webflow.js'],
                category: 'CMS',
            },
            'Wix': {
                globals: ['wixBiSession'],
                selector: 'meta[name="generator"][content*="Wix"]',
                scripts: ['static.parastorage.com', 'wix.com'],
                category: 'CMS',
            },
            'Squarespace': {
                globals: ['Static'],
                selector: 'meta[name="generator"][content*="Squarespace"]',
                scripts: ['squarespace.com'],
                category: 'CMS',
            },
            'Weebly': {
                globals: ['Weebly'],
                selector: 'meta[name="generator"][content*="Weebly"]',
                category: 'CMS',
            },
            'Hugo': {
                selector: 'meta[name="generator"][content*="Hugo"]',
                category: 'CMS',
            },
            'Jekyll': {
                selector: 'meta[name="generator"][content*="Jekyll"]',
                category: 'CMS',
            },
            'Contentful': {
                scripts: ['contentful.com', 'ctfassets.net'],
                category: 'CMS',
            },
            'Strapi': {
                scripts: ['strapi'],
                category: 'CMS',
            },
            'Craft CMS': {
                selector: 'meta[name="generator"][content*="Craft CMS"]',
                category: 'CMS',
            },
            'Typo3': {
                selector: 'meta[name="generator"][content*="TYPO3"]',
                globals: ['TYPO3'],
                category: 'CMS',
            },
            'Blogger': {
                selector: 'meta[name="generator"][content*="Blogger"]',
                scripts: ['blogger.com', 'blogspot.com'],
                category: 'CMS',
            },

            // E-commerce (additions)
            'Ecwid': {
                globals: ['Ecwid', 'ecwid_productBrowser'],
                scripts: ['app.ecwid.com'],
                category: 'E-commerce',
            },
            'Snipcart': {
                globals: ['Snipcart'],
                scripts: ['snipcart.com'],
                selector: '#snipcart',
                category: 'E-commerce',
            },
            'Medusa': {
                scripts: ['medusajs.com'],
                category: 'E-commerce',
            },

            // Marketing (additions)
            'Mailchimp': {
                globals: ['mc4wp'],
                scripts: ['chimpstatic.com', 'list-manage.com', 'mailchimp.com'],
                selector: '.mc4wp-form, #mc_embed_signup',
                category: 'Marketing',
            },
            'SendGrid': {
                scripts: ['sendgrid.com', 'sendgrid.net'],
                category: 'Marketing',
            },
            'ActiveCampaign': {
                globals: ['_actm'],
                scripts: ['activehosted.com', 'activecampaign.com'],
                category: 'Marketing',
            },
            'Drip': {
                globals: ['_dcq', '_dcs'],
                scripts: ['getdrip.com'],
                category: 'Marketing',
            },
            'ConvertKit': {
                scripts: ['convertkit.com'],
                selector: 'form[data-uid], [data-formkit]',
                category: 'Marketing',
            },
            'Braze': {
                globals: ['appboy', 'braze'],
                scripts: ['braze.com', 'appboy.com'],
                category: 'Marketing',
            },
            'Customer.io': {
                globals: ['_cio'],
                scripts: ['customer.io'],
                category: 'Marketing',
            },
            'Iterable': {
                globals: ['_iaq'],
                scripts: ['iterable.com'],
                category: 'Marketing',
            },
            'Marketo': {
                globals: ['Munchkin', 'mktoMunchkin'],
                scripts: ['munchkin.marketo.net'],
                category: 'Marketing',
            },
            'Pardot': {
                globals: ['pi', 'piAId'],
                scripts: ['pi.pardot.com', 'pardot.com'],
                category: 'Marketing',
            },
            'Salesforce': {
                globals: ['SfdcApp'],
                scripts: ['force.com', 'salesforce.com'],
                category: 'Marketing',
            },
            'Google Campaign Manager': {
                scripts: ['doubleclick.net'],
                category: 'Marketing',
            },

            // Consent Management
            'OneTrust': {
                globals: ['OneTrust', 'Optanon', 'OptanonWrapper'],
                scripts: ['cdn.cookielaw.org', 'onetrust.com'],
                category: 'Consent Management',
            },
            'Cookiebot': {
                globals: ['Cookiebot', 'CookieConsent'],
                scripts: ['cookiebot.com', 'consent.cookiebot.com'],
                category: 'Consent Management',
            },
            'Cookie Notice': {
                selector: '#cookie-notice, .cookie-notice, #cookie-law-info-bar',
                globals: ['cookie_notice_js'],
                category: 'Consent Management',
            },
            'Quantcast Choice': {
                globals: ['__cmp', '__tcfapi'],
                scripts: ['quantcast.mgr.consensu.org'],
                category: 'Consent Management',
            },
            'TrustArc': {
                globals: ['truste'],
                scripts: ['consent.trustarc.com'],
                category: 'Consent Management',
            },
            'Iubenda': {
                globals: ['_iub'],
                scripts: ['iubenda.com'],
                category: 'Consent Management',
            },
            'Cookie Script': {
                scripts: ['cookie-script.com'],
                selector: '#cookiescript_injected',
                category: 'Consent Management',
            },
            'Complianz': {
                selector: '#cmplz-cookiebanner-container',
                scripts: ['complianz'],
                category: 'Consent Management',
            },
            'Osano': {
                globals: ['Osano'],
                scripts: ['cmp.osano.com'],
                category: 'Consent Management',
            },
            'Didomi': {
                globals: ['Didomi', 'didomiOnReady'],
                scripts: ['sdk.privacy-center.org'],
                category: 'Consent Management',
            },
            'Usercentrics': {
                globals: ['UC_UI'],
                scripts: ['usercentrics.eu'],
                category: 'Consent Management',
            },

            // Hosting & Infrastructure
            'Vercel': {
                selector: 'meta[name="next-head-count"]',
                scripts: ['vercel.app', 'vercel.com', '_vercel'],
                category: 'Hosting',
            },
            'Netlify': {
                scripts: ['netlify.app', 'netlify.com'],
                selector: 'meta[name="generator"][content*="Netlify"]',
                category: 'Hosting',
            },
            'AWS': {
                scripts: ['amazonaws.com', 'aws.amazon.com', 'cloudfront.net'],
                category: 'Hosting',
            },
            'Google Cloud': {
                scripts: ['storage.googleapis.com'],
                category: 'Hosting',
            },
            'Azure': {
                scripts: ['azureedge.net', 'azure.com', 'azurewebsites.net'],
                category: 'Hosting',
            },
            'Firebase': {
                globals: ['firebase'],
                scripts: ['firebaseapp.com', 'firebase.google.com', 'gstatic.com/firebasejs'],
                category: 'Hosting',
            },
            'Supabase': {
                scripts: ['supabase.co', 'supabase.io'],
                category: 'Hosting',
            },

            // PWA & Performance
            'Progressive Web App': {
                selector: 'link[rel="manifest"]',
                category: 'PWA',
            },
            'Service Worker': {
                category: 'PWA',
                globals: ['navigator'],
                getDetails: () => {
                    if ('serviceWorker' in navigator) {
                        return navigator.serviceWorker.controller ? 'Active' : 'Registered';
                    }
                    return null;
                }
            },
            'AMP': {
                selector: 'html[amp], html[⚡]',
                scripts: ['cdn.ampproject.org'],
                category: 'PWA',
            },

            // Push Notifications
            'OneSignal': {
                globals: ['OneSignal'],
                scripts: ['onesignal.com'],
                category: 'Marketing',
            },
            'PushEngage': {
                globals: ['_peq'],
                scripts: ['pushengage.com'],
                category: 'Marketing',
            },
            'WebPush': {
                globals: ['PushManager'],
                scripts: ['pushwoosh.com', 'web-push'],
                category: 'Marketing',
            },

            // Search
            'Algolia': {
                globals: ['algoliasearch', 'instantsearch'],
                scripts: ['algoliasearch', 'algolia.net', 'algoliacdn.com'],
                category: 'Search',
            },
            'Elasticsearch': {
                scripts: ['elasticsearch', 'elastic.co'],
                category: 'Search',
            },
            'Meilisearch': {
                scripts: ['meilisearch'],
                category: 'Search',
            },

            // Video
            'YouTube Embed': {
                selector: 'iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"]',
                category: 'Video',
            },
            'Vimeo Embed': {
                selector: 'iframe[src*="player.vimeo.com"]',
                scripts: ['player.vimeo.com'],
                category: 'Video',
            },
            'Wistia': {
                globals: ['Wistia'],
                scripts: ['wistia.com', 'wistia.net'],
                category: 'Video',
            },

            // Maps
            'Google Maps': {
                globals: ['google'],
                selector: '.gm-style, iframe[src*="google.com/maps"]',
                scripts: ['maps.googleapis.com', 'maps.google.com'],
                category: 'Maps',
            },
            'Mapbox': {
                globals: ['mapboxgl'],
                scripts: ['api.mapbox.com', 'mapbox-gl'],
                category: 'Maps',
            },
            'Leaflet': {
                globals: ['L'],
                selector: '.leaflet-container',
                scripts: ['leaflet.js', 'leafletjs.com'],
                category: 'Maps',
            },
        };

        for (const [name, sig] of Object.entries(TECH_SIGNATURES)) {
            let found = false;
            let version = null;
            let details = null;

            // Check globals (highest priority)
            if (sig.globals) {
                for (const g of sig.globals) {
                    try {
                        if (typeof window[g] !== 'undefined' && window[g] !== null) {
                            found = true;
                            break;
                        }
                    } catch (e) {
                        // Some properties might throw errors when accessed
                        continue;
                    }
                }
            }

            // Check scripts
            if (!found && sig.scripts) {
                for (const pattern of sig.scripts) {
                    if (scripts.some(s => s.includes(pattern.toLowerCase()))) {
                        found = true;
                        break;
                    }
                }
            }

            // Check selectors
            if (!found && sig.selector) {
                try {
                    const element = document.querySelector(sig.selector);
                    if (element) {
                        found = true;
                    }
                } catch (e) {
                    // Invalid selector or DOM access error
                }
            }

            // Check HTML content for inline scripts
            if (!found && sig.scripts) {
                for (const pattern of sig.scripts) {
                    if (html.includes(pattern.toLowerCase())) {
                        found = true;
                        break;
                    }
                }
            }

            if (found) {
                // Get version if available
                if (sig.getVersion) {
                    try {
                        version = sig.getVersion();
                    } catch (e) {
                        // Version detection error
                    }
                }

                // Get details if available
                if (sig.getDetails) {
                    try {
                        details = sig.getDetails();
                    } catch (e) {
                        // Details detection error
                    }
                }

                detected.push({
                    name,
                    category: sig.category,
                    icon: sig.icon,
                    version: version || null,
                    details: details || null,
                    patterns: sig.scripts || []
                });
            }
        }

        // Sort by category then name
        detected.sort((a, b) => {
            if (a.category !== b.category) return a.category.localeCompare(b.category);
            return a.name.localeCompare(b.name);
        });

        return detected;
    }
})();
