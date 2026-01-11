const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('🔍 Debugging Container Detection...\n');

  const extensionPath = path.resolve(__dirname, '..');

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      '--disable-extensions-except=' + extensionPath,
      '--load-extension=' + extensionPath,
    ],
  });

  await new Promise(r => setTimeout(r, 2000));

  let extensionId;
  const workers = context.serviceWorkers();
  for (const worker of workers) {
    if (worker.url().includes('chrome-extension://')) {
      extensionId = worker.url().split('/')[2];
    }
  }
  console.log('Extension ID:', extensionId);

  // Go to a site with GTM
  const page = await context.newPage();

  // Listen to console
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Tag Master') || text.includes('GTM') || text.includes('Error')) {
      console.log('[Page Console]', text);
    }
  });

  console.log('\n📍 Going to tagmanager.google.com...');
  await page.goto('https://tagmanager.google.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  // Check page state
  console.log('\n📋 Checking page state...');
  const pageState = await page.evaluate(() => {
    return {
      hasDataLayer: Array.isArray(window.dataLayer),
      dataLayerLength: window.dataLayer ? window.dataLayer.length : 0,
      hasGTM: typeof window.google_tag_manager !== 'undefined',
      gtmKeys: window.google_tag_manager ? Object.keys(window.google_tag_manager) : [],
      hasSwissKnife: typeof window.__swissKnife !== 'undefined',
      url: window.location.href
    };
  });

  console.log('  URL:', pageState.url);
  console.log('  dataLayer exists:', pageState.hasDataLayer);
  console.log('  dataLayer length:', pageState.dataLayerLength);
  console.log('  google_tag_manager exists:', pageState.hasGTM);
  console.log('  GTM keys:', pageState.gtmKeys.length > 0 ? pageState.gtmKeys.join(', ') : 'none');
  console.log('  Tag Master injected:', pageState.hasSwissKnife);

  // Try sending message to content script
  console.log('\n📋 Testing message to content script...');

  try {
    const result = await page.evaluate(() => {
      return new Promise((resolve) => {
        // Try to detect GTM directly
        const containers = [];

        if (window.google_tag_manager) {
          for (const key in window.google_tag_manager) {
            if (key.startsWith('GTM-') || key.startsWith('G-')) {
              containers.push({ id: key, type: key.startsWith('GTM-') ? 'GTM' : 'GA4' });
            }
          }
        }

        // Check for GTM scripts
        document.querySelectorAll('script[src*="googletagmanager.com"]').forEach(script => {
          const match = script.src.match(/[?&]id=(GTM-[A-Z0-9]+|G-[A-Z0-9]+)/);
          if (match && !containers.find(c => c.id === match[1])) {
            containers.push({ id: match[1], type: match[1].startsWith('GTM-') ? 'GTM' : 'GA4', source: 'script' });
          }
        });

        resolve(containers);
      });
    });

    console.log('  Containers found directly:', JSON.stringify(result));
  } catch (e) {
    console.log('  Error:', e.message);
  }

  // Open side panel
  console.log('\n📋 Opening Side Panel...');
  const sidePanelPage = await context.newPage();

  sidePanelPage.on('console', msg => {
    console.log('[SidePanel]', msg.type(), msg.text());
  });

  await sidePanelPage.goto('chrome-extension://' + extensionId + '/sidepanel/sidepanel.html');
  await sidePanelPage.waitForTimeout(2000);

  // Check what detectContainers returns
  console.log('\n📋 Checking detectContainers function...');

  const containerListHTML = await sidePanelPage.evaluate(() => {
    return document.getElementById('containerList').innerHTML;
  });
  console.log('Container List HTML:', containerListHTML.substring(0, 300));

  // Try clicking refresh
  console.log('\n📋 Clicking Refresh...');
  await sidePanelPage.click('#refreshContainers');
  await sidePanelPage.waitForTimeout(2000);

  const containerListHTML2 = await sidePanelPage.evaluate(() => {
    return document.getElementById('containerList').innerHTML;
  });
  console.log('After Refresh:', containerListHTML2.substring(0, 300));

  console.log('\n⏳ Browser stays open for 15 seconds...');
  await page.waitForTimeout(15000);
  await context.close();
})().catch(console.error);
