/**
 * Swiss Knife for Google - Utility Functions
 */

import {
  GOOGLE_PATTERNS,
  GA4_PARAMS,
  GOOGLE_ADS_PARAMS,
  FLOODLIGHT_PARAMS,
  SHA256_PATTERN,
  MD5_PATTERN
} from './constants.js';

/**
 * Generate unique ID
 */
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format timestamp
 */
export function formatTimestamp(date = new Date(), format = 'HH:mm:ss.SSS') {
  const d = new Date(date);
  const pad = (n, len = 2) => String(n).padStart(len, '0');

  const replacements = {
    'YYYY': d.getFullYear(),
    'MM': pad(d.getMonth() + 1),
    'DD': pad(d.getDate()),
    'HH': pad(d.getHours()),
    'mm': pad(d.getMinutes()),
    'ss': pad(d.getSeconds()),
    'SSS': pad(d.getMilliseconds(), 3)
  };

  let result = format;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(key, value);
  }
  return result;
}

/**
 * Parse URL and extract query parameters
 */
export function parseUrl(url) {
  try {
    const urlObj = new URL(url);
    const params = {};

    // Parse query string
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    return {
      full: url,
      origin: urlObj.origin,
      pathname: urlObj.pathname,
      search: urlObj.search,
      params
    };
  } catch (e) {
    return { full: url, params: {}, error: e.message };
  }
}

/**
 * Identify Google request type from URL
 */
export function identifyGoogleRequest(url) {
  for (const [type, config] of Object.entries(GOOGLE_PATTERNS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(url)) {
        return {
          type,
          name: config.name,
          icon: config.icon,
          color: config.color
        };
      }
    }
  }
  return null;
}

/**
 * Decode GA4 request parameters
 */
export function decodeGA4Request(url) {
  const parsed = parseUrl(url);
  const decoded = {};

  for (const [key, value] of Object.entries(parsed.params)) {
    const paramInfo = GA4_PARAMS[key];
    decoded[key] = {
      value,
      ...(paramInfo || { name: key, description: 'Unknown parameter' })
    };

    // Handle prefixed parameters
    if (key.startsWith('ep.')) {
      decoded[key].name = `Event Param: ${key.slice(3)}`;
      decoded[key].description = 'Custom event parameter (string)';
    } else if (key.startsWith('epn.')) {
      decoded[key].name = `Event Param (Number): ${key.slice(4)}`;
      decoded[key].description = 'Custom event parameter (number)';
    } else if (key.startsWith('up.')) {
      decoded[key].name = `User Property: ${key.slice(3)}`;
      decoded[key].description = 'Custom user property (string)';
    } else if (key.startsWith('upn.')) {
      decoded[key].name = `User Property (Number): ${key.slice(4)}`;
      decoded[key].description = 'Custom user property (number)';
    }
  }

  return decoded;
}

/**
 * Decode Google Ads request parameters
 */
export function decodeGoogleAdsRequest(url) {
  const parsed = parseUrl(url);
  const decoded = {};

  for (const [key, value] of Object.entries(parsed.params)) {
    const paramInfo = GOOGLE_ADS_PARAMS[key];
    decoded[key] = {
      value,
      ...(paramInfo || { name: key, description: 'Unknown parameter' })
    };
  }

  return decoded;
}

/**
 * Decode Floodlight request parameters
 */
export function decodeFloodlightRequest(url) {
  const parsed = parseUrl(url);
  const decoded = {};

  for (const [key, value] of Object.entries(parsed.params)) {
    const paramInfo = FLOODLIGHT_PARAMS[key];
    decoded[key] = {
      value,
      ...(paramInfo || { name: key, description: 'Unknown parameter' })
    };
  }

  return decoded;
}

/**
 * Validate SHA-256 hash
 */
export function validateHash(value) {
  if (SHA256_PATTERN.test(value)) {
    return { valid: true, type: 'SHA-256' };
  }
  if (MD5_PATTERN.test(value)) {
    return { valid: false, type: 'MD5', warning: 'MD5 is not supported, use SHA-256' };
  }
  return { valid: false, type: 'plaintext', warning: 'Value is not hashed' };
}

/**
 * Validate Enhanced Conversions data
 */
export function validateEnhancedConversions(params) {
  const ecFields = ['em', 'ph', 'fn', 'ln', 'ct', 'st', 'zp', 'country'];
  const results = {
    detected: false,
    fields: {},
    warnings: [],
    valid: true
  };

  for (const field of ecFields) {
    if (params[field]) {
      results.detected = true;
      const hashValidation = validateHash(params[field]);
      results.fields[field] = {
        value: params[field],
        ...hashValidation
      };

      if (!hashValidation.valid && field !== 'country') {
        results.warnings.push(`${field}: ${hashValidation.warning}`);
        results.valid = false;
      }
    }
  }

  return results;
}

/**
 * Validate GTM ID format
 */
export function validateGTMId(id) {
  const gtmPattern = /^GTM-[A-Z0-9]{6,8}$/;
  const rawPattern = /^[A-Z0-9]{6,8}$/;

  if (gtmPattern.test(id)) {
    return { valid: true, formatted: id };
  }

  if (rawPattern.test(id)) {
    return { valid: true, formatted: `GTM-${id}` };
  }

  return { valid: false, formatted: null };
}

/**
 * Validate Google Ads Conversion ID
 */
export function validateGoogleAdsId(id) {
  const awPattern = /^AW-\d+$/;
  const rawPattern = /^\d+$/;

  if (awPattern.test(id)) {
    return { valid: true, formatted: id };
  }

  if (rawPattern.test(id)) {
    return { valid: true, formatted: `AW-${id}` };
  }

  return { valid: false, formatted: null };
}

/**
 * Validate GA4 Measurement ID
 */
export function validateGA4Id(id) {
  const pattern = /^G-[A-Z0-9]+$/;
  return pattern.test(id);
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str, maxLength = 50) {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}

/**
 * Deep clone object
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Debounce function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Safe JSON parse
 */
export function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return fallback;
  }
}

/**
 * Safe JSON stringify with pretty print option
 */
export function safeJsonStringify(obj, pretty = false) {
  try {
    return pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
  } catch (e) {
    return String(obj);
  }
}

/**
 * Extract GTM container ID from dataLayer
 */
export function extractGTMContainers(dataLayer) {
  const containers = new Set();

  if (!Array.isArray(dataLayer)) return [];

  for (const item of dataLayer) {
    // Check for gtm.start event
    if (item['gtm.start']) {
      // Container ID might be in the uniqueEventId path
    }
    // Check for explicit container references
    if (item.gtmContainerId) {
      containers.add(item.gtmContainerId);
    }
  }

  return Array.from(containers);
}

/**
 * Get color for event type (for UI)
 */
export function getEventColor(eventName) {
  const colors = {
    'gtm.js': '#4285F4',
    'gtm.dom': '#4285F4',
    'gtm.load': '#4285F4',
    'page_view': '#34A853',
    'purchase': '#EA4335',
    'add_to_cart': '#FBBC04',
    'begin_checkout': '#FBBC04',
    'login': '#9C27B0',
    'sign_up': '#9C27B0',
    'default': '#607D8B'
  };

  return colors[eventName] || colors.default;
}

/**
 * Check if URL matches Google service patterns
 */
export function isGoogleRequest(url) {
  const googleDomains = [
    'google-analytics.com',
    'analytics.google.com',
    'googletagmanager.com',
    'googleadservices.com',
    'doubleclick.net',
    'googlesyndication.com',
    'googleoptimize.com',
    'optimize.google.com'
  ];

  try {
    const urlObj = new URL(url);
    return googleDomains.some(domain => urlObj.hostname.includes(domain));
  } catch (e) {
    return false;
  }
}

/**
 * Process template variables
 */
export function processTemplate(template, variables = {}) {
  let result = typeof template === 'string' ? template : JSON.stringify(template);

  // Built-in variables
  const builtIn = {
    '{{timestamp}}': Date.now(),
    '{{random}}': Math.random().toString(36).substring(7),
    '{{page_url}}': typeof window !== 'undefined' ? window.location.href : '',
    '{{page_title}}': typeof document !== 'undefined' ? document.title : '',
    '{{userId}}': 'user_' + Math.random().toString(36).substring(7)
  };

  // Replace built-in variables
  for (const [key, value] of Object.entries(builtIn)) {
    result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
  }

  // Replace custom variables
  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(pattern, value);
  }

  try {
    return JSON.parse(result);
  } catch (e) {
    return result;
  }
}

/**
 * Export data as JSON file
 */
export function exportAsJson(data, filename = 'export.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export data as CSV
 */
export function exportAsCsv(data, filename = 'export.csv') {
  if (!Array.isArray(data) || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      const escaped = String(value).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
