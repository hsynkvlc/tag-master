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

        const target = e.target;
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
        if (e.key === 'Escape') disableSelectorMode();
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

                matches.forEach((match, index) => {
                    const scriptContent = match[1].trim();
                    if (scriptContent) {
                        // Check if it's an external script
                        const srcMatch = match[0].match(/src=["']([^"']+)["']/);

                        if (srcMatch) {
                            // External script - inject as-is from user snippet
                            let src = srcMatch[1];
                            if (preview && src.includes('gtm.js')) {
                                src += (src.includes('?') ? '&' : '?') + 'gtm_debug=x';
                            }
                            const script = document.createElement('script');
                            script.async = true;
                            script.src = src;
                            script.id = `tag-master-gtm-${gtmId}-${index}`;
                            document.head.appendChild(script);
                        } else {
                            // Inline script - modify to add debug if needed
                            let modifiedContent = scriptContent;
                            if (preview && scriptContent.includes('gtm.js')) {
                                // Add gtm_debug parameter for preview mode
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
                });

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
        const html = document.documentElement.outerHTML.substring(0, 50000).toLowerCase();

        const TECH_SIGNATURES = {
            // JavaScript Frameworks
            'React': {
                globals: ['React', '__REACT_DEVTOOLS_GLOBAL_HOOK__', '__REACT_ERROR_OVERLAY_GLOBAL_HOOK__'],
                selector: '[data-reactroot], [data-reactid]',
                category: 'JavaScript Framework',
                icon: 'https://cdn.simpleicons.org/react/61DAFB',
                getVersion: () => window.React?.version
            },
            'Vue.js': {
                globals: ['Vue', '__VUE__', '__VUE_DEVTOOLS_GLOBAL_HOOK__'],
                selector: '[data-v-], [v-cloak]',
                category: 'JavaScript Framework',
                icon: 'https://cdn.simpleicons.org/vuedotjs/4FC08D',
                getVersion: () => window.Vue?.version
            },
            'Angular': {
                globals: ['ng', 'angular', 'getAllAngularRootElements'],
                selector: '[ng-version], [ng-app], [_ngcontent], [_nghost]',
                category: 'JavaScript Framework',
                icon: 'https://cdn.simpleicons.org/angular/DD0031',
                getVersion: () => document.querySelector('[ng-version]')?.getAttribute('ng-version')
            },
            'Next.js': {
                globals: ['__NEXT_DATA__', '__NEXT_LOADED_PAGES__'],
                selector: '#__next',
                category: 'JavaScript Framework',
                icon: 'https://cdn.simpleicons.org/nextdotjs/white',
                getVersion: () => window.__NEXT_DATA__?.nextExport ? 'SSG' : (window.__NEXT_DATA__ ? 'SSR' : null)
            },
            'Nuxt.js': {
                globals: ['__NUXT__', '$nuxt', '__NUXT_PATHS__'],
                category: 'JavaScript Framework',
                icon: 'https://cdn.simpleicons.org/nuxtdotjs/00DC82'
            },
            'Gatsby': {
                globals: ['___gatsby', '___GATSBY_INITIAL_RENDER_COMPLETE'],
                selector: '#___gatsby',
                category: 'JavaScript Framework',
                icon: 'https://cdn.simpleicons.org/gatsby/663399'
            },
            'jQuery': {
                globals: ['jQuery', 'jquery'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/jquery/0769AD',
                getVersion: () => window.jQuery?.fn?.jquery || window.jQuery?.prototype?.jquery
            },
            'Svelte': {
                globals: ['__svelte', '__SVELTE_HMR'],
                category: 'JavaScript Framework',
                icon: 'https://cdn.simpleicons.org/svelte/FF3E00'
            },
            'Alpine.js': {
                globals: ['Alpine'],
                selector: '[x-data], [x-bind], [x-on]',
                category: 'JavaScript Framework',
                icon: 'https://cdn.simpleicons.org/alpinedotjs/8BC0D0',
                getVersion: () => window.Alpine?.version
            },
            'Ember.js': {
                globals: ['Ember', 'Em'],
                selector: '.ember-view, .ember-application',
                category: 'JavaScript Framework',
                icon: 'https://cdn.simpleicons.org/emberdotjs/E04E39',
                getVersion: () => window.Ember?.VERSION
            },
            'Backbone.js': {
                globals: ['Backbone'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/backbonedotjs/0071B5',
                getVersion: () => window.Backbone?.VERSION
            },
            'Lodash': {
                globals: ['_'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/lodash/3492FF',
                getVersion: () => window._?.VERSION
            },
            'Axios': {
                globals: ['axios'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/axios/5A29E4',
                getVersion: () => window.axios?.VERSION
            },
            'Moment.js': {
                globals: ['moment'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/clockify/03A9F4',
                getVersion: () => window.moment?.version
            },
            'GSAP': {
                globals: ['gsap', 'TweenMax', 'TweenLite'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/greensock/88CE02',
                getVersion: () => window.gsap?.version
            },
            'Three.js': {
                globals: ['THREE'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/threedotjs/white',
                getVersion: () => window.THREE?.REVISION
            },
            'D3.js': {
                globals: ['d3'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/d3dotjs/F9A03C',
                getVersion: () => window.d3?.version
            },

            // CMS
            'WordPress': {
                selector: 'link[href*="wp-content"], link[href*="wp-includes"], meta[name="generator"][content*="WordPress"]',
                scripts: ['wp-content', 'wp-includes', 'wp-json'],
                category: 'CMS',
                icon: 'https://cdn.simpleicons.org/wordpress/21759B'
            },
            'Drupal': {
                globals: ['Drupal'],
                selector: 'meta[name="generator"][content*="Drupal"]',
                scripts: ['drupal.js'],
                category: 'CMS',
                icon: 'https://cdn.simpleicons.org/drupal/0678BE',
                getVersion: () => window.Drupal?.settings?.version
            },
            'Joomla': {
                selector: 'meta[name="generator"][content*="Joomla"]',
                scripts: ['joomla'],
                category: 'CMS',
                icon: 'https://cdn.simpleicons.org/joomla/5091CD'
            },
            'Shopify': {
                globals: ['Shopify', 'ShopifyAnalytics'],
                selector: 'link[href*="cdn.shopify.com"]',
                scripts: ['cdn.shopify.com'],
                category: 'E-commerce',
                icon: 'https://cdn.simpleicons.org/shopify/7AB55C',
                getVersion: () => window.Shopify?.theme?.name
            },
            'Webflow': {
                globals: ['Webflow'],
                selector: 'html[data-wf-site], .w-webflow-badge',
                category: 'CMS',
                icon: 'https://cdn.simpleicons.org/webflow/4353FF'
            },
            'Wix': {
                scripts: ['static.wixstatic.com', 'static.parastorage.com'],
                selector: 'meta[name="generator"][content*="Wix"]',
                category: 'CMS',
                icon: 'https://cdn.simpleicons.org/wix/0C6EFC'
            },
            'Squarespace': {
                globals: ['Static', 'Squarespace'],
                selector: 'link[href*="squarespace"]',
                category: 'CMS',
                icon: 'https://cdn.simpleicons.org/squarespace/white'
            },
            'Ghost': {
                selector: 'meta[name="generator"][content*="Ghost"]',
                category: 'CMS',
                icon: 'https://cdn.simpleicons.org/ghost/15171A'
            },
            'Contentful': {
                globals: ['contentful'],
                scripts: ['contentful'],
                category: 'CMS',
                icon: 'https://cdn.simpleicons.org/contentful/2478CC'
            },

            // Analytics & Tag Management
            'Google Tag Manager': {
                globals: ['google_tag_manager', 'google_tag_data'],
                scripts: ['gtm.js'],
                category: 'Tag Management',
                icon: 'https://cdn.simpleicons.org/googletagmanager/246FDB',
                getDetails: () => {
                    const ids = Object.keys(window.google_tag_manager || {}).filter(k => k.startsWith('GTM-'));
                    return ids.length ? ids.join(', ') : null;
                }
            },
            'Google Analytics 4': {
                globals: ['gtag', 'google_tag_data'],
                scripts: ['gtag/js'],
                category: 'Analytics',
                icon: 'https://cdn.simpleicons.org/googleanalytics/E37400',
                getDetails: () => {
                    const gtagMatch = html.match(/gtag\(['"]config['"],\s*['"](G-[A-Z0-9]+)['"]/);
                    return gtagMatch ? gtagMatch[1] : null;
                }
            },
            'Google Analytics (UA)': {
                globals: ['ga', 'GoogleAnalyticsObject'],
                scripts: ['google-analytics.com/analytics.js', 'google-analytics.com/ga.js'],
                category: 'Analytics',
                icon: 'https://cdn.simpleicons.org/googleanalytics/E37400',
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
                icon: 'https://cdn.simpleicons.org/meta/0081FB',
                getDetails: () => window.fbq?.getState?.()?.pixelIDs?.join(', ')
            },
            'Meta Pixel': {
                globals: ['fbq'],
                scripts: ['connect.facebook.net'],
                category: 'Marketing',
                icon: 'https://cdn.simpleicons.org/meta/0081FB'
            },
            'Hotjar': {
                globals: ['hj', 'hjSiteSettings', '_hjSettings'],
                scripts: ['static.hotjar.com'],
                category: 'Analytics',
                icon: 'https://cdn.simpleicons.org/hotjar/FF3C00',
                getDetails: () => window._hjSettings?.hjid
            },
            'Mixpanel': {
                globals: ['mixpanel'],
                scripts: ['cdn.mxpnl.com', 'mixpanel.com'],
                category: 'Analytics',
                icon: 'https://cdn.simpleicons.org/mixpanel/7856FF'
            },
            'Segment': {
                globals: ['analytics'],
                scripts: ['cdn.segment.com', 'segment.io'],
                category: 'Analytics',
                icon: 'https://cdn.simpleicons.org/segment/52BD95'
            },
            'Amplitude': {
                globals: ['amplitude'],
                scripts: ['cdn.amplitude.com'],
                category: 'Analytics',
                icon: 'https://cdn.simpleicons.org/amplitude/2076FF'
            },
            'Heap': {
                globals: ['heap'],
                scripts: ['heap-analytics.com', 'heapanalytics.com'],
                category: 'Analytics',
                icon: 'https://cdn.simpleicons.org/heap/FF6D00'
            },
            'Clarity': {
                globals: ['clarity'],
                scripts: ['clarity.ms'],
                category: 'Analytics',
                icon: 'https://cdn.simpleicons.org/microsoftclarity/4B57A0'
            },
            'FullStory': {
                globals: ['FS', '_fs_host'],
                scripts: ['fullstory.com'],
                category: 'Analytics',
                icon: 'https://cdn.simpleicons.org/fullstory/543DE0'
            },
            'LogRocket': {
                globals: ['LogRocket', '_lr_loaded'],
                scripts: ['cdn.logrocket.io', 'logrocket.com'],
                category: 'Analytics',
                icon: 'https://cdn.simpleicons.org/logrocket/764ABC'
            },
            'Pendo': {
                globals: ['pendo'],
                scripts: ['pendo.io', 'cdn.pendo.io'],
                category: 'Analytics',
                icon: 'https://cdn.simpleicons.org/pendo/2F3137'
            },
            'Mouseflow': {
                globals: ['mouseflow', '_mfq'],
                scripts: ['mouseflow.com'],
                category: 'Analytics',
                icon: 'https://cdn.simpleicons.org/mouseflow/FF4F00'
            },
            'Lucky Orange': {
                globals: ['__lo_site_id'],
                scripts: ['luckyorange.com'],
                category: 'Analytics',
                icon: 'https://cdn.simpleicons.org/luckyorange/FF6700'
            },
            'Plausible': {
                scripts: ['plausible.io'],
                category: 'Analytics',
                icon: 'https://cdn.simpleicons.org/plausibleanalytics/5850EC'
            },
            'Matomo': {
                globals: ['_paq', 'Matomo', 'Piwik'],
                scripts: ['matomo', 'piwik'],
                category: 'Analytics',
                icon: 'https://cdn.simpleicons.org/matomo/3152A0'
            },

            // Advertising
            'Google Ads': {
                globals: ['google_trackConversion', 'gtag_report_conversion'],
                scripts: ['googleadservices.com', 'googlesyndication.com/pagead'],
                category: 'Advertising',
                icon: 'https://cdn.simpleicons.org/googleads/4285F4'
            },
            'Google AdSense': {
                globals: ['adsbygoogle'],
                scripts: ['pagead2.googlesyndication.com/pagead/js/adsbygoogle'],
                selector: 'ins.adsbygoogle',
                category: 'Advertising',
                icon: 'https://cdn.simpleicons.org/googleadsense/4285F4'
            },
            'LinkedIn Insight': {
                globals: ['_linkedin_data_partner_ids', 'lintrk'],
                scripts: ['snap.licdn.com'],
                category: 'Marketing',
                icon: 'https://cdn.simpleicons.org/linkedin/0A66C2'
            },
            'Twitter Pixel': {
                globals: ['twq'],
                scripts: ['static.ads-twitter.com'],
                category: 'Marketing',
                icon: 'https://cdn.simpleicons.org/x/white'
            },
            'TikTok Pixel': {
                globals: ['ttq'],
                scripts: ['analytics.tiktok.com'],
                category: 'Marketing',
                icon: 'https://cdn.simpleicons.org/tiktok/white'
            },
            'Pinterest Tag': {
                globals: ['pintrk'],
                scripts: ['s.pinimg.com/ct'],
                category: 'Marketing',
                icon: 'https://cdn.simpleicons.org/pinterest/BD081C'
            },
            'Snapchat Pixel': {
                globals: ['snaptr'],
                scripts: ['sc-static.net'],
                category: 'Marketing',
                icon: 'https://cdn.simpleicons.org/snapchat/FFFC00'
            },
            'Reddit Pixel': {
                globals: ['rdt'],
                scripts: ['reddit.com/pixel'],
                category: 'Marketing',
                icon: 'https://cdn.simpleicons.org/reddit/FF4500'
            },
            'Quora Pixel': {
                globals: ['qp'],
                scripts: ['quora.com/_/ad'],
                category: 'Marketing',
                icon: 'https://cdn.simpleicons.org/quora/B92B27'
            },
            'Criteo': {
                globals: ['criteo_q'],
                scripts: ['static.criteo.net'],
                category: 'Advertising',
                icon: 'https://cdn.simpleicons.org/criteo/F47A20'
            },
            'Taboola': {
                globals: ['_tfa'],
                scripts: ['cdn.taboola.com'],
                category: 'Advertising',
                icon: 'https://cdn.simpleicons.org/taboola/005BBF'
            },
            'Outbrain': {
                globals: ['OB_ADV_ID'],
                scripts: ['outbrain.com'],
                category: 'Advertising',
                icon: 'https://cdn.simpleicons.org/outbrain/E95E18'
            },

            // E-commerce
            'WooCommerce': {
                globals: ['woocommerce_params', 'wc_add_to_cart_params'],
                selector: '.woocommerce, link[href*="woocommerce"]',
                category: 'E-commerce',
                icon: 'https://cdn.simpleicons.org/woocommerce/96588A'
            },
            'BigCommerce': {
                globals: ['BCData', 'stencilBootstrap'],
                category: 'E-commerce',
                icon: 'https://cdn.simpleicons.org/bigcommerce/121118'
            },
            'Magento': {
                globals: ['Mage', 'mage'],
                selector: 'script[src*="mage"], .cms-index-index',
                category: 'E-commerce',
                icon: 'https://cdn.simpleicons.org/magento/EE672F'
            },
            'PrestaShop': {
                globals: ['prestashop'],
                selector: 'meta[name="generator"][content*="PrestaShop"]',
                category: 'E-commerce',
                icon: 'https://cdn.simpleicons.org/prestashop/DF0067'
            },
            'OpenCart': {
                scripts: ['catalog/view/javascript'],
                category: 'E-commerce',
                icon: 'https://cdn.simpleicons.org/opencart/23A6DB'
            },
            'Salesforce Commerce': {
                globals: ['dw'],
                scripts: ['demandware.static'],
                category: 'E-commerce',
                icon: 'https://cdn.simpleicons.org/salesforce/00A1E0'
            },
            'T-Soft': {
                globals: ['TSoftBasket', 'TSoft', 'TSoftParams', 'TSoftObject', 'design_path', 'sub_folder'],
                scripts: ['tsoft.com.tr', 'tsoftcdn.com', 't-soft.com.tr', '/Theme/'],
                selector: 'meta[name="generator"][content*="T-Soft"], meta[name="generator"][content*="TSoft"], meta[name="author"][content*="T-Soft"], link[href*="tsoft"]',
                category: 'E-commerce',
                icon: 'https://www.google.com/s2/favicons?domain=tsoft.com.tr&sz=64'
            },
            'İdeaSoft': {
                globals: ['IdeasoftData', 'ideaJS'],
                scripts: ['ideasoft.com.tr', 'mncdn.com/ideasoft'],
                selector: 'meta[name="generator"][content*="ideasoft"], meta[name="generator"][content*="İdeaSoft"]',
                category: 'E-commerce',
                icon: 'https://www.google.com/s2/favicons?domain=ideasoft.com.tr&sz=64'
            },
            'Ticimax': {
                globals: ['Ticimax', 'TicimaxBasket'],
                scripts: ['ticimax.com', 'ticimax.cloud'],
                selector: 'meta[name="generator"][content*="Ticimax"]',
                category: 'E-commerce',
                icon: 'https://www.google.com/s2/favicons?domain=ticimax.com&sz=64'
            },
            'N11': {
                scripts: ['n11.com', 'n11cdn.com'],
                selector: 'meta[property="og:site_name"][content*="n11"]',
                category: 'E-commerce',
                icon: 'https://www.google.com/s2/favicons?domain=n11.com&sz=64'
            },
            'Hepsiburada': {
                scripts: ['hepsiburada.com', 'hepsicdn.com'],
                selector: 'meta[property="og:site_name"][content*="Hepsiburada"]',
                category: 'E-commerce',
                icon: 'https://www.google.com/s2/favicons?domain=hepsiburada.com&sz=64'
            },
            'Gittigidiyor': {
                scripts: ['gittigidiyor.com', 'ggpht.com'],
                selector: 'meta[property="og:site_name"][content*="GittiGidiyor"]',
                category: 'E-commerce',
                icon: 'https://www.google.com/s2/favicons?domain=gittigidiyor.com&sz=64'
            },
            'Opencart': {
                globals: ['common', 'catalog'],
                scripts: ['catalog/view/javascript/common.js'],
                selector: 'meta[name="generator"][content*="OpenCart"]',
                category: 'E-commerce',
                icon: 'https://cdn.simpleicons.org/opencart/23A6DB'
            },
            'PrestaShop': {
                globals: ['prestashop'],
                scripts: ['prestashop'],
                selector: 'meta[name="generator"][content*="PrestaShop"]',
                category: 'E-commerce',
                icon: 'https://cdn.simpleicons.org/prestashop/DF0067'
            },
            'Klaviyo': {
                globals: ['klaviyo', '_learnq'],
                scripts: ['static.klaviyo.com'],
                category: 'Marketing',
                icon: 'https://cdn.simpleicons.org/klaviyo/2ECC71'
            },

            // Customer Support
            'Intercom': {
                globals: ['Intercom', 'intercomSettings'],
                scripts: ['widget.intercom.io'],
                category: 'Customer Support',
                icon: 'https://cdn.simpleicons.org/intercom/6AFDEF'
            },
            'Zendesk': {
                globals: ['zE', 'zESettings', '$zopim'],
                scripts: ['static.zdassets.com', 'zopim.com'],
                category: 'Customer Support',
                icon: 'https://cdn.simpleicons.org/zendesk/03363D'
            },
            'Drift': {
                globals: ['drift', 'driftt'],
                scripts: ['js.driftt.com'],
                category: 'Customer Support',
                icon: 'https://cdn.simpleicons.org/drift/0176FF'
            },
            'Crisp': {
                globals: ['$crisp', 'CRISP_WEBSITE_ID'],
                scripts: ['client.crisp.chat'],
                category: 'Customer Support',
                icon: 'https://cdn.simpleicons.org/crisp/29B6F6'
            },
            'LiveChat': {
                globals: ['LiveChatWidget', '__lc'],
                scripts: ['cdn.livechatinc.com'],
                category: 'Customer Support',
                icon: 'https://cdn.simpleicons.org/livechat/FFD000'
            },
            'Tawk.to': {
                globals: ['Tawk_API', 'Tawk_LoadStart'],
                scripts: ['embed.tawk.to'],
                category: 'Customer Support',
                icon: 'https://cdn.simpleicons.org/tawkto/03A84E'
            },
            'HubSpot': {
                globals: ['HubSpotConversations', '_hsq', 'hubspot'],
                scripts: ['js.hs-scripts.com', 'js.hubspot.com', 'hscta.net'],
                category: 'Marketing',
                icon: 'https://cdn.simpleicons.org/hubspot/FF7A59'
            },
            'Freshdesk': {
                globals: ['FreshWidget'],
                scripts: ['widget.freshworks.com'],
                category: 'Customer Support',
                icon: 'https://cdn.simpleicons.org/freshdesk/00B050'
            },
            'Olark': {
                globals: ['olark'],
                scripts: ['static.olark.com'],
                category: 'Customer Support',
                icon: 'https://cdn.simpleicons.org/olark/48B8E7'
            },

            // CDN & Performance
            'Cloudflare': {
                scripts: ['cdnjs.cloudflare.com', 'cloudflare.com'],
                selector: 'script[src*="cloudflare"]',
                category: 'CDN',
                icon: 'https://cdn.simpleicons.org/cloudflare/F38020'
            },
            'Fastly': {
                scripts: ['fastly.net'],
                category: 'CDN',
                icon: 'https://cdn.simpleicons.org/fastly/FF282D'
            },
            'Akamai': {
                scripts: ['akamai.net', 'akamaized.net', 'akstat.io'],
                category: 'CDN',
                icon: 'https://cdn.simpleicons.org/akamai/0096D6'
            },
            'jsDelivr': {
                scripts: ['cdn.jsdelivr.net'],
                category: 'CDN',
                icon: 'https://cdn.simpleicons.org/jsdelivr/E84D3D'
            },
            'unpkg': {
                scripts: ['unpkg.com'],
                category: 'CDN',
                icon: 'https://cdn.simpleicons.org/unpkg/F7F7F7'
            },
            'New Relic': {
                globals: ['newrelic', 'NREUM'],
                scripts: ['js-agent.newrelic.com'],
                category: 'Analytics',
                icon: 'https://cdn.simpleicons.org/newrelic/1CE783'
            },
            'Datadog RUM': {
                globals: ['DD_RUM'],
                scripts: ['datadoghq.com'],
                category: 'Analytics',
                icon: 'https://cdn.simpleicons.org/datadog/632CA6'
            },
            'Sentry': {
                globals: ['Sentry', '__SENTRY__'],
                scripts: ['browser.sentry-cdn.com', 'sentry.io'],
                category: 'Analytics',
                icon: 'https://cdn.simpleicons.org/sentry/362D59'
            },
            'Bugsnag': {
                globals: ['bugsnag', 'Bugsnag'],
                scripts: ['bugsnag.com'],
                category: 'Analytics',
                icon: 'https://cdn.simpleicons.org/bugsnag/4949E4'
            },

            // A/B Testing
            'Optimizely': {
                globals: ['optimizely', 'optimizelyEdge'],
                scripts: ['cdn.optimizely.com'],
                category: 'A/B Testing',
                icon: 'https://cdn.simpleicons.org/optimizely/2A7FFF'
            },
            'VWO': {
                globals: ['_vwo_code', 'VWO', '_vis_opt'],
                scripts: ['dev.visualwebsiteoptimizer.com'],
                category: 'A/B Testing',
                icon: 'https://cdn.simpleicons.org/vwo/4248F7'
            },
            'Google Optimize': {
                globals: ['google_optimize', 'dataLayer'],
                scripts: ['googleoptimize.com'],
                category: 'A/B Testing',
                icon: 'https://cdn.simpleicons.org/googleoptimize/B366FF'
            },
            'AB Tasty': {
                globals: ['ABTasty'],
                scripts: ['abtasty.com'],
                category: 'A/B Testing',
                icon: 'https://cdn.simpleicons.org/abtasty/3B3F45'
            },
            'LaunchDarkly': {
                globals: ['LDClient'],
                scripts: ['launchdarkly.com'],
                category: 'A/B Testing',
                icon: 'https://cdn.simpleicons.org/launchdarkly/3DD6F5'
            },
            'Split.io': {
                globals: ['splitio'],
                scripts: ['split.io'],
                category: 'A/B Testing',
                icon: 'https://cdn.simpleicons.org/split/805BDD'
            },

            // Payment
            'Stripe': {
                globals: ['Stripe'],
                scripts: ['js.stripe.com'],
                category: 'Payment',
                icon: 'https://cdn.simpleicons.org/stripe/635BFF'
            },
            'PayPal': {
                globals: ['paypal', 'PAYPAL'],
                scripts: ['paypal.com/sdk', 'paypalobjects.com'],
                category: 'Payment',
                icon: 'https://cdn.simpleicons.org/paypal/003087'
            },
            'Braintree': {
                globals: ['braintree'],
                scripts: ['js.braintreegateway.com'],
                category: 'Payment',
                icon: 'https://cdn.simpleicons.org/braintree/000000'
            },
            'Square': {
                globals: ['SqPaymentForm', 'Square'],
                scripts: ['squareup.com', 'square.com'],
                category: 'Payment',
                icon: 'https://cdn.simpleicons.org/square/006AFF'
            },
            'Klarna': {
                globals: ['Klarna', 'KlarnaOnsiteService'],
                scripts: ['klarna.com'],
                category: 'Payment',
                icon: 'https://cdn.simpleicons.org/klarna/FFB3C7'
            },
            'Afterpay': {
                globals: ['AfterPay', 'Afterpay'],
                scripts: ['afterpay.com', 'squarecdn.com/afterpay'],
                category: 'Payment',
                icon: 'https://cdn.simpleicons.org/afterpay/B2FCE4'
            },

            // Security
            'reCAPTCHA': {
                globals: ['grecaptcha'],
                scripts: ['google.com/recaptcha', 'gstatic.com/recaptcha'],
                category: 'Security',
                icon: 'https://cdn.simpleicons.org/google/4285F4'
            },
            'hCaptcha': {
                globals: ['hcaptcha'],
                scripts: ['hcaptcha.com'],
                category: 'Security',
                icon: 'https://cdn.simpleicons.org/hcaptcha/00B4D8'
            },
            'Cloudflare Turnstile': {
                globals: ['turnstile'],
                scripts: ['challenges.cloudflare.com/turnstile'],
                category: 'Security',
                icon: 'https://cdn.simpleicons.org/cloudflare/F38020'
            },

            // Fonts
            'Google Fonts': {
                selector: 'link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]',
                scripts: ['fonts.googleapis.com'],
                category: 'Fonts',
                icon: 'https://cdn.simpleicons.org/googlefonts/4285F4'
            },
            'Adobe Fonts': {
                globals: ['Typekit'],
                scripts: ['use.typekit.net'],
                category: 'Fonts',
                icon: 'https://cdn.simpleicons.org/adobefonts/000B1D'
            },
            'Font Awesome': {
                selector: 'link[href*="fontawesome"], .fa, .fas, .fab, .far',
                scripts: ['fontawesome'],
                category: 'Fonts',
                icon: 'https://cdn.simpleicons.org/fontawesome/528DD7'
            },

            // CSS Frameworks
            'Bootstrap': {
                selector: 'link[href*="bootstrap"]',
                scripts: ['bootstrap'],
                category: 'CSS Framework',
                icon: 'https://cdn.simpleicons.org/bootstrap/7952B3',
                getVersion: () => window.bootstrap?.Modal?.VERSION
            },
            'Tailwind CSS': {
                selector: '[class*="tw-"], .container, .flex, .grid, .bg-',
                category: 'CSS Framework',
                icon: 'https://cdn.simpleicons.org/tailwindcss/06B6D4'
            },
            'Bulma': {
                selector: 'link[href*="bulma"]',
                category: 'CSS Framework',
                icon: 'https://cdn.simpleicons.org/bulma/00D1B2'
            },
            'Foundation': {
                globals: ['Foundation'],
                selector: 'link[href*="foundation"]',
                category: 'CSS Framework',
                icon: 'https://cdn.simpleicons.org/zurb/CB5A30'
            },
            'Material UI': {
                selector: '[class*="MuiBox"], [class*="MuiButton"], [class*="makeStyles"]',
                category: 'CSS Framework',
                icon: 'https://cdn.simpleicons.org/mui/007FFF'
            },
            'Chakra UI': {
                selector: '[class*="chakra-"]',
                category: 'CSS Framework',
                icon: 'https://cdn.simpleicons.org/chakraui/319795'
            },
            'Ant Design': {
                selector: '[class*="ant-"], .antd',
                category: 'CSS Framework',
                icon: 'https://cdn.simpleicons.org/antdesign/0170FE'
            },
            'Semantic UI': {
                selector: 'link[href*="semantic"], .ui.container, .ui.button',
                scripts: ['semantic.min.js', 'semantic-ui'],
                category: 'CSS Framework',
                icon: 'https://cdn.simpleicons.org/semanticuireact/35BDB2'
            },

            // JavaScript Frameworks & Libraries
            'React': {
                globals: ['__REACT_DEVTOOLS_GLOBAL_HOOK__', '__REACT_ERROR_OVERLAY_GLOBAL_HOOK__'],
                selector: '[data-reactroot], [data-reactid], #__next',
                category: 'JavaScript Framework',
                icon: 'https://cdn.simpleicons.org/react/61DAFB',
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
                icon: 'https://cdn.simpleicons.org/nextdotjs/white',
                getVersion: () => window.__NEXT_DATA__?.buildId ? 'detected' : null
            },
            'Vue.js': {
                globals: ['__VUE__', 'Vue', '__vue__'],
                selector: '[data-v-], #app[data-v-app], [data-server-rendered]',
                category: 'JavaScript Framework',
                icon: 'https://cdn.simpleicons.org/vuedotjs/4FC08D',
                getVersion: () => window.Vue?.version
            },
            'Nuxt.js': {
                globals: ['__NUXT__', '$nuxt'],
                selector: '#__nuxt, #__layout',
                category: 'JavaScript Framework',
                icon: 'https://cdn.simpleicons.org/nuxtdotjs/00DC82'
            },
            'Angular': {
                globals: ['ng'],
                selector: '[ng-app], [data-ng-app], [ng-version], app-root',
                category: 'JavaScript Framework',
                icon: 'https://cdn.simpleicons.org/angular/DD0031',
                getVersion: () => {
                    const el = document.querySelector('[ng-version]');
                    return el?.getAttribute('ng-version') || null;
                }
            },
            'Svelte': {
                selector: '[class*="svelte-"]',
                category: 'JavaScript Framework',
                icon: 'https://cdn.simpleicons.org/svelte/FF3E00'
            },
            'SvelteKit': {
                globals: ['__sveltekit_data'],
                selector: '[data-sveltekit-preload-data]',
                category: 'JavaScript Framework',
                icon: 'https://cdn.simpleicons.org/svelte/FF3E00'
            },
            'Gatsby': {
                globals: ['___gatsby', '___GATSBY_INITIAL_RENDER_COMPLETE'],
                selector: '#___gatsby, #gatsby-focus-wrapper',
                category: 'JavaScript Framework',
                icon: 'https://cdn.simpleicons.org/gatsby/663399'
            },
            'Astro': {
                selector: '[data-astro-cid], astro-island, [class*="astro-"]',
                category: 'JavaScript Framework',
                icon: 'https://cdn.simpleicons.org/astro/BC52EE'
            },
            'Remix': {
                globals: ['__remixManifest', '__remixContext'],
                category: 'JavaScript Framework',
                icon: 'https://cdn.simpleicons.org/remix/white'
            },
            'Ember.js': {
                globals: ['Ember', 'Em'],
                selector: '.ember-view, .ember-application',
                category: 'JavaScript Framework',
                icon: 'https://cdn.simpleicons.org/emberdotjs/E04E39',
                getVersion: () => window.Ember?.VERSION
            },
            'Backbone.js': {
                globals: ['Backbone'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/backbonedotjs/0071B5',
                getVersion: () => window.Backbone?.VERSION
            },
            'Alpine.js': {
                globals: ['Alpine'],
                selector: '[x-data], [x-bind], [x-on]',
                category: 'JavaScript Framework',
                icon: 'https://cdn.simpleicons.org/alpinedotjs/8BC0D0'
            },
            'HTMX': {
                selector: '[hx-get], [hx-post], [hx-trigger], [data-hx-get]',
                scripts: ['htmx.org', 'htmx.min.js'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/htmx/3366CC'
            },
            'jQuery': {
                globals: ['jQuery', '$'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/jquery/0769AD',
                getVersion: () => window.jQuery?.fn?.jquery
            },
            'jQuery UI': {
                globals: ['jQuery'],
                selector: 'link[href*="jquery-ui"], .ui-widget',
                scripts: ['jquery-ui'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/jquery/0769AD',
                getVersion: () => window.jQuery?.ui?.version
            },
            'Lodash': {
                globals: ['_'],
                scripts: ['lodash'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/lodash/3492FF',
                getVersion: () => window._?.VERSION
            },
            'Underscore.js': {
                globals: ['_'],
                scripts: ['underscore'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/underscoredotjs/0371B5'
            },
            'Moment.js': {
                globals: ['moment'],
                scripts: ['moment.min.js', 'moment-with-locales'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/clockify/03A9F4'
            },
            'Three.js': {
                globals: ['THREE'],
                scripts: ['three.min.js', 'three.module'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/threedotjs/white'
            },
            'GSAP': {
                globals: ['gsap', 'TweenMax', 'TweenLite', 'TimelineMax'],
                scripts: ['gsap', 'greensock'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/greensock/88CE02'
            },
            'Lottie': {
                globals: ['lottie', 'bodymovin'],
                scripts: ['lottie', 'bodymovin'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/lottiefiles/05DEB6'
            },
            'Socket.io': {
                globals: ['io'],
                scripts: ['socket.io'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/socketdotio/white'
            },
            'Axios': {
                globals: ['axios'],
                scripts: ['axios.min.js', 'cdn.jsdelivr.net/npm/axios'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/axios/5A29E4'
            },
            'D3.js': {
                globals: ['d3'],
                scripts: ['d3.min.js', 'd3js.org'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/d3dotjs/F9A03C'
            },
            'Chart.js': {
                globals: ['Chart'],
                scripts: ['chart.js', 'chart.min.js', 'chartjs'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/chartdotjs/FF6384'
            },
            'Highcharts': {
                globals: ['Highcharts'],
                scripts: ['highcharts.com', 'highcharts.js'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/highcharts/32B4D9'
            },
            'Swiper': {
                globals: ['Swiper'],
                selector: '.swiper, .swiper-container',
                scripts: ['swiper-bundle', 'swiper.min'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/swiper/6332F6'
            },
            'Slick Slider': {
                selector: '.slick-slider, .slick-initialized',
                scripts: ['slick.min.js', 'slick.js'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/slick/FF6600'
            },
            'Owl Carousel': {
                selector: '.owl-carousel',
                scripts: ['owl.carousel'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/owl/E65100'
            },
            'Lightbox': {
                globals: ['Lightbox', 'lightGallery', 'GLightbox'],
                selector: '[data-lightbox], [data-fancybox]',
                scripts: ['lightbox', 'fancybox'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/photobucket/0077B5'
            },
            'Lazy Load': {
                selector: '[loading="lazy"], .lazyload, .lazy, [data-src]',
                scripts: ['lazysizes', 'lazyload'],
                category: 'JavaScript Library',
                icon: 'https://cdn.simpleicons.org/lazyload/3492FF'
            },

            // CMS (additions)
            'Ghost': {
                selector: 'meta[name="generator"][content*="Ghost"]',
                globals: ['ghost'],
                category: 'CMS',
                icon: 'https://cdn.simpleicons.org/ghost/15171A'
            },
            'Webflow': {
                globals: ['Webflow'],
                selector: 'html[data-wf-site], .w-webflow-badge',
                scripts: ['webflow.js'],
                category: 'CMS',
                icon: 'https://cdn.simpleicons.org/webflow/4353FF'
            },
            'Wix': {
                globals: ['wixBiSession'],
                selector: 'meta[name="generator"][content*="Wix"]',
                scripts: ['static.parastorage.com', 'wix.com'],
                category: 'CMS',
                icon: 'https://cdn.simpleicons.org/wix/0C6EFC'
            },
            'Squarespace': {
                globals: ['Static'],
                selector: 'meta[name="generator"][content*="Squarespace"]',
                scripts: ['squarespace.com'],
                category: 'CMS',
                icon: 'https://cdn.simpleicons.org/squarespace/white'
            },
            'Weebly': {
                globals: ['Weebly'],
                selector: 'meta[name="generator"][content*="Weebly"]',
                category: 'CMS',
                icon: 'https://cdn.simpleicons.org/weebly/2C567E'
            },
            'Hugo': {
                selector: 'meta[name="generator"][content*="Hugo"]',
                category: 'CMS',
                icon: 'https://cdn.simpleicons.org/hugo/FF4088'
            },
            'Jekyll': {
                selector: 'meta[name="generator"][content*="Jekyll"]',
                category: 'CMS',
                icon: 'https://cdn.simpleicons.org/jekyll/CC0000'
            },
            'Contentful': {
                scripts: ['contentful.com', 'ctfassets.net'],
                category: 'CMS',
                icon: 'https://cdn.simpleicons.org/contentful/2478CC'
            },
            'Strapi': {
                scripts: ['strapi'],
                category: 'CMS',
                icon: 'https://cdn.simpleicons.org/strapi/4945FF'
            },
            'Craft CMS': {
                selector: 'meta[name="generator"][content*="Craft CMS"]',
                category: 'CMS',
                icon: 'https://cdn.simpleicons.org/craftcms/E5422B'
            },
            'Typo3': {
                selector: 'meta[name="generator"][content*="TYPO3"]',
                globals: ['TYPO3'],
                category: 'CMS',
                icon: 'https://cdn.simpleicons.org/typo3/FF8700'
            },
            'Blogger': {
                selector: 'meta[name="generator"][content*="Blogger"]',
                scripts: ['blogger.com', 'blogspot.com'],
                category: 'CMS',
                icon: 'https://cdn.simpleicons.org/blogger/FF5722'
            },

            // E-commerce (additions)
            'Shopify': {
                globals: ['Shopify', 'ShopifyAnalytics'],
                scripts: ['cdn.shopify.com'],
                selector: 'meta[name="shopify-digital-wallet"]',
                category: 'E-commerce',
                icon: 'https://cdn.simpleicons.org/shopify/7AB55C',
                getDetails: () => window.Shopify?.shop
            },
            'Ecwid': {
                globals: ['Ecwid', 'ecwid_productBrowser'],
                scripts: ['app.ecwid.com'],
                category: 'E-commerce',
                icon: 'https://cdn.simpleicons.org/ecwid/002E5E'
            },
            'Snipcart': {
                globals: ['Snipcart'],
                scripts: ['snipcart.com'],
                selector: '#snipcart',
                category: 'E-commerce',
                icon: 'https://cdn.simpleicons.org/snipcart/1EA2A3'
            },
            'Medusa': {
                scripts: ['medusajs.com'],
                category: 'E-commerce',
                icon: 'https://cdn.simpleicons.org/medusa/7C3AED'
            },

            // Marketing (additions)
            'Mailchimp': {
                globals: ['mc4wp'],
                scripts: ['chimpstatic.com', 'list-manage.com', 'mailchimp.com'],
                selector: '.mc4wp-form, #mc_embed_signup',
                category: 'Marketing',
                icon: 'https://cdn.simpleicons.org/mailchimp/FFE01B'
            },
            'SendGrid': {
                scripts: ['sendgrid.com', 'sendgrid.net'],
                category: 'Marketing',
                icon: 'https://cdn.simpleicons.org/sendgrid/1A82E2'
            },
            'ActiveCampaign': {
                globals: ['_actm'],
                scripts: ['activehosted.com', 'activecampaign.com'],
                category: 'Marketing',
                icon: 'https://cdn.simpleicons.org/activecampaign/004CFF'
            },
            'Drip': {
                globals: ['_dcq', '_dcs'],
                scripts: ['getdrip.com'],
                category: 'Marketing',
                icon: 'https://cdn.simpleicons.org/drip/EF4B7A'
            },
            'ConvertKit': {
                scripts: ['convertkit.com'],
                selector: 'form[data-uid], [data-formkit]',
                category: 'Marketing',
                icon: 'https://cdn.simpleicons.org/convertkit/FB6970'
            },
            'Braze': {
                globals: ['appboy', 'braze'],
                scripts: ['braze.com', 'appboy.com'],
                category: 'Marketing',
                icon: 'https://cdn.simpleicons.org/braze/white'
            },
            'Customer.io': {
                globals: ['_cio'],
                scripts: ['customer.io'],
                category: 'Marketing',
                icon: 'https://cdn.simpleicons.org/customio/5BB4FF'
            },
            'Iterable': {
                globals: ['_iaq'],
                scripts: ['iterable.com'],
                category: 'Marketing',
                icon: 'https://cdn.simpleicons.org/iterable/5AB1EF'
            },
            'Marketo': {
                globals: ['Munchkin', 'mktoMunchkin'],
                scripts: ['munchkin.marketo.net'],
                category: 'Marketing',
                icon: 'https://cdn.simpleicons.org/marketo/5C4C9F'
            },
            'Pardot': {
                globals: ['pi', 'piAId'],
                scripts: ['pi.pardot.com', 'pardot.com'],
                category: 'Marketing',
                icon: 'https://cdn.simpleicons.org/salesforce/00A1E0'
            },
            'Salesforce': {
                globals: ['SfdcApp'],
                scripts: ['force.com', 'salesforce.com'],
                category: 'Marketing',
                icon: 'https://cdn.simpleicons.org/salesforce/00A1E0'
            },
            'Google Campaign Manager': {
                scripts: ['doubleclick.net'],
                category: 'Marketing',
                icon: 'https://cdn.simpleicons.org/googleads/4285F4'
            },

            // Consent Management
            'OneTrust': {
                globals: ['OneTrust', 'Optanon', 'OptanonWrapper'],
                scripts: ['cdn.cookielaw.org', 'onetrust.com'],
                category: 'Consent Management',
                icon: 'https://cdn.simpleicons.org/onetrust/01444B'
            },
            'Cookiebot': {
                globals: ['Cookiebot', 'CookieConsent'],
                scripts: ['cookiebot.com', 'consent.cookiebot.com'],
                category: 'Consent Management',
                icon: 'https://cdn.simpleicons.org/cookiebot/00B050'
            },
            'Cookie Notice': {
                selector: '#cookie-notice, .cookie-notice, #cookie-law-info-bar',
                globals: ['cookie_notice_js'],
                category: 'Consent Management',
                icon: 'https://cdn.simpleicons.org/cookiecutter/D4AA00'
            },
            'Quantcast Choice': {
                globals: ['__cmp', '__tcfapi'],
                scripts: ['quantcast.mgr.consensu.org'],
                category: 'Consent Management',
                icon: 'https://cdn.simpleicons.org/quantcast/000000'
            },
            'TrustArc': {
                globals: ['truste'],
                scripts: ['consent.trustarc.com'],
                category: 'Consent Management',
                icon: 'https://cdn.simpleicons.org/trustarc/009900'
            },
            'Iubenda': {
                globals: ['_iub'],
                scripts: ['iubenda.com'],
                category: 'Consent Management',
                icon: 'https://cdn.simpleicons.org/iubenda/2ECC71'
            },
            'Cookie Script': {
                scripts: ['cookie-script.com'],
                selector: '#cookiescript_injected',
                category: 'Consent Management',
                icon: 'https://cdn.simpleicons.org/cookiescript/F5A623'
            },
            'Complianz': {
                selector: '#cmplz-cookiebanner-container',
                scripts: ['complianz'],
                category: 'Consent Management',
                icon: 'https://cdn.simpleicons.org/complianz/5BB45F'
            },
            'Osano': {
                globals: ['Osano'],
                scripts: ['cmp.osano.com'],
                category: 'Consent Management',
                icon: 'https://cdn.simpleicons.org/osano/007DFF'
            },
            'Didomi': {
                globals: ['Didomi', 'didomiOnReady'],
                scripts: ['sdk.privacy-center.org'],
                category: 'Consent Management',
                icon: 'https://cdn.simpleicons.org/didomi/000000'
            },
            'Usercentrics': {
                globals: ['UC_UI'],
                scripts: ['usercentrics.eu'],
                category: 'Consent Management',
                icon: 'https://cdn.simpleicons.org/usercentrics/3E7CFF'
            },

            // Hosting & Infrastructure
            'Vercel': {
                selector: 'meta[name="next-head-count"]',
                scripts: ['vercel.app', 'vercel.com', '_vercel'],
                category: 'Hosting',
                icon: 'https://cdn.simpleicons.org/vercel/white'
            },
            'Netlify': {
                scripts: ['netlify.app', 'netlify.com'],
                selector: 'meta[name="generator"][content*="Netlify"]',
                category: 'Hosting',
                icon: 'https://cdn.simpleicons.org/netlify/00C7B7'
            },
            'AWS': {
                scripts: ['amazonaws.com', 'aws.amazon.com', 'cloudfront.net'],
                category: 'Hosting',
                icon: 'https://cdn.simpleicons.org/amazonwebservices/FF9900'
            },
            'Google Cloud': {
                scripts: ['storage.googleapis.com'],
                category: 'Hosting',
                icon: 'https://cdn.simpleicons.org/googlecloud/4285F4'
            },
            'Azure': {
                scripts: ['azureedge.net', 'azure.com', 'azurewebsites.net'],
                category: 'Hosting',
                icon: 'https://cdn.simpleicons.org/microsoftazure/0078D4'
            },
            'Firebase': {
                globals: ['firebase'],
                scripts: ['firebaseapp.com', 'firebase.google.com', 'gstatic.com/firebasejs'],
                category: 'Hosting',
                icon: 'https://cdn.simpleicons.org/firebase/FFCA28'
            },
            'Supabase': {
                scripts: ['supabase.co', 'supabase.io'],
                category: 'Hosting',
                icon: 'https://cdn.simpleicons.org/supabase/3FCF8E'
            },

            // PWA & Performance
            'Progressive Web App': {
                selector: 'link[rel="manifest"]',
                category: 'PWA',
                icon: 'https://cdn.simpleicons.org/pwa/5A0FC8'
            },
            'Service Worker': {
                category: 'PWA',
                icon: 'https://cdn.simpleicons.org/pwa/5A0FC8',
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
                icon: 'https://cdn.simpleicons.org/amp/005AF0'
            },

            // Push Notifications
            'OneSignal': {
                globals: ['OneSignal'],
                scripts: ['onesignal.com'],
                category: 'Marketing',
                icon: 'https://cdn.simpleicons.org/onesignal/E8344E'
            },
            'PushEngage': {
                globals: ['_peq'],
                scripts: ['pushengage.com'],
                category: 'Marketing',
                icon: 'https://cdn.simpleicons.org/pushengage/4CAF50'
            },
            'WebPush': {
                globals: ['PushManager'],
                scripts: ['pushwoosh.com', 'web-push'],
                category: 'Marketing',
                icon: 'https://cdn.simpleicons.org/webpush/FF6600'
            },

            // Search
            'Algolia': {
                globals: ['algoliasearch', 'instantsearch'],
                scripts: ['algoliasearch', 'algolia.net', 'algoliacdn.com'],
                category: 'Search',
                icon: 'https://cdn.simpleicons.org/algolia/003DFF'
            },
            'Elasticsearch': {
                scripts: ['elasticsearch', 'elastic.co'],
                category: 'Search',
                icon: 'https://cdn.simpleicons.org/elasticsearch/005571'
            },
            'Meilisearch': {
                scripts: ['meilisearch'],
                category: 'Search',
                icon: 'https://cdn.simpleicons.org/meilisearch/FF5CAA'
            },

            // Video
            'YouTube Embed': {
                selector: 'iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"]',
                category: 'Video',
                icon: 'https://cdn.simpleicons.org/youtube/FF0000'
            },
            'Vimeo Embed': {
                selector: 'iframe[src*="player.vimeo.com"]',
                scripts: ['player.vimeo.com'],
                category: 'Video',
                icon: 'https://cdn.simpleicons.org/vimeo/1AB7EA'
            },
            'Wistia': {
                globals: ['Wistia'],
                scripts: ['wistia.com', 'wistia.net'],
                category: 'Video',
                icon: 'https://cdn.simpleicons.org/wistia/54BBFF'
            },

            // Maps
            'Google Maps': {
                globals: ['google'],
                selector: '.gm-style, iframe[src*="google.com/maps"]',
                scripts: ['maps.googleapis.com', 'maps.google.com'],
                category: 'Maps',
                icon: 'https://cdn.simpleicons.org/googlemaps/4285F4'
            },
            'Mapbox': {
                globals: ['mapboxgl'],
                scripts: ['api.mapbox.com', 'mapbox-gl'],
                category: 'Maps',
                icon: 'https://cdn.simpleicons.org/mapbox/000000'
            },
            'Leaflet': {
                globals: ['L'],
                selector: '.leaflet-container',
                scripts: ['leaflet.js', 'leafletjs.com'],
                category: 'Maps',
                icon: 'https://cdn.simpleicons.org/leaflet/199900'
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
