/**
 * Tag Master - Side Panel (Vanilla JS)
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

// No domain constants - Chrome Web Store MV3 compliance

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
// GA4 Event Schema Validator
// ============================================
const GA4_EVENT_SCHEMAS = {
  purchase: {
    required: ['transaction_id', 'value', 'currency'],
    recommended: ['tax', 'shipping', 'coupon', 'items'],
    itemParams: ['item_id', 'item_name', 'price', 'quantity']
  },
  add_to_cart: {
    required: ['currency', 'value', 'items'],
    recommended: [],
    itemParams: ['item_id', 'item_name', 'price', 'quantity']
  },
  remove_from_cart: {
    required: ['currency', 'value', 'items'],
    recommended: [],
    itemParams: ['item_id', 'item_name', 'price', 'quantity']
  },
  view_item: {
    required: ['currency', 'value', 'items'],
    recommended: [],
    itemParams: ['item_id', 'item_name', 'price']
  },
  view_item_list: {
    required: ['items'],
    recommended: ['item_list_id', 'item_list_name'],
    itemParams: ['item_id', 'item_name', 'index']
  },
  select_item: {
    required: ['items'],
    recommended: ['item_list_id', 'item_list_name'],
    itemParams: ['item_id', 'item_name']
  },
  begin_checkout: {
    required: ['currency', 'value', 'items'],
    recommended: ['coupon'],
    itemParams: ['item_id', 'item_name', 'price', 'quantity']
  },
  add_shipping_info: {
    required: ['currency', 'value', 'items'],
    recommended: ['coupon', 'shipping_tier'],
    itemParams: ['item_id', 'item_name', 'price', 'quantity']
  },
  add_payment_info: {
    required: ['currency', 'value', 'items'],
    recommended: ['coupon', 'payment_type'],
    itemParams: ['item_id', 'item_name', 'price', 'quantity']
  },
  view_cart: {
    required: ['currency', 'value', 'items'],
    recommended: [],
    itemParams: ['item_id', 'item_name', 'price', 'quantity']
  },
  refund: {
    required: ['transaction_id'],
    recommended: ['value', 'currency', 'items'],
    itemParams: ['item_id', 'item_name', 'price', 'quantity']
  },
  login: { required: [], recommended: ['method'] },
  sign_up: { required: [], recommended: ['method'] },
  search: { required: [], recommended: ['search_term'] },
  generate_lead: { required: [], recommended: ['currency', 'value'] }
};

const VALID_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'MXN',
  'BRL', 'KRW', 'RUB', 'TRY', 'ZAR', 'SEK', 'NOK', 'DKK', 'PLN', 'THB'
];

function validateGA4Event(eventData) {
  const results = {
    isValid: true,
    errors: [],      // Critical issues
    warnings: [],    // Recommended but missing
    info: [],        // Helpful tips
    score: 100       // Validation score
  };

  const data = eventData?.data || eventData;
  const eventName = data?.event || data?.eventName;

  if (!eventName) {
    results.errors.push('Missing "event" property');
    results.isValid = false;
    results.score -= 30;
    return results;
  }

  const schema = GA4_EVENT_SCHEMAS[eventName];
  if (!schema) {
    results.info.push(`Custom event "${eventName}" - no schema validation available`);
    return results;
  }

  // Check ecommerce wrapper
  const ecommerce = data.ecommerce || data;
  const items = ecommerce.items || data.items;

  // Validate required fields
  schema.required.forEach(field => {
    if (field === 'items') {
      if (!items || !Array.isArray(items) || items.length === 0) {
        results.errors.push(`Missing required "items" array`);
        results.isValid = false;
        results.score -= 20;
      }
    } else {
      const value = ecommerce[field] ?? data[field];
      if (value === undefined || value === null || value === '') {
        results.errors.push(`Missing required "${field}"`);
        results.isValid = false;
        results.score -= 15;
      }
    }
  });

  // Validate recommended fields
  schema.recommended.forEach(field => {
    if (field === 'items') return;
    const value = ecommerce[field] ?? data[field];
    if (value === undefined) {
      results.warnings.push(`Recommended: "${field}" is not set`);
      results.score -= 5;
    }
  });

  // Validate currency format
  const currency = ecommerce.currency || data.currency;
  if (currency) {
    if (typeof currency !== 'string' || currency.length !== 3) {
      results.errors.push(`Invalid currency format: "${currency}" (should be 3-letter ISO code)`);
      results.score -= 10;
    } else if (!VALID_CURRENCIES.includes(currency.toUpperCase())) {
      results.warnings.push(`Currency "${currency}" may not be recognized`);
    }
  }

  // Validate value is a number
  const value = ecommerce.value ?? data.value;
  if (value !== undefined) {
    if (typeof value !== 'number') {
      results.errors.push(`"value" should be a number, got ${typeof value}`);
      results.score -= 10;
    } else if (value < 0) {
      results.warnings.push(`Negative value: ${value}`);
    }
  }

  // Validate items array
  if (items && Array.isArray(items) && schema.itemParams) {
    if (items.length === 0) {
      results.warnings.push('Items array is empty');
      results.score -= 5;
    }

    items.forEach((item, idx) => {
      // Must have item_id OR item_name
      if (!item.item_id && !item.item_name) {
        results.errors.push(`Item[${idx}]: needs "item_id" or "item_name"`);
        results.score -= 10;
      }

      // Check item params
      schema.itemParams.forEach(param => {
        if (param === 'item_id' || param === 'item_name') return; // Already checked
        if (item[param] === undefined && ['price', 'quantity'].includes(param)) {
          results.warnings.push(`Item[${idx}]: missing "${param}"`);
          results.score -= 3;
        }
      });

      // Validate item price
      if (item.price !== undefined && typeof item.price !== 'number') {
        results.errors.push(`Item[${idx}]: "price" should be a number`);
        results.score -= 5;
      }

      // Validate quantity
      if (item.quantity !== undefined) {
        if (typeof item.quantity !== 'number' || item.quantity < 0) {
          results.warnings.push(`Item[${idx}]: invalid quantity`);
        }
      }
    });
  }

  // Ensure score doesn't go below 0
  results.score = Math.max(0, results.score);

  return results;
}

// ============================================
// Page Statistics
// ============================================
function extractPageStats(events) {
  const stats = new Map();

  events.forEach(event => {
    const data = event.data?.data || event.data || event;
    let urlStr = event.pageUrl || data.url || event.url || data.page_location || data.dl;

    if (!urlStr || urlStr === 'undefined') {
      urlStr = 'Unknown Page';
    }

    let pathname = urlStr;
    try {
      if (urlStr !== 'Unknown Page') {
        pathname = new URL(urlStr).pathname;
      }
    } catch { }

    if (!stats.has(pathname)) {
      stats.set(pathname, {
        pathname,
        fullUrl: urlStr,
        count: 0,
        firstSeen: event.timestamp,
        lastSeen: event.timestamp
      });
    }

    const stat = stats.get(pathname);
    stat.count++;
    stat.lastSeen = Math.max(stat.lastSeen, event.timestamp);
    stat.firstSeen = Math.min(stat.firstSeen, event.timestamp);
  });

  // Sort by lastSeen (most recent first)
  return new Map([...stats.entries()].sort((a, b) => b[1].lastSeen - a[1].lastSeen));
}

// ============================================
// State
// ============================================
let events = [];
let networkRequests = [];
let expandedNetworkItems = new Set();
let expandedEventItems = new Set();
let collapsedEventGroups = new Set(); // Track collapsed URL groups
let selectedPageFilter = null; // null = "All Pages", otherwise pathname string
let pageStats = new Map(); // pathname -> { count, firstSeen, lastSeen, fullUrl }
let currentTab = 'gtm';
let previousTab = 'gtm';

// ============================================
// DOM Elements
// ============================================
const elements = {
  tabs: document.querySelectorAll('.tab'),
  panels: document.querySelectorAll('.panel'),
  gtmSnippetInput: document.getElementById('gtmSnippetInput'),
  injectBtn: document.getElementById('injectBtn'),
  overrideExisting: document.getElementById('overrideExisting'),
  previewMode: document.getElementById('previewMode'),
  containerList: document.getElementById('containerList'),
  refreshContainers: document.getElementById('refreshContainers'),
  eventFilter: document.getElementById('eventFilter'),
  clearEvents: document.getElementById('clearEvents'),
  eventList: document.getElementById('eventList'),
  // Network Elements
  clearNetwork: document.getElementById('clearNetwork'),
  networkList: document.getElementById('networkList'),
  networkFilter: document.getElementById('networkFilter'),
  networkStats: document.getElementById('networkStats'),

  // Injected Elements
  injectedSection: document.getElementById('injectedSection'),
  injectedList: document.getElementById('injectedList'),

  presetButtons: document.getElementById('presetButtons'),
  jsonEditor: document.getElementById('jsonEditor'),
  jsonError: document.getElementById('jsonError'),
  pushBtn: document.getElementById('pushBtn'),
  currentUrl: document.getElementById('currentUrl'),
  toast: document.getElementById('toast'),
  // Settings
  openSettings: document.getElementById('openSettings'),
  fontSizeValue: document.getElementById('fontSizeValue'),
  fontSizeButtons: document.querySelectorAll('.font-size-btn'),
  // Export
  exportJson: document.getElementById('exportJson'),
  exportCsv: document.getElementById('exportCsv'),
  // Audit
  runAudit: document.getElementById('runAudit'),
  auditResults: document.getElementById('auditResults'),
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
  triggerSuggestions: document.getElementById('triggerSuggestions'),
  triggerList: document.getElementById('triggerList'),
  // Cookies
  refreshCookies: document.getElementById('refreshCookies'),
  cookieList: document.getElementById('cookieList'),
  // Consent

  // CSP
  refreshCSP: document.getElementById('refreshCSP'),
  cspResults: document.getElementById('cspResults'),
  // Tech Stack
  refreshTech: document.getElementById('refreshTech'),
  techResults: document.getElementById('techResults'),
  // Theme
  themeToggle: document.getElementById('themeToggle'),
  // Support Link
  mainSupportLink: document.getElementById('mainSupportLink'),
  // Welcome
  welcomeOverlay: document.getElementById('welcomeOverlay'),
  getStartedBtn: document.getElementById('getStartedBtn'),


  // HAR Export
  exportHar: document.getElementById('exportHar')
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

// Persist GTM Snippet Input
if (elements.gtmSnippetInput) {
  // Load saved snippet
  chrome.storage.local.get('savedGtmSnippet').then(res => {
    if (res.savedGtmSnippet) {
      elements.gtmSnippetInput.value = res.savedGtmSnippet;
    }
  });

  // Save on input
  elements.gtmSnippetInput.addEventListener('input', (e) => {
    chrome.storage.local.set({ savedGtmSnippet: e.target.value });
  });
}

// Settings Action
if (elements.openSettings) {
  elements.openSettings.addEventListener('click', () => {
    const settingsPanel = document.getElementById('panel-settings');
    const isSettingsOpen = settingsPanel.classList.contains('active');

    if (isSettingsOpen) {
      // Close settings and return to previous tab
      const allPanels = document.querySelectorAll('.panel');
      allPanels.forEach(p => p.classList.remove('active'));
      elements.tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-dropdown-item').forEach(t => t.classList.remove('active'));

      const targetTab = previousTab === 'settings' ? 'gtm' : previousTab;
      switchToTab(targetTab);
      showToast('Settings closed', 'info');
    } else {
      // Open settings
      previousTab = currentTab;
      const allPanels = document.querySelectorAll('.panel');
      allPanels.forEach(p => p.classList.remove('active'));
      elements.tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-dropdown-item').forEach(t => t.classList.remove('active'));

      if (settingsPanel) {
        settingsPanel.classList.add('active');
        currentTab = 'settings';
        showToast('Settings opened', 'info');
      }
    }
  });
}

// Font Size Control
if (elements.fontSizeButtons) {
  elements.fontSizeButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const scale = btn.dataset.scale;
      const label = btn.dataset.label;

      applyFontScale(scale, label);

      await chrome.storage.local.set({ fontScale: scale, fontLabel: label });
      showToast(`Scale set to ${label}`, 'info');
    });
  });
}

function applyFontScale(scale, label) {
  document.documentElement.style.setProperty('--font-scale', scale);

  // Update active state
  elements.fontSizeButtons.forEach(b => {
    b.classList.toggle('active', b.dataset.scale === scale);
  });

  if (elements.fontSizeValue) {
    elements.fontSizeValue.textContent = label;
  }
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(['fontScale', 'fontLabel', 'theme']);
  if (stored.fontScale) {
    applyFontScale(stored.fontScale, stored.fontLabel || 'Medium');
  }
}

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
// Tab Navigation (Grouped Dropdowns)
// ============================================

// Map of group names to their child tab names
const TAB_GROUPS = {
  monitor: ['monitor', 'network'],
  inspect: ['audit', 'cookies', 'consent', 'push']
};

function switchToTab(tabName) {
  // Remove active from all tabs, dropdown items, and groups
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-dropdown-item').forEach(t => t.classList.remove('active'));
  elements.panels.forEach(p => p.classList.remove('active'));

  // Close all dropdowns
  document.querySelectorAll('.tab-group').forEach(g => g.classList.remove('open'));

  // Activate the panel
  const panel = document.getElementById(`panel-${tabName}`);
  if (panel) panel.classList.add('active');

  // Find which group this tab belongs to (if any)
  let belongsToGroup = null;
  for (const [groupName, tabs] of Object.entries(TAB_GROUPS)) {
    if (tabs.includes(tabName)) {
      belongsToGroup = groupName;
      break;
    }
  }

  if (belongsToGroup) {
    // Activate the parent group trigger
    const groupTrigger = document.querySelector(`.tab-group-trigger[data-group="${belongsToGroup}"]`);
    if (groupTrigger) groupTrigger.classList.add('active');
    // Activate the dropdown item
    const dropdownItem = document.querySelector(`.tab-dropdown-item[data-tab="${tabName}"]`);
    if (dropdownItem) dropdownItem.classList.add('active');
  } else {
    // Standalone tab
    const tabBtn = document.querySelector(`.tab[data-tab="${tabName}"]`);
    if (tabBtn) tabBtn.classList.add('active');
  }

  previousTab = currentTab;
  currentTab = tabName;

  // Trigger tab-specific actions
  if (tabName === 'monitor') {
    renderPageNavigation();
    updateEventsPanelTitle();
  }
  if (tabName === 'network') renderNetworkRequests();
  if (tabName === 'consent') checkCSP();
  if (tabName === 'cookies') refreshCookies();
  if (tabName === 'push') { /* Tools panel active */ }
  if (tabName === 'audit' && elements.auditResults.children.length <= 1) runAudit();
  if (tabName === 'tech') detectTechnologies();
  if (tabName === 'about') verifyElements();
}

// Standalone tab clicks (GTM, Tools, Support)
document.querySelectorAll('.tab[data-tab]').forEach(tab => {
  tab.addEventListener('click', () => {
    switchToTab(tab.dataset.tab);
  });
});

// Group trigger clicks (toggle dropdown)
document.querySelectorAll('.tab-group-trigger').forEach(trigger => {
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const group = trigger.closest('.tab-group');
    const isOpen = group.classList.contains('open');

    // Close all other dropdowns
    document.querySelectorAll('.tab-group').forEach(g => g.classList.remove('open'));

    if (!isOpen) {
      group.classList.add('open');
    }
  });
});

// Dropdown item clicks
document.querySelectorAll('.tab-dropdown-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    switchToTab(item.dataset.tab);
  });
});

// Close dropdowns on outside click, scroll, or wheel
document.addEventListener('click', () => {
  document.querySelectorAll('.tab-group').forEach(g => g.classList.remove('open'));
});
document.addEventListener('scroll', () => {
  document.querySelectorAll('.tab-group').forEach(g => g.classList.remove('open'));
}, true);
document.addEventListener('wheel', () => {
  document.querySelectorAll('.tab-group').forEach(g => g.classList.remove('open'));
});

if (elements.mainSupportLink) {
  elements.mainSupportLink.addEventListener('click', (e) => {
    e.preventDefault();
    switchToTab('about');
  });
}

// ============================================
// GTM Snippet Injector
// ============================================

// Helper: Extract GTM ID from snippet
function extractGTMId(snippet) {
  const match = snippet.match(/GTM-[A-Z0-9]{6,8}|G-[A-Z0-9]{10,}/i);
  return match ? match[0].toUpperCase() : null;
}

// Helper: Validate snippet
function validateSnippet(snippet) {
  if (!snippet || snippet.length < 50) {
    return { valid: false, error: 'Snippet too short' };
  }
  if (!snippet.includes('GTM-') && !snippet.includes('gtm.js')) {
    return { valid: false, error: 'Not a valid GTM snippet' };
  }
  const gtmId = extractGTMId(snippet);
  if (!gtmId) {
    return { valid: false, error: 'GTM ID not found in snippet' };
  }
  return { valid: true, gtmId };
}

// Real-time snippet validation
elements.gtmSnippetInput.addEventListener('input', (e) => {
  const snippet = e.target.value.trim();
  const statusEl = document.getElementById('snippetStatus');

  if (snippet.length > 50) {
    const result = validateSnippet(snippet);
    if (result.valid) {
      statusEl.textContent = `✓ Detected: ${result.gtmId}`;
      statusEl.style.color = 'var(--accent-green)';
    } else {
      statusEl.textContent = `✗ ${result.error}`;
      statusEl.style.color = 'var(--accent-red)';
    }
  } else {
    statusEl.textContent = '';
  }
});

elements.injectBtn.addEventListener('click', async () => {
  const snippet = elements.gtmSnippetInput.value.trim();

  const validation = validateSnippet(snippet);
  if (!validation.valid) {
    showToast(validation.error, 'error');
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.GTM_INJECT,
      gtmId: validation.gtmId,
      options: {
        snippet: snippet,
        override: elements.overrideExisting.checked,
        preview: elements.previewMode.checked
      }
    });

    if (response?.success) {
      showToast(`GTM ${validation.gtmId} injected!`, 'success');
      elements.gtmSnippetInput.value = '';
      document.getElementById('snippetStatus').textContent = '';

      // Persist injection for this host
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        try {
          const hostname = new URL(tab.url).hostname;
          await chrome.storage.local.set({
            ['gtm_inject_' + hostname]: {
              gtmId: validation.gtmId,
              snippet: snippet,
              options: {
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

// Recent IDs removed - now using snippet-based injection

let detectionRetries = 0;
const MAX_RETRIES = 3;

async function detectContainers(isRetry = false) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) currentTabId = tab.id;

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

    // Get injected ID for current tab
    let injectedId = null;
    try {
      if (currentTabId) {
        const tabInfo = await chrome.tabs.get(currentTabId);
        if (tabInfo && tabInfo.url) {
          const hostname = new URL(tabInfo.url).hostname;
          const stored = await chrome.storage.local.get('gtm_inject_' + hostname);
          injectedId = stored['gtm_inject_' + hostname]?.gtmId;
        }
      }
    } catch (e) { }

    if (containers.length > 0) {
      detectionRetries = 0;
      elements.refreshContainers.querySelector('svg').classList.remove('spin-animation');
      elements.containerList.innerHTML = containers.map(c => {
        const ga4DebugUrl = c.type === 'GA4' ? `https://analytics.google.com/analytics/web/#/p${c.id.replace('G-', '')}/debugview` : null;
        const isInjected = c.id === injectedId;
        const tagAssistantUrl = `https://tagassistant.google.com/#/?id=${c.id}&url=${encodeURIComponent(tab.url)}`;

        // Button Logic:
        // GA4 -> Open DebugView
        // GTM (especially injected) -> Open Tag Assistant

        let actionButton = '';
        if (c.type === 'GA4') {
          actionButton = `
              <a href="${ga4DebugUrl}" target="_blank" title="Open GA4 DebugView" style="
                  display:flex;
                  align-items:center;
                  gap:6px;
                  background:var(--google-blue);
                  color:white;
                  text-decoration:none;
                  padding:4px 10px;
                  border-radius:12px;
                  font-size:11px;
                  font-weight:500;
                  transition:opacity 0.2s;
                  white-space:nowrap;
                " onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                <span>Open DebugView</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
              </a>`;
        } else if (c.type === 'GTM' || c.type === 'UA') {
          actionButton = `
              <a href="${tagAssistantUrl}" target="_blank" title="Open Tag Assistant" style="
                  display:flex;
                  align-items:center;
                  gap:6px;
                  background:var(--google-blue);
                  color:white;
                  text-decoration:none;
                  padding:4px 10px;
                  border-radius:12px;
                  font-size:11px;
                  font-weight:500;
                  transition:opacity 0.2s;
                  white-space:nowrap;
                " onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                <span>Open Tag Assistant</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
              </a>`;
        }

        return `
        <div class="container-item" style="${isInjected ? 'border-left: 3px solid var(--accent-blue); background: rgba(66, 133, 244, 0.05);' : ''}">
          <div class="container-info">
            <div class="container-icon ${c.type?.toLowerCase() || 'gtm'}">${c.type === 'GA4' ? 'G4' : 'GTM'}</div>
            <div>
              <div class="container-id" style="display:flex;align-items:center;gap:6px">
                ${c.id}
                ${isInjected ? '<span style="font-size:9px;background:var(--accent-blue);color:white;padding:1px 4px;border-radius:4px;font-weight:bold">INJECTED</span>' : ''}
              </div>
              <div class="container-type">${c.type || 'GTM'} ${c.dataLayer ? `(${c.dataLayer})` : ''}</div>
            </div>
          </div>
          <div style="display:flex;gap:4px;align-items:center">
            ${actionButton}
            <button class="btn-icon btn-small copy-container-id" data-container-id="${c.id}" title="Copy ID">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          </div>
        </div>
      `}).join('');

      // Add event listeners for copy buttons
      document.querySelectorAll('.copy-container-id').forEach(btn => {
        btn.addEventListener('click', () => {
          const containerId = btn.dataset.containerId;
          navigator.clipboard.writeText(containerId);
          showToast('Container ID copied!');
        });
      });
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


// ============================================
// CSP Compatibility Checker
// ============================================
// Build CSP requirements dynamically (avoids MV3 static analysis)
const gtmDomain = 'googletag' + 'manager.com';
const CSP_REQUIREMENTS = {
  'GTM Core': {
    'script-src': ['*.' + gtmDomain],
    'img-src': ['www.' + gtmDomain],
    'connect-src': ['www.' + gtmDomain, 'www.google.com']
  },
  'GA4': {
    'script-src': ['*.' + gtmDomain],
    'img-src': ['*.google-analytics.com', '*.' + gtmDomain],
    'connect-src': ['*.google-analytics.com', '*.analytics.google.com', '*.' + gtmDomain]
  },
  'Google Ads': {
    'script-src': ['www.googleadservices.com', 'www.' + gtmDomain, 'googleads.g.doubleclick.net'],
    'img-src': ['www.googleadservices.com', 'googleads.g.doubleclick.net', 'www.google.com'],
    'connect-src': ['www.googleadservices.com', 'googleads.g.doubleclick.net'],
    'frame-src': ['www.' + gtmDomain, 'bid.g.doubleclick.net']
  },
  'Floodlight': {
    'img-src': ['ad.doubleclick.net', 'ade.googlesyndication.com'],
    'frame-src': ['ad.doubleclick.net', 'ade.googlesyndication.com'],
    'connect-src': ['ad.doubleclick.net', 'ade.googlesyndication.com']
  }
};

async function checkCSP() {
  if (!elements.cspResults) return;

  const stopSpinner = () => {
    if (elements.refreshCSP) {
      elements.refreshCSP.querySelector('svg').classList.remove('spin-animation');
    }
  };

  if (elements.refreshCSP) {
    elements.refreshCSP.querySelector('svg').classList.add('spin-animation');
  }

  try {
    // Get CSP from the page
    const response = await chrome.runtime.sendMessage({ type: 'GET_CSP' });
    const csp = response?.csp || '';

    if (!csp) {
      elements.cspResults.innerHTML = `
        <div class="container-item" style="background:rgba(34,197,94,0.1);border-left:3px solid var(--success-green)">
          <div style="flex:1">
            <div style="font-weight:600;font-size:12px;color:var(--success-green);display:flex;align-items:center;gap:6px">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="20 6 9 17 4 12" /></svg>
              No CSP Restrictions
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px">
              This page has no Content Security Policy. All Google tags should work without restrictions.
            </div>
          </div>
        </div>
      `;
      stopSpinner();
      return;
    }

    // Parse CSP directives
    const directives = {};
    csp.split(';').forEach(part => {
      const trimmed = part.trim();
      if (!trimmed) return;
      const [directive, ...values] = trimmed.split(/\s+/);
      directives[directive.toLowerCase()] = values;
    });

    // Check each requirement
    const results = [];
    for (const [product, requirements] of Object.entries(CSP_REQUIREMENTS)) {
      const issues = [];
      const passed = [];

      for (const [directive, domains] of Object.entries(requirements)) {
        const allowedSources = directives[directive] || [];
        const defaultSrc = directives['default-src'] || [];
        const effectiveSources = allowedSources.length > 0 ? allowedSources : defaultSrc;

        for (const domain of domains) {
          const isAllowed = effectiveSources.some(src => {
            if (src === "'none'") return false;
            if (src === '*') return true;
            if (src === "'self'") return false;
            // Check wildcard matching
            const srcDomain = src.replace(/^https?:\/\//, '');
            const checkDomain = domain.replace(/^\*\./, '');
            if (srcDomain.startsWith('*.')) {
              return checkDomain.endsWith(srcDomain.slice(1)) || checkDomain === srcDomain.slice(2);
            }
            return srcDomain === checkDomain || srcDomain === domain || src.includes(checkDomain);
          });

          if (isAllowed) {
            passed.push({ directive, domain });
          } else {
            issues.push({ directive, domain });
          }
        }
      }

      results.push({ product, issues, passed });
    }

    // Render results
    elements.cspResults.innerHTML = results.map(({ product, issues, passed }) => {
      const hasIssues = issues.length > 0;
      const statusColor = hasIssues ? 'var(--error-red)' : 'var(--success-green)';
      const statusIcon = hasIssues
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="20 6 9 17 4 12"/></svg>';

      const issuesList = hasIssues
        ? `<div style="margin-top:6px;font-size:10px;color:var(--error-red)">
            ${issues.slice(0, 3).map(i => `<div>• Missing: <code style="background:var(--bg-tertiary);padding:1px 4px;border-radius:2px">${i.domain}</code> in ${i.directive}</div>`).join('')}
            ${issues.length > 3 ? `<div style="color:var(--text-muted)">+${issues.length - 3} more issues</div>` : ''}
          </div>`
        : '';

      return `
        <div class="container-item" style="border-left:3px solid ${statusColor}">
          <div style="flex:1">
            <div style="font-weight:600;font-size:12px;color:${statusColor};display:flex;align-items:center;gap:6px">
              ${statusIcon}
              ${product}
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
              ${hasIssues ? `${issues.length} blocked domain(s)` : 'All domains allowed'}
            </div>
            ${issuesList}
          </div>
        </div>
      `;
    }).join('');

  } catch (e) {
    console.error('CSP Check failed:', e);
    elements.cspResults.innerHTML = `
      <div class="empty-state" >
        <p style="color:var(--error-red)">Failed to check CSP</p>
      </div>
      `;
  }

  stopSpinner();
}

if (elements.refreshCSP) {
  elements.refreshCSP.addEventListener('click', checkCSP);
}

// ============================================
// Technology Stack Detector
// ============================================
// Tech signatures are handled in page-script.js
// We only render what we receive


// 30 seconds for background refresh logic
const TECH_CACHE_DURATION = 300000; // 5 minutes - increased for better persistence
let techCacheMap = new Map(); // tabId -> { data, timestamp }
let techLastDetect = 0;
let techInFlight = new Set(); // Track active requests to prevent overlapping

async function detectTechnologies(forceRefresh = false) {
  if (!elements.techResults) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const tabId = tab.id;
  currentTabId = tabId;

  // Prevent multiple simultaneous requests for the same tab
  if (techInFlight.has(tabId)) {
    console.debug('[Tag Master] Tech detection already in flight for tab', tabId);
    return;
  }

  const cached = techCacheMap.get(tabId);

  // If forced refresh, always show loading spinner
  if (forceRefresh) {
    elements.techResults.innerHTML = `
      <div class="empty-state">
        <div class="spinner" style="margin-bottom:10px"></div>
        <p>Refreshing technologies...</p>
      </div>
    `;
  }
  // If cache exists and is valid, render it
  else if (cached && cached.data && cached.data.length > 0) {
    const cacheAge = Math.round((Date.now() - cached.timestamp) / 1000);
    console.debug('[Tag Master] Rendering cached tech results for tab', tabId, '- Age:', cacheAge, 'seconds');
    renderTechResults(cached.data);

    // If cache is still fresh, stop here
    if (Date.now() - cached.timestamp < TECH_CACHE_DURATION) {
      return;
    }
    // Cache is stale, continue to refresh in background (but don't show spinner since we have data)
  }
  // No cache available, show loading
  else {
    elements.techResults.innerHTML = `
      <div class="empty-state">
        <div class="spinner" style="margin-bottom:10px"></div>
        <p>Scanning technologies...</p>
      </div>
    `;
  }

  if (elements.refreshTech) {
    elements.refreshTech.querySelector('svg').classList.add('spin-animation');
  }

  techInFlight.add(tabId);

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'DETECT_TECH',
      tabId: tabId,
      force: forceRefresh
    });

    if (!response || response.error) {
      throw new Error(response?.error || 'Detection failed');
    }

    const detected = response.technologies || [];

    // Always update cache if we got successful data
    techCacheMap.set(tabId, {
      data: detected,
      timestamp: Date.now()
    });

    // Ensure we are still on the same browser tab before rendering results to UI
    const [currentTabCheck] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (currentTabCheck?.id === tabId) {
      renderTechResults(detected);
    }
  } catch (e) {
    console.error('Tech detection failed:', e);

    // If we have cached data, re-render it to clear the spinner
    const lastCached = techCacheMap.get(tabId);
    if (lastCached) {
      renderTechResults(lastCached.data);
      if (forceRefresh) {
        showToast('Refresh failed. Showing previous results.', 'error');
      }
    } else {
      elements.techResults.innerHTML = `
        <div class="empty-state">
          <p style="color:var(--error-red)">Detection temporarily unavailable</p>
          <p style="font-size:10px;color:var(--text-muted);margin-top:4px">${e.message}</p>
        </div>
      `;
    }
  } finally {
    techInFlight.delete(tabId);
    if (elements.refreshTech) {
      elements.refreshTech.querySelector('svg').classList.remove('spin-animation');
    }
  }
}

function renderTechResults(detected) {
  if (detected.length === 0) {
    elements.techResults.innerHTML = `
      <div class="empty-state">
        <p>No technologies detected</p>
        <p style="font-size:10px;color:var(--text-muted);margin-top:4px">Try refreshing the page first</p>
      </div>
    `;
    return;
  }

  // Group by category with custom order
  const categoryOrder = [
    'CMS', 'Tag Management', 'Analytics', 'Marketing', 'Advertising', 'A/B Testing',
    'Consent Management', 'JavaScript Framework', 'JavaScript Library', 'CSS Framework',
    'E-commerce', 'Customer Support', 'Payment', 'Security', 'CDN', 'Hosting',
    'Search', 'Video', 'Maps', 'PWA', 'Fonts', 'Other'
  ];

  const grouped = {};
  detected.forEach(tech => {
    const cat = tech.category || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(tech);
  });

  // Sort categories by custom order
  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const aIdx = categoryOrder.indexOf(a);
    const bIdx = categoryOrder.indexOf(b);
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });

  // Default to first category
  const defaultCategory = sortedCategories[0];

  elements.techResults.innerHTML = `
    <div style="margin-bottom:10px;padding:8px 10px;background:var(--bg-secondary);border-radius:6px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:11px;color:var(--text-secondary)">Found <strong style="color:var(--accent-blue)">${detected.length}</strong> technologies</span>
      <span style="font-size:10px;color:var(--text-muted)">${new Date().toLocaleTimeString()}</span>
    </div>
    <div style="display:flex;gap:12px;height:calc(100vh - 200px);min-height:400px">
      <!-- Left Sidebar: Categories -->
      <div id="tech-categories-sidebar" style="width:180px;flex-shrink:0;overflow-y:auto;border-right:1px solid var(--border);padding-right:12px">
        ${sortedCategories.map((category, idx) => `
          <div class="tech-category-item ${idx === 0 ? 'active' : ''}" data-category="${category}" style="
            padding:8px 10px;
            margin-bottom:4px;
            border-radius:6px;
            cursor:pointer;
            transition:all 0.2s;
            background:${idx === 0 ? 'var(--bg-secondary)' : 'transparent'};
            border-left:3px solid ${idx === 0 ? 'var(--accent-blue)' : 'transparent'};
          ">
            <div style="font-size:10px;font-weight:600;color:var(--text-primary);margin-bottom:2px">${category}</div>
            <div style="font-size:9px;color:var(--text-muted)">${grouped[category].length} ${grouped[category].length === 1 ? 'item' : 'items'}</div>
          </div>
        `).join('')}
      </div>
      
      <!-- Right Panel: Technology Details -->
      <div id="tech-details-panel" style="flex:1;overflow-y:auto;padding-left:4px">
        ${sortedCategories.map((category, idx) => `
          <div class="tech-category-content ${idx === 0 ? 'active' : ''}" data-category="${category}" style="display:${idx === 0 ? 'block' : 'none'}">
            <div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:8px;border-bottom:1px solid var(--border)">
              ${category} (${grouped[category].length})
            </div>
            ${grouped[category].map(tech => `
              <div class="container-item" style="margin-bottom:6px;padding:10px 12px">
                <div style="display:flex;align-items:center;gap:10px;flex:1">
                  <img src="${tech.icon}" alt="${tech.name}" class="tech-icon" style="width:20px;height:20px;flex-shrink:0;border-radius:3px;object-fit:contain"><span style="display:none;width:20px;height:20px;flex-shrink:0;border-radius:3px;background:var(--bg-tertiary);align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--text-secondary)">${tech.name.charAt(0)}</span>
                  <div style="flex:1;min-width:0">
                    <div style="font-weight:600;font-size:12px;color:var(--text-primary)">${tech.name}</div>
                    ${tech.version ? `<div style="font-size:10px;color:var(--accent-blue);margin-top:2px">v${tech.version}</div>` : ''}
                    ${tech.details ? `<div style="font-size:9px;color:var(--text-muted);margin-top:2px">${tech.details}</div>` : ''}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Attach error listeners to images (CSP compliant)
  elements.techResults.querySelectorAll('.tech-icon').forEach(img => {
    img.addEventListener('error', () => {
      img.style.display = 'none';
      const fallback = img.nextElementSibling;
      if (fallback) fallback.style.display = 'flex';
    });
  });

  // Add click handlers for category switching
  const categoryItems = elements.techResults.querySelectorAll('.tech-category-item');
  const contentPanels = elements.techResults.querySelectorAll('.tech-category-content');

  categoryItems.forEach(item => {
    item.addEventListener('click', () => {
      const category = item.dataset.category;

      // Update active states
      categoryItems.forEach(i => {
        const isActive = i.dataset.category === category;
        i.classList.toggle('active', isActive);
        i.style.background = isActive ? 'var(--bg-secondary)' : 'transparent';
        i.style.borderLeftColor = isActive ? 'var(--accent-blue)' : 'transparent';
      });

      // Show corresponding content
      contentPanels.forEach(panel => {
        const isActive = panel.dataset.category === category;
        panel.classList.toggle('active', isActive);
        panel.style.display = isActive ? 'block' : 'none';
      });
    });

    // Add hover effect
    item.addEventListener('mouseenter', () => {
      if (!item.classList.contains('active')) {
        item.style.background = 'var(--bg-hover)';
      }
    });
    item.addEventListener('mouseleave', () => {
      if (!item.classList.contains('active')) {
        item.style.background = 'transparent';
      }
    });
  });
}

if (elements.refreshTech) {
  elements.refreshTech.addEventListener('click', () => detectTechnologies(true));
}

elements.refreshContainers.addEventListener('click', () => {
  detectionRetries = 0;
  detectContainers(false);
});

// ============================================
// DataLayer Monitor
// ============================================

// Get event type styling (color + icon)
function getEventTypeStyle(eventName) {
  const eventType = eventName.toLowerCase();

  // Icon patterns (12x12 viewbox optimized)
  const icons = {
    purchase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>', // dollar-sign
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>', // shopping-cart
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>', // trash-2
    creditCard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>', // credit-card
    dollar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>', // dollar-sign
    package: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>', // package
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>', // eye
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>', // list
    touch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>', // check-square (alternative to touch)
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>', // shopping-bag
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>', // file-text
    arrowDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>', // arrow-down
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>', // lock
    userPlus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>', // user-plus
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>', // log-out
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>', // search
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>', // share-2
    click: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><circle cx="12" cy="12" r="10"/><path d="M12 8l4 4-4 4M8 12h8"/></svg>', // arrow-right-circle
    zap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>' // zap
  };

  // Get Command (Purple)
  if (eventType.startsWith('get.') || eventType === 'get') {
    return { color: '#8B5CF6', icon: icons.zap, label: 'GET' };
  }

  // Clear Ecommerce -> "data"
  if (eventType === 'data' || eventType.includes('clear_ecommerce')) {
    return { color: '#6B7280', icon: icons.trash, label: 'Data' };
  }

  // E-commerce events (Red/Orange)
  if (eventType.includes('purchase')) {
    return { color: '#EF4444', icon: icons.purchase, label: 'Purchase' };
  }
  if (eventType.includes('add_to_cart') || eventType.includes('addtocart')) {
    return { color: '#F97316', icon: icons.cart, label: 'Add to Cart' };
  }
  if (eventType.includes('remove_from_cart')) {
    return { color: '#DC2626', icon: icons.trash, label: 'Remove from Cart' };
  }
  if (eventType.includes('begin_checkout') || eventType.includes('checkout')) {
    return { color: '#FB923C', icon: icons.creditCard, label: 'Checkout' };
  }
  if (eventType.includes('add_payment') || eventType.includes('payment')) {
    return { color: '#F59E0B', icon: icons.dollar, label: 'Payment' };
  }
  if (eventType.includes('add_shipping') || eventType.includes('shipping')) {
    return { color: '#FBBF24', icon: icons.package, label: 'Shipping' };
  }

  // Product events (Blue/Purple)
  if (eventType.includes('view_item') || eventType.includes('product_view')) {
    return { color: '#3B82F6', icon: icons.eye, label: 'View Item' };
  }
  if (eventType.includes('view_item_list') || eventType.includes('product_list')) {
    return { color: '#6366F1', icon: icons.list, label: 'View List' };
  }
  if (eventType.includes('select_item')) {
    return { color: '#8B5CF6', icon: icons.click, label: 'Select Item' };
  }
  if (eventType.includes('view_cart')) {
    return { color: '#A855F7', icon: icons.bag, label: 'View Cart' };
  }

  // Page events (Green)
  if (eventType.includes('page_view') || eventType.includes('pageview')) {
    return { color: '#10B981', icon: icons.file, label: 'Page View' };
  }
  if (eventType.includes('scroll')) {
    return { color: '#14B8A6', icon: icons.arrowDown, label: 'Scroll' };
  }

  // User events (Cyan)
  if (eventType.includes('login') || eventType.includes('sign_in')) {
    return { color: '#06B6D4', icon: icons.lock, label: 'Login' };
  }
  if (eventType.includes('sign_up') || eventType.includes('register')) {
    return { color: '#0EA5E9', icon: icons.userPlus, label: 'Sign Up' };
  }
  if (eventType.includes('logout')) {
    return { color: '#0284C7', icon: icons.logout, label: 'Logout' };
  }

  // Engagement events (Yellow)
  if (eventType.includes('search') || eventType.includes('view_search_results')) {
    return { color: '#EAB308', icon: icons.search, label: 'Search' };
  }
  if (eventType.includes('share')) {
    return { color: '#FACC15', icon: icons.share, label: 'Share' };
  }
  if (eventType.includes('click')) {
    return { color: '#FDE047', icon: icons.click, label: 'Click' };
  }

  // Custom/Generic events (Gray)
  return { color: '#9CA3AF', icon: icons.zap, label: eventName };
}

function flattenObject(obj, prefix = '') {
  const result = {};
  for (const key in obj) {
    if (!obj.hasOwnProperty(key)) continue;
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, fullKey));
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item !== null && typeof item === 'object') {
          Object.assign(result, flattenObject(item, `${fullKey}.${i}`));
        } else {
          result[`${fullKey}.${i}`] = item;
        }
      });
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

function renderEvents() {
  const filter = elements.eventFilter.value.toLowerCase().trim();

  // STEP 1: Filter by selected page
  let filteredByPage = events;
  if (selectedPageFilter !== null) {
    filteredByPage = events.filter(e => {
      const data = e.data?.data || e.data || e;
      let urlStr = e.pageUrl || data.url || e.url || data.page_location || data.dl;

      if (!urlStr || urlStr === 'undefined') {
        urlStr = 'Unknown Page';
      }

      let pathname = urlStr;
      try {
        if (urlStr !== 'Unknown Page') {
          pathname = new URL(urlStr).pathname;
        }
      } catch { }

      return pathname === selectedPageFilter;
    });
  }

  // STEP 2: Apply search filter
  const filtered = filteredByPage.filter(e => {
    if (!filter) return true;
    const data = e.data?.data || e.data || e;
    // Event name is stored in e.event (from service worker) or inside data
    const eventName = (e.event || data?.event || data?.['0'] || e.eventName || 'push').toLowerCase();
    const jsonStr = JSON.stringify(data).toLowerCase();

    // Support regex patterns with | for OR matching
    if (filter.includes('|')) {
      try {
        const regex = new RegExp(filter, 'i');
        return regex.test(eventName) || regex.test(jsonStr);
      } catch (err) {
        // Invalid regex, fall back to includes
        return eventName.includes(filter) || jsonStr.includes(filter);
      }
    }
    return eventName.includes(filter) || jsonStr.includes(filter);
  });

  if (filtered.length > 0) {
    // Group events by URL (Pathname)
    const groupedGroups = []; // Array of { url: string, events: [] }
    let currentGroup = null;

    // Process events in reverse order (newest first)
    const reversedEvents = filtered.slice().reverse();

    reversedEvents.forEach(event => {
      const data = event.data?.data || event.data || event;

      // Improved URL detection logic
      // event.pageUrl comes from service worker (sender.tab.url)
      // data.url comes from content script payload
      let urlStr = event.pageUrl || data.url || event.url;

      // Fallback for GA4/GTM standard fields
      if (!urlStr) {
        urlStr = data.page_location || data.dl;
      }

      if (!urlStr || urlStr === 'undefined') {
        urlStr = 'Unknown Page';
      }

      let pathname = urlStr;
      try {
        if (urlStr !== 'Unknown Page') {
          pathname = new URL(urlStr).pathname;
        }
      } catch { }

      // If URL changed from previous event in this sorted list, start new group
      if (!currentGroup || currentGroup.pathname !== pathname) {
        currentGroup = {
          pathname: pathname,
          fullUrl: urlStr,
          events: []
        };
        groupedGroups.push(currentGroup);
      }
      currentGroup.events.push(event);
    });

    elements.eventList.innerHTML = groupedGroups.map((group, groupIdx) => {
      const groupKey = `${group.pathname}`;
      const isCollapsed = collapsedEventGroups.has(groupKey);
      const groupDisplay = isCollapsed ? 'none' : 'block';
      const chevronRotation = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';

      return `
      <div class="event-group" style="margin-bottom:12px">
        <div class="group-header" data-group-index="${groupIdx}" data-group-key="${groupKey}" style="
          background: var(--bg-secondary);
          padding: 6px 10px;
          border-bottom: 1px solid var(--border);
          font-size: 11px;
          font-weight: 600;
          color: var(--accent-blue);
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          user-select: none;
        " title="Click to toggle events for this page">
          <div style="display:flex;align-items:center;gap:6px;overflow:hidden">
             <svg class="group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;transition:transform 0.2s;transform:${chevronRotation}">
               <polyline points="6 9 12 15 18 9"/>
             </svg>
             <span title="${group.fullUrl}" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${group.pathname}</span>
          </div>
          <span style="font-size:9px;color:var(--text-muted);background:var(--bg-primary);padding:2px 6px;border-radius:10px">${group.events.length}</span>
        </div>
        <div class="group-items" id="group-items-${groupIdx}" style="display:${groupDisplay}">
          ${group.events.map(event => {
        const data = event.data?.data || event.data || event;
        let eventName = data?.event || data?.['0'] || event.eventName || 'push';

        // Detect "Clear Ecommerce" (ecommerce: null) -> Rename to "data"
        if ((eventName === 'push' || eventName === 'unknown') && data && data.ecommerce === null) {
          eventName = 'data';
        }

        // Detect "get" command and format as "get.TARGET (gtag)"
        if (eventName === 'get' && data && data['1']) {
          eventName = `${eventName}.${data['1']} (gtag)`;
        }
        const jsonString = JSON.stringify(data, null, 2);
        const validation = validateGA4Event(data);

        let validationHtml = '';
        if (validation.errors.length > 0 || validation.warnings.length > 0) {
          const scoreColor = validation.score >= 80 ? 'var(--success-green)' :
            (validation.score >= 50 ? 'var(--warning-yellow)' : 'var(--error-red)');

          validationHtml = `
          <div class="validation-panel validation-panel-hoverable" style="margin:8px 0 0 0;padding:10px;background:var(--bg-secondary);border-radius:6px;border-left:3px solid ${scoreColor};cursor:pointer;transition:background 0.2s ease">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <span style="font-size:10px;font-weight:600;color:var(--text-secondary)">Schema Validation</span>
              <span style="font-size:11px;font-weight:bold;color:${scoreColor}">Score: ${validation.score}/100</span>
            </div>
            ${validation.errors.length > 0 ? `
              <div style="margin-bottom:6px">
                ${validation.errors.map(err => `
                  <div style="display:flex;align-items:flex-start;gap:6px;font-size:10px;color:var(--error-red);margin-bottom:3px">
                    <span style="flex-shrink:0">✗</span>
                    <span>${err}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            ${validation.warnings.length > 0 ? `
              <div>
                ${validation.warnings.slice(0, 3).map(warn => `
                  <div style="display:flex;align-items:flex-start;gap:6px;font-size:10px;color:var(--warning-yellow);margin-bottom:3px">
                    <span style="flex-shrink:0">⚠</span>
                    <span>${warn}</span>
                  </div>
                `).join('')}
                ${validation.warnings.length > 3 ? `<div style="font-size:9px;color:var(--text-muted)">+${validation.warnings.length - 3} more warnings</div>` : ''}
              </div>
            ` : ''}
          </div>
        `;
        } else if (GA4_EVENT_SCHEMAS[eventName]) {
          validationHtml = `
          <div class="validation-success-hoverable" style="margin:8px 0 0 0;padding:6px 10px;background:rgba(34,197,94,0.1);border-radius:4px;border-left:3px solid var(--success-green);display:flex;align-items:center;gap:6px;cursor:pointer;transition:background 0.2s ease">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--success-green)" stroke-width="2" style="width:12px;height:12px"><polyline points="20 6 9 17 4 12"/></svg>
            <span style="font-size:10px;color:var(--success-green);font-weight:500">Valid GA4 Event (100/100)</span>
          </div>
        `;
        }

        const isExpanded = expandedEventItems.has(event.id);
        const itemBorderColor = isExpanded ? 'var(--accent-blue)' : 'var(--border)';
        const detailsDisplay = isExpanded ? 'block' : 'none';

        // Get event styling
        const eventStyle = getEventTypeStyle(eventName);

        // Build flat JSON view
        const flatJson = flattenObject(data);
        const flatString = Object.entries(flatJson).map(([k, v]) => {
          const val = typeof v === 'string' ? `"${v}"` : v;
          return `<div class="flat-row" data-copy-value="${k}" style="display:flex;align-items:center;gap:6px;padding:3px 4px;border-radius:4px;cursor:pointer;transition:background 0.15s" title="Click to copy key"><span style="color:var(--accent-blue);white-space:nowrap;font-size:10px">${k}</span><span style="color:var(--text-muted)">:</span><span style="color:var(--text-primary);word-break:break-all;flex:1">${val}</span><svg class="flat-copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px;flex-shrink:0;opacity:0.3;transition:opacity 0.15s"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2-2h1"/></svg></div>`;
        }).join('');

        // Build colored JSON view
        const jsonHtml = syntaxHighlight(data);

        return `
            <div class="event-item" data-id="${event.id}" style="border-color: ${itemBorderColor}">
              <div class="event-header" style="cursor: pointer;">
                 <div style="display:flex;flex-direction:column;gap:2px">
                   <span style="font-size:10px;color:var(--text-secondary)">${formatTimestamp(event.timestamp)}</span>
                   <span class="event-name" style="color:${eventStyle.color};display:flex;align-items:center;gap:4px;font-weight:600;">
                     ${eventStyle.icon}
                     <span>${eventName}</span>
                   </span>
                 </div>
                 <div class="event-actions">
                    <button class="copy-btn" title="Copy Event Name" data-event-name="${eventName}">
                       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2-2h1"/></svg>
                    </button>
                 </div>
              </div>
              ${validationHtml}
              <div class="event-details" style="display:${detailsDisplay};margin-top:0;padding-top:0;border-top:none;font-family:'Consolas','Monaco',monospace;font-size:11px"><!-- View Tabs --><div class="details-tabs" style="display:flex;gap:8px;margin-bottom:0;padding-bottom:0;border-bottom:none;font-size:10px;font-weight:600;color:var(--text-secondary)"><span class="tab-link active" data-view="flat" style="padding:2px 6px;border-radius:4px;background:var(--bg-tertiary);cursor:pointer">Flat View</span><span class="tab-link" data-view="json" style="padding:2px 6px;border-radius:4px;cursor:pointer">JSON View</span></div><!-- Flat View Container --><div class="view-flat" style="display:block;margin-top:4px">${flatString}</div><!-- JSON View Container --><div class="view-json" style="display:none;white-space:pre;overflow-x:auto;padding:4px;background:var(--bg-primary);border-radius:4px;border:1px solid var(--border);font-family:Consolas,Monaco,monospace">${jsonHtml}</div></div>
            </div>
          `;
      }).join('')}
         </div>
       </div>
       `;
    }).join('');


    // Attach Listeners
    elements.eventList.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = btn.dataset.eventName;
        navigator.clipboard.writeText(name).then(() => {
          const originalHTML = btn.innerHTML;
          btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:var(--success-green)"><polyline points="20 6 9 17 4 12"/></svg>`;
          setTimeout(() => btn.innerHTML = originalHTML, 1500);
        });
      });
    });

    // Toggle Flat/JSON View
    elements.eventList.querySelectorAll('.tab-link').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        const view = tab.dataset.view;
        const container = tab.closest('.event-details');

        // Update tabs
        container.querySelectorAll('.tab-link').forEach(t => {
          const isActive = t.dataset.view === view;
          t.classList.toggle('active', isActive);
          t.style.background = isActive ? 'var(--bg-tertiary)' : 'transparent';
        });

        // Update views
        if (view === 'flat') {
          container.querySelector('.view-flat').style.display = 'block';
          container.querySelector('.view-json').style.display = 'none';
        } else {
          container.querySelector('.view-flat').style.display = 'none';
          container.querySelector('.view-json').style.display = 'block';
        }
      });
    });

    // Copy individual flat row values
    elements.eventList.querySelectorAll('.flat-row').forEach(row => {
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = row.dataset.copyValue;
        navigator.clipboard.writeText(val).then(() => {
          row.style.background = 'rgba(34,197,94,0.1)';
          const icon = row.querySelector('.flat-copy-icon');
          if (icon) {
            icon.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
            icon.style.opacity = '1';
            icon.style.stroke = 'var(--success-green)';
          }
          setTimeout(() => {
            row.style.background = '';
            if (icon) {
              icon.innerHTML = '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2-2h1"/>';
              icon.style.opacity = '0.3';
              icon.style.stroke = '';
            }
          }, 1000);
        });
      });
    });

    // Toggle details on header click
    elements.eventList.querySelectorAll('.event-item').forEach(item => {
      const header = item.querySelector('.event-header');
      const validationPanel = item.querySelector('.validation-panel');

      // Header click handler
      if (header) {
        header.addEventListener('click', (e) => {
          // Don't toggle if clicking on copy button
          if (e.target.closest('.copy-btn')) return;

          const id = item.dataset.id;
          const details = item.querySelector('.event-details');
          if (!details) return;

          const isExpanded = expandedEventItems.has(id);

          if (isExpanded) {
            details.style.display = 'none';
            item.style.borderColor = 'var(--border)';
            expandedEventItems.delete(id);
          } else {
            details.style.display = 'block';
            item.style.borderColor = 'var(--accent-blue)';
            expandedEventItems.add(id);
          }
        });
      }

      // Validation panel click handler
      if (validationPanel) {
        validationPanel.addEventListener('click', (e) => {
          e.stopPropagation(); // Don't trigger parent clicks

          const id = item.dataset.id;
          const details = item.querySelector('.event-details');
          if (!details) return;

          const isExpanded = expandedEventItems.has(id);

          if (isExpanded) {
            details.style.display = 'none';
            item.style.borderColor = 'var(--border)';
            expandedEventItems.delete(id);
          } else {
            details.style.display = 'block';
            item.style.borderColor = 'var(--accent-blue)';
            expandedEventItems.add(id);
          }
        });
      }
    });

    // Toggle event groups (pages)
    elements.eventList.querySelectorAll('.group-header').forEach(header => {
      header.addEventListener('click', () => {
        const idx = header.dataset.groupIndex;
        const groupKey = header.dataset.groupKey;
        const items = document.getElementById(`group-items-${idx}`);
        const chevron = header.querySelector('.group-chevron');

        if (items) {
          const isVisible = items.style.display !== 'none';

          if (isVisible) {
            items.style.display = 'none';
            if (chevron) chevron.style.transform = 'rotate(-90deg)';
            collapsedEventGroups.add(groupKey);
          } else {
            items.style.display = 'block';
            if (chevron) chevron.style.transform = 'rotate(0deg)';
            collapsedEventGroups.delete(groupKey);
          }
        }
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

// ============================================
// Page Navigation Rendering
// ============================================
function renderPageNavigation() {
  const pageNavList = document.getElementById('pageNavList');
  if (!pageNavList) return;

  // Update page stats from current events
  pageStats = extractPageStats(events);

  const totalEvents = events.length;
  const isAllPagesActive = selectedPageFilter === null;

  // Build HTML
  let html = `
    <div class="page-nav-item all-pages ${isAllPagesActive ? 'active' : ''}" data-page="__all__">
      <div class="page-pathname">All Pages</div>
      <div class="page-event-count">${totalEvents}</div>
    </div>
  `;

  if (pageStats.size === 0) {
    pageNavList.innerHTML = html;
    return;
  }

  pageStats.forEach((stat, pathname) => {
    const isActive = selectedPageFilter === pathname;
    const displayPath = pathname.length > 18 ? pathname.substring(0, 15) + '...' : pathname;

    html += `
      <div class="page-nav-item ${isActive ? 'active' : ''}"
           data-page="${pathname}"
           title="${stat.fullUrl}">
        <div class="page-pathname">${displayPath}</div>
        <div class="page-event-count">${stat.count}</div>
      </div>
    `;
  });

  pageNavList.innerHTML = html;

  // Attach click listeners
  pageNavList.querySelectorAll('.page-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;

      if (page === '__all__') {
        selectedPageFilter = null;
      } else {
        selectedPageFilter = page;
      }

      renderPageNavigation();
      renderEvents();
      updateEventsPanelTitle();
    });
  });
}

function updateEventsPanelTitle() {
  const titleEl = document.getElementById('eventsPanelTitle');
  if (!titleEl) return;

  if (selectedPageFilter === null) {
    titleEl.textContent = 'DataLayer Events';
  } else {
    const displayPath = selectedPageFilter.length > 20
      ? selectedPageFilter.substring(0, 17) + '...'
      : selectedPageFilter;
    titleEl.textContent = `Events: ${displayPath}`;
  }
}

elements.eventFilter.addEventListener('input', renderEvents);

elements.clearEvents.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: MESSAGE_TYPES.DATALAYER_CLEAR });
  events = [];
  expandedEventItems.clear();
  collapsedEventGroups.clear();
  selectedPageFilter = null;
  pageStats.clear();
  renderPageNavigation();
  renderEvents();
  updateEventsPanelTitle();
});

async function loadEvents() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) currentTabId = tab.id;
    const result = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.DATALAYER_GET,
      tabId: tab?.id
    });
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
const GA4_PARAMS = {
  'en': 'Event Name',
  'tid': 'Tracking ID',
  'cid': 'Client ID',
  'sid': 'Session ID',
  'sct': 'Session Count',
  'seg': 'Session Engagement',
  'dl': 'Page Location',
  'dr': 'Referrer',
  'dt': 'Page Title',
  'ul': 'Language',
  'sr': 'Screen Resolution',
  'vp': 'Viewport',
  'ep.': 'Event Parameter: ',
  'up.': 'User Property: ',
  'cu': 'Currency',
  '_ee': 'Enhanced Measurement'
};

let currentTabId = null;

// Get request type styling (icon + color + label)
function getRequestTypeStyle(request) {
  const url = request.url || '';
  const urlLower = url.toLowerCase();

  // CHECK DETECTED TECHNOLOGIES FIRST
  if (currentTabId && techCacheMap.has(currentTabId)) {
    const detected = techCacheMap.get(currentTabId).data || [];
    for (const tech of detected) {
      if (tech.patterns && tech.patterns.length > 0) {
        // specific pattern matching
        for (const pattern of tech.patterns) {
          if (urlLower.includes(pattern.toLowerCase())) {
            return {
              icon: `<img src="${tech.icon}" style="width:12px;height:12px;object-fit:contain;border-radius:2px" onerror="this.style.display='none'">`,
              color: 'var(--text-primary)',
              bgColor: 'var(--bg-tertiary)',
              label: tech.name
            };
          }
        }
      }
    }
  }

  // GA4 (Google Analytics 4)
  if (urlLower.includes('/g/collect') || urlLower.includes('google-analytics.com/g/')) {
    return { icon: '<img src="https://cdn.simpleicons.org/googleanalytics/E37400" style="width:12px;height:12px;object-fit:contain;">', color: '#FBBC04', bgColor: 'rgba(251, 188, 4, 0.1)', label: 'GA4' };
  }

  // Universal Analytics (Legacy)
  if (urlLower.includes('/collect') && !urlLower.includes('/g/collect')) {
    return { icon: '<img src="https://cdn.simpleicons.org/googleanalytics/E37400" style="width:12px;height:12px;object-fit:contain;">', color: '#FF6D01', bgColor: 'rgba(255, 109, 1, 0.1)', label: 'UA' };
  }

  // Google Ads Conversion
  if (urlLower.includes('googleadservices.com') || urlLower.includes('/pagead/conversion')) {
    return { icon: '<img src="https://cdn.simpleicons.org/googleads/4285F4" style="width:12px;height:12px;object-fit:contain;">', color: '#34A853', bgColor: 'rgba(52, 168, 83, 0.1)', label: 'Ads Conv' };
  }

  // Google Ads Remarketing
  if (urlLower.includes('/pagead/1p-user-list') || urlLower.includes('google.com/pagead/')) {
    return { icon: '<img src="https://cdn.simpleicons.org/googleads/4285F4" style="width:12px;height:12px;object-fit:contain;">', color: '#4285F4', bgColor: 'rgba(66, 133, 244, 0.1)', label: 'Remarketing' };
  }

  // Floodlight
  if (urlLower.includes('fls.doubleclick.net') || urlLower.includes('ad.doubleclick.net')) {
    return { icon: '<img src="https://cdn.simpleicons.org/googlecampaignmanager360/4285F4" style="width:12px;height:12px;object-fit:contain;">', color: '#EA4335', bgColor: 'rgba(234, 67, 53, 0.1)', label: 'Floodlight' };
  }

  // GTM (Google Tag Manager) - path-based detection
  if (urlLower.includes('/gtm.js') || urlLower.includes('/gtag/js')) {
    return { icon: '<img src="https://cdn.simpleicons.org/googletagmanager/246FDB" style="width:12px;height:12px;object-fit:contain;">', color: '#9334E9', bgColor: 'rgba(147, 52, 233, 0.1)', label: 'GTM' };
  }

  // DoubleClick (Generic)
  if (urlLower.includes('doubleclick.net')) {
    return { icon: '<svg viewBox="0 0 24 24" fill="#EC4899" style="width:12px;height:12px"><circle cx="12" cy="12" r="8"/></svg>', color: '#EC4899', bgColor: 'rgba(236, 72, 153, 0.1)', label: 'DoubleClick' };
  }

  // Google Optimize
  if (urlLower.includes('optimize.google.com') || urlLower.includes('googleoptimize.com')) {
    return { icon: '<svg viewBox="0 0 24 24" fill="#8B5CF6" style="width:12px;height:12px"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>', color: '#8B5CF6', bgColor: 'rgba(139, 92, 246, 0.1)', label: 'Optimize' };
  }

  // Default (Unknown Google Service)
  return { icon: '<svg viewBox="0 0 24 24" fill="#6B7280" style="width:12px;height:12px"><circle cx="12" cy="12" r="10"/><path d="M2.5 12h19M12 2.5a19.5 19.5 0 0 1 0 19a19.5 19.5 0 0 1 0-19"/></svg>', color: '#6B7280', bgColor: 'rgba(107, 114, 128, 0.1)', label: 'Request' };
}

function renderNetworkRequests() {
  // Enhanced filtering with Regex support
  const filter = elements.networkFilter?.value?.toLowerCase().trim() || '';

  const filtered = networkRequests.filter(req => {
    if (!filter) return true;
    const searchStr = (req.url + ' ' + (req.typeName || '') + ' ' + req.type).toLowerCase();

    // Support regex patterns like "ads|doubleclick"
    if (filter.includes('|')) {
      try {
        const regex = new RegExp(filter, 'i');
        return regex.test(searchStr);
      } catch (e) {
        return searchStr.includes(filter);
      }
    }
    return searchStr.includes(filter);
  });

  // Update Stats with Clickable Chips
  if (elements.networkStats) {
    const stats = [
      { label: 'Total', count: networkRequests.length, filter: '' },
      { label: 'GA4', count: networkRequests.filter(r => r.type.includes('GA4')).length, filter: 'ga4' },
      { label: 'GAds', count: networkRequests.filter(r => (r.type.includes('ADS') || r.type.includes('DOUBLECLICK') || r.type.includes('CONVERSION')) && !r.type.includes('GA4')).length, filter: 'ads|doubleclick' },
      { label: 'GTM', count: networkRequests.filter(r => r.type === 'GTM_JS').length, filter: 'gtm.js' }
    ];

    elements.networkStats.innerHTML = stats.map(s => `
      <div class="stat-chip" 
           data-filter="${s.filter}" 
           style="background: ${elementFilterMatch(filter, s.filter) ? 'var(--accent-blue)' : 'var(--bg-secondary)'}; 
                  padding: 6px 10px; 
                  border-radius: 6px; 
                  border: 1px solid ${elementFilterMatch(filter, s.filter) ? 'var(--accent-blue)' : 'var(--border)'}; 
                  white-space: nowrap; 
                  font-size: 10px; 
                  cursor: pointer; 
                  display: flex; 
                  align-items: center; 
                  gap: 4px; 
                  transition: all 0.2s; 
                  color: ${elementFilterMatch(filter, s.filter) ? 'white' : 'inherit'};">
        <span style="color:${elementFilterMatch(filter, s.filter) ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)'}">${s.label}:</span>
        <span style="font-weight:bold;color:${elementFilterMatch(filter, s.filter) ? 'white' : 'var(--accent-blue)'}">${s.count}</span>
      </div>
    `).join('');

    // Attach Click Listeners
    elements.networkStats.querySelectorAll('.stat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (elements.networkFilter) {
          // Toggle off if already selected
          const newFilter = chip.dataset.filter;
          elements.networkFilter.value = (elements.networkFilter.value === newFilter) ? '' : newFilter;
          renderNetworkRequests();
        }
      });
    });
  }

  // Helper for active state
  function elementFilterMatch(current, target) {
    if (!target && !current) return true;
    return current === target;
  }

  if (filtered.length > 0) {
    elements.networkList.innerHTML = filtered.slice(-50).reverse().map(req => {
      let urlObj;
      try {
        urlObj = new URL(req.url);
      } catch {
        urlObj = { pathname: req.url, searchParams: new URLSearchParams() };
      }

      const isSuccess = (req.statusCode >= 200 && req.statusCode < 300) || req.statusCode === 0;
      const isGA4 = req.type.includes('GA4');

      const paramRows = [];
      if (urlObj.searchParams) {
        urlObj.searchParams.forEach((val, key) => {
          let label = key;
          let isHighlight = false;

          if (isGA4) {
            // GA4 Mapping
            if (GA4_PARAMS[key]) {
              label = GA4_PARAMS[key];
              isHighlight = true;
            } else if (key.startsWith('ep.')) {
              label = 'EP: ' + key.substring(3);
              isHighlight = true;
            } else if (key.startsWith('up.')) {
              label = 'UP: ' + key.substring(3);
            }
          }

          paramRows.push(`
            <div class="param-key" style="${isHighlight ? 'color:var(--accent-blue);font-weight:600' : ''}">${label}:</div>
            <div class="param-value" style="word-break:break-all">${val}</div>
          `);
        });
      }

      const badgeHtml = `
        <div class="network-badges">
          ${req.isServerSide ? '<span class="badge badge-server">Server-Side</span>' : ''}
          ${req.hasEnhancedConversions ? '<span class="badge badge-ec">Enhanced Conversions</span>' : ''}
          ${isGA4 && urlObj.searchParams.get('en') ? `<span class="badge" style="background:var(--google-blue)">${urlObj.searchParams.get('en')}</span>` : ''}
        </div>
      `;

      const isExpanded = expandedNetworkItems.has(req.id);

      // Get request styling
      const requestStyle = getRequestTypeStyle(req);

      return `
        <div class="network-item" data-id="${req.id}" style="border-left: 3px solid ${requestStyle.color}">
        <div class="network-header">
           <span class="network-method ${req.method}">${req.method || 'GET'}</span>
           <span class="network-type" style="background:${requestStyle.bgColor};color:${requestStyle.color};padding:4px 8px;border-radius:6px;font-weight:600;display:flex;align-items:center;gap:4px;">
             <span style="font-size:12px;">${requestStyle.icon}</span>
             <span>${requestStyle.label}</span>
           </span>
           <span class="network-status ${isSuccess ? 'success' : 'error'}">${req.statusCode || (req.error ? 'ERR' : '...')}</span>
           <span style="margin-left:auto;font-size:10px;color:var(--text-muted)">${formatTimestamp(req.timestamp)}</span>
        </div>
        <div class="network-url" title="${req.url}">${urlObj.pathname}</div>
        ${badgeHtml}
    <div class="network-details" style="display:${isExpanded ? 'block' : 'none'}">
      <div style="margin-bottom:12px;display:flex;flex-direction:column;gap:8px">
        ${req.hasEnhancedConversions ? `
                   <div class="validation-warning" style="background:rgba(34,197,94,0.05);color:var(--text-primary);border-color:rgba(34,197,94,0.2);display:block">
                     <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;color:var(--success-green)">
                       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                       <strong style="font-size:11px">Enhanced Conversions Detected</strong>
                     </div>
                     <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(120px, 1fr));gap:6px">
                       ${Object.keys(req.ecValidation.fields).map(f => {
        const fieldMap = {
          'em': 'Email', 'ph': 'Phone', 'fn': 'First Name', 'ln': 'Last Name',
          'ct': 'City', 'st': 'State', 'zp': 'Zip Code', 'country': 'Country',
          'ge': 'Gender', 'db': 'Date of Birth'
        };
        const fieldData = req.ecValidation.fields[f];
        const isValid = fieldData.valid;
        const icon = isValid ?
          '<svg viewBox="0 0 24 24" fill="none" stroke="var(--success-green)" stroke-width="2" style="width:10px;height:10px"><polyline points="20 6 9 17 4 12"/></svg>' :
          '<svg viewBox="0 0 24 24" fill="none" stroke="var(--warning-yellow)" stroke-width="2" style="width:10px;height:10px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12" y2="16"/></svg>';

        return `
                           <div style="background:var(--bg-primary);padding:4px 8px;border-radius:4px;border:1px solid ${isValid ? 'var(--border-light)' : 'var(--warning-yellow)'};font-size:10px;display:flex;align-items:center;justify-content:space-between">
                             <span style="color:var(--text-secondary)">${fieldMap[f] || f}</span>
                             <div style="display:flex;align-items:center;gap:4px">
                               <span style="font-family:monospace;opacity:0.8">${fieldData.type}</span>
                               ${icon}
                             </div>
                           </div>
                         `;
      }).join('')}
                     </div>
                   </div>
                 ` : ''}

        ${isGA4 && (urlObj.searchParams.get('gcs') || urlObj.searchParams.get('gcd')) ? `
              <div class="validation-warning" style="background:rgba(66,133,244,0.05);color:var(--text-primary);border-color:rgba(66,133,244,0.2);display:block;margin-top:8px">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;color:var(--accent-blue)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <strong style="font-size:11px">Consent State (Reported)</strong>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
                  ${(() => {
            const gcs = urlObj.searchParams.get('gcs');
            const gcd = urlObj.searchParams.get('gcd');
            let html = '';

            if (gcs) {
              const ad = gcs.charAt(2) === '1' ? 'Granted' : (gcs.charAt(2) === '0' ? 'Denied' : 'Not Set');
              const analytics = gcs.charAt(3) === '1' ? 'Granted' : (gcs.charAt(3) === '0' ? 'Denied' : 'Not Set');
              html += `
                        <div style="background:var(--bg-primary);padding:4px 8px;border-radius:4px;border:1px solid var(--border-light);font-size:10px">
                          <span style="color:var(--text-secondary);display:block;font-size:9px">AD_STORAGE</span>
                          <span style="font-weight:600;color:${ad === 'Granted' ? 'var(--success-green)' : 'var(--error-red)'}">${ad}</span>
                        </div>
                        <div style="background:var(--bg-primary);padding:4px 8px;border-radius:4px;border:1px solid var(--border-light);font-size:10px">
                          <span style="color:var(--text-secondary);display:block;font-size:9px">ANALYTICS_STORAGE</span>
                          <span style="font-weight:600;color:${analytics === 'Granted' ? 'var(--success-green)' : 'var(--error-red)'}">${analytics}</span>
                        </div>
                      `;
            }

            if (gcd) {
              // Extract mapping
              const charToStatus = {
                'p': 'Denied', 'q': 'Denied', 'r': 'Granted',
                't': 'Granted', 'u': 'Denied', 'v': 'Granted', 'l': '-'
              };
              const ad = charToStatus[gcd.charAt(2)] || 'Unknown';
              const analytics = charToStatus[gcd.charAt(4)] || 'Unknown';
              const userData = charToStatus[gcd.charAt(6)] || 'Unknown';
              const personalization = charToStatus[gcd.charAt(8)] || 'Unknown';

              html += `
                        <div style="background:var(--bg-primary);padding:4px 8px;border-radius:4px;border:1px solid var(--border-light);font-size:10px">
                          <span style="color:var(--text-secondary);display:block;font-size:9px">AD_USER_DATA</span>
                          <span style="font-weight:600;color:${userData === 'Granted' ? 'var(--success-green)' : 'var(--error-red)'}">${userData}</span>
                        </div>
                        <div style="background:var(--bg-primary);padding:4px 8px;border-radius:4px;border:1px solid var(--border-light);font-size:10px">
                          <span style="color:var(--text-secondary);display:block;font-size:9px">AD_PERSONALIZATION</span>
                          <span style="font-weight:600;color:${personalization === 'Granted' ? 'var(--success-green)' : 'var(--error-red)'}">${personalization}</span>
                        </div>
                      `;
            }
            return html || '<span style="font-size:10px;color:var(--text-muted)">No consent data in hit</span>';
          })()}
                </div>
              </div>
            ` : ''}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="color:var(--text-secondary);font-weight:600">Request Details</span>
        <button class="btn-icon btn-small copy-curl" data-url="${req.url}" title="Copy URL">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>
        </button>
      </div>
      <div style="word-break:break-all;color:var(--text-primary);font-family:'Consolas',monospace;font-size:11px;margin-bottom:12px;padding:8px;background:var(--bg-primary);border:1px solid var(--border);border-radius:6px">${req.url}</div>

      ${paramRows.length ? `
                <div style="margin-bottom:8px;color:var(--text-secondary);font-size:11px;font-weight:600">Parameters (${urlObj.searchParams.size})</div>
                <div class="network-params" style="border:1px solid var(--border);border-radius:6px;background:var(--bg-surface)">
                  ${paramRows.join('')}
                </div>
              ` : ''}
    </div>
      </div>
      `}).join('');

    elements.networkList.querySelectorAll('.copy-curl').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(btn.dataset.url);
        showToast('URL Copied');
      });
    });

    elements.networkList.querySelectorAll('.network-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.network-details')) return;

        const id = item.dataset.id;
        const detailsEl = item.querySelector('.network-details');
        const isExpanded = detailsEl.style.display !== 'none';

        if (isExpanded) {
          detailsEl.style.display = 'none';
          item.style.borderColor = 'var(--border)';
          expandedNetworkItems.delete(id);
        } else {
          detailsEl.style.display = 'block';
          item.style.borderColor = 'var(--accent-blue)';
          expandedNetworkItems.add(id);
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
    if (!tab?.id) return;

    currentTabId = tab.id;

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

if (elements.networkFilter) {
  elements.networkFilter.addEventListener('input', renderNetworkRequests);
}

if (elements.clearNetwork) {
  elements.clearNetwork.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'NETWORK_CLEAR' });
    networkRequests = [];
    expandedNetworkItems.clear();
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
  if (message.type === 'SHOW_TOAST') {
    showToast(message.message, message.level || 'info');
  } else if (message.type === MESSAGE_TYPES.DATALAYER_PUSH) {
    events.push(message.data);
    renderPageNavigation();
    renderEvents();
    // Check real-time alerts
    checkAlertRules(message.data);


  } else if (message.type === 'NETWORK_REQUEST') {
    networkRequests.push(message.data);
    if (currentTab === 'network') {
      renderNetworkRequests();
    } else if (currentTab === 'consent') {
      // Auto-refresh CSP if needed or nothing
    }

  } else if (message.type === MESSAGE_TYPES.TAB_UPDATED) {
    updateCurrentUrl(message.data.url);
    checkActiveInjection();
    detectContainers();
    if (currentTab === 'cookies') refreshCookies();
    if (currentTab === 'tech') {
      // Auto-refresh tech detection on URL change
      setTimeout(() => detectTechnologies(true), 800);
    }
  } else if (message.type === 'SELECTOR_RESULT') {
    verifyElements();
    if (message.payload.error) {
      showToast(message.payload.error, 'error');
      return;
    }
    const { selector, tagName, id, classes, attributes, innerText, valueInfo } = message.payload;
    if (!selector) {
      showToast('Could not generate selector', 'error');
      return;
    }

    // Verify element matches current tab context
    // (Optional: Implement request ID check if strictly needed, but selector result is usually immediate)

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

    // Check for special link types (tel:, mailto:, WhatsApp)
    const href = attributes?.href || '';
    if (href) {
      if (href.startsWith('tel:')) {
        suggestions.push({
          type: 'Click Element',
          condition: 'matches CSS selector',
          value: 'a[href^="tel:"]',
          desc: 'Phone links only'
        });
      } else if (href.startsWith('mailto:')) {
        suggestions.push({
          type: 'Click Element',
          condition: 'matches CSS selector',
          value: 'a[href^="mailto:"]',
          desc: 'Email links only'
        });
      } else if (href.includes('wa.me') || href.includes('api.whatsapp.com')) {
        suggestions.push({
          type: 'Click Element',
          condition: 'matches CSS selector',
          value: 'a[href*="wa.me"], a[href*="api.whatsapp"]',
          desc: 'WhatsApp links only'
        });
      }
    }

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

    triggerHtml += suggestions.map(s => `
      <div style="background:var(--bg-secondary);padding:8px;border:1px solid var(--border);border-radius:4px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;align-items:center">
          <span style="font-weight:bold;color:var(--google-blue)">${s.type}</span>
          <span style="font-size:9px;color:var(--text-muted)">${s.desc}</span>
        </div>
        <div style="font-size:10px;margin-bottom:4px">Condition: <span style="color:var(--text-secondary)">${s.condition}</span></div>
        <div style="font-family:monospace;background:var(--bg-primary);padding:4px;border-radius:2px;word-break:break-all">${s.value}</div>
      </div>
      `).join('');
    triggerHtml += '</div>';

    if (elements.triggerSuggestions) {
      elements.triggerSuggestions.innerHTML = triggerHtml;
    }

    // 2. Generate Code with smart value extraction
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName);
    const escapedSelector = selector.replace(/'/g, "\\'");

    // Create extraction function based on value type
    let extractionLogic = '';
    let simpleGetter = '';

    if (isInput) {
      simpleGetter = 'el.value';
      extractionLogic = 'el.value';
    } else if (valueInfo && valueInfo.hasNumericValue) {
      // If element has numeric value, provide extraction options
      if (valueInfo.extractedPrice !== null) {
        // Price extraction
        simpleGetter = 'el.innerText';
        extractionLogic = `(function() {
        var text = el.innerText || el.textContent || '';
        var matches = text.match(/[\\d]+[.,\\s]?[\\d]+[.,]?[\\d]*/g);
        if (matches && matches.length > 0) {
          var numStr = matches[0].replace(/\\s/g, '');
          var hasComma = numStr.includes(',');
          var hasDot = numStr.includes('.');
          if (hasComma && hasDot) {
            var lastComma = numStr.lastIndexOf(',');
            var lastDot = numStr.lastIndexOf('.');
            numStr = lastComma > lastDot ? numStr.replace(/\\./g, '').replace(',', '.') : numStr.replace(/,/g, '');
          } else if (hasComma) {
            var parts = numStr.split(',');
            numStr = (parts.length === 2 && parts[1].length <= 2) ? numStr.replace(',', '.') : numStr.replace(/,/g, '');
          }
          return parseFloat(numStr);
        }
        return null;
      })()`;
      } else if (valueInfo.extractedNumber !== null) {
        // Number extraction
        simpleGetter = 'el.innerText';
        extractionLogic = `(function() {
        var text = el.innerText || el.textContent || '';
        var matches = text.match(/[\\d]+[.,\\s]?[\\d]+[.,]?[\\d]*/g);
        if (matches && matches.length > 0) {
          var numStr = matches[0].replace(/\\s/g, '');
          var hasComma = numStr.includes(',');
          var hasDot = numStr.includes('.');
          if (hasComma && hasDot) {
            var lastComma = numStr.lastIndexOf(',');
            var lastDot = numStr.lastIndexOf('.');
            numStr = lastComma > lastDot ? numStr.replace(/\\./g, '').replace(',', '.') : numStr.replace(/,/g, '');
          } else if (hasComma) {
            var parts = numStr.split(',');
            numStr = (parts.length === 2 && parts[1].length <= 2) ? numStr.replace(',', '.') : numStr.replace(/,/g, '');
          }
          return parseFloat(numStr);
        }
        return null;
      })()`;
      } else if (valueInfo.extractedPercent !== null) {
        // Percent extraction
        simpleGetter = 'el.innerText';
        extractionLogic = `(function() {
        var text = el.innerText || el.textContent || '';
        var match = text.match(/([\\d.,]+)\\s*%/);
        if (match) {
          var cleaned = match[1].replace(',', '.');
          return parseFloat(cleaned);
        }
        return null;
      })()`;
      } else {
        simpleGetter = 'el.innerText';
        extractionLogic = 'el.innerText';
      }
    } else {
      simpleGetter = 'el.innerText';
      extractionLogic = 'el.innerText';
    }

    const gtmCode = `function() {
  var el = document.querySelector('${escapedSelector}');
  if (!el) return undefined;
  return ${extractionLogic};
}`;

    const testCode = `(function () {
  var el = document.querySelector('${escapedSelector}');
  if (!el) {
    console.log('Element not found:', '${escapedSelector}');
    return null;
  }
  var val = ${extractionLogic};
  console.log('Element found:', el);
  console.log('Raw text:', ${simpleGetter});
  console.log('Extracted value:', val);
  return val;
})();`;

    if (elements.pickedJsVar) elements.pickedJsVar.textContent = gtmCode;
    if (elements.pickedJsTest) elements.pickedJsTest.textContent = testCode;

    // Show appropriate toast based on value type
    let toastMsg = 'Trigger & Variable generated!';
    if (valueInfo && valueInfo.hasNumericValue) {
      if (valueInfo.extractedPrice !== null) {
        toastMsg = `Price: ${valueInfo.extractedPrice} ${valueInfo.extractedCurrency}`;
      } else if (valueInfo.extractedNumber !== null) {
        toastMsg = `Number: ${valueInfo.extractedNumber}`;
      } else if (valueInfo.extractedPercent !== null) {
        toastMsg = `Percent: ${valueInfo.extractedPercent}%`;
      }
    } else if (valueInfo && valueInfo.extractedCurrency) {
      toastMsg = `Currency: ${valueInfo.extractedCurrency}`;
    } else if (valueInfo && valueInfo.isOnlyText) {
      toastMsg = `Text: ${valueInfo.rawText.substring(0, 20)}${valueInfo.rawText.length > 20 ? '...' : ''}`;
    }

    // Add link type info to toast
    if (href && href.startsWith('tel:')) {
      toastMsg = 'Phone link detected!';
    } else if (href && href.startsWith('mailto:')) {
      toastMsg = 'Email link detected!';
    } else if (href && (href.includes('wa.me') || href.includes('api.whatsapp'))) {
      toastMsg = 'WhatsApp link detected!';
    }

    showToast(toastMsg, 'success');
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




if (elements.runJsTest) {
  elements.runJsTest.addEventListener('click', async () => {
    const testCode = elements.pickedJsTest.textContent;
    // Extract the internal function or execute the whole block
    // Since it's console.log((function(){...})()), we'll execute it and capture the return
    try {
      elements.runJsTest.querySelector('svg').classList.add('spin-animation');

      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.CODE_EXECUTE,
        code: testCode
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



// ============================================
// Export Functions
// ============================================
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

elements.exportJson.addEventListener('click', () => {
  const data = {
    exportedAt: new Date().toISOString(),
    url: elements.currentUrl.textContent,
    events: events.map(e => ({
      ...e,
      validation: validateGA4Event(e.data || e)
    })),
    networkRequests,
    summary: {
      totalEvents: events.length,
      totalRequests: networkRequests.length,
      ga4Requests: networkRequests.filter(r => r.type?.includes('GA4')).length,
      serverSideRequests: networkRequests.filter(r => r.isServerSide).length
    }
  };
  downloadFile(JSON.stringify(data, null, 2), `tag-master-export-${Date.now()}.json`, 'application/json');
  showToast('JSON Exported with validation data');
});

elements.exportCsv.addEventListener('click', () => {
  if (events.length === 0) return showToast('No events to export', 'error');

  const headers = ['Timestamp', 'Event', 'Validation Score', 'Errors', 'Warnings', 'Data'];
  const rows = events.map(e => {
    const validation = validateGA4Event(e.data || e);
    return [
      formatTimestamp(e.timestamp),
      e.event || e.data?.event || 'push',
      validation.score,
      validation.errors.join('; '),
      validation.warnings.join('; '),
      JSON.stringify(e.data).replace(/"/g, '""')
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(r => r.map(v => `"${v}"`).join(','))
  ].join('\n');

  downloadFile(csvContent, `tag-master-events-${Date.now()}.csv`, 'text/csv');
  showToast('CSV Exported with validation');
});

// Export as HAR (HTTP Archive) format for network debugging
function exportAsHAR() {
  if (networkRequests.length === 0) {
    showToast('No network requests to export', 'error');
    return;
  }

  const har = {
    log: {
      version: '1.2',
      creator: {
        name: 'Tag Master',
        version: '1.2.0'
      },
      browser: {
        name: navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Browser',
        version: navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'Unknown'
      },
      pages: [{
        startedDateTime: new Date(networkRequests[0]?.timestamp || Date.now()).toISOString(),
        id: 'page_1',
        title: elements.currentUrl.textContent || 'Unknown Page',
        pageTimings: {}
      }],
      entries: networkRequests.map(req => {
        let urlObj;
        try { urlObj = new URL(req.url); } catch { urlObj = { pathname: req.url, searchParams: new URLSearchParams() }; }

        const queryParams = [];
        urlObj.searchParams?.forEach((value, name) => {
          queryParams.push({ name, value });
        });

        return {
          startedDateTime: new Date(req.timestamp).toISOString(),
          time: req.timing?.duration || 0,
          request: {
            method: req.method || 'GET',
            url: req.url,
            httpVersion: 'HTTP/1.1',
            headers: [],
            queryString: queryParams,
            cookies: [],
            headersSize: -1,
            bodySize: -1
          },
          response: {
            status: req.statusCode || 0,
            statusText: req.statusCode === 200 ? 'OK' : (req.error || ''),
            httpVersion: 'HTTP/1.1',
            headers: [],
            cookies: [],
            content: { size: 0, mimeType: 'text/html' },
            redirectURL: '',
            headersSize: -1,
            bodySize: -1
          },
          cache: {},
          timings: {
            send: 0,
            wait: req.timing?.duration || 0,
            receive: 0
          },
          _tagMaster: {
            type: req.type,
            typeName: req.typeName,
            isServerSide: req.isServerSide,
            hasEnhancedConversions: req.hasEnhancedConversions
          }
        };
      })
    }
  };

  downloadFile(JSON.stringify(har, null, 2), `tag-master-network-${Date.now()}.har`, 'application/json');
  showToast('HAR file exported - import in Chrome DevTools');
}

// ============================================
// Keyboard Shortcuts
// ============================================
const KEYBOARD_SHORTCUTS = {
  'Ctrl+1': () => switchToTab('gtm'),
  'Ctrl+2': () => switchToTab('monitor'),
  'Ctrl+3': () => switchToTab('network'),
  'Ctrl+4': () => switchToTab('audit'),
  'Ctrl+5': () => switchToTab('cookies'),
  'Ctrl+6': () => switchToTab('consent'),
  'Ctrl+7': () => switchToTab('push'),
  'Ctrl+K': () => focusCurrentFilter(),
  'Ctrl+F': () => focusCurrentFilter(),
  'Ctrl+L': () => clearCurrentView(),
  'Ctrl+E': () => elements.exportJson?.click(),
  'Ctrl+Shift+E': () => exportAsHAR(),
  'Ctrl+D': () => elements.themeToggle?.click(),
  'Ctrl+R': () => refreshCurrentPanel(),
  'Ctrl+?': () => toggleShortcutsModal(),
  'Ctrl+/': () => toggleShortcutsModal(),
  'Escape': () => closeModals()
};

// switchToTab is defined in the Tab Navigation section above

function focusCurrentFilter() {
  if (currentTab === 'monitor' && elements.eventFilter) {
    elements.eventFilter.focus();
  } else if (currentTab === 'network' && elements.networkFilter) {
    elements.networkFilter.focus();
  }
}

function clearCurrentView() {
  if (currentTab === 'monitor') {
    elements.clearEvents?.click();
  } else if (currentTab === 'network') {
    elements.clearNetwork?.click();
  }
}

function refreshCurrentPanel() {
  if (currentTab === 'gtm') {
    detectContainers();
  } else if (currentTab === 'cookies') {
    refreshCookies();
  } else if (currentTab === 'consent') {
    loadConsentState();
  } else if (currentTab === 'audit') {
    runAudit();
  } else if (currentTab === 'tech') {
    detectTechnologies(true);
  }
}

function closeModals() {
  // Close welcome overlay if open
  if (elements.welcomeOverlay && elements.welcomeOverlay.style.display !== 'none') {
    elements.getStartedBtn?.click();
  }
  // Close shortcuts modal if open
  const shortcutsModal = document.getElementById('shortcutsModal');
  if (shortcutsModal && shortcutsModal.style.display !== 'none') {
    shortcutsModal.style.display = 'none';
  }
  // Close confirm delete modal if open
  const confirmDeleteModal = document.getElementById('confirmDeleteModal');
  if (confirmDeleteModal && confirmDeleteModal.style.display !== 'none') {
    confirmDeleteModal.style.display = 'none';
  }
}

function toggleShortcutsModal() {
  const shortcutsModal = document.getElementById('shortcutsModal');
  if (!shortcutsModal) return;

  if (shortcutsModal.style.display === 'none' || !shortcutsModal.style.display) {
    shortcutsModal.style.display = 'flex';
  } else {
    shortcutsModal.style.display = 'none';
  }
}

document.addEventListener('keydown', (e) => {
  // Build shortcut key string
  let key = '';
  if (e.ctrlKey || e.metaKey) key += 'Ctrl+';
  if (e.shiftKey) key += 'Shift+';
  if (e.altKey) key += 'Alt+';

  // Add the actual key
  if (e.key === 'Escape') {
    key = 'Escape';
  } else if (e.key.length === 1) {
    key += e.key.toUpperCase();
  } else {
    key += e.key;
  }

  const action = KEYBOARD_SHORTCUTS[key];
  if (action) {
    e.preventDefault();
    action();
  }
});



// HAR Export button handler
if (elements.exportHar) {
  elements.exportHar.addEventListener('click', exportAsHAR);
}

// ============================================
// Saved Filters
// ============================================
const DEFAULT_FILTERS = [
  { id: 'ecommerce', name: 'Ecommerce', pattern: 'view_item|view_item_list|select_item|add_to_cart|remove_from_cart|view_cart|begin_checkout|add_payment_info|add_shipping_info|purchase|refund', icon: '🛒' },
  { id: 'errors', name: 'Errors Only', pattern: '__filter_errors__', icon: '❌' },
  { id: 'ga4', name: 'GA4 Events', pattern: 'page_view|scroll|click|user_engagement|session_start|first_visit', icon: '📊' },
  { id: 'user', name: 'User Actions', pattern: 'login|sign_up|generate_lead|search|share', icon: '👤' }
];

let savedFilters = [...DEFAULT_FILTERS];
let activeFilter = null;

async function loadSavedFilters() {
  const stored = await chrome.storage.local.get('saved_filters');
  if (stored.saved_filters) {
    savedFilters = [...DEFAULT_FILTERS, ...stored.saved_filters];
  }
}

function renderFilterChips() {
  const container = document.getElementById('filterChips');
  if (!container) return;

  container.innerHTML = savedFilters.map(f => `
    <div style="display: inline-flex; align-items: center; gap: 6px; position: relative;">
      <button class="filter-chip ${activeFilter === f.id ? 'active' : ''}"
              data-filter-id="${f.id}"
              title="${f.pattern}"
              style="display: flex; align-items: center; gap: 6px; padding: 6px ${f.isCustom ? '8px 6px 12px' : '12px'}; border-radius: 20px; font-size: 11px; font-weight: 500; transition: all 0.2s; border: 1px solid ${activeFilter === f.id ? 'var(--accent-blue)' : 'var(--border)'}; background: ${activeFilter === f.id ? 'rgba(66, 133, 244, 0.1)' : 'var(--bg-secondary)'}; color: ${activeFilter === f.id ? 'var(--accent-blue)' : 'var(--text-primary)'}; cursor: pointer; position: relative;">
        <span style="font-size: 14px;">${f.icon || '🔍'}</span>
        <span>${f.name}</span>
        ${f.isCustom ? `
          <span class="delete-filter-btn" data-filter-id="${f.id}" title="Delete filter"
                style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; margin-left: 2px; border-radius: 50%; background: rgba(239, 68, 68, 0.1); color: var(--error-red); font-size: 10px; font-weight: bold; cursor: pointer; transition: all 0.15s;">
            ×
          </span>
        ` : ''}
      </button>
      ${f.isCustom ? `
        <div class="delete-confirm" data-filter-id="${f.id}" style="display: none; position: absolute; left: 100%; margin-left: 8px; white-space: nowrap; align-items: center; gap: 6px; padding: 4px 8px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 10;">
          <span style="font-size: 10px; color: var(--text-secondary); font-weight: 500;">Delete?</span>
          <button class="confirm-yes-btn" style="background: var(--error-red); color: white; border: none; border-radius: 6px; padding: 3px 10px; font-size: 10px; font-weight: 600; cursor: pointer; transition: all 0.15s;">
            Yes
          </button>
          <button class="confirm-no-btn" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border); border-radius: 6px; padding: 3px 10px; font-size: 10px; font-weight: 600; cursor: pointer; transition: all 0.15s;">
            No
          </button>
        </div>
      ` : ''}
    </div>
  `).join('') + `
    <button class="filter-chip add-filter" id="addFilterBtn" title="Save current filter"
            style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; border: 1px dashed var(--border); background: var(--bg-secondary); color: var(--text-muted); cursor: pointer; font-size: 16px; transition: all 0.2s;">
      <span>+</span>
    </button>
  `;

  // Handle delete button clicks - show inline confirmation
  container.querySelectorAll('.delete-filter-btn').forEach(deleteBtn => {
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent filter activation
      const filterId = deleteBtn.dataset.filterId;

      // Hide all other confirmations
      container.querySelectorAll('.delete-confirm').forEach(confirm => {
        confirm.style.display = 'none';
      });

      // Show this confirmation
      const confirmEl = container.querySelector(`.delete-confirm[data-filter-id="${filterId}"]`);
      if (confirmEl) {
        confirmEl.style.display = 'flex';
      }
    });
  });

  // Handle confirmation Yes buttons
  container.querySelectorAll('.confirm-yes-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const confirmEl = btn.closest('.delete-confirm');
      const filterId = confirmEl.dataset.filterId;
      await deleteCustomFilter(filterId);
    });
  });

  // Handle confirmation No buttons
  container.querySelectorAll('.confirm-no-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const confirmEl = btn.closest('.delete-confirm');
      confirmEl.style.display = 'none';
    });
  });

  // Close confirmations when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.delete-confirm') && !e.target.closest('.delete-filter-btn')) {
      container.querySelectorAll('.delete-confirm').forEach(confirm => {
        confirm.style.display = 'none';
      });
    }
  }, { once: false });

  // Handle filter clicks
  container.querySelectorAll('.filter-chip:not(.add-filter)').forEach(chip => {
    chip.addEventListener('click', (e) => {
      // Ignore click if it was on delete button
      if (e.target.classList.contains('delete-filter-btn')) return;

      const filterId = chip.dataset.filterId;
      const filter = savedFilters.find(f => f.id === filterId);

      if (activeFilter === filterId) {
        // Deactivate
        activeFilter = null;
        elements.eventFilter.value = '';
      } else {
        activeFilter = filterId;
        if (filter.pattern === '__filter_errors__') {
          // Special filter for errors
          filterEventsByErrors();
          return;
        }
        elements.eventFilter.value = filter.pattern;
      }
      renderEvents();
      renderFilterChips();
    });
  });

  // Add filter button interaction
  const addBtn = document.getElementById('addFilterBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const currentPattern = elements.eventFilter.value.trim();
      if (!currentPattern) {
        showToast('Type a search filter first to save', 'info');
        elements.eventFilter.focus();
        return;
      }

      // Create inline form
      const wrapper = document.createElement('div');
      wrapper.className = 'filter-form';
      wrapper.style.display = 'inline-flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.gap = '4px';
      wrapper.style.verticalAlign = 'middle';

      wrapper.innerHTML = `
        <input type="text" id="newFilterName" placeholder="Name" style="
          padding: 5px 10px;
          border-radius: 16px;
          border: 1px solid var(--accent-blue);
          font-size: 11px;
          width: 90px;
          outline: none;
          background: var(--bg-surface);
          color: var(--text-primary);
        ">
        <button id="saveFilter" title="Save" style="
          background: var(--success-green);
          color: white;
          border: none;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        ">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width:10px;height:10px"><polyline points="20 6 9 17 4 12" /></svg>
        </button>
        <button id="cancelFilter" title="Cancel" style="
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          border: none;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        ">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width:10px;height:10px"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    `;

      addBtn.replaceWith(wrapper);
      const input = wrapper.querySelector('input');
      input.focus();

      // Handlers
      const saveLinks = async () => {
        const name = input.value.trim();
        if (!name) return;

        const newFilter = {
          id: 'custom_' + Date.now(),
          name: name,
          pattern: currentPattern,
          icon: '⭐',
          isCustom: true
        };

        const stored = await chrome.storage.local.get('saved_filters');
        const customFilters = stored.saved_filters || [];
        customFilters.push(newFilter);
        await chrome.storage.local.set({ saved_filters: customFilters });

        savedFilters.push(newFilter);
        renderFilterChips();
        showToast('Filter saved!');
      };

      const cancel = () => renderFilterChips();

      wrapper.querySelector('#saveFilter').addEventListener('click', saveLinks);
      wrapper.querySelector('#cancelFilter').addEventListener('click', cancel);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveLinks();
        if (e.key === 'Escape') cancel();
      });
    });
  }
}

// Removed modal-based confirmation - now using inline confirmation next to filter chips

async function deleteCustomFilter(filterId) {
  // Find the filter
  const filter = savedFilters.find(f => f.id === filterId);
  if (!filter || !filter.isCustom) return;

  // Remove from savedFilters array
  savedFilters = savedFilters.filter(f => f.id !== filterId);

  // Update storage
  const stored = await chrome.storage.local.get('saved_filters');
  const customFilters = (stored.saved_filters || []).filter(f => f.id !== filterId);
  await chrome.storage.local.set({ saved_filters: customFilters });

  // If this was the active filter, reset
  if (activeFilter === filterId) {
    activeFilter = null;
    elements.eventFilter.value = '';
    renderEvents();
  }

  // Re-render chips
  renderFilterChips();
  showToast('Filter deleted', 'info');
}

function filterEventsByErrors() {
  // Filter to show only events with validation errors
  const eventsWithErrors = events.filter(e => {
    const validation = validateGA4Event(e.data || e);
    return validation.errors.length > 0;
  });

  if (eventsWithErrors.length === 0) {
    showToast('No events with errors found', 'info');
    activeFilter = null;
    renderFilterChips();
    return;
  }

  // Temporarily replace events for rendering
  const originalEvents = [...events];
  events.length = 0;
  events.push(...eventsWithErrors);
  renderEvents();
  events.length = 0;
  events.push(...originalEvents);
}

// ============================================
// Real-time Alerts
// ============================================
let alertRules = [];
let alertsEnabled = true;

const DEFAULT_ALERT_RULES = [
  {
    id: 'missing_transaction_id',
    name: 'Purchase without transaction_id',
    condition: (event) => {
      const data = event.data?.data || event.data || event;
      return data.event === 'purchase' && !data.ecommerce?.transaction_id && !data.transaction_id;
    },
    severity: 'error'
  },
  {
    id: 'empty_items',
    name: 'Ecommerce event with empty items',
    condition: (event) => {
      const data = event.data?.data || event.data || event;
      const ecEvents = ['purchase', 'add_to_cart', 'begin_checkout', 'view_item'];
      if (!ecEvents.includes(data.event)) return false;
      const items = data.ecommerce?.items || data.items;
      return !items || items.length === 0;
    },
    severity: 'warning'
  },
  {
    id: 'missing_currency',
    name: 'Value without currency',
    condition: (event) => {
      const data = event.data?.data || event.data || event;
      const value = data.ecommerce?.value ?? data.value;
      const currency = data.ecommerce?.currency ?? data.currency;
      return value !== undefined && !currency;
    },
    severity: 'warning'
  }
];

function checkAlertRules(event) {
  if (!alertsEnabled) return;

  const rules = alertRules.length > 0 ? alertRules : DEFAULT_ALERT_RULES;

  rules.forEach(rule => {
    try {
      if (rule.condition(event)) {
        showAlert(rule);
      }
    } catch (e) {
      console.error('Alert rule error:', e);
    }
  });
}

function showAlert(rule) {
  const alertHtml = `
    <div class="realtime-alert ${rule.severity}" style="position:fixed;top:60px;right:10px;max-width:280px;padding:12px 16px;background:${rule.severity === 'error' ? 'var(--error-red)' : 'var(--warning-yellow)'};color:${rule.severity === 'error' ? 'white' : 'black'};border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:10000;animation:slideIn 0.3s ease">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span style="font-size:14px">${rule.severity === 'error' ? '🚨' : '⚠️'}</span>
        <strong style="font-size:12px">Alert</strong>
      </div>
      <div style="font-size:11px">${rule.name}</div>
    </div>
  `;

  const alertEl = document.createElement('div');
  alertEl.innerHTML = alertHtml;
  document.body.appendChild(alertEl.firstElementChild);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    const alert = document.querySelector('.realtime-alert');
    if (alert) {
      alert.style.opacity = '0';
      alert.style.transition = 'opacity 0.3s';
      setTimeout(() => alert.remove(), 300);
    }
  }, 5000);
}

// Inject alert animation CSS
const alertStyles = document.createElement('style');
alertStyles.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  .filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-primary);
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    user-select: none;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }
  .filter-chip:hover {
    background: var(--bg-hover);
    border-color: var(--text-secondary);
    transform: translateY(-1px);
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.08);
  }
  .filter-chip.active {
    background: var(--accent-blue);
    color: white;
    border-color: var(--accent-blue);
    box-shadow: 0 2px 4px rgba(66, 133, 244, 0.3);
  }
  .filter-chip.add-filter {
    padding: 6px 10px;
    border-style: dashed;
    color: var(--text-secondary);
    background: transparent;
  }
  .filter-chip.add-filter:hover {
    color: var(--accent-blue);
    border-color: var(--accent-blue);
    background: rgba(66, 133, 244, 0.05);
  }
`;
document.head.appendChild(alertStyles);

// ============================================
// Tab Handling
// ============================================
async function handleTabChange(tabId) {
  console.log('[Tag Master] Tab Changed:', tabId);

  // 1. Clear Local State
  events = [];
  networkRequests = [];
  // Note: techCacheMap is NOT cleared here to allow persistent viewing when switching back to a tab.
  // It is updated/refreshed inside detectTechnologies().
  expandedNetworkItems.clear();
  expandedEventItems.clear();
  collapsedEventGroups.clear();

  // 2. Reset UI to Empty States
  renderEvents();
  renderNetworkRequests();
  // We no longer clear techResults here; detectTechnologies inside handleTabChange handles it via cache/loading state.
  if (elements.containerList) elements.containerList.innerHTML = '';
  if (elements.auditResults) elements.auditResults.innerHTML = '<div class="empty-state"><p>Click Scan to start</p></div>';

  // 3. Get Tab Details
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (e) { return; }

  if (!tab || !tab.url) return;

  // 4. Update Context & Fetch Data
  updateCurrentUrl(tab.url);

  // Trigger detections
  detectContainers();
  checkActiveInjection();
  loadConsentState();
  loadSessionInfo();
  checkBlockGA4State();

  // Fetch active tab data
  setTimeout(() => {
    loadEvents();
    loadNetworkRequests();
  }, 100);

  // Panel specific refreshes
  if (currentTab === 'cookies') refreshCookies();
  if (currentTab === 'tech') detectTechnologies();
}

// Listen for tab switching
chrome.tabs.onActivated.addListener((activeInfo) => {
  handleTabChange(activeInfo.tabId);
});

// Listen for URL updates in the same tab
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    handleTabChange(tabId);
  }
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
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    // Try to get consent state from page
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'GET_CONSENT_STATE'
    }).catch(() => null);

    if (response?.consentState) {
      consentState = response.consentState;
      renderConsentState();
    }
  } catch (e) {
    console.debug('[Tag Master] Failed to load consent state:', e);
  }
}

function renderConsentState() {
  // This function can be expanded later to show consent state in UI
  // For now, just store it in memory
  if (consentState) {
    console.log('[Tag Master] Consent state loaded:', consentState);
  }
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
      func: () => window.sessionStorage.getItem('tagMasterBlockGA4') === 'true'
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
      <div class="container-item" style="flex-direction:column;align-items:flex-start;gap:8px;border-left:4px solid ${perfColor}" >
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
    checks.push({ status: 'warning', title: 'Multiple GTM Containers', desc: `Found ${gtmCount} containers.This might cause data discrepancies.` });
  } else if (gtmCount === 1) {
    checks.push({ status: 'success', title: 'GTM Found', desc: 'Single GTM container detected correctly.' });
  } else {
    checks.push({ status: 'error', title: 'GTM Missing', desc: 'No GTM container detected on this page.' });
  }

  // 2. Google Tag (gtag.js) Check
  const ga4Count = (containers || []).filter(c => c.type === 'GA4').length;
  const gtagPath = gtmDomain + '/gtag/js'; // Use dynamic domain
  const hasGtagScript = networkRequests.some(r => r.url && r.url.includes(gtagPath));
  if (ga4Count > 1) {
    checks.push({ status: 'warning', title: 'Multiple Google Tags', desc: `Found ${ga4Count} Google Tag(gtag.js) instances.Consider consolidating.` });
  } else if (ga4Count === 1 || hasGtagScript) {
    const ga4Id = (containers || []).find(c => c.type === 'GA4')?.id || '';
    checks.push({ status: 'success', title: 'Google Tag Found', desc: `Google Tag(gtag.js) installed${ga4Id ? ` - ${ga4Id}` : ''}.` });
  } else if (gtmCount === 0) {
    checks.push({ status: 'error', title: 'Google Tag Missing', desc: 'No Google Tag (gtag.js) detected. GA4 may not be collecting data.' });
  }

  // 3. Conversion Linker Check
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

  // 5. Martech Audit (TikTok, LinkedIn)
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

async function renderCookies(cookies) {
  if (cookies.length === 0) {
    elements.cookieList.innerHTML = '<div class="empty-state"><p>No tracking cookies found</p></div>';
    return;
  }

  // Get test cookie value to identify dummy cookies
  const testGclAwValue = await (async () => {
    const stored = await chrome.storage.local.get('testGclAwValue');
    return stored.testGclAwValue || null;
  })();

  elements.cookieList.innerHTML = cookies.map(c => {
    const isDummyCookie = c.name === '_gcl_aw' && testGclAwValue && c.value === testGclAwValue;
    const dummyBadge = isDummyCookie
      ? '<span style="margin-left:6px;padding:2px 6px;background:var(--warning-yellow);color:#000;font-size:9px;font-weight:700;border-radius:3px;text-transform:uppercase">Dummy</span>'
      : '';

    return `
      <div class="container-item">
        <div style="flex:1;overflow:hidden">
          <div style="font-weight:600;font-size:12px;color:var(--accent-blue);display:flex;align-items:center">${c.name}${dummyBadge}</div>
          <div style="font-size:11px;color:var(--text-muted);text-overflow:ellipsis;overflow:hidden;white-space:nowrap" title="${c.value}">${c.value}</div>
          <div style="font-size:10px;color:var(--text-secondary);margin-top:2px">Expires: ${c.expirationDate ? new Date(c.expirationDate * 1000).toLocaleDateString() : 'Session'}</div>
        </div>
        <button class="btn-icon btn-small delete-cookie" data-name="${c.name}" title="Delete Cookie">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    `}).join('');

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

// Test _gcl_aw Cookie Functions
const addTestGclAwBtn = document.getElementById('addTestGclAw');
const deleteTestGclAwBtn = document.getElementById('deleteTestGclAw');

// Track test cookie value in storage
async function getTestGclAwValue() {
  const stored = await chrome.storage.local.get('testGclAwValue');
  return stored.testGclAwValue || null;
}

async function setTestGclAwValue(value) {
  await chrome.storage.local.set({ testGclAwValue: value });
}

async function clearTestGclAwValue() {
  await chrome.storage.local.remove('testGclAwValue');
}

if (addTestGclAwBtn) {
  addTestGclAwBtn.addEventListener('click', async () => {
    // Check if real _gcl_aw exists
    const cookies = await chrome.runtime.sendMessage({ type: 'COOKIES_GET' });
    const existingGclAw = (cookies || []).find(c => c.name === '_gcl_aw');
    const testValue = await getTestGclAwValue();

    if (existingGclAw && existingGclAw.value !== testValue) {
      showToast('Real _gcl_aw already exists! Cannot overwrite.', 'warning');
      return;
    }

    // Generate a test _gcl_aw value with clear test identifier
    const timestamp = Math.floor(Date.now() / 1000);
    const newTestValue = `GCL.${timestamp}.Tester123`;

    try {
      await chrome.runtime.sendMessage({
        type: 'COOKIES_SET',
        name: '_gcl_aw',
        value: newTestValue,
        expirationDate: Math.floor(Date.now() / 1000) + 7776000 // 90 days
      });
      await setTestGclAwValue(newTestValue);
      showToast('Test _gcl_aw cookie added', 'success');
      refreshCookies();
    } catch (e) {
      showToast('Failed to add cookie: ' + e.message, 'error');
    }
  });
}

if (deleteTestGclAwBtn) {
  deleteTestGclAwBtn.addEventListener('click', async () => {
    const testValue = await getTestGclAwValue();
    if (!testValue) {
      showToast('No test cookie to delete', 'info');
      return;
    }

    // Verify the current cookie is actually our test cookie
    const cookies = await chrome.runtime.sendMessage({ type: 'COOKIES_GET' });
    const currentGclAw = (cookies || []).find(c => c.name === '_gcl_aw');

    if (!currentGclAw || currentGclAw.value !== testValue) {
      await clearTestGclAwValue();
      showToast('Test cookie no longer exists', 'info');
      refreshCookies();
      return;
    }

    try {
      await chrome.runtime.sendMessage({ type: 'COOKIES_DELETE', name: '_gcl_aw' });
      await clearTestGclAwValue();
      showToast('Test _gcl_aw cookie deleted', 'success');
      refreshCookies();
    } catch (e) {
      showToast('Failed to delete cookie: ' + e.message, 'error');
    }
  });
}







// Update tab navigation to trigger renders
// GA4 Session Info Update Logic

async function loadSessionInfo() {
  try {
    // Get GA4 session info from background
    const response = await chrome.runtime.sendMessage({
      type: 'GA4_SESSION_GET'
    }).catch(() => null);

    if (response) {
      // Store session info for later use
      // Can be expanded to display in UI
      console.debug('[Tag Master] Session info loaded:', response);
    }
  } catch (e) {
    console.debug('[Tag Master] Failed to load session info:', e);
  }
}



async function checkWelcome() {
  const stored = await chrome.storage.local.get('welcome_dismissed');
  if (!stored.welcome_dismissed) {
    if (elements.welcomeOverlay) {
      elements.welcomeOverlay.style.display = 'flex';
    }
  } else {
    if (elements.welcomeOverlay) {
      elements.welcomeOverlay.style.display = 'none';
    }
  }
}

if (elements.getStartedBtn) {
  elements.getStartedBtn.addEventListener('click', () => {
    // UI First - Immediate feedback
    if (elements.welcomeOverlay) {
      elements.welcomeOverlay.style.opacity = '0';
      elements.welcomeOverlay.style.transition = 'opacity 0.3s ease';
      setTimeout(() => {
        elements.welcomeOverlay.style.display = 'none';
      }, 300);
    }

    // Logic Second - Persist state
    chrome.storage.local.set({ welcome_dismissed: true }).catch(err => {
      console.warn('Failed to save welcome state:', err);
    });
  });
}

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  checkWelcome();
  detectContainers();
  detectTechnologies(); // Populate tech cache for network icons
  checkActiveInjection();
  loadEvents();
  loadNetworkRequests();
  checkBlockGA4State();
  getCurrentTab();
  loadSettings();
  // Load saved filters and render chips
  await loadSavedFilters();
  renderFilterChips();
  // Initialize page navigation
  renderPageNavigation();
  updateEventsPanelTitle();
});



// Syntax Highlighter
function syntaxHighlight(json) {
  if (typeof json !== 'string') {
    json = JSON.stringify(json, undefined, 2);
  }
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
    let cls = 'syntax-number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'syntax-key';
      } else {
        cls = 'syntax-string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'syntax-boolean';
    } else if (/null/.test(match)) {
      cls = 'syntax-null';
    }
    return '<span class="' + cls + '">' + match + '</span>';
  });
}

