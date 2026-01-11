/**
 * Swiss Knife for Google - DevTools Panel
 */

const { useState, useEffect, useCallback, useRef, useMemo } = React;

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
  GTM_DETECT: 'GTM_DETECT',
  TAB_GET: 'TAB_GET'
};

const GA4_PARAMS = {
  v: 'Protocol Version',
  tid: 'Measurement ID',
  cid: 'Client ID',
  uid: 'User ID',
  en: 'Event Name',
  dl: 'Document Location',
  dr: 'Document Referrer',
  dt: 'Document Title',
  sr: 'Screen Resolution',
  ul: 'User Language',
  sid: 'Session ID',
  sct: 'Session Count',
  seg: 'Session Engaged',
  _p: 'Page ID',
  _s: 'Hit Counter',
  cu: 'Currency',
  _ee: 'External Event',
  _dbg: 'Debug Mode',
  gcs: 'Consent State',
  gcd: 'Consent Default'
};

const GOOGLE_ADS_PARAMS = {
  label: 'Conversion Label',
  value: 'Conversion Value',
  currency: 'Currency',
  transaction_id: 'Transaction ID',
  oid: 'Order ID',
  em: 'Email (Hashed)',
  ph: 'Phone (Hashed)',
  fn: 'First Name (Hashed)',
  ln: 'Last Name (Hashed)',
  ct: 'City (Hashed)',
  st: 'State (Hashed)',
  zp: 'Zip Code (Hashed)',
  country: 'Country',
  gclid: 'GCLID',
  gbraid: 'GBRAID',
  wbraid: 'WBRAID'
};

const GOOGLE_COOKIES = [
  { pattern: '_ga', name: 'GA Client ID', service: 'Google Analytics' },
  { pattern: '_ga_', name: 'GA4 Session', service: 'Google Analytics 4' },
  { pattern: '_gid', name: 'GA Daily ID', service: 'Google Analytics' },
  { pattern: '_gac_', name: 'Google Ads Campaign', service: 'Google Ads' },
  { pattern: '_gcl_aw', name: 'GCLID Storage', service: 'Google Ads' },
  { pattern: '_gcl_dc', name: 'DoubleClick GCLID', service: 'DoubleClick' },
  { pattern: '_gcl_au', name: 'Google Ads Linker', service: 'Google Ads' },
  { pattern: '_gcl_gb', name: 'GBRAID Storage', service: 'Google Ads' },
  { pattern: '_gat_', name: 'GA Throttle', service: 'Google Analytics' }
];

const CODE_SNIPPETS = [
  { name: 'Log dataLayer', code: 'console.table(window.dataLayer);' },
  { name: 'Get GTM Containers', code: 'Object.keys(window.google_tag_manager || {}).filter(k => k.startsWith("GTM-"));' },
  { name: 'Get GA4 IDs', code: 'Object.keys(window.google_tag_manager || {}).filter(k => k.startsWith("G-"));' },
  { name: 'List All Cookies', code: 'document.cookie.split(";").map(c => c.trim());' },
  { name: 'Get Client ID', code: '(document.cookie.match(/_ga=([^;]+)/) || [])[1];' },
  { name: 'Check Consent Mode', code: 'window.dataLayer?.find(e => e[0] === "consent");' }
];

// ============================================
// Icons
// ============================================
const Icons = {
  Knife: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.5 2L4 12.5V18h5.5L20 7.5c.83-.83.83-2.17 0-3L17 1.5c-.83-.83-2.17-.83-3 0l-.5.5z"/>
    </svg>
  ),
  Network: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
    </svg>
  ),
  Ads: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
    </svg>
  ),
  Cookie: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="8" cy="9" r="1" fill="currentColor"/>
      <circle cx="15" cy="8" r="1" fill="currentColor"/>
      <circle cx="10" cy="14" r="1" fill="currentColor"/>
      <circle cx="16" cy="14" r="1" fill="currentColor"/>
    </svg>
  ),
  Code: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="16 18 22 12 16 6"/>
      <polyline points="8 6 2 12 8 18"/>
    </svg>
  ),
  Layers: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 17 12 22 22 17"/>
      <polyline points="2 12 12 17 22 12"/>
    </svg>
  ),
  Tag: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  ),
  Trash: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
    </svg>
  ),
  Download: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  Copy: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>
  ),
  Play: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  ),
  X: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  AlertTriangle: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  Filter: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  ),
  Refresh: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
    </svg>
  )
};

// ============================================
// Utility Functions
// ============================================
function formatTimestamp(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

function formatBytes(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function parseUrlParams(url) {
  try {
    const urlObj = new URL(url);
    const params = {};
    urlObj.searchParams.forEach((value, key) => {
      params[key] = decodeURIComponent(value);
    });
    return params;
  } catch (e) {
    return {};
  }
}

function syntaxHighlight(json) {
  if (typeof json !== 'string') {
    json = JSON.stringify(json, null, 2);
  }
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
    let cls = 'json-number';
    if (/^"/.test(match)) {
      cls = /:$/.test(match) ? 'json-key' : 'json-string';
    } else if (/true|false/.test(match)) {
      cls = 'json-boolean';
    } else if (/null/.test(match)) {
      cls = 'json-null';
    }
    return '<span class="' + cls + '">' + match + '</span>';
  });
}

function isValidSHA256(value) {
  return /^[a-f0-9]{64}$/i.test(value);
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
}

// ============================================
// Network Monitor Component
// ============================================
function NetworkMonitor() {
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [filter, setFilter] = useState('');
  const [typeFilters, setTypeFilters] = useState({
    GA4: true, UA: true, GOOGLE_ADS_CONVERSION: true, GOOGLE_ADS_REMARKETING: true,
    FLOODLIGHT: true, GTM: true, DOUBLECLICK: true, OPTIMIZE: true
  });
  const [preserveLog, setPreserveLog] = useState(true);

  useEffect(() => {
    // Load existing requests
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.NETWORK_GET }).then((result) => {
      if (Array.isArray(result)) setRequests(result);
    });

    // Listen for new requests
    const listener = (message) => {
      if (message.type === MESSAGE_TYPES.NETWORK_REQUEST) {
        setRequests((prev) => [...prev, message.data]);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const handleClear = () => {
    if (!preserveLog) {
      chrome.runtime.sendMessage({ type: MESSAGE_TYPES.NETWORK_CLEAR });
      setRequests([]);
      setSelectedRequest(null);
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (!typeFilters[req.type]) return false;
      if (filter && !req.url.toLowerCase().includes(filter.toLowerCase())) return false;
      return true;
    });
  }, [requests, typeFilters, filter]);

  const toggleTypeFilter = (type) => {
    setTypeFilters((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const exportRequests = () => {
    const data = JSON.stringify(filteredRequests, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `network-requests-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="devtools-panel active">
      <div className="toolbar">
        <div className="toolbar-group">
          <input
            type="text"
            className="toolbar-input"
            placeholder="Filter requests..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="toolbar-separator" />
        <div className="filter-pills">
          {Object.entries(typeFilters).map(([type, active]) => (
            <button
              key={type}
              className={`filter-pill ${active ? 'active' : ''}`}
              onClick={() => toggleTypeFilter(type)}
            >
              <span className="dot" style={{ background: getTypeColor(type) }} />
              {type.replace('GOOGLE_ADS_', '').replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="toolbar-separator" />
        <button
          className={`toolbar-btn ${preserveLog ? 'active' : ''}`}
          onClick={() => setPreserveLog(!preserveLog)}
        >
          Preserve Log
        </button>
        <button className="toolbar-btn" onClick={handleClear} disabled={preserveLog}>
          <Icons.Trash /> Clear
        </button>
        <button className="toolbar-btn" onClick={exportRequests}>
          <Icons.Download /> Export
        </button>
      </div>

      <div className="split-pane">
        <div className="split-pane-content">
          {filteredRequests.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Time</th>
                  <th style={{ width: '100px' }}>Type</th>
                  <th style={{ width: '60px' }}>Status</th>
                  <th>URL</th>
                  <th style={{ width: '80px' }}>Size</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => (
                  <tr
                    key={req.id}
                    className={`${selectedRequest?.id === req.id ? 'selected' : ''} ${req.statusCode === 0 || req.error ? 'error' : ''}`}
                    onClick={() => setSelectedRequest(req)}
                  >
                    <td>{formatTimestamp(req.timestamp)}</td>
                    <td>
                      <span className={`type-badge ${req.type.toLowerCase().replace('google_ads_', '')}`}>
                        {req.typeName || req.type}
                      </span>
                    </td>
                    <td>
                      <span className="status-indicator">
                        <span className={`status-dot ${req.statusCode === 200 || req.statusCode === 204 ? 'success' : req.statusCode === 0 || req.error ? 'error' : 'pending'}`} />
                        {req.statusCode || '-'}
                      </span>
                    </td>
                    <td style={{ maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {req.url}
                    </td>
                    <td>{formatBytes(req.size)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <Icons.Network />
              <h3>No Google requests captured</h3>
              <p>Navigate to a page with Google tags to see requests</p>
            </div>
          )}
        </div>

        {selectedRequest && (
          <div className="split-pane-detail">
            <RequestDetail request={selectedRequest} onClose={() => setSelectedRequest(null)} />
          </div>
        )}
      </div>
    </div>
  );
}

function getTypeColor(type) {
  const colors = {
    GA4: '#F9AB00',
    UA: '#E37400',
    GOOGLE_ADS_CONVERSION: '#4285F4',
    GOOGLE_ADS_REMARKETING: '#34A853',
    FLOODLIGHT: '#EA4335',
    GTM: '#4285F4',
    DOUBLECLICK: '#FBBC04',
    OPTIMIZE: '#B366FF'
  };
  return colors[type] || '#666';
}

function RequestDetail({ request, onClose }) {
  const [activeTab, setActiveTab] = useState('params');
  const params = parseUrlParams(request.url);

  const getParamDefinition = (key) => {
    if (request.type === 'GA4' || request.type === 'UA') {
      return GA4_PARAMS[key] || key;
    }
    if (request.type?.includes('GOOGLE_ADS')) {
      return GOOGLE_ADS_PARAMS[key] || key;
    }
    return key;
  };

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <span className="detail-title">
          <span className={`type-badge ${request.type?.toLowerCase().replace('google_ads_', '')}`}>
            {request.typeName || request.type}
          </span>
        </span>
        <button className="detail-close" onClick={onClose}>
          <Icons.X />
        </button>
      </div>

      <div className="detail-tabs">
        <button className={`detail-tab ${activeTab === 'params' ? 'active' : ''}`} onClick={() => setActiveTab('params')}>
          Parameters
        </button>
        <button className={`detail-tab ${activeTab === 'headers' ? 'active' : ''}`} onClick={() => setActiveTab('headers')}>
          Headers
        </button>
        <button className={`detail-tab ${activeTab === 'raw' ? 'active' : ''}`} onClick={() => setActiveTab('raw')}>
          Raw
        </button>
      </div>

      <div className="detail-content">
        {activeTab === 'params' && (
          <div className="param-list">
            {Object.entries(params).map(([key, value]) => (
              <div key={key} className="param-item">
                <div className="param-key">{key}</div>
                <div>
                  <div className="param-value">{value}</div>
                  <div className="param-desc">{getParamDefinition(key)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'headers' && (
          <div className="param-list">
            {(request.requestHeaders || []).map((header, i) => (
              <div key={i} className="param-item">
                <div className="param-key">{header.name}</div>
                <div className="param-value">{header.value}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'raw' && (
          <div>
            <div className="section">
              <div className="section-title">Full URL</div>
              <div className="code-block" style={{ wordBreak: 'break-all' }}>{request.url}</div>
            </div>
            <button className="btn btn-secondary" onClick={() => copyToClipboard(request.url)}>
              <Icons.Copy /> Copy URL
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Google Ads Inspector Component
// ============================================
function GoogleAdsInspector() {
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.NETWORK_GET }).then((result) => {
      if (Array.isArray(result)) {
        const adsRequests = result.filter(r =>
          r.type === 'GOOGLE_ADS_CONVERSION' || r.type === 'GOOGLE_ADS_REMARKETING'
        );
        setRequests(adsRequests);
      }
    });

    const listener = (message) => {
      if (message.type === MESSAGE_TYPES.NETWORK_REQUEST &&
          (message.data.type === 'GOOGLE_ADS_CONVERSION' || message.data.type === 'GOOGLE_ADS_REMARKETING')) {
        setRequests((prev) => [...prev, message.data]);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  return (
    <div className="devtools-panel active">
      <div className="toolbar">
        <div className="toolbar-group">
          <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
            Google Ads Conversion & Remarketing Inspector
          </span>
        </div>
      </div>

      <div className="split-pane">
        <div className="split-pane-content">
          {requests.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Time</th>
                  <th style={{ width: '120px' }}>Type</th>
                  <th>Conversion ID / Label</th>
                  <th style={{ width: '100px' }}>Value</th>
                  <th style={{ width: '80px' }}>EC Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => {
                  const params = parseUrlParams(req.url);
                  const hasEC = params.em || params.ph || params.fn;
                  return (
                    <tr
                      key={req.id}
                      className={selectedRequest?.id === req.id ? 'selected' : ''}
                      onClick={() => setSelectedRequest(req)}
                    >
                      <td>{formatTimestamp(req.timestamp)}</td>
                      <td>
                        <span className={`type-badge ${req.type === 'GOOGLE_ADS_CONVERSION' ? 'ads' : 'remarketing'}`}>
                          {req.type === 'GOOGLE_ADS_CONVERSION' ? 'Conversion' : 'Remarketing'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>
                        {params.label || params.id || '-'}
                      </td>
                      <td>{params.value ? `${params.value} ${params.currency || ''}` : '-'}</td>
                      <td>
                        {hasEC ? (
                          <span className="validation-badge valid"><Icons.Check /> Active</span>
                        ) : (
                          <span className="validation-badge warning">None</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <Icons.Ads />
              <h3>No Google Ads tags detected</h3>
              <p>Conversion and remarketing tags will appear here</p>
            </div>
          )}
        </div>

        {selectedRequest && (
          <div className="split-pane-detail">
            <EnhancedConversionsDetail request={selectedRequest} onClose={() => setSelectedRequest(null)} />
          </div>
        )}
      </div>
    </div>
  );
}

function EnhancedConversionsDetail({ request, onClose }) {
  const params = parseUrlParams(request.url);

  const ecFields = [
    { key: 'em', name: 'Email' },
    { key: 'ph', name: 'Phone' },
    { key: 'fn', name: 'First Name' },
    { key: 'ln', name: 'Last Name' },
    { key: 'ct', name: 'City' },
    { key: 'st', name: 'State' },
    { key: 'zp', name: 'Zip Code' },
    { key: 'country', name: 'Country' }
  ];

  const warnings = [];

  ecFields.forEach(({ key, name }) => {
    if (params[key] && key !== 'country') {
      if (!isValidSHA256(params[key])) {
        warnings.push(`${name}: Value is not properly SHA-256 hashed`);
      }
    }
  });

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <span className="detail-title">Enhanced Conversions Analysis</span>
        <button className="detail-close" onClick={onClose}><Icons.X /></button>
      </div>

      <div className="detail-content">
        <div className="section">
          <div className="section-title">Conversion Details</div>
          <div className="param-list">
            {params.label && (
              <div className="param-item">
                <div className="param-key">Label</div>
                <div className="param-value">{params.label}</div>
              </div>
            )}
            {params.value && (
              <div className="param-item">
                <div className="param-key">Value</div>
                <div className="param-value">{params.value} {params.currency}</div>
              </div>
            )}
            {params.transaction_id && (
              <div className="param-item">
                <div className="param-key">Transaction ID</div>
                <div className="param-value">{params.transaction_id}</div>
              </div>
            )}
          </div>
        </div>

        <div className="section">
          <div className="section-title">Enhanced Conversions Data</div>
          <div className="ec-tree">
            {ecFields.map(({ key, name }) => {
              const value = params[key];
              const isHashed = value && key !== 'country' ? isValidSHA256(value) : null;

              return (
                <div key={key} className="ec-tree-item">
                  <span className="ec-tree-label">{name} ({key}): </span>
                  {value ? (
                    <>
                      <span className="ec-tree-value" style={{ color: 'var(--success-green)' }}>Present</span>
                      {key !== 'country' && (
                        <span className="ec-tree-status">
                          {isHashed ? (
                            <span className="validation-badge valid"><Icons.Check /> SHA-256</span>
                          ) : (
                            <span className="validation-badge invalid"><Icons.AlertTriangle /> Not Hashed</span>
                          )}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="ec-tree-value" style={{ color: 'var(--text-muted)' }}>Not Set</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="section">
            <div className="section-title" style={{ color: 'var(--warning-yellow)' }}>Warnings</div>
            {warnings.map((warning, i) => (
              <div key={i} style={{ color: 'var(--warning-yellow)', fontSize: '11px', marginBottom: '4px' }}>
                <Icons.AlertTriangle style={{ width: 12, height: 12, display: 'inline', marginRight: 4 }} />
                {warning}
              </div>
            ))}
          </div>
        )}

        <div className="section">
          <div className="section-title">Attribution</div>
          <div className="param-list">
            {params.gclid && (
              <div className="param-item">
                <div className="param-key">GCLID</div>
                <div className="param-value">{params.gclid}</div>
              </div>
            )}
            {params.gbraid && (
              <div className="param-item">
                <div className="param-key">GBRAID</div>
                <div className="param-value">{params.gbraid}</div>
              </div>
            )}
            {params.wbraid && (
              <div className="param-item">
                <div className="param-key">WBRAID</div>
                <div className="param-value">{params.wbraid}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Cookie Inspector Component
// ============================================
function CookieInspector() {
  const [cookies, setCookies] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadCookies = async () => {
    setLoading(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        const allCookies = await chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.COOKIES_GET,
          url: tab.url
        });

        // Filter Google-related cookies
        const googleCookies = allCookies.filter(cookie => {
          return GOOGLE_COOKIES.some(gc =>
            cookie.name === gc.pattern || cookie.name.startsWith(gc.pattern)
          );
        }).map(cookie => {
          const definition = GOOGLE_COOKIES.find(gc =>
            cookie.name === gc.pattern || cookie.name.startsWith(gc.pattern)
          );
          return { ...cookie, definition };
        });

        setCookies(googleCookies);
      }
    } catch (e) {
      console.error('Failed to load cookies:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCookies();
  }, []);

  const handleDelete = async (cookie) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.COOKIES_DELETE,
        url: tab.url,
        name: cookie.name
      });
      loadCookies();
    }
  };

  const exportCookies = () => {
    const data = JSON.stringify(cookies, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `google-cookies-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="devtools-panel active">
      <div className="toolbar">
        <div className="toolbar-group">
          <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
            Google Marketing Cookies
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <button className="toolbar-btn" onClick={loadCookies}>
          <Icons.Refresh /> Refresh
        </button>
        <button className="toolbar-btn" onClick={exportCookies}>
          <Icons.Download /> Export
        </button>
      </div>

      <div className="table-container">
        {cookies.length > 0 ? (
          <table className="data-table cookie-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Service</th>
                <th style={{ width: '300px' }}>Value</th>
                <th>Domain</th>
                <th>Expires</th>
                <th style={{ width: '60px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cookies.map((cookie, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'monospace' }}>{cookie.name}</td>
                  <td>
                    <span className="type-badge gtm">{cookie.definition?.service || 'Google'}</span>
                  </td>
                  <td className="cookie-value" title={cookie.value}>{cookie.value}</td>
                  <td>{cookie.domain}</td>
                  <td>{cookie.expirationDate ? new Date(cookie.expirationDate * 1000).toLocaleDateString() : 'Session'}</td>
                  <td>
                    <button className="toolbar-btn" onClick={() => handleDelete(cookie)} title="Delete">
                      <Icons.Trash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <Icons.Cookie />
            <h3>No Google cookies found</h3>
            <p>Google Analytics, Ads, and GTM cookies will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Code Runner Component
// ============================================
function CodeRunner() {
  const [code, setCode] = useState(CODE_SNIPPETS[0].code);
  const [output, setOutput] = useState('');
  const [isSuccess, setIsSuccess] = useState(true);

  const runCode = async () => {
    try {
      const result = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.CODE_EXECUTE,
        code
      });

      if (result?.success) {
        setIsSuccess(true);
        setOutput(JSON.stringify(result.result, null, 2) || 'undefined');
      } else {
        setIsSuccess(false);
        setOutput(result?.error || 'Execution failed');
      }
    } catch (e) {
      setIsSuccess(false);
      setOutput(e.message);
    }
  };

  return (
    <div className="devtools-panel active">
      <div className="toolbar">
        <div className="toolbar-group">
          <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
            Execute JavaScript in page context
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <select
          className="toolbar-input"
          style={{ minWidth: '150px' }}
          onChange={(e) => setCode(e.target.value)}
        >
          {CODE_SNIPPETS.map((snippet, i) => (
            <option key={i} value={snippet.code}>{snippet.name}</option>
          ))}
        </select>
        <button className="btn" onClick={runCode}>
          <Icons.Play /> Run
        </button>
      </div>

      <div className="code-editor-container">
        <textarea
          className="code-editor"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          placeholder="Enter JavaScript code..."
        />
        <div className={`code-output ${isSuccess ? 'code-output-success' : 'code-output-error'}`}>
          <div style={{ marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '10px' }}>
            Output:
          </div>
          <pre>{output || 'No output yet. Click Run to execute code.'}</pre>
        </div>
      </div>
    </div>
  );
}

// ============================================
// DataLayer Panel Component
// ============================================
function DataLayerPanel() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.DATALAYER_GET }).then((result) => {
      if (Array.isArray(result)) setEvents(result);
    });

    const listener = (message) => {
      if (message.type === MESSAGE_TYPES.DATALAYER_PUSH) {
        setEvents((prev) => [...prev, message.data]);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const filteredEvents = events.filter(e => {
    if (!filter) return true;
    return JSON.stringify(e.data).toLowerCase().includes(filter.toLowerCase());
  });

  const handleClear = () => {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.DATALAYER_CLEAR });
    setEvents([]);
    setSelectedEvent(null);
  };

  return (
    <div className="devtools-panel active">
      <div className="toolbar">
        <input
          type="text"
          className="toolbar-input"
          placeholder="Filter events..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div style={{ flex: 1 }} />
        <button className="toolbar-btn" onClick={handleClear}>
          <Icons.Trash /> Clear
        </button>
      </div>

      <div className="split-pane">
        <div className="split-pane-content">
          {filteredEvents.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Time</th>
                  <th style={{ width: '150px' }}>Event</th>
                  <th>Data Preview</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => (
                  <tr
                    key={event.id}
                    className={selectedEvent?.id === event.id ? 'selected' : ''}
                    onClick={() => setSelectedEvent(event)}
                  >
                    <td>{formatTimestamp(event.timestamp)}</td>
                    <td style={{ color: 'var(--success-green)', fontFamily: 'monospace' }}>
                      {event.event || event.data?.event || 'push'}
                    </td>
                    <td style={{ maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '10px' }}>
                      {JSON.stringify(event.data)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <Icons.Layers />
              <h3>No dataLayer events</h3>
              <p>Events will appear here as they are pushed</p>
            </div>
          )}
        </div>

        {selectedEvent && (
          <div className="split-pane-detail">
            <div className="detail-panel">
              <div className="detail-header">
                <span className="detail-title">Event Details</span>
                <button className="detail-close" onClick={() => setSelectedEvent(null)}><Icons.X /></button>
              </div>
              <div className="detail-content">
                <div className="section">
                  <div className="section-title">Event Data</div>
                  <div
                    className="code-block"
                    dangerouslySetInnerHTML={{ __html: syntaxHighlight(selectedEvent.data) }}
                  />
                </div>
                <button className="btn btn-secondary" onClick={() => copyToClipboard(JSON.stringify(selectedEvent.data, null, 2))}>
                  <Icons.Copy /> Copy JSON
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Main App Component
// ============================================
function App() {
  const [activeTab, setActiveTab] = useState('network');

  const tabs = [
    { id: 'network', name: 'Network', icon: Icons.Network },
    { id: 'datalayer', name: 'DataLayer', icon: Icons.Layers },
    { id: 'ads', name: 'Google Ads', icon: Icons.Ads },
    { id: 'cookies', name: 'Cookies', icon: Icons.Cookie },
    { id: 'code', name: 'Code Runner', icon: Icons.Code }
  ];

  return (
    <div className="devtools-app">
      <header className="devtools-header">
        <div className="devtools-logo">
          <Icons.Knife />
          <span>Swiss Knife for Google</span>
        </div>
        <div className="devtools-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`devtools-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon />
              {tab.name}
            </button>
          ))}
        </div>
      </header>

      <div className="devtools-content">
        {activeTab === 'network' && <NetworkMonitor />}
        {activeTab === 'datalayer' && <DataLayerPanel />}
        {activeTab === 'ads' && <GoogleAdsInspector />}
        {activeTab === 'cookies' && <CookieInspector />}
        {activeTab === 'code' && <CodeRunner />}
      </div>
    </div>
  );
}

// ============================================
// Render
// ============================================
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
