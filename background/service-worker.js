/**
 * Swiss Knife for Google - Background Service Worker
 * Handles: Network interception, storage, message passing, session management
 */

import { MESSAGE_TYPES, DEFAULT_SETTINGS, GOOGLE_PATTERNS } from '../shared/constants.js';
import { generateId, identifyGoogleRequest, formatTimestamp, isGoogleRequest, validateEnhancedConversions } from '../shared/utils.js';

// ============================================
// State Management
// ============================================
let tabSessions = {}; // Stores GA4 session info per tab
let tabEvents = {}; // Stores DataLayer events per tab { tabId: [] }
let tabRequests = {}; // Stores Network requests per tab { tabId: [] }
let settings = { ...DEFAULT_SETTINGS };
let currentSession = null; // Current debugging session

// ============================================
// IndexedDB Setup
// ============================================
const DB_NAME = 'SwissKnifeDB';
const DB_VERSION = 1;
let db = null;

async function initDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Sessions store
      if (!database.objectStoreNames.contains('sessions')) {
        const sessionsStore = database.createObjectStore('sessions', { keyPath: 'id' });
        sessionsStore.createIndex('startTime', 'startTime', { unique: false });
      }

      // Network requests store
      if (!database.objectStoreNames.contains('networkRequests')) {
        const networkStore = database.createObjectStore('networkRequests', { keyPath: 'id' });
        networkStore.createIndex('sessionId', 'sessionId', { unique: false });
        networkStore.createIndex('timestamp', 'timestamp', { unique: false });
        networkStore.createIndex('type', 'type', { unique: false });
      }

      // DataLayer events store
      if (!database.objectStoreNames.contains('dataLayerEvents')) {
        const dataLayerStore = database.createObjectStore('dataLayerEvents', { keyPath: 'id' });
        dataLayerStore.createIndex('sessionId', 'sessionId', { unique: false });
        dataLayerStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Templates store
      if (!database.objectStoreNames.contains('templates')) {
        database.createObjectStore('templates', { keyPath: 'id' });
      }

      // Snippets store
      if (!database.objectStoreNames.contains('snippets')) {
        database.createObjectStore('snippets', { keyPath: 'id' });
      }
    };
  });
}

// ============================================
// Storage Operations
// ============================================
async function dbAdd(storeName, data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbPut(storeName, data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbGet(storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbGetAll(storeName, indexName = null, query = null) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const target = indexName ? store.index(indexName) : store;
    const request = query ? target.getAll(query) : target.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbDelete(storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbClear(storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ============================================
// Session Management
// ============================================
async function startSession() {
  currentSession = {
    id: generateId(),
    startTime: Date.now(),
    pageCount: 0,
    eventCount: 0,
    requestCount: 0,
    pages: []
  };

  await dbAdd('sessions', currentSession);
  console.log('[Swiss Knife] Session started:', currentSession.id);
  return currentSession;
}

async function updateSession(updates) {
  if (!currentSession) return;
  Object.assign(currentSession, updates);
  if (db) {
    await dbPut('sessions', currentSession).catch(console.error);
  }
  return currentSession;
}

// ============================================
// Network Request Handling
// ============================================
function captureNetworkRequest(details) {
  const googleType = identifyGoogleRequest(details.url);
  if (!googleType) return;

  const urlObj = new URL(details.url);
  const ecValidation = googleType.type === 'GOOGLE_ADS_CONVERSION' ? validateEnhancedConversions(Object.fromEntries(urlObj.searchParams)) : null;

  const request = {
    id: generateId(),
    timestamp: Date.now(),
    type: googleType.type,
    typeName: googleType.name,
    typeColor: googleType.color,
    isServerSide: googleType.isServerSide,
    hasEnhancedConversions: ecValidation?.detected || false,
    ecValidation: ecValidation,
    url: details.url,
    method: details.method,
    tabId: details.tabId
  };

  if (!tabRequests[details.tabId]) tabRequests[details.tabId] = [];
  tabRequests[details.tabId].push(request);
  if (tabRequests[details.tabId].length > 300) tabRequests[details.tabId].shift();

  // Extract GA4 Session Info
  if (googleType.type === 'GA4' || googleType.type === 'GA4_SERVER_SIDE') {
    const tid = urlObj.searchParams.get('tid');
    const cid = urlObj.searchParams.get('cid');
    const sid = urlObj.searchParams.get('sid');
    if (tid || cid || sid) {
      tabSessions[details.tabId] = {
        ...(tabSessions[details.tabId] || {}),
        ...(tid && { tid }),
        ...(cid && { cid }),
        ...(sid && { sid }),
        lastUpdate: Date.now()
      };

      broadcastMessage({
        type: 'GA4_SESSION_UPDATE',
        tabId: details.tabId,
        data: tabSessions[details.tabId]
      });
    }
  }

  broadcastMessage({ type: MESSAGE_TYPES.NETWORK_REQUEST, data: request });

  if (db && settings.preserveLog) {
    dbAdd('networkRequests', request).catch(() => { });
  }
}

function updateNetworkRequest(tabId, requestId, updates) {
  const requests = tabRequests[tabId] || [];
  const request = requests.find(r => r.id === requestId);
  if (request) {
    Object.assign(request, updates);
    if (db && settings.preserveLog) {
      dbPut('networkRequests', request).catch(console.error);
    }
  }
}

// ============================================
// DataLayer Event Handling
// ============================================
async function handleDataLayerEvent(event, sender) {
  const tabId = sender.tab?.id;
  if (!tabId) return;

  const dataLayerEvent = {
    id: generateId(),
    timestamp: Date.now(),
    pageUrl: sender.tab?.url || event.pageUrl,
    tabId: tabId,
    event: event.eventName,
    data: event.data
  };

  if (!tabEvents[tabId]) tabEvents[tabId] = [];
  tabEvents[tabId].push(dataLayerEvent);
  if (tabEvents[tabId].length > 300) tabEvents[tabId].shift();

  broadcastMessage({ type: MESSAGE_TYPES.DATALAYER_PUSH, data: dataLayerEvent });

  if (db && settings.preserveLog) {
    dbAdd('dataLayerEvents', dataLayerEvent).catch(() => { });
  }
  return dataLayerEvent;
}

// ============================================
// Message Broadcasting
// ============================================
function broadcastMessage(message) {
  // Send to all extension pages (popup, sidepanel, devtools)
  chrome.runtime.sendMessage(message).catch(() => {
    // Ignore errors when no listeners
  });
}

// ============================================
// Settings Management
// ============================================
async function loadSettings() {
  const stored = await chrome.storage.local.get('settings');
  if (stored.settings) {
    settings = { ...DEFAULT_SETTINGS, ...stored.settings };
  }
  return settings;
}

async function saveSettings(newSettings) {
  settings = { ...settings, ...newSettings };
  await chrome.storage.local.set({ settings });
  return settings;
}

// ============================================
// Recent GTM IDs Management
// ============================================
async function getRecentGTMIds() {
  const stored = await chrome.storage.local.get('recentGTMIds');
  return stored.recentGTMIds || [];
}

async function addRecentGTMId(gtmId) {
  let recentIds = await getRecentGTMIds();
  // Remove if already exists
  recentIds = recentIds.filter(id => id !== gtmId);
  // Add to front
  recentIds.unshift(gtmId);
  // Keep max 5
  recentIds = recentIds.slice(0, 5);
  await chrome.storage.local.set({ recentGTMIds: recentIds });
  return recentIds;
}

// ============================================
// Message Handler
// ============================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch(error => {
    console.error('[Swiss Knife] Message error:', error);
    sendResponse({ error: error.message });
  });
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  switch (message.type) {
    // DataLayer Messages
    case MESSAGE_TYPES.DATALAYER_PUSH:
      return await handleDataLayerEvent(message.data, sender);

    case MESSAGE_TYPES.DATALAYER_GET:
      const [dlTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return dlTab ? (tabEvents[dlTab.id] || []) : [];

    case MESSAGE_TYPES.DATALAYER_CLEAR:
      const [clTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (clTab) tabEvents[clTab.id] = [];
      if (db) await dbClear('dataLayerEvents');
      return { success: true };

    case 'NETWORK_GET':
      const [ntTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return ntTab ? (tabRequests[ntTab.id] || []) : [];

    case 'NETWORK_CLEAR':
      const [cnTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (cnTab) tabRequests[cnTab.id] = [];
      if (db) await dbClear('networkRequests');
      return { success: true };

    // Session Messages
    case MESSAGE_TYPES.SESSION_GET:
      return { id: 'tab-session', tabSessions };

    case MESSAGE_TYPES.SESSION_START:
      return { success: true };

    // Settings Messages
    case MESSAGE_TYPES.SETTINGS_GET:
      return settings;

    case MESSAGE_TYPES.SETTINGS_SET:
      return await saveSettings(message.data);

    // Storage Messages
    case MESSAGE_TYPES.STORAGE_GET:
      return await chrome.storage.local.get(message.keys);

    case MESSAGE_TYPES.STORAGE_SET:
      await chrome.storage.local.set(message.data);
      return { success: true };

    // GTM Messages
    case MESSAGE_TYPES.GTM_INJECT:
      await addRecentGTMId(message.gtmId);
      // Forward to content script
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        return await chrome.tabs.sendMessage(tab.id, {
          type: MESSAGE_TYPES.GTM_INJECT,
          gtmId: message.gtmId,
          options: message.options
        });
      }
      return { error: 'No active tab' };

    case MESSAGE_TYPES.GTM_DETECT:
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab) {
        try {
          return await chrome.tabs.sendMessage(activeTab.id, {
            type: MESSAGE_TYPES.GTM_DETECT
          }, { frameId: 0 });
        } catch (e) {
          // Fallback or ignore if main frame is not accessible (e.g. restricted URL)
          console.warn('Failed to detect in main frame', e);
          return [];
        }
      }
      return [];

    // Tab Messages
    case MESSAGE_TYPES.TAB_GET:
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return currentTab;

    // Cookies Messages
    case MESSAGE_TYPES.COOKIES_GET:
      let targetUrl = message.url;
      if (!targetUrl) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        targetUrl = tab?.url;
      }
      if (!targetUrl) return [];

      const allCookies = await chrome.cookies.getAll({ url: targetUrl });
      // Identify Google cookies
      return allCookies.filter(c =>
        c.name.startsWith('_ga') ||
        c.name.startsWith('_gid') ||
        c.name.startsWith('_gcl') ||
        c.name.includes('gac') ||
        c.name.includes('FPID') ||
        c.domain.includes('google.com') ||
        c.domain.includes('doubleclick.net')
      ).sort((a, b) => a.name.localeCompare(b.name));

    case MESSAGE_TYPES.COOKIES_DELETE:
      let deleteUrl = message.url;
      if (!deleteUrl) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        deleteUrl = tab?.url;
      }
      if (!deleteUrl) return { success: false };

      await chrome.cookies.remove({
        url: deleteUrl,
        name: message.name
      });
      return { success: true };

    case 'COOKIES_SET':
      const [setTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!setTab?.url) return { success: false };

      const urlObj = new URL(setTab.url);
      await chrome.cookies.set({
        url: setTab.url,
        domain: urlObj.hostname,
        path: '/',
        name: message.name,
        value: message.value,
        expirationDate: message.expirationDate || (Date.now() / 1000 + 7776000), // 90 days default
        sameSite: 'lax'
      });
      return { success: true };

    // Code Execution
    case MESSAGE_TYPES.CODE_EXECUTE:
      const [execTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (execTab) {
        return await chrome.tabs.sendMessage(execTab.id, {
          type: MESSAGE_TYPES.CODE_EXECUTE,
          code: message.code
        });
      }
      return { error: 'No active tab' };

    case 'CONSENT_GET':
      const [consentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (consentTab) {
        try {
          // Forward to page script via content script
          const result = await chrome.tabs.sendMessage(consentTab.id, {
            type: 'GET_CONSENT_STATE'
          });
          return result || { error: 'No consent data' };
        } catch (e) {
          return { error: 'Failed to access tab' };
        }
      }
      return { error: 'No active tab' };

    case 'GET_CSP':
      const [cspTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (cspTab) {
        try {
          const result = await chrome.tabs.sendMessage(cspTab.id, { type: 'GET_CSP' });
          return result || { csp: '' };
        } catch (e) {
          return { csp: '', error: 'Failed to get CSP' };
        }
      }
      return { csp: '', error: 'No active tab' };

    case 'DETECT_TECH':
      const [techTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (techTab) {
        try {
          const result = await chrome.tabs.sendMessage(techTab.id, { type: 'DETECT_TECH' });
          return result || { technologies: [] };
        } catch (e) {
          return { technologies: [], error: 'Failed to detect technologies' };
        }
      }
      return { technologies: [], error: 'No active tab' };

    case 'GA4_SESSION_GET':
      const [sessionTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return sessionTab ? (tabSessions[sessionTab.id] || null) : null;

    default:
      console.warn('[Swiss Knife] Unknown message type:', message.type);
      return { error: 'Unknown message type' };
  }
}

// ============================================
// Network Request Interception
// ============================================
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (isGoogleRequest(details.url)) {
      captureNetworkRequest(details);
    }
  },
  { urls: ['<all_urls>'] },
  ['requestBody']
);

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (isGoogleRequest(details.url)) {
      const requests = tabRequests[details.tabId] || [];
      const request = requests.find(
        r => r.url === details.url && r.tabId === details.tabId
      );
      if (request) {
        updateNetworkRequest(details.tabId, request.id, {
          statusCode: details.statusCode,
          timing: {
            ...(request.timing || {}),
            endTime: details.timeStamp,
            duration: request.timing ? details.timeStamp - request.timing.startTime : 0
          }
        });
      }
    }
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (isGoogleRequest(details.url)) {
      const requests = tabRequests[details.tabId] || [];
      const request = requests.find(
        r => r.url === details.url && r.tabId === details.tabId
      );
      if (request) {
        updateNetworkRequest(details.tabId, request.id, {
          error: details.error,
          statusCode: 0
        });
      }
    }
  },
  { urls: ['<all_urls>'] }
);

// ============================================
// Tab Navigation Handling
// ============================================
chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId === 0) {
    // Clear data for this tab on refresh to avoid duplicates
    // We do this at onCommitted (earliest point for new document)
    // DISABLED CLEARING to preserve history across navigations per user request
    // tabEvents[details.tabId] = [];
    // tabRequests[details.tabId] = [];

    // Main frame navigation committed
    // Broadcast TAB_UPDATED for UI responsiveness
    broadcastMessage({
      type: MESSAGE_TYPES.TAB_UPDATED,
      data: { url: details.url, tabId: details.tabId }
    });
  }
});

chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId === 0 && currentSession) {
    currentSession.pageCount++;
    currentSession.pages.push({
      url: details.url,
      timestamp: Date.now()
    });
    await updateSession({
      pageCount: currentSession.pageCount,
      pages: currentSession.pages
    });
  }
});

// ============================================
// Side Panel Setup
// ============================================
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// ============================================
// Initialization
// ============================================
async function initialize() {
  console.log('[Swiss Knife] Initializing...');

  try {
    await initDatabase();
    await loadSettings();
    await startSession();
    console.log('[Swiss Knife] Initialized successfully');
  } catch (error) {
    console.error('[Swiss Knife] Initialization error:', error);
  }
}

initialize();

// ============================================
// Keep Service Worker Alive
// ============================================
const KEEP_ALIVE_INTERVAL = 20000; // 20 seconds

setInterval(() => {
  // Ping to keep alive
  chrome.runtime.getPlatformInfo(() => { });
}, KEEP_ALIVE_INTERVAL);
