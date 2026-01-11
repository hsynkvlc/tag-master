/**
 * Swiss Knife for Google - Constants
 * Phase 1: Google Products Only
 */

// Google Network Request Patterns
export const GOOGLE_PATTERNS = {
  GA4: {
    name: 'GA4',
    icon: 'ga4',
    color: '#F9AB00',
    patterns: [
      /google-analytics\.com\/g\/collect/,
      /analytics\.google\.com\/g\/collect/,
      /www\.google-analytics\.com\/g\/collect/
    ],
    identifier: 'v=2'
  },
  UA: {
    name: 'Universal Analytics',
    icon: 'ua',
    color: '#E37400',
    patterns: [
      /google-analytics\.com\/collect/,
      /google-analytics\.com\/r\/collect/,
      /www\.google-analytics\.com\/collect/
    ],
    identifier: 'v=1'
  },
  GOOGLE_ADS_CONVERSION: {
    name: 'Google Ads Conversion',
    icon: 'ads',
    color: '#4285F4',
    patterns: [
      /googleadservices\.com\/pagead\/conversion/,
      /www\.googleadservices\.com\/pagead\/conversion/
    ]
  },
  GOOGLE_ADS_REMARKETING: {
    name: 'Google Ads Remarketing',
    icon: 'remarketing',
    color: '#34A853',
    patterns: [
      /googleadservices\.com\/pagead\/viewthroughconversion/,
      /www\.googleadservices\.com\/pagead\/viewthroughconversion/
    ]
  },
  FLOODLIGHT: {
    name: 'Floodlight',
    icon: 'floodlight',
    color: '#EA4335',
    patterns: [
      /ad\.doubleclick\.net\/ddm\/activity/,
      /fls\.doubleclick\.net/
    ]
  },
  DOUBLECLICK: {
    name: 'DoubleClick',
    icon: 'doubleclick',
    color: '#FBBC04',
    patterns: [
      /doubleclick\.net/,
      /ad\.doubleclick\.net/
    ]
  },
  GTM: {
    name: 'GTM',
    icon: 'gtm',
    color: '#4285F4',
    patterns: [
      /googletagmanager\.com\/gtm\.js/,
      /googletagmanager\.com\/gtag\/js/
    ]
  },
  OPTIMIZE: {
    name: 'Google Optimize',
    icon: 'optimize',
    color: '#B366FF',
    patterns: [
      /optimize\.google\.com/,
      /googleoptimize\.com/
    ]
  }
};

// GA4 Parameter Definitions
export const GA4_PARAMS = {
  // Core Parameters
  v: { name: 'Protocol Version', description: 'GA4 uses v=2' },
  tid: { name: 'Measurement ID', description: 'GA4 property measurement ID (G-XXXXXXX)' },
  gtm: { name: 'GTM Hash', description: 'GTM container hash if loaded via GTM' },
  _p: { name: 'Page ID', description: 'Unique page identifier' },
  cid: { name: 'Client ID', description: 'Anonymous client identifier' },
  ul: { name: 'User Language', description: 'Browser language setting' },
  sr: { name: 'Screen Resolution', description: 'User screen resolution' },
  _s: { name: 'Session Counter', description: 'Hit counter for session' },
  sid: { name: 'Session ID', description: 'GA4 session identifier' },
  sct: { name: 'Session Count', description: 'Total session count for user' },
  seg: { name: 'Session Engaged', description: 'Whether session is engaged (1=yes)' },
  dl: { name: 'Document Location', description: 'Full page URL' },
  dr: { name: 'Document Referrer', description: 'Referrer URL' },
  dt: { name: 'Document Title', description: 'Page title' },
  en: { name: 'Event Name', description: 'Name of the event' },
  _ee: { name: 'External Event', description: 'External event indicator' },
  ep: { name: 'Event Parameter', description: 'Custom event parameter (string)' },
  epn: { name: 'Event Parameter (Number)', description: 'Custom event parameter (number)' },
  up: { name: 'User Property', description: 'Custom user property (string)' },
  upn: { name: 'User Property (Number)', description: 'Custom user property (number)' },
  // E-commerce
  cu: { name: 'Currency', description: 'Currency code (ISO 4217)' },
  // User ID
  uid: { name: 'User ID', description: 'Custom user identifier' },
  // Debug
  _dbg: { name: 'Debug Mode', description: 'Debug mode enabled' },
  // Consent
  gcs: { name: 'Google Consent State', description: 'Consent mode state' },
  gcd: { name: 'Google Consent Default', description: 'Consent mode defaults' },
  // Traffic Source
  _utmcc: { name: 'Campaign Cookie', description: 'UTM campaign cookie' }
};

// Google Ads Conversion Parameters
export const GOOGLE_ADS_PARAMS = {
  // Conversion Parameters
  label: { name: 'Conversion Label', description: 'Unique conversion action label' },
  value: { name: 'Conversion Value', description: 'Monetary value of conversion' },
  currency: { name: 'Currency', description: 'Currency code for value' },
  transaction_id: { name: 'Transaction ID', description: 'Order/transaction identifier' },
  oid: { name: 'Order ID', description: 'Alternative order ID parameter' },
  // Enhanced Conversions - User Data (Hashed)
  em: { name: 'Email (Hashed)', description: 'SHA-256 hashed email address' },
  ph: { name: 'Phone (Hashed)', description: 'SHA-256 hashed phone number' },
  fn: { name: 'First Name (Hashed)', description: 'SHA-256 hashed first name' },
  ln: { name: 'Last Name (Hashed)', description: 'SHA-256 hashed last name' },
  ct: { name: 'City (Hashed)', description: 'SHA-256 hashed city' },
  st: { name: 'State (Hashed)', description: 'SHA-256 hashed state/region' },
  zp: { name: 'Zip Code (Hashed)', description: 'SHA-256 hashed postal code' },
  country: { name: 'Country', description: 'Country code (ISO 3166-1 alpha-2)' },
  // Remarketing
  ecomm_prodid: { name: 'Product ID(s)', description: 'Product IDs for remarketing' },
  ecomm_pagetype: { name: 'Page Type', description: 'Type of page (home, product, cart, purchase)' },
  ecomm_totalvalue: { name: 'Total Value', description: 'Total cart/order value' },
  // Attribution
  gclid: { name: 'GCLID', description: 'Google Click Identifier' },
  gbraid: { name: 'GBRAID', description: 'App attribution parameter (iOS)' },
  wbraid: { name: 'WBRAID', description: 'Web attribution parameter (iOS)' }
};

// Floodlight Parameters
export const FLOODLIGHT_PARAMS = {
  src: { name: 'Source', description: 'Advertiser ID' },
  type: { name: 'Activity Group', description: 'Activity group tag string' },
  cat: { name: 'Activity Tag', description: 'Activity tag string' },
  ord: { name: 'Order ID / Cachebuster', description: 'Unique transaction ID or random number' },
  cost: { name: 'Revenue', description: 'Revenue/cost value' },
  qty: { name: 'Quantity', description: 'Number of items' },
  u1: { name: 'Custom Variable 1', description: 'Custom Floodlight variable' },
  u2: { name: 'Custom Variable 2', description: 'Custom Floodlight variable' },
  u3: { name: 'Custom Variable 3', description: 'Custom Floodlight variable' },
  u4: { name: 'Custom Variable 4', description: 'Custom Floodlight variable' },
  u5: { name: 'Custom Variable 5', description: 'Custom Floodlight variable' }
};

// Google Cookies
export const GOOGLE_COOKIES = {
  _ga: {
    name: 'GA Client ID',
    description: 'Stores unique client ID for GA4/UA',
    service: 'Google Analytics',
    expiry: '2 years'
  },
  '_ga_*': {
    name: 'GA4 Session',
    description: 'GA4 session and engagement data',
    service: 'Google Analytics 4',
    expiry: '2 years'
  },
  _gid: {
    name: 'GA Daily ID',
    description: 'Daily unique visitor identifier',
    service: 'Google Analytics',
    expiry: '24 hours'
  },
  '_gac_*': {
    name: 'Google Ads Campaign',
    description: 'Stores campaign information from Google Ads',
    service: 'Google Ads',
    expiry: '90 days'
  },
  _gcl_aw: {
    name: 'GCLID Storage',
    description: 'Stores Google Click ID from ad clicks',
    service: 'Google Ads',
    expiry: '90 days'
  },
  _gcl_dc: {
    name: 'DoubleClick GCLID',
    description: 'DoubleClick click identifier',
    service: 'DoubleClick',
    expiry: '90 days'
  },
  _gcl_au: {
    name: 'Google Ads Linker',
    description: 'Used for cross-domain tracking',
    service: 'Google Ads',
    expiry: '90 days'
  },
  _gcl_gb: {
    name: 'GBRAID Storage',
    description: 'iOS app attribution parameter',
    service: 'Google Ads',
    expiry: '90 days'
  },
  '_gat_*': {
    name: 'GA Throttle',
    description: 'Used to throttle request rate',
    service: 'Google Analytics',
    expiry: '1 minute'
  }
};

// GA4 Recommended Events
export const GA4_RECOMMENDED_EVENTS = {
  // E-commerce
  add_payment_info: {
    name: 'add_payment_info',
    description: 'User submits payment info',
    params: ['currency', 'value', 'coupon', 'payment_type', 'items']
  },
  add_shipping_info: {
    name: 'add_shipping_info',
    description: 'User submits shipping info',
    params: ['currency', 'value', 'coupon', 'shipping_tier', 'items']
  },
  add_to_cart: {
    name: 'add_to_cart',
    description: 'User adds item to cart',
    params: ['currency', 'value', 'items']
  },
  add_to_wishlist: {
    name: 'add_to_wishlist',
    description: 'User adds item to wishlist',
    params: ['currency', 'value', 'items']
  },
  begin_checkout: {
    name: 'begin_checkout',
    description: 'User begins checkout',
    params: ['currency', 'value', 'coupon', 'items']
  },
  purchase: {
    name: 'purchase',
    description: 'User completes purchase',
    params: ['transaction_id', 'value', 'currency', 'tax', 'shipping', 'coupon', 'items']
  },
  refund: {
    name: 'refund',
    description: 'Refund issued',
    params: ['transaction_id', 'value', 'currency', 'tax', 'shipping', 'items']
  },
  remove_from_cart: {
    name: 'remove_from_cart',
    description: 'User removes item from cart',
    params: ['currency', 'value', 'items']
  },
  select_item: {
    name: 'select_item',
    description: 'User selects item from list',
    params: ['item_list_id', 'item_list_name', 'items']
  },
  select_promotion: {
    name: 'select_promotion',
    description: 'User selects promotion',
    params: ['creative_name', 'creative_slot', 'promotion_id', 'promotion_name', 'items']
  },
  view_cart: {
    name: 'view_cart',
    description: 'User views cart',
    params: ['currency', 'value', 'items']
  },
  view_item: {
    name: 'view_item',
    description: 'User views item details',
    params: ['currency', 'value', 'items']
  },
  view_item_list: {
    name: 'view_item_list',
    description: 'User views item list',
    params: ['item_list_id', 'item_list_name', 'items']
  },
  view_promotion: {
    name: 'view_promotion',
    description: 'User views promotion',
    params: ['creative_name', 'creative_slot', 'promotion_id', 'promotion_name', 'items']
  },
  // Engagement
  login: {
    name: 'login',
    description: 'User logs in',
    params: ['method']
  },
  sign_up: {
    name: 'sign_up',
    description: 'User signs up',
    params: ['method']
  },
  search: {
    name: 'search',
    description: 'User performs search',
    params: ['search_term']
  },
  share: {
    name: 'share',
    description: 'User shares content',
    params: ['method', 'content_type', 'item_id']
  },
  generate_lead: {
    name: 'generate_lead',
    description: 'Lead generation',
    params: ['currency', 'value']
  }
};

// DataLayer Event Templates
export const DATALAYER_TEMPLATES = {
  page_view: {
    name: 'Page View',
    template: {
      event: 'page_view',
      page_title: '{{page_title}}',
      page_location: '{{page_url}}'
    }
  },
  purchase: {
    name: 'Purchase',
    template: {
      event: 'purchase',
      ecommerce: {
        transaction_id: '{{transaction_id}}',
        value: '{{value}}',
        currency: 'USD',
        tax: '{{tax}}',
        shipping: '{{shipping}}',
        items: [
          {
            item_id: '{{item_id}}',
            item_name: '{{item_name}}',
            price: '{{price}}',
            quantity: '{{quantity}}'
          }
        ]
      }
    }
  },
  add_to_cart: {
    name: 'Add to Cart',
    template: {
      event: 'add_to_cart',
      ecommerce: {
        currency: 'USD',
        value: '{{value}}',
        items: [
          {
            item_id: '{{item_id}}',
            item_name: '{{item_name}}',
            price: '{{price}}',
            quantity: 1
          }
        ]
      }
    }
  },
  begin_checkout: {
    name: 'Begin Checkout',
    template: {
      event: 'begin_checkout',
      ecommerce: {
        currency: 'USD',
        value: '{{value}}',
        items: []
      }
    }
  },
  login: {
    name: 'Login',
    template: {
      event: 'login',
      method: '{{method}}'
    }
  },
  sign_up: {
    name: 'Sign Up',
    template: {
      event: 'sign_up',
      method: '{{method}}'
    }
  },
  custom_event: {
    name: 'Custom Event',
    template: {
      event: '{{event_name}}',
      custom_parameter: '{{value}}'
    }
  }
};

// Message Types for Chrome Extension Communication
export const MESSAGE_TYPES = {
  // DataLayer
  DATALAYER_PUSH: 'DATALAYER_PUSH',
  DATALAYER_INIT: 'DATALAYER_INIT',
  DATALAYER_GET: 'DATALAYER_GET',
  DATALAYER_CLEAR: 'DATALAYER_CLEAR',
  // GTM
  GTM_INJECT: 'GTM_INJECT',
  GTM_REMOVE: 'GTM_REMOVE',
  GTM_DETECT: 'GTM_DETECT',
  GTM_INFO: 'GTM_INFO',
  // Network
  NETWORK_REQUEST: 'NETWORK_REQUEST',
  NETWORK_CLEAR: 'NETWORK_CLEAR',
  NETWORK_GET: 'NETWORK_GET',
  // Session
  SESSION_START: 'SESSION_START',
  SESSION_END: 'SESSION_END',
  SESSION_GET: 'SESSION_GET',
  // Storage
  STORAGE_GET: 'STORAGE_GET',
  STORAGE_SET: 'STORAGE_SET',
  // Code Runner
  CODE_EXECUTE: 'CODE_EXECUTE',
  CODE_RESULT: 'CODE_RESULT',
  // Cookies
  COOKIES_GET: 'COOKIES_GET',
  COOKIES_SET: 'COOKIES_SET',
  COOKIES_DELETE: 'COOKIES_DELETE',
  // Settings
  SETTINGS_GET: 'SETTINGS_GET',
  SETTINGS_SET: 'SETTINGS_SET',
  // Tab
  TAB_UPDATED: 'TAB_UPDATED',
  TAB_GET: 'TAB_GET'
};

// Default Settings
export const DEFAULT_SETTINGS = {
  preserveLog: true,
  theme: 'dark',
  defaultInterface: 'sidepanel',
  maxSessionAge: 7, // days
  maxEventsPerSession: 10000,
  autoCleanup: true,
  timestampFormat: 'HH:mm:ss.SSS',
  compactView: false,
  fontSize: 'medium',
  captureGA4: true,
  captureUA: true,
  captureGoogleAds: true,
  captureFloodlight: true,
  captureGTM: true,
  captureOptimize: true,
  maxRequestsToStore: 5000
};

// SHA-256 Hash Pattern (for Enhanced Conversions validation)
export const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
export const MD5_PATTERN = /^[a-f0-9]{32}$/i;

// GA4 Event Schema Definitions (for validation)
export const GA4_EVENT_SCHEMAS = {
  // Ecommerce Events with Required/Recommended params
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
  add_to_wishlist: {
    required: ['currency', 'value', 'items'],
    recommended: [],
    itemParams: ['item_id', 'item_name', 'price']
  },
  view_promotion: {
    required: ['items'],
    recommended: ['creative_name', 'creative_slot', 'promotion_id', 'promotion_name'],
    itemParams: ['item_id', 'item_name', 'promotion_id', 'promotion_name']
  },
  select_promotion: {
    required: ['items'],
    recommended: ['creative_name', 'creative_slot', 'promotion_id', 'promotion_name'],
    itemParams: ['item_id', 'item_name', 'promotion_id', 'promotion_name']
  },
  refund: {
    required: ['transaction_id'],
    recommended: ['value', 'currency', 'items'],
    itemParams: ['item_id', 'item_name', 'price', 'quantity']
  },
  // Engagement Events
  login: {
    required: [],
    recommended: ['method']
  },
  sign_up: {
    required: [],
    recommended: ['method']
  },
  search: {
    required: [],
    recommended: ['search_term']
  },
  share: {
    required: [],
    recommended: ['method', 'content_type', 'item_id']
  },
  generate_lead: {
    required: [],
    recommended: ['currency', 'value']
  },
  // Page/Screen Events
  page_view: {
    required: [],
    recommended: ['page_title', 'page_location', 'page_referrer']
  },
  screen_view: {
    required: ['screen_name'],
    recommended: ['screen_class']
  }
};

// Valid ISO 4217 Currency Codes (common ones)
export const VALID_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'MXN',
  'BRL', 'KRW', 'RUB', 'TRY', 'ZAR', 'SEK', 'NOK', 'DKK', 'PLN', 'THB',
  'IDR', 'HKD', 'SGD', 'NZD', 'PHP', 'MYR', 'TWD', 'AED', 'SAR', 'CZK'
];

// Keyboard Shortcuts
export const KEYBOARD_SHORTCUTS = {
  'Ctrl+1': { action: 'switchTab', tab: 'gtm', description: 'Go to GTM tab' },
  'Ctrl+2': { action: 'switchTab', tab: 'monitor', description: 'Go to Events tab' },
  'Ctrl+3': { action: 'switchTab', tab: 'network', description: 'Go to Network tab' },
  'Ctrl+4': { action: 'switchTab', tab: 'audit', description: 'Go to Audit tab' },
  'Ctrl+5': { action: 'switchTab', tab: 'cookies', description: 'Go to Cookies tab' },
  'Ctrl+6': { action: 'switchTab', tab: 'consent', description: 'Go to Consent tab' },
  'Ctrl+7': { action: 'switchTab', tab: 'push', description: 'Go to Tools tab' },
  'Ctrl+K': { action: 'focusSearch', description: 'Focus search/filter' },
  'Ctrl+L': { action: 'clearAll', description: 'Clear current view' },
  'Ctrl+E': { action: 'exportJson', description: 'Export as JSON' },
  'Ctrl+Shift+E': { action: 'exportCsv', description: 'Export as CSV' },
  'Ctrl+R': { action: 'refresh', description: 'Refresh current panel' },
  'Ctrl+D': { action: 'toggleTheme', description: 'Toggle dark/light theme' },
  'Escape': { action: 'closeModal', description: 'Close modal/popup' }
};
