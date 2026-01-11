# 🛠️ Swiss Knife for Google

**Professional toolkit for GTM Experts, Marketing Analysts, and Web Developers.**

Swiss Knife for Google is a powerful Chrome Extension designed to streamline the implementation, debugging, and auditing of Google Tag Manager (GTM) and Google Analytics 4 (GA4).

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.2.0-green.svg)
![Type](https://img.shields.io/badge/platform-Chrome_Extension-orange.svg)

---

## ✨ Key Features

### 💉 GTM Environment Injector
- Inject any GTM container into any website instantly.
- **Persistence:** Keep the container active across page reloads.
- **Preview Mode:** Enable GTM debugging without forcing environments via URL.
- **Recent IDs:** Quick access to your most-used GTM containers.

### 🕵️ DataLayer Monitor
- Real-time tracking of all `dataLayer.push` events.
- **Validation:** Automatic warnings for missing mandatory ecommerce fields (items, transaction_id, etc.).
- **Search & Filter:** Find specific events in seconds.
- **Export:** Save your event history as JSON or CSV.

### 🎯 Element Picker & Variable Builder
- Select elements on the page to instantly generate GTM Custom JS variables.
- **Robust Selector Engine:** Uses IDs, data-attributes, and unique paths to ensure stable selectors.
- **Live Testing:** Execute code directly within the extension to verify values before moving to GTM.

### 📡 Network Inspector (Martech Focused)
- Filtered list showing only relevant Google tracking requests (GA4, GTM, Ads).
- Detect **Server-Side** hits and **Enhanced Conversions**.
- Detailed query parameter breakdown.

### 🍪 Cookie Manager
- List and manage tracking cookies.
- One-click deletion of Google tracking cookies (`_ga`, `_gid`, `_fbp`, etc.).

### ⚖️ Compliance Audit
- Scan the page for Martech compliance and implementation gaps.
- Verify GTM/GA4 container health.

---

## 🎨 Professional UI
- **Modern Design:** Sleek glassmorphism aesthetics.
- **Light/Dark Mode:** Seamlessly switch between themes based on your preference.
- **Responsive Navigation:** Optimized for side panel usage.

---

## 🚀 Installation

1. Clone this repository: `git clone https://github.com/hsynkvlc/google-swiss-knife.git`
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the root folder of this project.

---

## 🛠️ Technology Stack
- **Frontend:** Vanilla JavaScript, HTML5, CSS3.
- **APIs:** Chrome Extension Manifest V3 (SidePanel, Cookies, Scripting, Storage).
- **Architecture:** Decoupled Content-Main world communication for deep DataLayer access.

---

## ☕ Support the Project
If you find this tool helpful, consider supporting its development:
- [Buy Me a Coffee](https://www.buymeacoffee.com/yourprofile)

---

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.

Developed with ❤️ by **Hüseyin**
