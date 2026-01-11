/**
 * Tag Master - DevTools Entry Point
 */

// Create the DevTools panel
chrome.devtools.panels.create(
  'Tag Master',
  '../assets/icons/icon32.png',
  'panel.html',
  (panel) => {
    console.log('[Tag Master] DevTools panel created');

    // Panel shown callback
    panel.onShown.addListener((window) => {
      console.log('[Tag Master] Panel shown');
    });

    // Panel hidden callback
    panel.onHidden.addListener(() => {
      console.log('[Tag Master] Panel hidden');
    });
  }
);
