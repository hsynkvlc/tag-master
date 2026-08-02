/**
 * Tag Master - Utility Functions
 */

import {
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

