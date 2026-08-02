# Tag Master

**Debug every tag on the page, not just Google's.**

Tag Master is a Chrome extension for people who implement and verify tracking. It decodes tracking
requests from 42 analytics and advertising platforms in one side panel, recognises hits routed through
server-side GTM, and reports which vendors kept firing after consent was denied.

<a href="https://www.producthunt.com/products/tag-master?embed=true&amp;utm_source=badge-featured&amp;utm_medium=badge&amp;utm_campaign=badge-tag-master" target="_blank" rel="noopener noreferrer"><img alt="Tag Master on Product Hunt" width="125" height="27" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1085251&amp;theme=light&amp;t=1772058972881"></a>

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.5.0-green.svg)
![Platform](https://img.shields.io/badge/platform-Chrome_Extension-orange.svg)
![Manifest](https://img.shields.io/badge/manifest-v3-blueviolet.svg)

[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/tag-master/lemnndbboekafiammkmfbldomlepigko) · [tagmaster.dev](https://tagmaster.dev)

---

## What it does

### Network inspector, 42 platforms
Every tracking request is decoded into readable parameters — account ID, event name, value, currency —
instead of a raw query string. Google Analytics 4, Google Ads, GTM, Floodlight, Meta, TikTok, LinkedIn,
Criteo, Adform, RTB House, Microsoft UET, Pinterest, Snap, X Ads, Taboola, Outbrain, Reddit, Quora,
Adobe Analytics, Adobe Launch, Tealium, Segment, Amplitude, Mixpanel, Matomo, Piwik PRO, Yandex Metrica,
Hotjar, Microsoft Clarity, FullStory, Heap, Plausible, Klaviyo, HubSpot, Braze, Optimizely, VWO, Awin.

Enhanced Conversions are checked for SHA-256 hashing, and Meta hits carrying `eid` are flagged as ready
for CAPI deduplication. Captured sessions export as HAR, JSON or CSV.

### Server-side GTM
Requests are matched by path rather than hostname, so GA4 hits proxied through a first-party endpoint
(`sst.yoursite.com/g/collect`) are still recognised, labelled and decoded. Paste your server container's
`X-Gtm-Server-Preview` token and requests from your browser appear in its preview session.

### Consent Mode V2 audit
Live state for all four signals, `gcs` and `gcd` decoded per hit, and a report listing every vendor that
kept sending data while ad consent was denied — the case Consent Mode itself does not cover, because
non-Google platforms never read those signals.

### Platform debug modes
Google has Tag Assistant and DebugView. Other platforms have their own equivalents, and Tag Master turns
them on for the site in the active tab:

| Platform | What it switches on |
|---|---|
| TikTok | Test Events (`tt_test_id`) |
| Snap | Test Events (`_scTestEvent`, one hour) |
| Microsoft UET | UET debug beacons (`_uetdbg`) |
| Tealium | utag debug console (`utagdb`) |
| Yandex Metrica | On-page debug panel (`_ym_debug`) |
| Hotjar | Debug logging (`hjDebug`) |
| Criteo | Tag debug mode |
| Adobe Launch | `_satellite` debug |

### Hit blocker
Block any vendor's requests so test traffic never reaches production analytics. Blocked hits are still
listed, so you can see what would have been sent. GA4 DebugView mode is one toggle away.

### GTM injector
Inject any container into any page. The injection persists across reloads, and with one click Tag
Assistant opens ready to connect. Snippets you paste are saved per container ID, so you paste once and
reuse from a list. Works under Manifest V3.

### Visual trigger builder
Click any element and get a ready-to-paste GTM recipe: a stable CSS selector, condition options with copy
buttons, and a Custom JavaScript variable that extracts prices automatically. The picker climbs to the
clickable parent and skips unstable utility classes.

### Also included
dataLayer monitor with GA4 e-commerce schema validation, cookie inspector, CSP compatibility check,
technology detection (e-commerce platform, CMP, frameworks) and a one-click tracking audit.

---

## Privacy

No account, no login, no telemetry, no external server. Captured sessions are stored locally in the
browser and never leave the device. Full policy: [tagmaster.dev/privacy](https://tagmaster.dev/privacy).

---

## Install

**Chrome Web Store:** [Tag Master](https://chromewebstore.google.com/detail/tag-master/lemnndbboekafiammkmfbldomlepigko)

**From source:**
```bash
git clone https://github.com/hsynkvlc/tag-master.git
```
Open `chrome://extensions/`, enable Developer mode, choose **Load unpacked** and select the folder.

Requires Chrome 116 or later.

---

## How it is built

Manifest V3, vanilla JavaScript, no build step. The content script runs in the isolated world and bridges
to a page script in the MAIN world, which is what makes `dataLayer` interception and GTM injection
possible under MV3.

Vendor knowledge lives in one declarative registry (`shared/vendors.js`): each platform declares its host
and path patterns, account parameter, parameter dictionary, cookies and blocking rules. Adding a platform
means adding one entry — the network panel, hit blocker, audit and cookie filter all read from it.

```
tag-master/
  manifest.json
  background/
    service-worker.js     Request capture, blocking rules, debug modes
  content/
    content-script.js     Isolated world, bridge between page and extension
    page-script.js        MAIN world, dataLayer and GTM injection
  sidepanel/
    sidepanel.html/.js    Main UI
    styles.css
  popup/
  shared/
    vendors.js            Vendor registry, blocking rules, debug modes
    constants.js          GA4 parameters and event schemas
    utils.js              Validation helpers
  docs/
    expansion-roadmap.md  Vendor and sGTM coverage plan
    growth-plan.md        Positioning, store listing, distribution
```

---

## Permissions

| Permission | Why |
|---|---|
| `storage`, `unlimitedStorage` | Preferences and captured sessions, stored locally |
| `tabs`, `activeTab` | Identify the tab being debugged; user-invoked actions |
| `scripting` | Inject the detection scripts and GTM containers |
| `sidePanel` | The main interface |
| `cookies` | Show tracking cookies; write the debug-mode cookies you enable |
| `webRequest` | Read tracking requests to display them |
| `webNavigation` | Attribute events to page navigations |
| `declarativeNetRequest` | Hit blocker, GA4 DebugView, sGTM preview header |
| `<all_urls>` | Debugging has to work on whichever site you are inspecting |

---

## Support

[Buy Me a Coffee](https://buymeacoffee.com/tagmaster)

## License

MIT — see [LICENSE](LICENSE).

Built by [hsynkvlc](https://github.com/hsynkvlc).
