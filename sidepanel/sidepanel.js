/**
 * Swiss Knife for Google - Side Panel (Vanilla JS)
 */

// ============================================
// Constants
// ============================================
const MESSAGE_TYPES = {
  DATALAYER_PUSH: 'DATALAYER_PUSH',
  DATALAYER_GET: 'DATALAYER_GET',
  DATALAYER_CLEAR: 'DATALAYER_CLEAR',
  GTM_INJECT: 'GTM_INJECT',
  GTM_DETECT: 'GTM_DETECT',
  TAB_UPDATED: 'TAB_UPDATED',
  CODE_EXECUTE: 'CODE_EXECUTE',
  CODE_RESULT: 'CODE_RESULT'
};

const PRESETS = {
  page_view: {
    event: 'page_view',
    page_title: '{{page_title}}',
    page_location: '{{page_url}}'
  },
  purchase: {
    event: 'purchase',
    ecommerce: {
      transaction_id: 'T_{{timestamp}}',
      value: 99.99,
      currency: 'USD',
      items: [{ item_id: 'SKU_12345', item_name: 'Sample Product', price: 99.99, quantity: 1 }]
    }
  },
  add_to_cart: {
    event: 'add_to_cart',
    ecommerce: {
      currency: 'USD',
      value: 29.99,
      items: [{ item_id: 'SKU_12345', item_name: 'Sample Product', price: 29.99, quantity: 1 }]
    }
  },
  begin_checkout: {
    event: 'begin_checkout',
    ecommerce: { currency: 'USD', value: 99.99, items: [] }
  },
  login: { event: 'login', method: 'email' },
  sign_up: { event: 'sign_up', method: 'email' }
};

// ============================================
// State
// ============================================
// ============================================
// State
// ============================================
let events = [];
let networkRequests = [];
let currentTab = 'gtm';

// ============================================
// DOM Elements
// ============================================
const elements = {
  tabs: document.querySelectorAll('.tab'),
  panels: document.querySelectorAll('.panel'),
  gtmIdInput: document.getElementById('gtmIdInput'),
  injectBtn: document.getElementById('injectBtn'),
  initDataLayer: document.getElementById('initDataLayer'),
  overrideExisting: document.getElementById('overrideExisting'),
  previewMode: document.getElementById('previewMode'),
  recentList: document.getElementById('recentList'),
  containerList: document.getElementById('containerList'),
  refreshContainers: document.getElementById('refreshContainers'),
  eventFilter: document.getElementById('eventFilter'),
  clearEvents: document.getElementById('clearEvents'),
  eventList: document.getElementById('eventList'),
  // Network Elements
  clearNetwork: document.getElementById('clearNetwork'),
  networkList: document.getElementById('networkList'),

  // Injected Elements
  injectedSection: document.getElementById('injectedSection'),
  injectedList: document.getElementById('injectedList'),

  presetButtons: document.getElementById('presetButtons'),
  jsonEditor: document.getElementById('jsonEditor'),
  jsonError: document.getElementById('jsonError'),
  pushBtn: document.getElementById('pushBtn'),
  currentUrl: document.getElementById('currentUrl'),
  toast: document.getElementById('toast'),
  // Session Deep Dive
  sessionBar: document.getElementById('sessionDeepDive'),
  deepTid: document.getElementById('deepTid'),
  deepSid: document.getElementById('deepSid'),
  deepCid: document.getElementById('deepCid'),
  // Export
  exportJson: document.getElementById('exportJson'),
  exportCsv: document.getElementById('exportCsv'),
  // Audit
  runAudit: document.getElementById('runAudit'),
  auditResults: document.getElementById('auditResults'),
  // Snippets
  snippetList: document.getElementById('snippetList'),
  // Element Picker
  pickElementBtn: document.getElementById('pickElementBtn'),
  captureHighlightBtn: document.getElementById('captureHighlightBtn'),
  selectorResult: document.getElementById('selectorResult'),
  pickedSelector: document.getElementById('pickedSelector'),
  pickedJsTest: document.getElementById('pickedJsTest'),
  copyJsTest: document.getElementById('copyJsTest'),
  runJsTest: document.getElementById('runJsTest'),
  testResultArea: document.getElementById('testResultArea'),
  testResultValue: document.getElementById('testResultValue'),
  pickedJsVar: document.getElementById('pickedJsVar'),
  copyJsVar: document.getElementById('copyJsVar'),
  saveAsSnippet: document.getElementById('saveAsSnippet'),
  triggerSuggestions: document.getElementById('triggerSuggestions'),
  triggerList: document.getElementById('triggerList'),
  // Cookies
  refreshCookies: document.getElementById('refreshCookies'),
  cookieList: document.getElementById('cookieList'),
  // Consent
  refreshConsent: document.getElementById('refreshConsent'),
  consentList: document.getElementById('consentList'),
  consentWarning: document.getElementById('consentWarning'),
  // Theme
  themeToggle: document.getElementById('themeToggle'),
  // Support Link
  mainSupportLink: document.getElementById('mainSupportLink')
};

// Re-verify elements in case some were late-loaded or moved
function verifyElements() {
  for (const key in elements) {
    if (!elements[key]) {
      elements[key] = document.getElementById(key);
    }
  }
}

// ============================================
// Theme Management
// ============================================
async function initTheme() {
  const stored = await chrome.storage.local.get('theme');
  const theme = stored.theme || 'light';
  document.body.setAttribute('data-theme', theme);
}

if (elements.themeToggle) {
  elements.themeToggle.addEventListener('click', async () => {
    const currentTheme = document.body.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    await chrome.storage.local.set({ theme: newTheme });
    showToast(`${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} mode active`);
  });
}

// ... (Utility Functions) ...

async function checkActiveInjection() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;

    const hostname = new URL(tab.url).hostname;
    const key = 'gtm_inject_' + hostname;
    const stored = await chrome.storage.local.get(key);
    const config = stored[key];

    if (config) {
      elements.injectedSection.style.display = 'block';
      elements.injectedList.innerHTML = `
        <div class="container-item" style="border-color:var(--accent-blue)">
          <div class="container-info">
            <div class="container-icon gtm">GTM</div>
            <div>
              <div class="container-id">${config.gtmId}</div>
              <div class="container-type" style="color:var(--accent-blue)">Active & Persisted</div>
            </div>
          </div>
          <div style="display:flex;gap:4px">
             <button class="btn-icon btn-small ta-btn" title="Open Tag Assistant">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
             </button>
             <button class="btn-icon btn-small remove-inject-btn" title="Remove Injection">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                   <line x1="18" y1="6" x2="6" y2="18"></line>
                   <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
             </button>
          </div>
        </div>
      `;

      // Tag Assistant Button Logic
      elements.injectedList.querySelector('.ta-btn').addEventListener('click', async () => {
        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (currentTab?.url) {
          const taUrl = `https://tagassistant.google.com/#/source/TAG_MANAGER?id=${config.gtmId}&url=${encodeURIComponent(currentTab.url)}`;
          window.open(taUrl, '_blank');
        }
      });

      // Remove Logic
      elements.injectedList.querySelector('.remove-inject-btn').addEventListener('click', async () => {
        await chrome.storage.local.remove(key);
        elements.injectedSection.style.display = 'none';
        chrome.tabs.reload(); // Reload to clear
      });

    } else {
      elements.injectedSection.style.display = 'none';
    }
  } catch (e) {
    console.error('Check active injection failed', e);
  }
}

// ============================================
// Utility Functions
// ============================================
function formatTimestamp(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

function validateGTMId(id) {
  const gtmPattern = /^GTM-[A-Z0-9]{6,8}$/;
  const rawPattern = /^[A-Z0-9]{6,8}$/i;

  if (gtmPattern.test(id)) return { valid: true, formatted: id };
  if (rawPattern.test(id.replace('GTM-', ''))) {
    return { valid: true, formatted: id.startsWith('GTM-') ? id : `GTM-${id.toUpperCase()}` };
  }
  return { valid: false, formatted: null };
}

function showToast(message, type = 'success') {
  elements.toast.textContent = message;
  elements.toast.className = `toast ${type}`;
  elements.toast.style.display = 'flex';
  setTimeout(() => { elements.toast.style.display = 'none'; }, 3000);
}

function processTemplate(obj, tab) {
  let str = JSON.stringify(obj);
  str = str.replace(/\{\{timestamp\}\}/g, Date.now());
  str = str.replace(/\{\{transaction_id\}\}/g, 'T-' + Math.floor(Math.random() * 1000000));
  str = str.replace(/\{\{value\}\}/g, (Math.random() * 100).toFixed(2));
  str = str.replace(/\{\{page_title\}\}/g, (tab?.title || 'Sample Page').replace(/"/g, '\"'));
  str = str.replace(/\{\{page_url\}\}/g, tab?.url || 'https://example.com');
  return JSON.parse(str);
}

// ============================================
// Tab Navigation
// ============================================
elements.tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;

    elements.tabs.forEach(t => t.classList.remove('active'));
    elements.panels.forEach(p => p.classList.remove('active'));

    tab.classList.add('active');
    document.getElementById(`panel-${tabName}`).classList.add('active');
    currentTab = tabName;

    if (tabName === 'network') renderNetworkRequests();
    if (tabName === 'consent') loadConsentState();
    if (tabName === 'cookies') refreshCookies();
    if (tabName === 'push') {
      renderSnippets();
      renderSavedTriggers();
    }
    if (tabName === 'audit' && elements.auditResults.children.length <= 1) runAudit();
    if (tabName === 'about') verifyElements();
  });
});

if (elements.mainSupportLink) {
  elements.mainSupportLink.addEventListener('click', (e) => {
    e.preventDefault();
    const aboutTab = Array.from(elements.tabs).find(t => t.dataset.tab === 'about');
    if (aboutTab) aboutTab.click();
  });
}

// ============================================
// GTM Injector
// ============================================
elements.gtmIdInput.addEventListener('input', (e) => {
  const value = e.target.value.toUpperCase();
  e.target.value = value;

  if (value.length >= 6) {
    const result = validateGTMId(value);
    e.target.className = `input ${result.valid ? 'success' : 'error'}`;
  } else {
    e.target.className = 'input';
  }
});

elements.injectBtn.addEventListener('click', async () => {
  const result = validateGTMId(elements.gtmIdInput.value);
  if (!result.valid) {
    showToast('Invalid GTM ID format', 'error');
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.GTM_INJECT,
      gtmId: result.formatted,
      options: {
        initDataLayer: elements.initDataLayer.checked,
        override: elements.overrideExisting.checked,
        preview: elements.previewMode.checked
      }
    });

    if (response?.success) {
      showToast(`GTM ${result.formatted} injected!`, 'success');
      elements.gtmIdInput.value = '';
      elements.gtmIdInput.className = 'input';
      loadRecentIds();
      // Persist injection for this host
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        try {
          const hostname = new URL(tab.url).hostname;
          await chrome.storage.local.set({
            ['gtm_inject_' + hostname]: {
              gtmId: result.formatted,
              options: {
                initDataLayer: elements.initDataLayer.checked,
                override: elements.overrideExisting.checked,
                preview: elements.previewMode.checked
              }
            }
          });
          checkActiveInjection();
        } catch (e) { console.error('Storage save failed', e); }
      }

      setTimeout(() => detectContainers(false), 2000);
    } else {
      showToast(response?.error || 'Injection failed', 'error');
    }
  } catch (e) {
    showToast(e.message, 'error');
  }
});

async function loadRecentIds() {
  const result = await chrome.storage.local.get('recentGTMIds');
  const recentIds = result.recentGTMIds || [];

  elements.recentList.innerHTML = recentIds.length ? recentIds.map(id =>
    `<button class="recent-item" data-id="${id}">${id}</button>`
  ).join('') : '<span style="color:var(--text-muted);font-size:11px">No recent IDs</span>';

  elements.recentList.querySelectorAll('.recent-item').forEach(btn => {
    btn.addEventListener('click', () => {
      elements.gtmIdInput.value = btn.dataset.id;
      elements.gtmIdInput.className = 'input success';
    });
  });
}

let detectionRetries = 0;
const MAX_RETRIES = 3;

async function detectContainers(isRetry = false) {
  if (!isRetry) {
    elements.refreshContainers.querySelector('svg').classList.add('spin-animation');
  }

  try {
    const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GTM_DETECT });

    // Handle error response or invalid data
    if (response && response.error) {
      // If it was manual click, throw error to show UI message
      // If auto-retry, just suppress
      if (!isRetry) throw new Error(response.error);
      return;
    }

    const containers = Array.isArray(response) ? response : [];

    if (containers.length > 0) {
      detectionRetries = 0;
      elements.refreshContainers.querySelector('svg').classList.remove('spin-animation');
      elements.containerList.innerHTML = containers.map(c => {
        const ga4DebugUrl = c.type === 'GA4' ? `https://analytics.google.com/analytics/web/#/p${c.id.replace('G-', '')}/debugview` : null;
        return `
        <div class="container-item">
          <div class="container-info">
            <div class="container-icon ${c.type?.toLowerCase() || 'gtm'}">${c.type === 'GA4' ? 'G4' : 'GTM'}</div>
            <div>
              <div class="container-id">${c.id}</div>
              <div class="container-type">${c.type || 'GTM'} ${c.dataLayer ? `(${c.dataLayer})` : ''}</div>
            </div>
          </div>
          <div style="display:flex;gap:4px">
            ${ga4DebugUrl ? `
              <a href="${ga4DebugUrl}" target="_blank" class="btn-icon btn-small" title="Open GA4 DebugView" style="color:var(--google-blue);border-color:var(--google-blue);text-decoration:none;display:flex">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
              </a>
            ` : ''}
            <button class="btn-icon btn-small" onclick="navigator.clipboard.writeText('${c.id}')" title="Copy ID">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          </div>
        </div>
      `}).join('');
    } else {
      if (detectionRetries < MAX_RETRIES) {
        detectionRetries++;
        if (detectionRetries === 1) {
          elements.containerList.innerHTML = `<div class="empty-state"><p>Scanning...</p></div>`;
        }
        setTimeout(() => detectContainers(true), detectionRetries * 1000);
        return;
      }

      elements.refreshContainers.querySelector('svg').classList.remove('spin-animation');
      elements.containerList.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:32px;height:32px">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
          </svg>
          <p>No containers detected</p>
        </div>
      `;
    }
  } catch (err) {
    console.error('Detection failed:', err);
    elements.containerList.innerHTML = `<div class="empty-state"><p style="color:var(--error-red)">Error: ${err.message}</p></div>`;
    elements.refreshContainers.querySelector('svg').classList.remove('spin-animation');
  }
}

// ============================================
// Consent Management
// ============================================
async function loadConsentState() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_CONSENT_STATE' });
  if (response) {
    renderConsentState(response);
  }
}

function renderConsentState(state) {
  const items = Object.entries(state);
  const isV2Ready = state.ad_user_data !== 'unknown' && state.ad_personalization !== 'unknown';

  if (elements.consentWarning) {
    elements.consentWarning.style.display = isV2Ready ? 'none' : 'block';
  }

  elements.consentList.innerHTML = items.map(([key, value]) => {
    const isGranted = value === 'granted';
    const isUnknown = value === 'unknown';

    return `
      <div class="container-item" style="padding: 8px 12px">
        <div style="font-size: 11px; font-weight: 500">${key.replace('_storage', '')}</div>
        <div class="badge" style="background:${isUnknown ? 'var(--bg-hover)' : (isGranted ? 'var(--success-green)' : 'var(--error-red)')}; color: white; font-size: 9px; padding: 2px 6px; border-radius: 4px; font-weight: bold; text-transform: uppercase">
          ${value}
        </div>
      </div>
    `;
  }).join('');
}

if (elements.refreshConsent) {
  elements.refreshConsent.addEventListener('click', loadConsentState);
}

elements.refreshContainers.addEventListener('click', () => {
  detectionRetries = 0;
  detectContainers(false);
});

// ============================================
// DataLayer Monitor
// ============================================
function renderEvents() {
  const filter = elements.eventFilter.value.toLowerCase();
  const filtered = events.filter(e =>
    !filter || JSON.stringify(e.data).toLowerCase().includes(filter)
  );

  if (filtered.length > 0) {
    elements.eventList.innerHTML = filtered.slice().reverse().map(event => {
      // Validation Logic
      let warnings = [];
      const data = event.data?.data || event.data || event; // Try various depths
      const eventName = data?.event || data?.['0'] || event.eventName || 'push';
      const jsonString = JSON.stringify(data, null, 2);

      const ecEvents = ['purchase', 'add_to_cart', 'begin_checkout', 'view_item', 'view_item_list', 'select_item', 'remove_from_cart', 'add_to_wishlist'];
      if (ecEvents.includes(eventName)) {
        const ecommerce = data.ecommerce || data;
        const items = ecommerce.items || data.items;

        if (!items || !Array.isArray(items) || items.length === 0) {
          warnings.push('Missing "items" array');
        } else {
          // Check first item for common issues
          const firstItem = items[0];
          if (!firstItem.item_id && !firstItem.item_name) warnings.push('Item needs id or name');
          if (firstItem.price === undefined) warnings.push('Item missing price');
        }

        if (eventName === 'purchase') {
          if (!ecommerce.transaction_id) warnings.push('Missing "transaction_id"');
          if (ecommerce.value === undefined) warnings.push('Missing "value"');
          if (!ecommerce.currency) warnings.push('Missing "currency"');
        }
      }

      const validationHtml = warnings.length > 0 ? `
         <div class="validation-warning">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            ${warnings.join(', ')}
         </div>
       ` : '';

      return `
      <div class="event-item expanded" data-id="${event.id}">
        <div class="event-header">
           <div style="display:flex;flex-direction:column;gap:2px">
             <span style="font-size:10px;color:var(--text-secondary)">${formatTimestamp(event.timestamp)}</span>
             <span class="event-name">${eventName}</span>
           </div>
           <div class="event-actions">
              <button class="copy-btn" title="Copy JSON" data-json='${jsonString.replace(/'/g, "&apos;")}'>
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
           </div>
        </div>
        ${validationHtml}
        <div class="event-details">${jsonString}</div>
      </div>
    `}).join('');

    // Attach Listeners
    elements.eventList.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const json = btn.dataset.json;
        navigator.clipboard.writeText(json).then(() => {
          const originalHTML = btn.innerHTML;
          btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:var(--success-green)"><polyline points="20 6 9 17 4 12"/></svg>`;
          setTimeout(() => btn.innerHTML = originalHTML, 1500);
        });
      });
    });

    // Toggle details on header click
    elements.eventList.querySelectorAll('.event-header').forEach(header => {
      header.addEventListener('click', () => {
        const item = header.parentElement;
        const details = item.querySelector('.event-details');
        const isHidden = details.style.display === 'none';
        details.style.display = isHidden ? 'block' : 'none';
      });
    });

  } else {
    elements.eventList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:32px;height:32px">
          <polygon points="12 2 2 7 12 12 22 7 12 2"/>
          <polyline points="2 17 12 22 22 17"/>
          <polyline points="2 12 12 17 22 12"/>
        </svg>
        <p>No dataLayer events yet</p>
        <p style="font-size:11px;margin-top:4px">Events will appear here</p>
      </div>
    `;
  }
}

elements.eventFilter.addEventListener('input', renderEvents);

elements.clearEvents.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: MESSAGE_TYPES.DATALAYER_CLEAR });
  events = [];
  renderEvents();
});

async function loadEvents() {
  try {
    const result = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.DATALAYER_GET });
    if (Array.isArray(result)) {
      events = result;
      renderEvents();
    }
  } catch (e) {
    console.error('Failed to load events:', e);
  }
}


// ============================================
// Network Monitor
// ============================================
function renderNetworkRequests() {
  if (networkRequests.length > 0) {
    elements.networkList.innerHTML = networkRequests.slice(-50).reverse().map(req => {
      let urlObj;
      try { urlObj = new URL(req.url); } catch { urlObj = { pathname: req.url, searchParams: [] } }
      const isSuccess = (req.statusCode >= 200 && req.statusCode < 300) || req.statusCode === 0;

      const paramRows = [];
      if (urlObj.searchParams) {
        urlObj.searchParams.forEach((val, key) => {
          paramRows.push(`<div class="param-key">${key}:</div><div class="param-value">${val}</div>`);
        });
      }

      const badgeHtml = `
        <div class="network-badges">
          ${req.isServerSide ? '<span class="badge badge-server">Server-Side</span>' : ''}
          ${req.hasEnhancedConversions ? '<span class="badge badge-ec">Enhanced Conversions</span>' : ''}
        </div>
      `;

      return `
      <div class="network-item" style="border-left: 3px solid ${req.typeColor || '#ccc'}">
        <div class="network-header">
           <span class="network-method ${req.method}">${req.method || 'GET'}</span>
           <span class="network-type">${req.typeName || req.type}</span>
           <span class="network-status ${isSuccess ? 'success' : 'error'}">${req.statusCode || (req.error ? 'ERR' : '...')}</span>
           <span style="margin-left:auto;font-size:10px;color:var(--text-muted)">${formatTimestamp(req.timestamp)}</span>
        </div>
        <div class="network-url" title="${req.url}">${urlObj.pathname}</div>
        ${badgeHtml}
        <div class="network-details" style="display:none">
            <div style="margin-bottom:12px;display:flex;flex-direction:column;gap:8px">
               ${req.hasEnhancedConversions ? `
                 <div class="validation-warning" style="background:rgba(34,197,94,0.1);color:var(--success-green);border-color:rgba(34,197,94,0.3)">
                   <strong>Enhanced Conversions Detected</strong>
                   <ul style="margin-left:14px;font-size:10px">
                     ${Object.keys(req.ecValidation.fields).map(f => `<li>${f}: ${req.ecValidation.fields[f].type}</li>`).join('')}
                   </ul>
                 </div>
               ` : ''}
            </div>
            <div style="margin-bottom:6px;color:var(--text-secondary)"><strong>Request URL:</strong></div>
            <div style="word-break:break-all;color:var(--text-primary);font-family:'Consolas',monospace;font-size:11px;margin-bottom:12px;padding:6px;background:var(--bg-primary);border-radius:4px">${req.url}</div>
            
            ${paramRows.length ? `
              <div style="margin-bottom:6px;color:var(--text-secondary)"><strong>Query Parameters:</strong></div>
              <div class="network-params">
                ${paramRows.join('')}
              </div>
            ` : ''}
        </div>
      </div>
    `}).join('');

    elements.networkList.querySelectorAll('.network-item').forEach(item => {
      item.addEventListener('click', () => {
        const detailsEl = item.querySelector('.network-details');
        const isExpanded = detailsEl.style.display !== 'none';
        detailsEl.style.display = isExpanded ? 'none' : 'block';
        if (!isExpanded) {
          item.style.borderColor = 'var(--accent-blue)';
        } else {
          item.style.borderColor = 'var(--border)';
        }
      });
    });
  } else {
    elements.networkList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:32px;height:32px">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
        <p>No network requests</p>
      </div>
    `;
  }
}


async function loadNetworkRequests() {
  try {
    // NETWORK_GET typically returns all requests for current tab 
    // We haven't implemented MESSAGE_TYPES.NETWORK_GET listener fully with tabId filtering in sidepanel context easily
    // But service worker supports it. We need current tab ID.
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    const result = await chrome.runtime.sendMessage({
      type: 'NETWORK_GET',
      tabId: tab.id
    });

    if (Array.isArray(result)) {
      networkRequests = result;
      renderNetworkRequests();
    }
  } catch (e) {
    console.warn('Failed to load network requests:', e);
  }
}

if (elements.clearNetwork) {
  elements.clearNetwork.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'NETWORK_CLEAR' });
    networkRequests = [];
    renderNetworkRequests();
  });
}

// ============================================
// Visual Element Picker
// ============================================
elements.pickElementBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    chrome.tabs.sendMessage(tab.id, { type: 'SELECTOR_START' });
    showToast('Click an element on the page', 'info');
  }
});

elements.captureHighlightBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    chrome.tabs.sendMessage(tab.id, { type: 'SELECTOR_FROM_HIGHLIGHT' });
  }
});

// ============================================
// DataLayer Push
// ============================================
elements.presetButtons.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const preset = PRESETS[btn.dataset.preset];
    if (preset) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const processed = processTemplate(preset, tab);
      elements.jsonEditor.value = JSON.stringify(processed, null, 2);
      elements.jsonError.style.display = 'none';
      elements.jsonEditor.className = 'json-editor';
    }
  });
});

elements.jsonEditor.addEventListener('input', () => {
  try {
    JSON.parse(elements.jsonEditor.value);
    elements.jsonError.style.display = 'none';
    elements.jsonEditor.className = 'json-editor';
  } catch (e) {
    elements.jsonError.textContent = e.message;
    elements.jsonError.style.display = 'block';
    elements.jsonEditor.className = 'json-editor error';
  }
});

elements.pushBtn.addEventListener('click', async () => {
  try {
    const data = JSON.parse(elements.jsonEditor.value);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab) {
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: MESSAGE_TYPES.DATALAYER_PUSH,
        data
      });

      if (response && response.error) {
        showToast(response.error, 'error');
      } else {
        showToast(`Event "${data.event || 'push'}" sent!`, 'success');
        // Refresh events list after a short delay to allow round-trip
        setTimeout(loadEvents, 800);
      }
    }
  } catch (e) {
    showToast(e.message, 'error');
  }
});

// Set default JSON
elements.jsonEditor.value = JSON.stringify(processTemplate(PRESETS.page_view), null, 2);

// ============================================
// Message Listener
// ============================================
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === MESSAGE_TYPES.DATALAYER_PUSH) {
    events.push(message.data);
    renderEvents();
  } else if (message.type === 'NETWORK_REQUEST') {
    networkRequests.push(message.data);
    if (currentTab === 'network') {
      renderNetworkRequests();
    }
  } else if (message.type === 'GA4_SESSION_UPDATE') {
    updateSessionDeepDive(message.data);
  } else if (message.type === MESSAGE_TYPES.TAB_UPDATED) {
    updateCurrentUrl(message.data.url);
    checkActiveInjection();
    detectContainers();
    resetSessionDeepDive();
    if (currentTab === 'cookies') refreshCookies();
  } else if (message.type === 'SELECTOR_RESULT') {
    verifyElements();
    if (message.payload.error) {
      showToast(message.payload.error, 'error');
      return;
    }
    const { selector, tagName, id, classes, attributes, innerText } = message.payload;
    if (!selector) return;

    // UI Updates
    if (elements.selectorResult) {
      elements.selectorResult.style.display = 'block';
      elements.selectorResult.classList.remove('result-pulse');
      void elements.selectorResult.offsetWidth;
      elements.selectorResult.classList.add('result-pulse');
    }
    if (elements.testResultArea) elements.testResultArea.style.display = 'none';
    if (elements.pickedSelector) elements.pickedSelector.textContent = selector;

    // 1. Generate Trigger Suggestions
    let triggerHtml = '<div style="display:flex;flex-direction:column;gap:8px">';
    const suggestions = [];

    if (id) {
      suggestions.push({
        type: 'Click ID',
        condition: 'equals',
        value: id,
        desc: 'Most stable method'
      });
    }

    if (classes && classes.length > 0) {
      suggestions.push({
        type: 'Click Classes',
        condition: 'contains',
        value: classes[0],
        desc: 'Class-based targeting'
      });
    }

    // data-attributes are gold for GTM
    Object.keys(attributes || {}).forEach(attr => {
      if (attr.startsWith('data-')) {
        suggestions.push({
          type: 'Click Element',
          condition: 'matches CSS selector',
          value: `[${attr}="${attributes[attr]}"]`,
          desc: 'Flexible data-attribute'
        });
      }
    });

    // Fallback: CSS Selector
    suggestions.push({
      type: 'Click Element',
      condition: 'matches CSS selector',
      value: selector,
      desc: 'Hierarchical path'
    });

    triggerHtml += suggestions.map((s, idx) => `
      <div style="background:var(--bg-secondary);padding:8px;border:1px solid var(--border);border-radius:4px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;align-items:center">
          <span style="font-weight:bold;color:var(--google-blue)">${s.type}</span>
          <div style="display:flex;gap:4px;align-items:center">
             <span style="font-size:9px;color:var(--text-muted)">${s.desc}</span>
             <button class="btn-icon btn-small save-trigger-btn" 
                     data-id="${Date.now() + idx}" 
                     data-type="${s.type}" 
                     data-condition="${s.condition}" 
                     data-value="${s.value.replace(/"/g, '&quot;')}" 
                     title="Save to Library">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
             </button>
          </div>
        </div>
        <div style="font-size:10px;margin-bottom:4px">Condition: <span style="color:var(--text-secondary)">${s.condition}</span></div>
        <div style="font-family:monospace;background:var(--bg-primary);padding:4px;border-radius:2px;word-break:break-all">${s.value}</div>
      </div>
    `).join('');
    triggerHtml += '</div>';

    if (elements.triggerSuggestions) {
      elements.triggerSuggestions.innerHTML = triggerHtml;

      // Attach save listeners
      elements.triggerSuggestions.querySelectorAll('.save-trigger-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const trigger = {
            id: btn.dataset.id,
            type: btn.dataset.type,
            condition: btn.dataset.condition,
            value: btn.dataset.value,
            timestamp: Date.now()
          };
          await saveTrigger(trigger);
        });
      });
    }

    // 2. Generate Code
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName);
    const getter = isInput ? 'el.value' : 'el.innerText';
    const escapedSelector = selector.replace(/'/g, "\\'");

    const gtmCode = `function() {
  var el = document.querySelector('${escapedSelector}');
  return el ? ${getter} : undefined;
}`;

    const testCode = `(function() {
  var el = document.querySelector('${escapedSelector}');
  var val = el ? ${getter} : undefined;
  console.log('GTM Variable Value:', val);
  return val;
})();`;

    if (elements.pickedJsVar) elements.pickedJsVar.textContent = gtmCode;
    if (elements.pickedJsTest) elements.pickedJsTest.textContent = testCode;

    showToast('Trigger & Variable generated!', 'success');
  }
});

// Copy Listeners
[
  { btn: elements.copyJsVar, el: elements.pickedJsVar, msg: 'GTM Code copied!' },
  { btn: elements.copyJsTest, el: elements.pickedJsTest, msg: 'Test Code copied!' }
].forEach(target => {
  if (target.btn) {
    target.btn.addEventListener('click', () => {
      navigator.clipboard.writeText(target.el.textContent).then(() => {
        showToast(target.msg, 'success');
      });
    });
  }
});


if (elements.saveAsSnippet) {
  elements.saveAsSnippet.addEventListener('click', async () => {
    const code = elements.pickedJsVar.textContent;
    const name = prompt('Enter a name for this snippet:', 'GTM Var: ' + (elements.pickedSelector.textContent.substring(0, 20)));

    if (name && code) {
      const newSnippet = {
        id: 'custom_' + Date.now(),
        name: name,
        code: code,
        isCustom: true
      };

      const stored = await chrome.storage.local.get('custom_snippets');
      const snippets = stored.custom_snippets || [];
      snippets.push(newSnippet);
      await chrome.storage.local.set({ 'custom_snippets': snippets });

      showToast('Snippet saved to library!', 'success');
      if (currentTab === 'push') renderSnippets();
    }
  });
}

if (elements.runJsTest) {
  elements.runJsTest.addEventListener('click', async () => {
    const codeSnippet = elements.pickedJsTest.textContent;
    // Extract the internal function or execute the whole block
    // Since it's console.log((function(){...})()), we'll execute it and capture the return
    try {
      elements.runJsTest.querySelector('svg').classList.add('spin-animation');

      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.CODE_EXECUTE,
        code: codeSnippet
      });

      elements.runJsTest.querySelector('svg').classList.remove('spin-animation');

      if (response && response.success) {
        elements.testResultArea.style.display = 'block';
        const resultValue = response.result;
        elements.testResultValue.textContent = (resultValue === undefined) ? 'undefined' :
          (resultValue === null ? 'null' : JSON.stringify(resultValue));
        elements.testResultValue.style.color = resultValue ? 'var(--success-green)' : 'var(--error-red)';
      } else {
        showToast(response?.error || 'Test failed', 'error');
      }
    } catch (e) {
      elements.runJsTest.querySelector('svg').classList.remove('spin-animation');
      console.error('Test Execution Error:', e);
    }
  });
}

function updateSessionDeepDive(data) {
  if (!data) return;
  elements.sessionBar.style.display = 'flex';
  if (data.tid) elements.deepTid.textContent = data.tid;
  if (data.sid) elements.deepSid.textContent = data.sid;
  if (data.cid) elements.deepCid.textContent = data.cid;
}

function resetSessionDeepDive() {
  elements.sessionBar.style.display = 'none';
  elements.deepTid.textContent = '-';
  elements.deepSid.textContent = '-';
  elements.deepCid.textContent = '-';
}

// ============================================
// Export Functions
// ============================================
elements.exportJson.addEventListener('click', () => {
  const data = {
    events,
    networkRequests,
    timestamp: new Date().toISOString(),
    url: elements.currentUrl.textContent
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `swiss-knife-export-${Date.now()}.json`;
  a.click();
  showToast('JSON Exported');
});

elements.exportCsv.addEventListener('click', () => {
  if (events.length === 0) return showToast('No events to export', 'error');

  const headers = ['Timestamp', 'Event', 'Data'];
  const rows = events.map(e => [
    formatTimestamp(e.timestamp),
    e.event || e.data?.event || 'push',
    JSON.stringify(e.data).replace(/"/g, '""')
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(r => r.map(v => `"${v}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `swiss-knife-events-${Date.now()}.csv`;
  a.click();
  showToast('CSV Exported');
});

// Listen for tab switching
chrome.tabs.onActivated.addListener(() => {
  getCurrentTab();
  checkActiveInjection();
  detectContainers();
});

// ============================================
// Current URL
// ============================================
async function updateCurrentUrl(url) {
  if (url) {
    try {
      elements.currentUrl.textContent = new URL(url).hostname;
    } catch {
      elements.currentUrl.textContent = url;
    }
  }
}

async function getCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      updateCurrentUrl(tab.url);
    }
  } catch (e) {
    console.error('Failed to get current tab:', e);
  }
}

// ============================================
// Consent Mode Monitor
// ============================================
let consentState = null;

async function loadConsentState() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CONSENT_GET' });
    if (response && !response.error) {
      consentState = response;
      renderConsentState();
    }
  } catch (e) {
    // console.error(e);
  }
}

function renderConsentState() {
  const list = document.getElementById('consentList');
  if (!list) return;

  if (!consentState) {
    list.innerHTML = '<div class="empty-state"><p>No consent data</p></div>';
    return;
  }

  const mapColor = (status) => {
    if (status === 'granted') return 'var(--success-green)';
    if (status === 'denied') return 'var(--error-red)';
    return 'var(--text-muted)';
  };

  list.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            ${Object.keys(consentState).map(key => `
                <div class="container-item" style="flex-direction:column;align-items:flex-start;gap:4px">
                    <div style="font-size:10px;color:var(--text-secondary);text-transform:uppercase">${key.replace(/_/g, ' ')}</div>
                    <div style="font-size:12px;font-weight:600;color:${mapColor(consentState[key])}">
                        ${consentState[key].toUpperCase()}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// ============================================
// Tools Section (Blocker & Cleaner)
// ============================================


const clearCookiesBtn = document.getElementById('clearCookies');
if (clearCookiesBtn) {
  clearCookiesBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'CLEAR_GOOGLE_COOKIES'
        });
        showToast('Google Cookies Cleared', 'success');
        setTimeout(() => chrome.tabs.reload(tab.id), 1000);
      }
    } catch (e) {
      showToast('Failed to clear cookies', 'error');
    }
  });
}

// ============================================
// Tools: Block GA4
// ============================================
async function checkBlockGA4State() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.sessionStorage.getItem('swissKnifeBlockGA4') === 'true'
    });

    const blockGA4 = document.getElementById('blockGA4');
    if (results && results[0] && blockGA4) {
      blockGA4.checked = results[0].result;
    }
  } catch (e) { }
}

const blockGA4Btn = document.getElementById('blockGA4');
if (blockGA4Btn) {
  blockGA4Btn.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'BLOCK_GA4_HITS',
          enabled
        });
      }
    } catch (e) {
      console.error('Failed to toggle GA4 block', e);
      e.target.checked = !enabled;
    }
  });
}

// ============================================
// Professional Features: Audit
// ============================================
async function runAudit() {
  if (!elements.runAudit) return;
  elements.runAudit.textContent = 'Scanning...';
  elements.runAudit.disabled = true;
  elements.auditResults.innerHTML = '<div class="empty-state"><p>Analyzing tracking setup...</p></div>';

  try {
    const perf = await chrome.runtime.sendMessage({ type: 'GET_PERFORMANCE_METRICS' });
    if (perf) {
      const perfColor = perf.impactScore === 'High' ? 'var(--error-red)' : (perf.impactScore === 'Medium' ? 'var(--warning-yellow)' : 'var(--success-green)');
      elements.auditResults.innerHTML = `
        <div class="container-item" style="flex-direction:column;align-items:flex-start;gap:8px;border-left:4px solid ${perfColor}">
          <div style="font-size:11px;font-weight:bold;color:var(--text-primary)">Tracking Performance Impact: ${perf.impactScore}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%;font-size:10px">
            <div>Scripts: <span style="font-weight:600">${perf.containerCount}</span></div>
            <div>Overhead: <span style="font-weight:600">${perf.sizeKb} KB</span></div>
            <div>Load Time: <span style="font-weight:600">${perf.loadTimeMs} ms</span></div>
          </div>
        </div>
        <div style="margin:12px 0;height:1px;background:var(--border)"></div>
      `;
    }
  } catch (e) { console.error('Perf check failed', e); }

  const checks = [];

  // 1. GTM Check
  const containers = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GTM_DETECT });
  const gtmCount = (containers || []).filter(c => c.type === 'GTM').length;
  if (gtmCount > 1) {
    checks.push({ status: 'warning', title: 'Multiple GTM Containers', desc: `Found ${gtmCount} containers. This might cause data discrepancies.` });
  } else if (gtmCount === 1) {
    checks.push({ status: 'success', title: 'GTM Found', desc: 'Single GTM container detected correctly.' });
  } else {
    checks.push({ status: 'error', title: 'GTM Missing', desc: 'No GTM container detected on this page.' });
  }

  // 2. Conversion Linker Check
  const cookies = await chrome.runtime.sendMessage({ type: 'COOKIES_GET' });
  const hasLinker = (cookies || []).some(c => c.name === '_gcl_au');
  if (hasLinker) {
    checks.push({ status: 'success', title: 'Conversion Linker', desc: 'Active (_gcl_au found). Attribution will work correctly.' });
  } else {
    checks.push({ status: 'warning', title: 'No Conversion Linker', desc: 'Missing _gcl_au cookie. Google Ads attribution might be limited.' });
  }

  // 3. Consent Mode Check
  const hasConsentHit = networkRequests.some(r => r.url.includes('gcs=') || r.url.includes('gcd='));
  if (hasConsentHit) {
    checks.push({ status: 'success', title: 'Consent Mode V2', desc: 'Consent parameters (gcs/gcd) detected in network traffic.' });
  } else {
    checks.push({ status: 'error', title: 'Consent Missing', desc: 'No Consent Mode signals detected. Required for 2025 compliance!' });
  }

  // 4. GA4 Hit Check
  const hasGA4 = networkRequests.some(r => r.type === 'GA4' || r.type === 'GA4_SERVER_SIDE');
  if (hasGA4) {
    checks.push({ status: 'success', title: 'GA4 Active', desc: 'GA4 data collection hits detected.' });
  }

  // 5. Martech Audit (Meta, TikTok, LinkedIn)
  const metaHit = networkRequests.find(r => r.type === 'META_PIXEL');
  if (metaHit) checks.push({ status: 'success', title: 'Meta Pixel', desc: 'Meta tracking detected.' });
  else checks.push({ status: 'warning', title: 'Meta Pixel Missing', desc: 'No Meta Pixel hits found.' });

  const ttHit = networkRequests.find(r => r.type === 'TIKTOK_PIXEL');
  if (ttHit) checks.push({ status: 'success', title: 'TikTok Pixel', desc: 'TikTok tracking detected.' });

  const liHit = networkRequests.find(r => r.type === 'LINKEDIN_PIXEL');
  if (liHit) checks.push({ status: 'success', title: 'LinkedIn Insight', desc: 'LinkedIn tracking detected.' });

  renderAuditResults(checks);
  elements.runAudit.textContent = 'Run Scan';
  elements.runAudit.disabled = false;
}

function renderAuditResults(checks) {
  elements.auditResults.innerHTML = checks.map(c => `
    <div class="container-item" style="border-left: 4px solid ${c.status === 'success' ? 'var(--success-green)' : (c.status === 'warning' ? 'var(--warning-yellow)' : 'var(--error-red)')}">
      <div style="flex:1">
        <div style="font-weight:600;display:flex;align-items:center;gap:6px">
          <span style="color:${c.status === 'success' ? 'var(--success-green)' : (c.status === 'warning' ? 'var(--warning-yellow)' : 'var(--error-red)')}">
            ${c.status === 'success' ? '✓' : (c.status === 'warning' ? '⚠' : '✗')}
          </span>
          ${c.title}
        </div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">${c.desc}</div>
      </div>
    </div>
  `).join('');
}

if (elements.runAudit) elements.runAudit.addEventListener('click', runAudit);

// ============================================
// Professional Features: Cookies
// ============================================
async function refreshCookies() {
  if (!elements.refreshCookies) return;
  elements.refreshCookies.querySelector('svg').classList.add('spin-animation');
  try {
    const cookies = await chrome.runtime.sendMessage({ type: 'COOKIES_GET' });
    renderCookies(cookies || []);
  } catch (e) {
    console.error('Cookie Refresh Failed', e);
  }
  elements.refreshCookies.querySelector('svg').classList.remove('spin-animation');
}

function renderCookies(cookies) {
  if (cookies.length === 0) {
    elements.cookieList.innerHTML = '<div class="empty-state"><p>No tracking cookies found</p></div>';
    return;
  }

  elements.cookieList.innerHTML = cookies.map(c => `
    <div class="container-item">
      <div style="flex:1;overflow:hidden">
        <div style="font-weight:600;font-size:12px;color:var(--accent-blue)">${c.name}</div>
        <div style="font-size:11px;color:var(--text-muted);text-overflow:ellipsis;overflow:hidden;white-space:nowrap" title="${c.value}">${c.value}</div>
        <div style="font-size:10px;color:var(--text-secondary);margin-top:2px">Expires: ${c.expirationDate ? new Date(c.expirationDate * 1000).toLocaleDateString() : 'Session'}</div>
      </div>
      <button class="btn-icon btn-small delete-cookie" data-name="${c.name}" title="Delete Cookie">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>
  `).join('');

  elements.cookieList.querySelectorAll('.delete-cookie').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.name;
      await chrome.runtime.sendMessage({ type: 'COOKIES_DELETE', name });
      showToast(`Cookie ${name} deleted`);
      refreshCookies();
    });
  });
}

if (elements.refreshCookies) elements.refreshCookies.addEventListener('click', refreshCookies);

// ============================================
// Professional Features: Snippets
// ============================================
const SNIPPETS = [
  { id: 'dl_size', name: 'Check DataLayer Size', code: 'alert("DataLayer length: " + (window.dataLayer ? window.dataLayer.length : 0))' },
  { id: 'ec_check', name: 'Log eCommerce items', code: 'console.table(window.dataLayer.filter(e => e.ecommerce && e.ecommerce.items).map(e => e.ecommerce.items).flat())' },
  { id: 'clear_ga4', name: 'Clear GA4 SessionStorage', code: 'Object.keys(sessionStorage).filter(k => k.startsWith("_ga")).forEach(k => sessionStorage.removeItem(k)); alert("GA4 Session Storage Cleared")' },
  { id: 'force_scroll', name: 'Inject 90% Scroll Hit', code: 'window.dataLayer.push({event: "scroll", percent_scrolled: 90});' }
];

async function renderSnippets() {
  if (!elements.snippetList) return;

  const stored = await chrome.storage.local.get('custom_snippets');
  const customSnippets = stored.custom_snippets || [];
  const allSnippets = [...SNIPPETS, ...customSnippets];

  elements.snippetList.innerHTML = allSnippets.map(s => `
    <div class="container-item" style="cursor:pointer" data-id="${s.id}">
      <div style="flex:1">
        <div style="font-weight:600;font-size:12px;display:flex;align-items:center;gap:6px">
          ${s.isCustom ? '<span style="color:var(--accent-blue)">★</span>' : ''}
          ${s.name}
        </div>
        <div style="font-size:10px;color:var(--text-muted)">Click to execute in page</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        ${s.isCustom ? `
          <button class="btn-icon btn-small delete-snippet" data-id="${s.id}" title="Delete Snippet">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;color:var(--error-red)"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        ` : ''}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:var(--accent-blue)"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </div>
    </div>
  `).join('');

  // Handle execute
  elements.snippetList.querySelectorAll('.container-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      if (e.target.closest('.delete-snippet')) return;

      const snippet = allSnippets.find(s => s.id === item.dataset.id);
      if (snippet) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: 'MAIN',
            func: (code) => {
              try {
                new Function(code)();
              } catch (e) { console.error('Snippet execution failed', e); }
            },
            args: [snippet.code]
          });
          showToast(`Executing: ${snippet.name}`);
        }
      }
    });
  });

  // Handle delete
  elements.snippetList.querySelectorAll('.delete-snippet').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const stored = await chrome.storage.local.get('custom_snippets');
      const snippets = (stored.custom_snippets || []).filter(s => s.id !== id);
      await chrome.storage.local.set({ 'custom_snippets': snippets });
      renderSnippets();
      showToast('Snippet deleted');
    });
  });
}

// ============================================
// Professional Features: Trigger Library
// ============================================
async function saveTrigger(trigger) {
  const name = prompt('Enter a name for this trigger:', `${trigger.type}: ${trigger.value.substring(0, 15)}...`);
  if (!name) return;

  trigger.name = name;
  const stored = await chrome.storage.local.get('saved_triggers');
  const triggers = stored.saved_triggers || [];
  triggers.push(trigger);
  await chrome.storage.local.set({ 'saved_triggers': triggers });

  showToast('Trigger saved to library!', 'success');
  renderSavedTriggers();
}

async function renderSavedTriggers() {
  if (!elements.triggerList) return;

  const stored = await chrome.storage.local.get('saved_triggers');
  const triggers = stored.saved_triggers || [];

  if (triggers.length === 0) {
    elements.triggerList.innerHTML = '<div class="empty-state"><p>No saved triggers yet</p></div>';
    return;
  }

  elements.triggerList.innerHTML = triggers.map(t => `
    <div class="container-item" style="padding: 10px; flex-direction: column; align-items: flex-start; gap: 4px">
      <div style="width: 100%; display: flex; justify-content: space-between; align-items: center">
        <div style="font-weight: 600; font-size: 11px; color: var(--accent-blue)">${t.name}</div>
        <button class="btn-icon btn-small delete-trigger" data-id="${t.id}" title="Delete Trigger">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;color:var(--error-red)"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
      <div style="font-size: 10px; color: var(--text-muted)">
        ${t.type} <span style="margin: 0 4px">→</span> ${t.condition}
      </div>
      <div style="font-family: monospace; font-size: 9px; background: var(--bg-hover); padding: 4px; border-radius: 4px; width: 100%; word-break: break-all; color: var(--text-secondary)">
        ${t.value}
      </div>
    </div>
  `).join('');

  elements.triggerList.querySelectorAll('.delete-trigger').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const stored = await chrome.storage.local.get('saved_triggers');
      const triggers = (stored.saved_triggers || []).filter(t => t.id !== id);
      await chrome.storage.local.set({ 'saved_triggers': triggers });
      renderSavedTriggers();
      showToast('Trigger deleted');
    });
  });
}

// Update tab navigation to trigger renders
// GA4 Session Info Update Logic

async function loadSessionInfo() {
  const info = await chrome.runtime.sendMessage({ type: 'GA4_SESSION_GET' });
  if (info) updateSessionDeepDive(info);
}

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadRecentIds();
  detectContainers();
  checkActiveInjection();
  loadEvents();
  loadNetworkRequests();
  loadConsentState();
  checkBlockGA4State();
  getCurrentTab();
  loadSessionInfo();
  renderSavedTriggers();
});
