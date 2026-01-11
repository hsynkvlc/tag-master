/**
 * Swiss Knife for Google - DevTools Entry Point
 */

// Create the DevTools panel
chrome.devtools.panels.create(
  'Swiss Knife',
  '../assets/icons/icon32.png',
  'panel.html',
  (panel) => {
    console.log('[Swiss Knife] DevTools panel created');

    // Panel shown callback
    panel.onShown.addListener((window) => {
      console.log('[Swiss Knife] Panel shown');
    });

    // Panel hidden callback
    panel.onHidden.addListener(() => {
      console.log('[Swiss Knife] Panel hidden');
    });
  }
);
