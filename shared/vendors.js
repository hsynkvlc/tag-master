/**
 * Tag Master - Vendor Registry
 *
 * Single declarative source of truth for every tracking vendor the extension
 * can detect. Loaded three ways:
 *   - Service worker (ESM):  import '../shared/vendors.js'  (side-effect module)
 *   - Sidepanel (classic):   <script src="../shared/vendors.js"></script>
 * Exposes globals: TM_VENDORS, TM_VENDOR_BY_ID, tmClassifyRequest,
 * tmIsTrackedRequest, TM_TRACKING_COOKIE_PREFIXES, TM_TRACKING_COOKIE_DOMAINS.
 *
 * Detection philosophy (sGTM resilience): every vendor is matched host+path
 * first; a second "proxy pass" recognises Google hit shapes by PATH ALONE on
 * non-Google hosts, which is how server-side GTM / first-party proxying works.
 */
(function () {
  'use strict';

  // matchRules: [{host: RegExp on hostname, path?: RegExp on pathname}]
  // accountParam: query param holding the account/pixel/tag id
  // eventParam: query param holding the event name
  // params: query param -> friendly label (shown in the network panel)
  // cookies: first-party cookie name prefixes owned by this vendor
  // bodyType: 'json' when hits are JSON POSTs worth decoding
  const TM_VENDORS = [
    // ---------------- Google ----------------
    {
      id: 'GA4', name: 'GA4', category: 'google', color: '#F9AB00',
      match: [{ host: /(^|\.)google-analytics\.com$|(^|\.)analytics\.google\.com$/, path: /\/g\/collect/ }],
      accountParam: 'tid', eventParam: 'en',
      params: {
        v: 'Protocol Version', tid: 'Measurement ID', cid: 'Client ID', sid: 'Session ID',
        sct: 'Session Count', seg: 'Session Engaged', dl: 'Page Location', dr: 'Referrer',
        dt: 'Page Title', en: 'Event Name', ul: 'Language', sr: 'Screen Resolution',
        cu: 'Currency', uid: 'User ID', gcs: 'Consent State (gcs)', gcd: 'Consent Default (gcd)',
        dma: 'DMA Region', npa: 'Non-Personalized Ads'
      },
      cookies: ['_ga', '_gid', '_gat']
    },
    {
      id: 'UA', name: 'Universal Analytics', category: 'google', color: '#E37400',
      match: [{ host: /(^|\.)google-analytics\.com$/, path: /^\/(r\/|j\/)?collect/ }],
      accountParam: 'tid', eventParam: 'ea',
      params: { v: 'Protocol Version', tid: 'Tracking ID', cid: 'Client ID', t: 'Hit Type', ec: 'Event Category', ea: 'Event Action', el: 'Event Label', ev: 'Event Value' },
      cookies: ['__utm']
    },
    {
      id: 'GOOGLE_ADS_CONVERSION', name: 'Google Ads Conversion', category: 'google', color: '#4285F4',
      match: [
        { host: /(^|\.)googleadservices\.com$/, path: /\/pagead\/conversion/ },
        { host: /(^|\.)googleads\.g\.doubleclick\.net$/, path: /\/pagead\/viewthroughconversion/ }
      ],
      accountParam: null, eventParam: 'label',
      params: {
        label: 'Conversion Label', value: 'Conversion Value', currency_code: 'Currency',
        transaction_id: 'Transaction ID', em: 'Email (Hashed)', ph: 'Phone (Hashed)',
        gclid: 'Google Click ID', gclaw: 'GCLID (aw)', gcs: 'Consent State (gcs)', gcd: 'Consent Default (gcd)'
      },
      cookies: ['_gcl']
    },
    {
      id: 'GOOGLE_ADS_REMARKETING', name: 'Google Ads Remarketing', category: 'google', color: '#34A853',
      match: [
        { host: /(^|\.)googleadservices\.com$/, path: /\/pagead\/viewthroughconversion/ },
        { host: /(^|\.)google\.com$/, path: /\/pagead\/1p-user-list/ }
      ],
      accountParam: null, eventParam: null,
      params: { gcs: 'Consent State (gcs)', gcd: 'Consent Default (gcd)' },
      cookies: []
    },
    {
      id: 'FLOODLIGHT', name: 'Floodlight', category: 'google', color: '#EA4335',
      match: [
        { host: /(^|\.)ad\.doubleclick\.net$/, path: /\/ddm\/activity/ },
        { host: /(^|\.)fls\.doubleclick\.net$/ }
      ],
      accountParam: 'src', eventParam: 'type',
      params: { src: 'Advertiser ID', type: 'Activity Group', cat: 'Activity Tag', ord: 'Order/Cachebuster', cost: 'Revenue', qty: 'Quantity' },
      cookies: []
    },
    {
      id: 'GTM', name: 'GTM', category: 'google', color: '#4285F4',
      match: [{ host: /(^|\.)googletagmanager\.com$/, path: /\/(gtm\.js|gtag\/js|gtag\.js|gtm\/js|ns\.html)/ }],
      accountParam: 'id', eventParam: null,
      params: { id: 'Container / Tag ID', l: 'DataLayer Name' },
      cookies: []
    },
    {
      id: 'OPTIMIZE', name: 'Google Optimize', category: 'google', color: '#B366FF',
      match: [{ host: /(^|\.)optimize\.google\.com$|(^|\.)googleoptimize\.com$/ }],
      accountParam: null, eventParam: null, params: {}, cookies: []
    },
    {
      id: 'DOUBLECLICK', name: 'DoubleClick', category: 'google', color: '#FBBC04',
      match: [{ host: /(^|\.)doubleclick\.net$/ }],
      accountParam: null, eventParam: null,
      params: { gcs: 'Consent State (gcs)', gcd: 'Consent Default (gcd)' },
      cookies: []
    },

    // ---------------- Meta ----------------
    {
      id: 'META_PIXEL', name: 'Meta Pixel', category: 'social', color: '#1877F2',
      match: [
        { host: /(^|\.)facebook\.com$/, path: /^\/tr\/?$/ },
        { host: /(^|\.)connect\.facebook\.net$/ }
      ],
      exclude: (u) => u.searchParams.get('ev') === 'Microdata' || u.searchParams.get('ev') === 'microdata',
      accountParam: 'id', eventParam: 'ev',
      params: {
        id: 'Pixel ID', ev: 'Event Name', dl: 'Page URL', rl: 'Referrer', ts: 'Timestamp',
        eid: 'Event ID (CAPI dedup)', 'cd[value]': 'Value', 'cd[currency]': 'Currency',
        'cd[content_ids]': 'Content IDs', 'cd[content_type]': 'Content Type',
        'cd[contents]': 'Contents', 'cd[num_items]': 'Item Count', 'cd[search_string]': 'Search Query',
        'ud[em]': 'Email (Hashed)', 'ud[ph]': 'Phone (Hashed)', fbc: 'Click ID (fbc)', fbp: 'Browser ID (fbp)'
      },
      cookies: ['_fbp', '_fbc']
    },

    // ---------------- TikTok ----------------
    {
      id: 'TIKTOK_PIXEL', name: 'TikTok Pixel', category: 'social', color: '#FE2C55',
      match: [{ host: /(^|\.)analytics\.tiktok\.com$/ }],
      accountParam: 'sdkid', eventParam: 'event', bodyType: 'json',
      params: { sdkid: 'Pixel Code', event: 'Event Name' },
      cookies: ['_ttp'],
      // JSON POST body: {event, context:{pixel:{code}, ad:{...}}, properties:{...}}
      extractFromBody: function (body) {
        if (!body || typeof body !== 'object') return null;
        var first = Array.isArray(body.batch) ? body.batch[0] : body;
        if (!first || typeof first !== 'object') return null;
        var ctx = first.context || {};
        return {
          event: first.event || null,
          accountId: (ctx.pixel && ctx.pixel.code) || null,
          eventId: first.event_id || null
        };
      }
    },

    // ---------------- LinkedIn ----------------
    {
      id: 'LINKEDIN_PIXEL', name: 'LinkedIn Insight', category: 'social', color: '#0A66C2',
      match: [
        { host: /(^|\.)px\.ads\.linkedin\.com$/, path: /\/collect/ },
        { host: /(^|\.)snap\.licdn\.com$/ }
      ],
      accountParam: 'pid', eventParam: 'conversionId',
      params: { pid: 'Partner ID', conversionId: 'Conversion ID', fmt: 'Format', url: 'Page URL', time: 'Timestamp' },
      cookies: ['li_fat_id']
    },

    // ---------------- Adform ----------------
    {
      id: 'ADFORM', name: 'Adform', category: 'ads', color: '#0BA9E9',
      match: [
        { host: /(^|\.)track\.adform\.net$/, path: /\/serving\/trackpoint/i },
        { host: /(^|\.)(s1|s2)\.adform\.net$/ },
        { host: /(^|\.)adx\.adform\.net$/ }
      ],
      accountParam: 'pm', eventParam: 'ADFPageName',
      params: { pm: 'Tracking ID', ADFPageName: 'Tracking Point', ADFdivider: 'Divider', sales: 'Sales Value', orderid: 'Order ID', currency: 'Currency' },
      cookies: []
    },

    // ---------------- RTB House ----------------
    {
      id: 'RTB_HOUSE', name: 'RTB House', category: 'ads', color: '#FF5A00',
      match: [{ host: /(^|\.)creativecdn\.com$/ }],
      accountParam: 'id', eventParam: null,
      params: { id: 'Tag ID (pr_hash_event)', cd: 'Cookie Deal', uid: 'User ID' },
      cookies: [],
      // id=pr_{hash}_{eventSuffix} -> account 'pr_{hash}', event = suffix
      extract: function (u) {
        var id = u.searchParams.get('id');
        if (!id || id.indexOf('pr_') !== 0) return null;
        var parts = id.split('_');
        if (parts.length < 3) return { accountId: id, event: null };
        return { accountId: parts.slice(0, 2).join('_'), event: parts.slice(2).join('_') };
      }
    },

    // ---------------- Criteo ----------------
    {
      id: 'CRITEO', name: 'Criteo', category: 'ads', color: '#F48120',
      match: [
        { host: /(^|\.)sslwidget\.criteo\.com$/, path: /\/event/ },
        { host: /(^|\.)(static|dynamic)\.criteo\.(net|com)$/ }
      ],
      accountParam: 'a', eventParam: null,
      params: { a: 'Account ID', v: 'Tag Version', tld: 'Domain' },
      cookies: ['cto_bundle'],
      // events packed into p0..pN as URL-encoded JSON
      extract: function (u) {
        var events = [];
        u.searchParams.forEach(function (val, key) {
          if (/^p\d+$/.test(key)) {
            try {
              var obj = JSON.parse(val);
              if (obj && obj.event) events.push(obj.event);
            } catch (e) { /* not JSON */ }
          }
        });
        return events.length ? { event: events.join(', ') } : null;
      }
    },

    // ---------------- Microsoft / Bing UET ----------------
    {
      id: 'BING_UET', name: 'Microsoft UET', category: 'ads', color: '#00897B',
      match: [{ host: /(^|\.)bat\.bing\.com$/ }],
      accountParam: 'ti', eventParam: 'evt',
      params: { ti: 'Tag ID', evt: 'Event Type', ec: 'Event Category', ea: 'Event Action', el: 'Event Label', ev: 'Event Value', gv: 'Goal Revenue', gc: 'Currency', p: 'Page URL', spa: 'SPA Mode' },
      cookies: ['_uetsid', '_uetvid', '_uetmsclkid']
    },

    // ---------------- Pinterest ----------------
    {
      id: 'PINTEREST', name: 'Pinterest Tag', category: 'social', color: '#E60023',
      match: [
        { host: /(^|\.)ct\.pinterest\.com$/ },
        { host: /(^|\.)s\.pinimg\.com$/, path: /\/ct\// }
      ],
      accountParam: 'tid', eventParam: 'event',
      params: { tid: 'Tag ID', event: 'Event Name', pd: 'Page Data', ed: 'Event Data', cb: 'Cachebuster' },
      cookies: ['_pin_unauth', '_epik']
    },

    // ---------------- Snap ----------------
    {
      id: 'SNAP_PIXEL', name: 'Snap Pixel', category: 'social', color: '#FFFC00',
      match: [
        { host: /(^|\.)tr\.snapchat\.com$/ },
        { host: /(^|\.)sc-static\.net$/, path: /scevent/ }
      ],
      accountParam: 'pid', eventParam: 'ev',
      params: { pid: 'Pixel ID', ev: 'Event Name', pl: 'Page URL', rf: 'Referrer', u_hem: 'Email (Hashed)', u_hpn: 'Phone (Hashed)', e_cur: 'Currency', e_pr: 'Price', e_tid: 'Transaction ID' },
      cookies: ['_scid']
    },

    // ---------------- Twitter / X ----------------
    {
      id: 'TWITTER_PIXEL', name: 'X / Twitter Pixel', category: 'social', color: '#14171A',
      match: [
        { host: /(^|\.)analytics\.(twitter|x)\.com$|^t\.co$/, path: /\/i\/adsct/ },
        { host: /(^|\.)static\.ads-twitter\.com$/ }
      ],
      accountParam: 'txn_id', eventParam: null,
      params: { txn_id: 'Pixel ID', events: 'Events (JSON)', p_id: 'Platform', tw_sale_amount: 'Sale Amount', tw_order_quantity: 'Order Quantity', tw_document_href: 'Page URL', event_id: 'Event ID (dedup)' },
      cookies: ['_twclid']
    },

    // ---------------- Taboola ----------------
    {
      id: 'TABOOLA', name: 'Taboola', category: 'native', color: '#014E9E',
      match: [
        { host: /(^|\.)trc\.taboola\.com$/ },
        { host: /(^|\.)cdn\.taboola\.com$/, path: /\/libtrc\// }
      ],
      accountParam: null, eventParam: 'en',
      params: { en: 'Event Name', revenue: 'Revenue', currency: 'Currency', orderid: 'Order ID', quantity: 'Quantity' },
      cookies: [],
      // account id is the first path segment: trc.taboola.com/{account}/log/3/unip
      extract: function (u) {
        var m = u.pathname.match(/^\/([^/]+)\/log\//);
        return m ? { accountId: m[1] } : null;
      }
    },

    // ---------------- Outbrain ----------------
    {
      id: 'OUTBRAIN', name: 'Outbrain', category: 'native', color: '#F18421',
      match: [
        { host: /(^|\.)tr\.outbrain\.com$/ },
        { host: /(^|\.)amplify\.outbrain\.com$/ }
      ],
      accountParam: 'marketerId', eventParam: 'name',
      params: { marketerId: 'Marketer ID', name: 'Event Name', dl: 'Page URL', orderId: 'Order ID', orderValue: 'Order Value', currency: 'Currency', optOut: 'Opt-Out' },
      cookies: []
    }
  ];

  const TM_VENDOR_BY_ID = {};
  TM_VENDORS.forEach(function (v) { TM_VENDOR_BY_ID[v.id] = v; });

  // Aggregated first-party cookie prefixes across all vendors (+ sGTM cookies)
  const TM_TRACKING_COOKIE_PREFIXES = ['FPID', 'FPLC', '_gcl', '_gac'];
  TM_VENDORS.forEach(function (v) {
    (v.cookies || []).forEach(function (c) {
      if (TM_TRACKING_COOKIE_PREFIXES.indexOf(c) === -1) TM_TRACKING_COOKIE_PREFIXES.push(c);
    });
  });

  // Third-party domains whose cookies matter in the Cookies panel
  const TM_TRACKING_COOKIE_DOMAINS = [
    'google.com', 'doubleclick.net', 'facebook.com', 'tiktok.com', 'linkedin.com',
    'adform.net', 'creativecdn.com', 'criteo.com', 'bing.com', 'pinterest.com',
    'snapchat.com', 'twitter.com', 'x.com', 'taboola.com', 'outbrain.com'
  ];

  // Registrable-domain-ish comparison (last two labels; good enough for the
  // "is this request first-party to the page?" signal)
  function sameSite(hostA, hostB) {
    if (!hostA || !hostB) return false;
    var a = hostA.split('.').slice(-2).join('.');
    var b = hostB.split('.').slice(-2).join('.');
    return a === b;
  }

  /**
   * Classify a request URL against the vendor registry.
   * @param {string} url
   * @param {{initiator?: string}} [opts] initiator = page origin, used for the
   *        first-party (sGTM) signal.
   * @returns {null | {type, name, color, category, isServerSide, firstParty,
   *          accountId, event, eventId}}
   */
  function tmClassifyRequest(url, opts) {
    var u;
    try { u = new URL(url); } catch (e) { return null; }
    var host = u.hostname;
    var initiatorHost = null;
    if (opts && opts.initiator) {
      try { initiatorHost = new URL(opts.initiator).hostname; } catch (e) { /* opaque */ }
    }

    function result(vendor, isServerSide) {
      var accountId = vendor.accountParam ? u.searchParams.get(vendor.accountParam) : null;
      var event = vendor.eventParam ? u.searchParams.get(vendor.eventParam) : null;
      if (vendor.extract) {
        var extra = vendor.extract(u);
        if (extra) {
          if (extra.accountId) accountId = extra.accountId;
          if (extra.event) event = extra.event;
        }
      }
      return {
        type: vendor.id,
        name: vendor.name,
        color: vendor.color,
        category: vendor.category,
        isServerSide: !!isServerSide,
        firstParty: initiatorHost ? sameSite(host, initiatorHost) : false,
        accountId: accountId || null,
        event: event || null,
        eventId: u.searchParams.get('eid') || u.searchParams.get('event_id') || null
      };
    }

    // Pass 1: normal host(+path) matching
    for (var i = 0; i < TM_VENDORS.length; i++) {
      var vendor = TM_VENDORS[i];
      for (var j = 0; j < vendor.match.length; j++) {
        var rule = vendor.match[j];
        if (rule.host.test(host) && (!rule.path || rule.path.test(u.pathname))) {
          if (vendor.exclude && vendor.exclude(u)) continue;
          return result(vendor, false);
        }
      }
    }

    // Pass 2: sGTM / first-party proxy shapes (path-only, non-Google host)
    var isGoogleHost = /(^|\.)(google-analytics\.com|analytics\.google\.com|googletagmanager\.com|google\.com)$/.test(host);
    if (!isGoogleHost) {
      // GA4 routed through a server container (custom transport_url)
      if (/\/g\/collect|\/mp\/collect/.test(u.pathname) ||
        (u.searchParams.get('v') === '2' && /^G-/.test(u.searchParams.get('tid') || ''))) {
        var r = result(TM_VENDOR_BY_ID.GA4, true);
        r.type = 'GA4_SERVER_SIDE';
        r.name = 'GA4 (Server-Side)';
        return r;
      }
      // GTM web container / gtag loader served from a first-party domain
      var idParam = u.searchParams.get('id') || '';
      if ((/\/gtm\.js$/.test(u.pathname) && /^GTM-/.test(idParam)) ||
        (/\/gtag\/js$/.test(u.pathname) && /^(G|GT|AW|DC)-/.test(idParam))) {
        return result(TM_VENDOR_BY_ID.GTM, true);
      }
    }

    return null;
  }

  function tmIsTrackedRequest(url) {
    return tmClassifyRequest(url) !== null;
  }

  globalThis.TM_VENDORS = TM_VENDORS;
  globalThis.TM_VENDOR_BY_ID = TM_VENDOR_BY_ID;
  globalThis.TM_TRACKING_COOKIE_PREFIXES = TM_TRACKING_COOKIE_PREFIXES;
  globalThis.TM_TRACKING_COOKIE_DOMAINS = TM_TRACKING_COOKIE_DOMAINS;
  globalThis.tmClassifyRequest = tmClassifyRequest;
  globalThis.tmIsTrackedRequest = tmIsTrackedRequest;
})();
