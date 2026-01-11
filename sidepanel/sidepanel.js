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
  TAB_UPDATED: 'TAB_UPDATED'
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
let events = [];
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
  presetButtons: document.getElementById('presetButtons'),
  jsonEditor: document.getElementById('jsonEditor'),
  jsonError: document.getElementById('jsonError'),
  pushBtn: document.getElementById('pushBtn'),
  currentUrl: document.getElementById('currentUrl'),
  toast: document.getElementById('toast')
};

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

function processTemplate(obj) {
  let str = JSON.stringify(obj);
  str = str.replace(/\{\{timestamp\}\}/g, Date.now());
  str = str.replace(/\{\{page_title\}\}/g, 'Page Title');
  str = str.replace(/\{\{page_url\}\}/g, 'https://example.com');
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
  });
});

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
      setTimeout(detectContainers, 1000);
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

async function detectContainers() {
  try {
    const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GTM_DETECT });
    const containers = response || [];

    if (containers.length > 0) {
      elements.containerList.innerHTML = containers.map(c => `
        <div class="container-item">
          <div class="container-info">
            <div class="container-icon ${c.type?.toLowerCase() || 'gtm'}">${c.type === 'GA4' ? 'G4' : 'GTM'}</div>
            <div>
              <div class="container-id">${c.id}</div>
              <div class="container-type">${c.type || 'GTM'}</div>
            </div>
          </div>
          <div class="container-status"></div>
        </div>
      `).join('');
    } else {
      elements.containerList.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:32px;height:32px">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
          </svg>
          <p>No containers detected</p>
        </div>
      `;
    }
  } catch (e) {
    console.error('Failed to detect containers:', e);
  }
}

elements.refreshContainers.addEventListener('click', detectContainers);

// ============================================
// DataLayer Monitor
// ============================================
function renderEvents() {
  const filter = elements.eventFilter.value.toLowerCase();
  const filtered = events.filter(e =>
    !filter || JSON.stringify(e.data).toLowerCase().includes(filter)
  );

  if (filtered.length > 0) {
    elements.eventList.innerHTML = filtered.slice(-50).map(event => `
      <div class="event-item" data-id="${event.id}">
        <div class="event-header">
          <div class="event-info">
            <span class="event-time">${formatTimestamp(event.timestamp)}</span>
            <span class="event-name">${event.event || event.data?.event || 'push'}</span>
          </div>
        </div>
        <div class="event-preview">${JSON.stringify(event.data).substring(0, 80)}...</div>
        <div class="event-data" style="display:none"><pre>${JSON.stringify(event.data, null, 2)}</pre></div>
      </div>
    `).join('');

    elements.eventList.querySelectorAll('.event-item').forEach(item => {
      item.addEventListener('click', () => {
        const dataEl = item.querySelector('.event-data');
        const previewEl = item.querySelector('.event-preview');
        const isExpanded = dataEl.style.display !== 'none';

        dataEl.style.display = isExpanded ? 'none' : 'block';
        previewEl.style.display = isExpanded ? 'block' : 'none';
        item.classList.toggle('expanded', !isExpanded);
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
// DataLayer Push
// ============================================
elements.presetButtons.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const preset = PRESETS[btn.dataset.preset];
    if (preset) {
      const processed = processTemplate(preset);
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
      await chrome.tabs.sendMessage(tab.id, {
        type: MESSAGE_TYPES.DATALAYER_PUSH,
        data
      });
      showToast(`Event "${data.event || 'push'}" sent!`, 'success');
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
  } else if (message.type === MESSAGE_TYPES.TAB_UPDATED) {
    updateCurrentUrl(message.data.url);
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
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  loadRecentIds();
  detectContainers();
  loadEvents();
  getCurrentTab();
});
