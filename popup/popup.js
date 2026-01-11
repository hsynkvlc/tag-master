/**
 * Swiss Knife for Google - Popup Script
 */

document.addEventListener('DOMContentLoaded', () => {
  // Open Side Panel
  document.getElementById('openSidePanel').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      await chrome.sidePanel.open({ tabId: tab.id });
      window.close();
    }
  });

  // Open DevTools hint
  document.getElementById('openDevTools').addEventListener('click', () => {
    alert('Press F12 to open DevTools, then navigate to the "Swiss Knife" tab.');
    window.close();
  });
});
