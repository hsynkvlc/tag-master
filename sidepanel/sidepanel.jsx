/**
 * Swiss Knife for Google - Side Panel React App
 */

const { useState, useEffect, useCallback, useRef } = React;

// ============================================
// Constants
// ============================================
const MESSAGE_TYPES = {
  DATALAYER_PUSH: 'DATALAYER_PUSH',
  DATALAYER_GET: 'DATALAYER_GET',
  DATALAYER_CLEAR: 'DATALAYER_CLEAR',
  GTM_INJECT: 'GTM_INJECT',
  GTM_DETECT: 'GTM_DETECT',
  NETWORK_REQUEST: 'NETWORK_REQUEST',
  NETWORK_GET: 'NETWORK_GET',
  SESSION_GET: 'SESSION_GET',
  TAB_GET: 'TAB_GET',
  TAB_UPDATED: 'TAB_UPDATED',
  CODE_EXECUTE: 'CODE_EXECUTE'
};

const DATALAYER_TEMPLATES = {
  page_view: {
    name: 'Page View',
    data: { event: 'page_view', page_title: document.title, page_location: window.location.href }
  },
  purchase: {
    name: 'Purchase',
    data: {
      event: 'purchase',
      ecommerce: {
        transaction_id: 'T_' + Date.now(),
        value: 99.99,
        currency: 'USD',
        items: [{ item_id: 'SKU_12345', item_name: 'Sample Product', price: 99.99, quantity: 1 }]
      }
    }
  },
  add_to_cart: {
    name: 'Add to Cart',
    data: {
      event: 'add_to_cart',
      ecommerce: {
        currency: 'USD',
        value: 29.99,
        items: [{ item_id: 'SKU_12345', item_name: 'Sample Product', price: 29.99, quantity: 1 }]
      }
    }
  },
  begin_checkout: {
    name: 'Begin Checkout',
    data: {
      event: 'begin_checkout',
      ecommerce: { currency: 'USD', value: 99.99, items: [] }
    }
  },
  login: {
    name: 'Login',
    data: { event: 'login', method: 'email' }
  },
  sign_up: {
    name: 'Sign Up',
    data: { event: 'sign_up', method: 'email' }
  }
};

// ============================================
// Icons
// ============================================
const Icons = {
  Knife: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.5 2L4 12.5V18h5.5L20 7.5c.83-.83.83-2.17 0-3L17 1.5c-.83-.83-2.17-.83-3 0l-.5.5z"/>
      <path d="M14 6l4 4"/>
    </svg>
  ),
  Tag: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  ),
  Layers: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 17 12 22 22 17"/>
      <polyline points="2 12 12 17 22 12"/>
    </svg>
  ),
  Send: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  Play: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  ),
  Trash: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
    </svg>
  ),
  Copy: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  X: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  ChevronDown: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  Refresh: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
    </svg>
  ),
  Settings: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  ),
  Box: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  )
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

  if (gtmPattern.test(id)) {
    return { valid: true, formatted: id };
  }
  if (rawPattern.test(id.replace('GTM-', ''))) {
    return { valid: true, formatted: id.startsWith('GTM-') ? id : `GTM-${id.toUpperCase()}` };
  }
  return { valid: false, formatted: null };
}

function syntaxHighlight(json) {
  if (typeof json !== 'string') {
    json = JSON.stringify(json, null, 2);
  }
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
    let cls = 'json-number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'json-key';
      } else {
        cls = 'json-string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'json-boolean';
    } else if (/null/.test(match)) {
      cls = 'json-null';
    }
    return '<span class="' + cls + '">' + match + '</span>';
  });
}

// ============================================
// Toast Component
// ============================================
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast ${type}`}>
      {type === 'success' && <Icons.Check />}
      {type === 'error' && <Icons.X />}
      <span>{message}</span>
    </div>
  );
}

// ============================================
// GTM Injector Component
// ============================================
function GTMInjector({ onInject }) {
  const [gtmId, setGtmId] = useState('');
  const [recentIds, setRecentIds] = useState([]);
  const [options, setOptions] = useState({
    initDataLayer: true,
    override: false,
    preview: false
  });
  const [validation, setValidation] = useState({ valid: null });
  const [containers, setContainers] = useState([]);

  useEffect(() => {
    // Load recent GTM IDs
    chrome.storage.local.get('recentGTMIds').then((result) => {
      setRecentIds(result.recentGTMIds || []);
    });

    // Detect existing containers
    detectContainers();
  }, []);

  const detectContainers = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GTM_DETECT });
      if (response && Array.isArray(response)) {
        setContainers(response);
      }
    } catch (e) {
      console.error('Failed to detect containers:', e);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value.toUpperCase();
    setGtmId(value);

    if (value.length >= 6) {
      const result = validateGTMId(value);
      setValidation(result);
    } else {
      setValidation({ valid: null });
    }
  };

  const handleInject = async () => {
    const result = validateGTMId(gtmId);
    if (!result.valid) {
      onInject({ success: false, error: 'Invalid GTM ID format' });
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.GTM_INJECT,
        gtmId: result.formatted,
        options
      });

      if (response?.success) {
        onInject({ success: true, gtmId: result.formatted });
        setGtmId('');
        setValidation({ valid: null });

        // Refresh recent IDs
        chrome.storage.local.get('recentGTMIds').then((res) => {
          setRecentIds(res.recentGTMIds || []);
        });

        // Refresh detected containers
        setTimeout(detectContainers, 1000);
      } else {
        onInject({ success: false, error: response?.error || 'Injection failed' });
      }
    } catch (e) {
      onInject({ success: false, error: e.message });
    }
  };

  const handleRecentClick = (id) => {
    setGtmId(id);
    setValidation(validateGTMId(id));
  };

  return (
    <div className="panel active">
      <div className="section">
        <div className="section-title">Inject GTM Container</div>
        <div className="input-group">
          <input
            type="text"
            className={`input ${validation.valid === true ? 'success' : validation.valid === false ? 'error' : ''}`}
            placeholder="GTM-XXXXXX"
            value={gtmId}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === 'Enter' && handleInject()}
          />
          <button className="btn" onClick={handleInject} disabled={!validation.valid}>
            <Icons.Play />
            Inject
          </button>
        </div>

        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={options.initDataLayer}
              onChange={(e) => setOptions({ ...options, initDataLayer: e.target.checked })}
            />
            Initialize dataLayer
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={options.override}
              onChange={(e) => setOptions({ ...options, override: e.target.checked })}
            />
            Replace existing
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={options.preview}
              onChange={(e) => setOptions({ ...options, preview: e.target.checked })}
            />
            Preview mode
          </label>
        </div>
      </div>

      {recentIds.length > 0 && (
        <div className="section">
          <div className="section-title">Recent</div>
          <div className="recent-list">
            {recentIds.map((id) => (
              <button key={id} className="recent-item" onClick={() => handleRecentClick(id)}>
                {id}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Detected Containers</span>
          <button className="btn-icon btn-small" onClick={detectContainers}>
            <Icons.Refresh />
          </button>
        </div>
        {containers.length > 0 ? (
          <div className="container-list">
            {containers.map((container) => (
              <div key={container.id} className="container-item">
                <div className="container-info">
                  <div className={`container-icon ${container.type.toLowerCase()}`}>
                    {container.type === 'GTM' ? 'GTM' : 'G4'}
                  </div>
                  <div>
                    <div className="container-id">{container.id}</div>
                    <div className="container-type">{container.type}</div>
                  </div>
                </div>
                <div className="container-status"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Icons.Box />
            <p>No containers detected on this page</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// DataLayer Monitor Component
// ============================================
function DataLayerMonitor() {
  const [events, setEvents] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    // Load existing events
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.DATALAYER_GET }).then((result) => {
      if (Array.isArray(result)) {
        setEvents(result);
      }
    });

    // Listen for new events
    const listener = (message) => {
      if (message.type === MESSAGE_TYPES.DATALAYER_PUSH) {
        setEvents((prev) => [...prev, message.data]);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [events]);

  const handleClear = () => {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.DATALAYER_CLEAR });
    setEvents([]);
  };

  const handleCopy = (data) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  };

  const filteredEvents = events.filter((event) => {
    if (!filter) return true;
    const searchStr = JSON.stringify(event.data).toLowerCase();
    return searchStr.includes(filter.toLowerCase());
  });

  return (
    <div className="panel active">
      <div className="section">
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input
            type="text"
            className="input"
            placeholder="Filter events..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn btn-secondary" onClick={handleClear}>
            <Icons.Trash />
          </button>
        </div>
      </div>

      <div className="event-list" ref={listRef} style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
        {filteredEvents.length > 0 ? (
          filteredEvents.slice(-50).map((event) => (
            <div
              key={event.id}
              className={`event-item ${expandedId === event.id ? 'expanded' : ''}`}
              onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
            >
              <div className="event-header">
                <div className="event-info">
                  <span className="event-time">{formatTimestamp(event.timestamp)}</span>
                  <span className="event-name">{event.event || event.data?.event || 'push'}</span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    className="btn-icon btn-small"
                    onClick={(e) => { e.stopPropagation(); handleCopy(event.data); }}
                  >
                    <Icons.Copy />
                  </button>
                </div>
              </div>
              {expandedId !== event.id && (
                <div className="event-preview">
                  {JSON.stringify(event.data).substring(0, 100)}...
                </div>
              )}
              {expandedId === event.id && (
                <div
                  className="event-data"
                  dangerouslySetInnerHTML={{ __html: syntaxHighlight(event.data) }}
                />
              )}
            </div>
          ))
        ) : (
          <div className="empty-state">
            <Icons.Layers />
            <p>No dataLayer events captured yet</p>
            <p style={{ fontSize: '11px', marginTop: '8px' }}>Events will appear here as they are pushed</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// DataLayer Injector Component
// ============================================
function DataLayerInjector({ onPush }) {
  const [jsonValue, setJsonValue] = useState(JSON.stringify(DATALAYER_TEMPLATES.page_view.data, null, 2));
  const [jsonError, setJsonError] = useState(null);

  const handleJsonChange = (e) => {
    const value = e.target.value;
    setJsonValue(value);

    try {
      JSON.parse(value);
      setJsonError(null);
    } catch (err) {
      setJsonError(err.message);
    }
  };

  const handlePresetClick = (template) => {
    // Update dynamic values
    const data = JSON.parse(JSON.stringify(template.data));
    if (data.page_title) data.page_title = document.title;
    if (data.page_location) data.page_location = window.location.href;
    if (data.ecommerce?.transaction_id) data.ecommerce.transaction_id = 'T_' + Date.now();

    setJsonValue(JSON.stringify(data, null, 2));
    setJsonError(null);
  };

  const handlePush = async () => {
    if (jsonError) return;

    try {
      const data = JSON.parse(jsonValue);
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (tab) {
        await chrome.tabs.sendMessage(tab.id, {
          type: MESSAGE_TYPES.DATALAYER_PUSH,
          data
        });
        onPush({ success: true, event: data.event || 'push' });
      }
    } catch (err) {
      onPush({ success: false, error: err.message });
    }
  };

  return (
    <div className="panel active">
      <div className="section">
        <div className="section-title">Quick Presets</div>
        <div className="preset-buttons">
          {Object.entries(DATALAYER_TEMPLATES).map(([key, template]) => (
            <button
              key={key}
              className="preset-btn"
              onClick={() => handlePresetClick(template)}
            >
              {template.name}
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-title">Event Data</div>
        <textarea
          className={`json-editor ${jsonError ? 'error' : ''}`}
          value={jsonValue}
          onChange={handleJsonChange}
          spellCheck={false}
        />
        {jsonError && (
          <div style={{ color: 'var(--error-red)', fontSize: '11px', marginTop: '6px' }}>
            {jsonError}
          </div>
        )}
      </div>

      <button className="btn" onClick={handlePush} disabled={!!jsonError} style={{ width: '100%' }}>
        <Icons.Send />
        Push to dataLayer
      </button>
    </div>
  );
}

// ============================================
// Main App Component
// ============================================
function App() {
  const [activeTab, setActiveTab] = useState('gtm');
  const [toast, setToast] = useState(null);
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    // Get current tab URL
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab) {
        setCurrentUrl(tab.url);
      }
    });

    // Listen for tab updates
    const listener = (message) => {
      if (message.type === MESSAGE_TYPES.TAB_UPDATED) {
        setCurrentUrl(message.data.url);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const handleGTMInject = (result) => {
    if (result.success) {
      showToast(`GTM ${result.gtmId} injected successfully`, 'success');
    } else {
      showToast(result.error || 'Injection failed', 'error');
    }
  };

  const handleDataLayerPush = (result) => {
    if (result.success) {
      showToast(`Event "${result.event}" pushed to dataLayer`, 'success');
    } else {
      showToast(result.error || 'Push failed', 'error');
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-title">
          <Icons.Knife />
          <span>Swiss Knife for Google</span>
        </div>
        <div className="header-actions">
          <button className="btn-icon">
            <Icons.Settings />
          </button>
        </div>
      </header>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'gtm' ? 'active' : ''}`}
          onClick={() => setActiveTab('gtm')}
        >
          <Icons.Tag />
          <span>GTM</span>
        </button>
        <button
          className={`tab ${activeTab === 'monitor' ? 'active' : ''}`}
          onClick={() => setActiveTab('monitor')}
        >
          <Icons.Layers />
          <span>Monitor</span>
        </button>
        <button
          className={`tab ${activeTab === 'inject' ? 'active' : ''}`}
          onClick={() => setActiveTab('inject')}
        >
          <Icons.Send />
          <span>Push</span>
        </button>
      </div>

      <div className="content">
        {activeTab === 'gtm' && <GTMInjector onInject={handleGTMInject} />}
        {activeTab === 'monitor' && <DataLayerMonitor />}
        {activeTab === 'inject' && <DataLayerInjector onPush={handleDataLayerPush} />}
      </div>

      <div className="status-bar">
        <div className="status-item">
          <div className="status-dot"></div>
          <span>Active</span>
        </div>
        <div className="status-item" style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentUrl ? new URL(currentUrl).hostname : 'No page'}
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

// ============================================
// Render App
// ============================================
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
