/**
 * Tag Master - Popup Script
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

  // Instant Generation from Highlight
  initHighlightCapture();

  async function initHighlightCapture() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && !tab.url.startsWith('chrome://')) {
      chrome.tabs.sendMessage(tab.id, { type: 'SELECTOR_FROM_HIGHLIGHT' }).catch(() => { });
    }
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SELECTOR_RESULT' && message.payload && !message.payload.error) {
      const { selector, tagName } = message.payload;
      const getter = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName) ? 'el.value' : 'el.innerText';
      const gtmCode = `function() {\n  var el = document.querySelector('${selector}');\n  return el ? ${getter} : undefined;\n}`;

      const resDiv = document.getElementById('selectionResult');
      const codePre = document.getElementById('popupJsVar');
      if (resDiv && codePre) {
        resDiv.style.display = 'block';
        codePre.textContent = gtmCode;
      }
    }
  });

  const copyBtn = document.getElementById('copyPopupJs');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const code = document.getElementById('popupJsVar').textContent;
      navigator.clipboard.writeText(code).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = 'Copy to Clipboard', 2000);
      });
    });
  }

  // Open DevTools hint
  document.getElementById('openDevTools').addEventListener('click', () => {
    alert('Press F12 to open DevTools, then navigate to the "Tag Master" tab.');
    window.close();
  });
});
