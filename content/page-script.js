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
        console.log('[Tag Master] Monitoring DataLayer:', dlName);
    }

    // Periodically re-check for DataLayer name changes (e.g. if GTM loads late)
    setInterval(() => {
        if (window.google_tag_manager) {
            for (const key in window.google_tag_manager) {
                if (key.startsWith('GTM-') && window.google_tag_manager[key].dataLayer) {
                    const newName = window.google_tag_manager[key].dataLayer.name;
                    if (newName && newName !== window.__tagMaster.dataLayerName) {
                        console.log('[Tag Master] DataLayer name change detected:', newName);
                        window.__tagMaster.dataLayerName = newName;
                        // Trigger re-init logic if needed
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
                try {
                    const consentData = getConsentState();
                    console.log('[Tag Master] Consent data retrieved:', consentData);
                    reply('CONSENT_STATE', consentData);
                } catch (error) {
                    console.error('[Tag Master] Error getting consent state:', error);
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

        console.log('[Tag Master] Selector mode active for req:', requestId);

        if (!highlightEl) {
            highlightEl = document.createElement('div');
            highlightEl.id = 'tag-master-selector-highlight';
            highlightEl.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;background:rgba(66,133,244,0.15);border:2px solid #4285f4;transition:all 0.05s ease;display:none;box-shadow: 0 0 0 9999px rgba(0,0,0,0.1);';
            document.body.appendChild(highlightEl);

            // Add a floating indicator
            const badge = document.createElement('div');
            badge.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:#4285f4;color:white;padding:8px 16px;border-radius:20px;font-family:sans-serif;font-size:12px;font-weight:bold;z-index:2147483647;box-shadow:0 4px 12px rgba(0,0,0,0.2);pointer-events:none;';
            badge.id = 'tag-master-selector-badge';
            badge.innerHTML = '<span style="margin-right:8px">🎯</span> Tag Master Selection Mode <span style="margin-left:8px;opacity:0.7;font-weight:normal">(ESC to cancel)</span>';
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
            console.error('[Tag Master] Failed to access sessionStorage:', e);
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
        console.warn('[Tag Master] Blocking GA4 Hits (Simulation Mode)');

        // Block sendBeacon
        const originalSendBeacon = navigator.sendBeacon;
        navigator.sendBeacon = function (url, data) {
            if (url && (url.includes('google-analytics.com') || url.includes('analytics.google.com'))) {
                console.info('[Tag Master] Blocked GA4 Beacon:', url);
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
                        console.info('[Tag Master] Blocked GA4 Pixel:', url);
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
                console.info('[Tag Master] Blocked GA4 Fetch:', url);
                return Promise.resolve(new Response(null, { status: 200 }));
            }
            return originalFetch.apply(this, arguments);
        };

        // Block XHR
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url) {
            if (url && (typeof url === 'string') && (url.includes('google-analytics.com') || url.includes('analytics.google.com'))) {
                this._blocked = true;
                console.info('[Tag Master] Blocked GA4 XHR:', url);
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
            console.warn('[Tag Master] Error reading GTM consent:', e);
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
        script.id = 'tag-master-gtm-' + gtmId;
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
        noscript.id = 'tag-master-gtm-noscript-' + gtmId;
        const iframe = document.createElement('iframe');
        iframe.src = 'https://www.googletagmanager.com/ns.html?id=' + gtmId;
        iframe.height = '0';
        iframe.width = '0';
        iframe.style.cssText = 'display:none;visibility:hidden';
        noscript.appendChild(iframe);
        document.body.insertBefore(noscript, document.body.firstChild);

        window.postMessage({
            source: TAG_MASTER_ID,
            type: 'GTM_INJECTED',
            payload: { gtmId, success: true }
        }, '*');
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
            console.warn('[Tag Master] DOM not ready for tech detection');
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
                icon: '⚛️',
                getVersion: () => window.React?.version
            },
            'Vue.js': {
                globals: ['Vue', '__VUE__', '__VUE_DEVTOOLS_GLOBAL_HOOK__'],
                selector: '[data-v-], [v-cloak]',
                category: 'JavaScript Framework',
                icon: '💚',
                getVersion: () => window.Vue?.version
            },
            'Angular': {
                globals: ['ng', 'angular', 'getAllAngularRootElements'],
                selector: '[ng-version], [ng-app], [_ngcontent], [_nghost]',
                category: 'JavaScript Framework',
                icon: '🅰️',
                getVersion: () => document.querySelector('[ng-version]')?.getAttribute('ng-version')
            },
            'Next.js': {
                globals: ['__NEXT_DATA__', '__NEXT_LOADED_PAGES__'],
                selector: '#__next',
                category: 'JavaScript Framework',
                icon: '▲',
                getVersion: () => window.__NEXT_DATA__?.nextExport ? 'SSG' : (window.__NEXT_DATA__ ? 'SSR' : null)
            },
            'Nuxt.js': {
                globals: ['__NUXT__', '$nuxt', '__NUXT_PATHS__'],
                category: 'JavaScript Framework',
                icon: '💚'
            },
            'Gatsby': {
                globals: ['___gatsby', '___GATSBY_INITIAL_RENDER_COMPLETE'],
                selector: '#___gatsby',
                category: 'JavaScript Framework',
                icon: '💜'
            },
            'jQuery': {
                globals: ['jQuery', 'jquery'],
                category: 'JavaScript Library',
                icon: '📜',
                getVersion: () => window.jQuery?.fn?.jquery || window.jQuery?.prototype?.jquery
            },
            'Svelte': {
                globals: ['__svelte', '__SVELTE_HMR'],
                category: 'JavaScript Framework',
                icon: '🔥'
            },
            'Alpine.js': {
                globals: ['Alpine'],
                selector: '[x-data], [x-bind], [x-on]',
                category: 'JavaScript Framework',
                icon: '🏔️',
                getVersion: () => window.Alpine?.version
            },
            'Ember.js': {
                globals: ['Ember', 'Em'],
                selector: '.ember-view, .ember-application',
                category: 'JavaScript Framework',
                icon: '🐹',
                getVersion: () => window.Ember?.VERSION
            },
            'Backbone.js': {
                globals: ['Backbone'],
                category: 'JavaScript Library',
                icon: '🦴',
                getVersion: () => window.Backbone?.VERSION
            },
            'Lodash': {
                globals: ['_'],
                category: 'JavaScript Library',
                icon: '📚',
                getVersion: () => window._?.VERSION
            },
            'Axios': {
                globals: ['axios'],
                category: 'JavaScript Library',
                icon: '📡',
                getVersion: () => window.axios?.VERSION
            },
            'Moment.js': {
                globals: ['moment'],
                category: 'JavaScript Library',
                icon: '⏰',
                getVersion: () => window.moment?.version
            },
            'GSAP': {
                globals: ['gsap', 'TweenMax', 'TweenLite'],
                category: 'JavaScript Library',
                icon: '🎬',
                getVersion: () => window.gsap?.version
            },
            'Three.js': {
                globals: ['THREE'],
                category: 'JavaScript Library',
                icon: '🎮',
                getVersion: () => window.THREE?.REVISION
            },
            'D3.js': {
                globals: ['d3'],
                category: 'JavaScript Library',
                icon: '📊',
                getVersion: () => window.d3?.version
            },

            // CMS
            'WordPress': {
                selector: 'link[href*="wp-content"], link[href*="wp-includes"], meta[name="generator"][content*="WordPress"]',
                scripts: ['wp-content', 'wp-includes', 'wp-json'],
                category: 'CMS',
                icon: '📝'
            },
            'Drupal': {
                globals: ['Drupal'],
                selector: 'meta[name="generator"][content*="Drupal"]',
                scripts: ['drupal.js'],
                category: 'CMS',
                icon: '💧',
                getVersion: () => window.Drupal?.settings?.version
            },
            'Joomla': {
                selector: 'meta[name="generator"][content*="Joomla"]',
                scripts: ['joomla'],
                category: 'CMS',
                icon: '🟠'
            },
            'Shopify': {
                globals: ['Shopify', 'ShopifyAnalytics'],
                selector: 'link[href*="cdn.shopify.com"]',
                scripts: ['cdn.shopify.com'],
                category: 'E-commerce',
                icon: '🛍️',
                getVersion: () => window.Shopify?.theme?.name
            },
            'Webflow': {
                globals: ['Webflow'],
                selector: 'html[data-wf-site], .w-webflow-badge',
                category: 'CMS',
                icon: '🎨'
            },
            'Wix': {
                scripts: ['static.wixstatic.com', 'static.parastorage.com'],
                selector: 'meta[name="generator"][content*="Wix"]',
                category: 'CMS',
                icon: '🌐'
            },
            'Squarespace': {
                globals: ['Static', 'Squarespace'],
                selector: 'link[href*="squarespace"]',
                category: 'CMS',
                icon: '⬛'
            },
            'Ghost': {
                selector: 'meta[name="generator"][content*="Ghost"]',
                category: 'CMS',
                icon: '👻'
            },
            'Contentful': {
                globals: ['contentful'],
                scripts: ['contentful'],
                category: 'CMS',
                icon: '📄'
            },

            // Analytics & Tag Management
            'Google Tag Manager': {
                globals: ['google_tag_manager', 'google_tag_data'],
                scripts: ['googletagmanager.com/gtm.js', 'googletagmanager.com/gtm/js'],
                category: 'Tag Management',
                icon: '🏷️',
                getDetails: () => {
                    const ids = Object.keys(window.google_tag_manager || {}).filter(k => k.startsWith('GTM-'));
                    return ids.length ? ids.join(', ') : null;
                }
            },
            'Google Analytics 4': {
                globals: ['gtag', 'google_tag_data'],
                scripts: ['googletagmanager.com/gtag/js'],
                category: 'Analytics',
                icon: '📊',
                getDetails: () => {
                    const gtagMatch = html.match(/gtag\(['"]config['"],\s*['"](G-[A-Z0-9]+)['"]/);
                    return gtagMatch ? gtagMatch[1] : null;
                }
            },
            'Google Analytics (UA)': {
                globals: ['ga', 'GoogleAnalyticsObject'],
                scripts: ['google-analytics.com/analytics.js', 'google-analytics.com/ga.js'],
                category: 'Analytics',
                icon: '📈',
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
                icon: '📘',
                getDetails: () => window.fbq?.getState?.()?.pixelIDs?.join(', ')
            },
            'Meta Pixel': {
                globals: ['fbq'],
                scripts: ['connect.facebook.net'],
                category: 'Marketing',
                icon: '📘'
            },
            'Hotjar': {
                globals: ['hj', 'hjSiteSettings', '_hjSettings'],
                scripts: ['static.hotjar.com'],
                category: 'Analytics',
                icon: '🔥',
                getDetails: () => window._hjSettings?.hjid
            },
            'Mixpanel': {
                globals: ['mixpanel'],
                scripts: ['cdn.mxpnl.com', 'mixpanel.com'],
                category: 'Analytics',
                icon: '📊'
            },
            'Segment': {
                globals: ['analytics'],
                scripts: ['cdn.segment.com', 'segment.io'],
                category: 'Analytics',
                icon: '💚'
            },
            'Amplitude': {
                globals: ['amplitude'],
                scripts: ['cdn.amplitude.com'],
                category: 'Analytics',
                icon: '📈'
            },
            'Heap': {
                globals: ['heap'],
                scripts: ['heap-analytics.com', 'heapanalytics.com'],
                category: 'Analytics',
                icon: '📊'
            },
            'Clarity': {
                globals: ['clarity'],
                scripts: ['clarity.ms'],
                category: 'Analytics',
                icon: '🔍'
            },
            'FullStory': {
                globals: ['FS', '_fs_host'],
                scripts: ['fullstory.com'],
                category: 'Analytics',
                icon: '🎥'
            },
            'LogRocket': {
                globals: ['LogRocket', '_lr_loaded'],
                scripts: ['cdn.logrocket.io', 'logrocket.com'],
                category: 'Analytics',
                icon: '🚀'
            },
            'Pendo': {
                globals: ['pendo'],
                scripts: ['pendo.io', 'cdn.pendo.io'],
                category: 'Analytics',
                icon: '📍'
            },
            'Mouseflow': {
                globals: ['mouseflow', '_mfq'],
                scripts: ['mouseflow.com'],
                category: 'Analytics',
                icon: '🖱️'
            },
            'Lucky Orange': {
                globals: ['__lo_site_id'],
                scripts: ['luckyorange.com'],
                category: 'Analytics',
                icon: '🍊'
            },
            'Plausible': {
                scripts: ['plausible.io'],
                category: 'Analytics',
                icon: '📊'
            },
            'Matomo': {
                globals: ['_paq', 'Matomo', 'Piwik'],
                scripts: ['matomo', 'piwik'],
                category: 'Analytics',
                icon: '📊'
            },

            // Advertising
            'Google Ads': {
                globals: ['google_trackConversion', 'gtag_report_conversion'],
                scripts: ['googleadservices.com', 'googlesyndication.com/pagead'],
                category: 'Advertising',
                icon: '📢'
            },
            'Google AdSense': {
                globals: ['adsbygoogle'],
                scripts: ['pagead2.googlesyndication.com/pagead/js/adsbygoogle'],
                selector: 'ins.adsbygoogle',
                category: 'Advertising',
                icon: '💰'
            },
            'LinkedIn Insight': {
                globals: ['_linkedin_data_partner_ids', 'lintrk'],
                scripts: ['snap.licdn.com'],
                category: 'Marketing',
                icon: '💼'
            },
            'Twitter Pixel': {
                globals: ['twq'],
                scripts: ['static.ads-twitter.com'],
                category: 'Marketing',
                icon: '🐦'
            },
            'TikTok Pixel': {
                globals: ['ttq'],
                scripts: ['analytics.tiktok.com'],
                category: 'Marketing',
                icon: '🎵'
            },
            'Pinterest Tag': {
                globals: ['pintrk'],
                scripts: ['s.pinimg.com/ct'],
                category: 'Marketing',
                icon: '📌'
            },
            'Snapchat Pixel': {
                globals: ['snaptr'],
                scripts: ['sc-static.net'],
                category: 'Marketing',
                icon: '👻'
            },
            'Reddit Pixel': {
                globals: ['rdt'],
                scripts: ['reddit.com/pixel'],
                category: 'Marketing',
                icon: '🔴'
            },
            'Quora Pixel': {
                globals: ['qp'],
                scripts: ['quora.com/_/ad'],
                category: 'Marketing',
                icon: '❓'
            },
            'Criteo': {
                globals: ['criteo_q'],
                scripts: ['static.criteo.net'],
                category: 'Advertising',
                icon: '🎯'
            },
            'Taboola': {
                globals: ['_tfa'],
                scripts: ['cdn.taboola.com'],
                category: 'Advertising',
                icon: '📰'
            },
            'Outbrain': {
                globals: ['OB_ADV_ID'],
                scripts: ['outbrain.com'],
                category: 'Advertising',
                icon: '📰'
            },

            // E-commerce
            'WooCommerce': {
                globals: ['woocommerce_params', 'wc_add_to_cart_params'],
                selector: '.woocommerce, link[href*="woocommerce"]',
                category: 'E-commerce',
                icon: '🛒'
            },
            'BigCommerce': {
                globals: ['BCData', 'stencilBootstrap'],
                category: 'E-commerce',
                icon: '🛒'
            },
            'Magento': {
                globals: ['Mage', 'mage'],
                selector: 'script[src*="mage"], .cms-index-index',
                category: 'E-commerce',
                icon: '🛒'
            },
            'PrestaShop': {
                globals: ['prestashop'],
                selector: 'meta[name="generator"][content*="PrestaShop"]',
                category: 'E-commerce',
                icon: '🛒'
            },
            'OpenCart': {
                scripts: ['catalog/view/javascript'],
                category: 'E-commerce',
                icon: '🛒'
            },
            'Salesforce Commerce': {
                globals: ['dw'],
                scripts: ['demandware.static'],
                category: 'E-commerce',
                icon: '☁️'
            },
            'Klaviyo': {
                globals: ['klaviyo', '_learnq'],
                scripts: ['static.klaviyo.com'],
                category: 'Marketing',
                icon: '📧'
            },

            // Customer Support
            'Intercom': {
                globals: ['Intercom', 'intercomSettings'],
                scripts: ['widget.intercom.io'],
                category: 'Customer Support',
                icon: '💬'
            },
            'Zendesk': {
                globals: ['zE', 'zESettings', '$zopim'],
                scripts: ['static.zdassets.com', 'zopim.com'],
                category: 'Customer Support',
                icon: '💬'
            },
            'Drift': {
                globals: ['drift', 'driftt'],
                scripts: ['js.driftt.com'],
                category: 'Customer Support',
                icon: '💬'
            },
            'Crisp': {
                globals: ['$crisp', 'CRISP_WEBSITE_ID'],
                scripts: ['client.crisp.chat'],
                category: 'Customer Support',
                icon: '💬'
            },
            'LiveChat': {
                globals: ['LiveChatWidget', '__lc'],
                scripts: ['cdn.livechatinc.com'],
                category: 'Customer Support',
                icon: '💬'
            },
            'Tawk.to': {
                globals: ['Tawk_API', 'Tawk_LoadStart'],
                scripts: ['embed.tawk.to'],
                category: 'Customer Support',
                icon: '💬'
            },
            'HubSpot': {
                globals: ['HubSpotConversations', '_hsq', 'hubspot'],
                scripts: ['js.hs-scripts.com', 'js.hubspot.com', 'hscta.net'],
                category: 'Marketing',
                icon: '🟠'
            },
            'Freshdesk': {
                globals: ['FreshWidget'],
                scripts: ['widget.freshworks.com'],
                category: 'Customer Support',
                icon: '💬'
            },
            'Olark': {
                globals: ['olark'],
                scripts: ['static.olark.com'],
                category: 'Customer Support',
                icon: '💬'
            },

            // CDN & Performance
            'Cloudflare': {
                scripts: ['cdnjs.cloudflare.com', 'cloudflare.com'],
                selector: 'script[src*="cloudflare"]',
                category: 'CDN',
                icon: '☁️'
            },
            'Fastly': {
                scripts: ['fastly.net'],
                category: 'CDN',
                icon: '⚡'
            },
            'Akamai': {
                scripts: ['akamai.net', 'akamaized.net', 'akstat.io'],
                category: 'CDN',
                icon: '🌐'
            },
            'jsDelivr': {
                scripts: ['cdn.jsdelivr.net'],
                category: 'CDN',
                icon: '📦'
            },
            'unpkg': {
                scripts: ['unpkg.com'],
                category: 'CDN',
                icon: '📦'
            },
            'New Relic': {
                globals: ['newrelic', 'NREUM'],
                scripts: ['js-agent.newrelic.com'],
                category: 'Analytics',
                icon: '📊'
            },
            'Datadog RUM': {
                globals: ['DD_RUM'],
                scripts: ['datadoghq.com'],
                category: 'Analytics',
                icon: '🐕'
            },
            'Sentry': {
                globals: ['Sentry', '__SENTRY__'],
                scripts: ['browser.sentry-cdn.com', 'sentry.io'],
                category: 'Analytics',
                icon: '🛡️'
            },
            'Bugsnag': {
                globals: ['bugsnag', 'Bugsnag'],
                scripts: ['bugsnag.com'],
                category: 'Analytics',
                icon: '🐛'
            },

            // A/B Testing
            'Optimizely': {
                globals: ['optimizely', 'optimizelyEdge'],
                scripts: ['cdn.optimizely.com'],
                category: 'A/B Testing',
                icon: '🧪'
            },
            'VWO': {
                globals: ['_vwo_code', 'VWO', '_vis_opt'],
                scripts: ['dev.visualwebsiteoptimizer.com'],
                category: 'A/B Testing',
                icon: '🧪'
            },
            'Google Optimize': {
                globals: ['google_optimize', 'dataLayer'],
                scripts: ['googleoptimize.com'],
                category: 'A/B Testing',
                icon: '🧪'
            },
            'AB Tasty': {
                globals: ['ABTasty'],
                scripts: ['abtasty.com'],
                category: 'A/B Testing',
                icon: '🧪'
            },
            'LaunchDarkly': {
                globals: ['LDClient'],
                scripts: ['launchdarkly.com'],
                category: 'A/B Testing',
                icon: '🚀'
            },
            'Split.io': {
                globals: ['splitio'],
                scripts: ['split.io'],
                category: 'A/B Testing',
                icon: '🧪'
            },

            // Payment
            'Stripe': {
                globals: ['Stripe'],
                scripts: ['js.stripe.com'],
                category: 'Payment',
                icon: '💳'
            },
            'PayPal': {
                globals: ['paypal', 'PAYPAL'],
                scripts: ['paypal.com/sdk', 'paypalobjects.com'],
                category: 'Payment',
                icon: '💳'
            },
            'Braintree': {
                globals: ['braintree'],
                scripts: ['js.braintreegateway.com'],
                category: 'Payment',
                icon: '💳'
            },
            'Square': {
                globals: ['SqPaymentForm', 'Square'],
                scripts: ['squareup.com', 'square.com'],
                category: 'Payment',
                icon: '💳'
            },
            'Klarna': {
                globals: ['Klarna', 'KlarnaOnsiteService'],
                scripts: ['klarna.com'],
                category: 'Payment',
                icon: '💳'
            },
            'Afterpay': {
                globals: ['AfterPay', 'Afterpay'],
                scripts: ['afterpay.com', 'squarecdn.com/afterpay'],
                category: 'Payment',
                icon: '💳'
            },

            // Security
            'reCAPTCHA': {
                globals: ['grecaptcha'],
                scripts: ['google.com/recaptcha', 'gstatic.com/recaptcha'],
                category: 'Security',
                icon: '🔒'
            },
            'hCaptcha': {
                globals: ['hcaptcha'],
                scripts: ['hcaptcha.com'],
                category: 'Security',
                icon: '🔒'
            },
            'Cloudflare Turnstile': {
                globals: ['turnstile'],
                scripts: ['challenges.cloudflare.com/turnstile'],
                category: 'Security',
                icon: '🔒'
            },

            // Fonts
            'Google Fonts': {
                selector: 'link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]',
                scripts: ['fonts.googleapis.com'],
                category: 'Fonts',
                icon: '🔤'
            },
            'Adobe Fonts': {
                globals: ['Typekit'],
                scripts: ['use.typekit.net'],
                category: 'Fonts',
                icon: '🔤'
            },
            'Font Awesome': {
                selector: 'link[href*="fontawesome"], .fa, .fas, .fab, .far',
                scripts: ['fontawesome'],
                category: 'Fonts',
                icon: '🎨'
            },

            // CSS Frameworks
            'Bootstrap': {
                selector: 'link[href*="bootstrap"]',
                scripts: ['bootstrap'],
                category: 'CSS Framework',
                icon: '🅱️',
                getVersion: () => window.bootstrap?.Modal?.VERSION
            },
            'Tailwind CSS': {
                selector: '[class*="tw-"], .container, .flex, .grid, .bg-',
                category: 'CSS Framework',
                icon: '🎨'
            },
            'Bulma': {
                selector: 'link[href*="bulma"]',
                category: 'CSS Framework',
                icon: '🟢'
            },
            'Foundation': {
                globals: ['Foundation'],
                selector: 'link[href*="foundation"]',
                category: 'CSS Framework',
                icon: '🏗️'
            },
            'Material UI': {
                selector: '[class*="MuiBox"], [class*="MuiButton"], [class*="makeStyles"]',
                category: 'CSS Framework',
                icon: '🎨'
            },
            'Chakra UI': {
                selector: '[class*="chakra-"]',
                category: 'CSS Framework',
                icon: '⚡'
            },
            'Ant Design': {
                selector: '[class*="ant-"], .antd',
                category: 'CSS Framework',
                icon: '🐜'
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
                    console.debug('[Tag Master] Selector error for', name, ':', e.message);
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
                        console.debug('[Tag Master] Version detection error for', name, ':', e.message);
                    }
                }

                // Get details if available
                if (sig.getDetails) {
                    try {
                        details = sig.getDetails();
                    } catch (e) {
                        console.debug('[Tag Master] Details detection error for', name, ':', e.message);
                    }
                }

                detected.push({
                    name,
                    category: sig.category,
                    icon: sig.icon,
                    version: version || null,
                    details: details || null
                });
            }
        }

        // Sort by category then name
        detected.sort((a, b) => {
            if (a.category !== b.category) return a.category.localeCompare(b.category);
            return a.name.localeCompare(b.name);
        });

        console.log('[Tag Master] Detected', detected.length, 'technologies:', detected.map(t => t.name).join(', '));
        return detected;
    }

    console.log('[Tag Master] Page script initialized');
})();
