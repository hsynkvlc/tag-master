/**
 * Swiss Knife for Google - Background Service Worker
 * Handles: Network interception, storage, message passing, session management
 */

import { MESSAGE_TYPES, DEFAULT_SETTINGS, GOOGLE_PATTERNS } from '../shared/constants.js';
import { generateId, identifyGoogleRequest, formatTimestamp, isGoogleRequest } from '../shared/utils.js';

// ============================================
// State Management
// ============================================
let currentSession = null;
let networkRequests = [];
let dataLayerEvents = [];
let settings = { ...DEFAULT_SETTINGS };

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
  await dbPut('sessions', currentSession);
}

async function getSession() {
  if (!currentSession) {
    await startSession();
  }
  return currentSession;
}

// ============================================
// Network Request Handling
// ============================================
function captureNetworkRequest(details) {
  const googleType = identifyGoogleRequest(details.url);

  if (!googleType) return;

  const request = {
    id: generateId(),
    sessionId: currentSession?.id,
    timestamp: Date.now(),
    type: googleType.type,
    typeName: googleType.name,
    typeColor: googleType.color,
    url: details.url,
    method: details.method,
    tabId: details.tabId,
    frameId: details.frameId,
    initiator: details.initiator,
    requestHeaders: details.requestHeaders,
    statusCode: null,
    responseHeaders: null,
    size: 0,
    timing: {
      startTime: details.timeStamp
    }
  };

  networkRequests.push(request);

  // Store in IndexedDB
  if (db && settings.preserveLog) {
    dbAdd('networkRequests', request).catch(console.error);
  }

  // Update session
  if (currentSession) {
    currentSession.requestCount++;
    updateSession({ requestCount: currentSession.requestCount });
  }

  // Broadcast to UI
  broadcastMessage({
    type: MESSAGE_TYPES.NETWORK_REQUEST,
    data: request
  });

  return request.id;
}

function updateNetworkRequest(requestId, updates) {
  const request = networkRequests.find(r => r.id === requestId);
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
  const dataLayerEvent = {
    id: generateId(),
    sessionId: currentSession?.id,
    timestamp: Date.now(),
    pageUrl: sender.tab?.url || event.pageUrl,
    tabId: sender.tab?.id,
    event: event.eventName,
    data: event.data
  };

  dataLayerEvents.push(dataLayerEvent);

  // Store in IndexedDB
  if (db && settings.preserveLog) {
    await dbAdd('dataLayerEvents', dataLayerEvent);
  }

  // Update session
  if (currentSession) {
    currentSession.eventCount++;
    await updateSession({ eventCount: currentSession.eventCount });
  }

  // Broadcast to UI
  broadcastMessage({
    type: MESSAGE_TYPES.DATALAYER_PUSH,
    data: dataLayerEvent
  });

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
      return dataLayerEvents.filter(e =>
        !message.tabId || e.tabId === message.tabId
      );

    case MESSAGE_TYPES.DATALAYER_CLEAR:
      dataLayerEvents = [];
      if (db) await dbClear('dataLayerEvents');
      return { success: true };

    // Network Messages
    case MESSAGE_TYPES.NETWORK_GET:
      return networkRequests.filter(r =>
        !message.tabId || r.tabId === message.tabId
      );

    case MESSAGE_TYPES.NETWORK_CLEAR:
      networkRequests = [];
      if (db) await dbClear('networkRequests');
      return { success: true };

    // Session Messages
    case MESSAGE_TYPES.SESSION_GET:
      return await getSession();

    case MESSAGE_TYPES.SESSION_START:
      return await startSession();

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
        return await chrome.tabs.sendMessage(activeTab.id, {
          type: MESSAGE_TYPES.GTM_DETECT
        });
      }
      return { containers: [] };

    // Tab Messages
    case MESSAGE_TYPES.TAB_GET:
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return currentTab;

    // Cookies Messages
    case MESSAGE_TYPES.COOKIES_GET:
      return await chrome.cookies.getAll({ url: message.url });

    case MESSAGE_TYPES.COOKIES_DELETE:
      await chrome.cookies.remove({
        url: message.url,
        name: message.name
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
      const request = networkRequests.find(
        r => r.url === details.url && r.tabId === details.tabId
      );
      if (request) {
        updateNetworkRequest(request.id, {
          statusCode: details.statusCode,
          timing: {
            ...request.timing,
            endTime: details.timeStamp,
            duration: details.timeStamp - request.timing.startTime
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
      const request = networkRequests.find(
        r => r.url === details.url && r.tabId === details.tabId
      );
      if (request) {
        updateNetworkRequest(request.id, {
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
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId === 0 && currentSession) {
    // Main frame navigation completed
    currentSession.pageCount++;
    currentSession.pages.push({
      url: details.url,
      timestamp: Date.now()
    });
    await updateSession({
      pageCount: currentSession.pageCount,
      pages: currentSession.pages
    });

    broadcastMessage({
      type: MESSAGE_TYPES.TAB_UPDATED,
      data: { url: details.url, tabId: details.tabId }
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
  chrome.runtime.getPlatformInfo(() => {});
}, KEEP_ALIVE_INTERVAL);
