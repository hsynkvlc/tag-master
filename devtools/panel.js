/**
 * Tag Master - DevTools Panel (Vanilla JS)
 */

// ============================================
// Constants
// ============================================
const MESSAGE_TYPES = {
  DATALAYER_PUSH: 'DATALAYER_PUSH',
  DATALAYER_GET: 'DATALAYER_GET',
  DATALAYER_CLEAR: 'DATALAYER_CLEAR',
  NETWORK_REQUEST: 'NETWORK_REQUEST',
  NETWORK_GET: 'NETWORK_GET',
  NETWORK_CLEAR: 'NETWORK_CLEAR',
  COOKIES_GET: 'COOKIES_GET',
  COOKIES_DELETE: 'COOKIES_DELETE',
  CODE_EXECUTE: 'CODE_EXECUTE',
  TAB_GET: 'TAB_GET'
};

const GA4_PARAMS = {
  v: 'Protocol Version', tid: 'Measurement ID', cid: 'Client ID', uid: 'User ID',
  en: 'Event Name', dl: 'Document Location', dr: 'Document Referrer', dt: 'Document Title',
  sr: 'Screen Resolution', ul: 'User Language', sid: 'Session ID', sct: 'Session Count',
  seg: 'Session Engaged', _p: 'Page ID', _s: 'Hit Counter', cu: 'Currency'
};

const GOOGLE_COOKIES = [
  { pattern: '_ga', name: 'GA Client ID', service: 'Google Analytics' },
  { pattern: '_ga_', name: 'GA4 Session', service: 'Google Analytics 4' },
  { pattern: '_gid', name: 'GA Daily ID', service: 'Google Analytics' },
  { pattern: '_gac_', name: 'Google Ads Campaign', service: 'Google Ads' },
  { pattern: '_gcl_aw', name: 'GCLID Storage', service: 'Google Ads' },
  { pattern: '_gcl_', name: 'Google Click', service: 'Google Ads' },
  { pattern: '_gat_', name: 'GA Throttle', service: 'Google Analytics' }
];

// ============================================
// State
// ============================================
let networkRequests = [];
let dataLayerEvents = [];
let typeFilters = { GA4: true, UA: true, GOOGLE_ADS_CONVERSION: true, FLOODLIGHT: true, GTM: true };
let preserveLog = true;
let selectedRequest = null;

// ============================================
// Utility Functions
// ============================================
function formatTimestamp(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

function parseUrlParams(url) {
  try {
    const urlObj = new URL(url);
    const params = {};
    urlObj.searchParams.forEach((value, key) => params[key] = decodeURIComponent(value));
    return params;
  } catch { return {}; }
}

function getTypeColor(type) {
  const colors = { GA4: '#F9AB00', UA: '#E37400', GOOGLE_ADS_CONVERSION: '#4285F4', GOOGLE_ADS_REMARKETING: '#34A853', FLOODLIGHT: '#EA4335', GTM: '#4285F4' };
  return colors[type] || '#666';
}

// ============================================
// Tab Navigation
// ============================================
document.querySelectorAll('.devtools-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.devtools-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.devtools-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
  });
});

// ============================================
// Network Monitor
// ============================================
function renderNetworkTable() {
  const filter = document.getElementById('networkFilter').value.toLowerCase();
  const filtered = networkRequests.filter(req => {
    if (!typeFilters[req.type]) return false;
    if (filter && !req.url.toLowerCase().includes(filter)) return false;
    return true;
  });

  const tbody = document.getElementById('networkTableBody');
  if (filtered.length > 0) {
    tbody.innerHTML = filtered.map(req => `
      <tr data-id="${req.id}" class="${selectedRequest?.id === req.id ? 'selected' : ''} ${req.statusCode === 0 || req.error ? 'error' : ''}">
        <td>${formatTimestamp(req.timestamp)}</td>
        <td><span class="type-badge" style="background:${getTypeColor(req.type)}20;color:${getTypeColor(req.type)}">${req.typeName || req.type}</span></td>
        <td><span class="status-indicator"><span class="status-dot ${req.statusCode === 200 || req.statusCode === 204 ? 'success' : req.error ? 'error' : 'pending'}"></span>${req.statusCode || '-'}</span></td>
        <td style="max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${req.url}</td>
      </tr>
    `).join('');

    tbody.querySelectorAll('tr').forEach(row => {
      row.addEventListener('click', () => {
        const req = networkRequests.find(r => r.id === row.dataset.id);
        if (req) showRequestDetail(req);
      });
    });
  } else {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-muted)">No requests captured</td></tr>`;
  }
}

function showRequestDetail(req) {
  selectedRequest = req;
  const params = parseUrlParams(req.url);
  const detail = document.getElementById('requestDetail');

  detail.innerHTML = `
    <div class="detail-panel">
      <div class="detail-header">
        <span class="detail-title"><span class="type-badge" style="background:${getTypeColor(req.type)}20;color:${getTypeColor(req.type)}">${req.typeName || req.type}</span></span>
        <button class="detail-close" id="closeDetail">&times;</button>
      </div>
      <div class="detail-content">
        <div class="section">
          <div class="section-title">Parameters</div>
          <div class="param-list">
            ${Object.entries(params).map(([key, value]) => `
              <div class="param-item">
                <div class="param-key">${key}</div>
                <div><div class="param-value">${value}</div><div class="param-desc">${GA4_PARAMS[key] || key}</div></div>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="section">
          <div class="section-title">Full URL</div>
          <div class="code-block" style="word-break:break-all;font-size:10px">${req.url}</div>
        </div>
      </div>
    </div>
  `;

  detail.style.display = 'block';
  document.getElementById('closeDetail').addEventListener('click', () => {
    detail.style.display = 'none';
    selectedRequest = null;
    renderNetworkTable();
  });
  renderNetworkTable();
}

// Type Filters
document.querySelectorAll('#typeFilters .filter-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    const type = pill.dataset.type;
    typeFilters[type] = !typeFilters[type];
    pill.classList.toggle('active', typeFilters[type]);
    renderNetworkTable();
  });
});

// Preserve Log
document.getElementById('preserveLogBtn').addEventListener('click', function() {
  preserveLog = !preserveLog;
  this.classList.toggle('active', preserveLog);
});

// Clear Network
document.getElementById('clearNetworkBtn').addEventListener('click', () => {
  if (!preserveLog) {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.NETWORK_CLEAR });
    networkRequests = [];
    renderNetworkTable();
  }
});

// Export Network
document.getElementById('exportNetworkBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(networkRequests, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `network-${Date.now()}.json`;
  a.click();
});

document.getElementById('networkFilter').addEventListener('input', renderNetworkTable);

// ============================================
// DataLayer
// ============================================
function renderDataLayerTable() {
  const filter = document.getElementById('datalayerFilter').value.toLowerCase();
  const filtered = dataLayerEvents.filter(e => !filter || JSON.stringify(e.data).toLowerCase().includes(filter));

  const tbody = document.getElementById('datalayerTableBody');
  if (filtered.length > 0) {
    tbody.innerHTML = filtered.map(e => `
      <tr data-id="${e.id}">
        <td>${formatTimestamp(e.timestamp)}</td>
        <td style="color:var(--success-green);font-family:monospace">${e.event || e.data?.event || 'push'}</td>
        <td style="max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace;font-size:10px">${JSON.stringify(e.data)}</td>
      </tr>
    `).join('');

    tbody.querySelectorAll('tr').forEach(row => {
      row.addEventListener('click', () => {
        const event = dataLayerEvents.find(e => e.id === row.dataset.id);
        if (event) showEventDetail(event);
      });
    });
  } else {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:40px;color:var(--text-muted)">No events captured</td></tr>`;
  }
}

function showEventDetail(event) {
  const detail = document.getElementById('eventDetail');
  detail.innerHTML = `
    <div class="detail-panel">
      <div class="detail-header">
        <span class="detail-title">Event Details</span>
        <button class="detail-close" id="closeEventDetail">&times;</button>
      </div>
      <div class="detail-content">
        <div class="section">
          <div class="section-title">Event Data</div>
          <pre class="code-block">${JSON.stringify(event.data, null, 2)}</pre>
        </div>
      </div>
    </div>
  `;
  detail.style.display = 'block';
  document.getElementById('closeEventDetail').addEventListener('click', () => detail.style.display = 'none');
}

document.getElementById('datalayerFilter').addEventListener('input', renderDataLayerTable);
document.getElementById('clearDatalayerBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: MESSAGE_TYPES.DATALAYER_CLEAR });
  dataLayerEvents = [];
  renderDataLayerTable();
});

// ============================================
// Google Ads
// ============================================
function renderAdsTable() {
  const adsRequests = networkRequests.filter(r => r.type === 'GOOGLE_ADS_CONVERSION' || r.type === 'GOOGLE_ADS_REMARKETING');
  const tbody = document.getElementById('adsTableBody');

  if (adsRequests.length > 0) {
    tbody.innerHTML = adsRequests.map(req => {
      const params = parseUrlParams(req.url);
      const hasEC = params.em || params.ph || params.fn;
      return `
        <tr>
          <td>${formatTimestamp(req.timestamp)}</td>
          <td><span class="type-badge ${req.type === 'GOOGLE_ADS_CONVERSION' ? 'ads' : 'remarketing'}">${req.type === 'GOOGLE_ADS_CONVERSION' ? 'Conversion' : 'Remarketing'}</span></td>
          <td style="font-family:monospace">${params.label || params.id || '-'}</td>
          <td>${params.value ? `${params.value} ${params.currency || ''}` : '-'}</td>
          <td>${hasEC ? '<span class="validation-badge valid">Active</span>' : '<span class="validation-badge warning">None</span>'}</td>
        </tr>
      `;
    }).join('');
  } else {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">No Google Ads tags detected</td></tr>`;
  }
}

// ============================================
// Cookies
// ============================================
async function loadCookies() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;

    const allCookies = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.COOKIES_GET, url: tab.url });
    const googleCookies = allCookies.filter(cookie =>
      GOOGLE_COOKIES.some(gc => cookie.name === gc.pattern || cookie.name.startsWith(gc.pattern))
    ).map(cookie => ({
      ...cookie,
      definition: GOOGLE_COOKIES.find(gc => cookie.name === gc.pattern || cookie.name.startsWith(gc.pattern))
    }));

    const tbody = document.getElementById('cookiesTableBody');
    if (googleCookies.length > 0) {
      tbody.innerHTML = googleCookies.map(c => `
        <tr>
          <td style="font-family:monospace">${c.name}</td>
          <td><span class="type-badge gtm">${c.definition?.service || 'Google'}</span></td>
          <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${c.value}">${c.value}</td>
          <td>${c.domain}</td>
          <td>${c.expirationDate ? new Date(c.expirationDate * 1000).toLocaleDateString() : 'Session'}</td>
          <td><button class="toolbar-btn delete-cookie" data-name="${c.name}">Delete</button></td>
        </tr>
      `).join('');

      tbody.querySelectorAll('.delete-cookie').forEach(btn => {
        btn.addEventListener('click', async () => {
          await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.COOKIES_DELETE, url: tab.url, name: btn.dataset.name });
          loadCookies();
        });
      });
    } else {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">No Google cookies found</td></tr>`;
    }
  } catch (e) { console.error('Failed to load cookies:', e); }
}

document.getElementById('refreshCookiesBtn').addEventListener('click', loadCookies);
document.getElementById('exportCookiesBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;
  const cookies = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.COOKIES_GET, url: tab.url });
  const blob = new Blob([JSON.stringify(cookies, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cookies-${Date.now()}.json`;
  a.click();
});

// ============================================
// Code Runner
// ============================================
document.getElementById('snippetSelect').addEventListener('change', function() {
  document.getElementById('codeEditor').value = this.value;
});

document.getElementById('runCodeBtn').addEventListener('click', async () => {
  const code = document.getElementById('codeEditor').value;
  const output = document.getElementById('codeOutputContent');

  try {
    const result = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.CODE_EXECUTE, code });
    if (result?.success) {
      output.textContent = JSON.stringify(result.result, null, 2) || 'undefined';
      output.style.color = 'var(--success-green)';
    } else {
      output.textContent = result?.error || 'Execution failed';
      output.style.color = 'var(--error-red)';
    }
  } catch (e) {
    output.textContent = e.message;
    output.style.color = 'var(--error-red)';
  }
});

// ============================================
// Message Listener
// ============================================
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === MESSAGE_TYPES.NETWORK_REQUEST) {
    networkRequests.push(message.data);
    renderNetworkTable();
    renderAdsTable();
  } else if (message.type === MESSAGE_TYPES.DATALAYER_PUSH) {
    dataLayerEvents.push(message.data);
    renderDataLayerTable();
  }
});

// ============================================
// Initialize
// ============================================
async function init() {
  // Load network requests
  const netResult = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.NETWORK_GET });
  if (Array.isArray(netResult)) {
    networkRequests = netResult;
    renderNetworkTable();
    renderAdsTable();
  }

  // Load dataLayer events
  const dlResult = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.DATALAYER_GET });
  if (Array.isArray(dlResult)) {
    dataLayerEvents = dlResult;
    renderDataLayerTable();
  }

  // Load cookies
  loadCookies();

  // Set preserve log active
  document.getElementById('preserveLogBtn').classList.add('active');
}

document.addEventListener('DOMContentLoaded', init);
