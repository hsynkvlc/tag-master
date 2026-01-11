# Swiss Knife for Google - Project Guide

## Overview
Professional Chrome extension for debugging Google Marketing Stack (GTM, GA4, Google Ads, Enhanced Conversions, Floodlight, Consent Mode V2).

## Tech Stack
- **Manifest**: Chrome Extension Manifest V3
- **Languages**: Vanilla JavaScript, HTML, CSS
- **Storage**: Chrome Storage API, IndexedDB
- **APIs**: webRequest, tabs, sidePanel, cookies

## Project Structure
```
├── manifest.json          # Extension configuration
├── background/
│   └── service-worker.js  # Background service worker
├── content/
│   ├── content-script.js  # Isolated world bridge
│   └── page-script.js     # MAIN world (dataLayer access)
├── sidepanel/
│   ├── sidepanel.html     # Main UI
│   ├── sidepanel.js       # UI logic (~2300 lines)
│   └── styles.css         # Styling with CSS variables
├── popup/
│   ├── popup.html         # Quick actions popup
│   └── popup.js
├── devtools/
│   ├── devtools.html
│   └── devtools.js
├── shared/
│   ├── constants.js       # Patterns, schemas, defaults
│   └── utils.js           # Utility functions
└── icons/                 # Extension icons
```

## Key Features
1. **GTM Injector** - Inject/remove GTM containers
2. **DataLayer Monitor** - Real-time event tracking with GA4 schema validation
3. **Network Inspector** - Google request monitoring (GA4, Ads, Floodlight)
4. **Audit Panel** - Compliance checks
5. **Consent Mode V2** - Consent state debugging
6. **Element Picker** - CSS selector generator for GTM variables
7. **Event Timeline** - Visual timeline of events
8. **Real-time Alerts** - Notification for validation errors

## Design System
- **Theme**: Dark/Light toggle support
- **Colors**: Google brand colors as accents
- **Typography**: System fonts for UI, monospace for code
- **Components**: Cards, buttons, tabs, toasts, modals

## Skills Available
- `/frontend-design` - Create distinctive UI components

## Development Notes
- CSP restrictions: No external CDN scripts
- Message passing: sidepanel <-> service-worker <-> content-script <-> page-script
- Tab-specific storage: `tabEvents[tabId]`, `tabRequests[tabId]`
