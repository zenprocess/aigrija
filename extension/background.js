const API_BASE = 'https://ai-grija.ro';

// Create context menus on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'check-selection',
    title: 'Verifică cu ai-grija.ro',
    contexts: ['selection'],
  });

  chrome.contextMenus.create({
    id: 'check-link',
    title: 'Verifică link cu ai-grija.ro',
    contexts: ['link'],
  });
});

// Badge helpers
function setBadge(tabId, verdict) {
  const MAP = {
    phishing: { color: '#DC2626', text: '!' },
    suspicious: { color: '#F59E0B', text: '?' },
    safe: { color: '#16A34A', text: 'OK' },
  };
  const b = MAP[verdict] || { color: '#6B7280', text: '…' };
  chrome.action.setBadgeBackgroundColor({ color: b.color, tabId });
  chrome.action.setBadgeText({ text: b.text, tabId });
}

function setBadgeLoading(tabId) {
  chrome.action.setBadgeBackgroundColor({ color: '#2563EB', tabId });
  chrome.action.setBadgeText({ text: '…', tabId });
}

function clearBadge(tabId) {
  chrome.action.setBadgeText({ text: '', tabId });
}

// Main check function
async function checkContent(tabId, text, url) {
  setBadgeLoading(tabId);

  // Store loading state so popup can show it immediately
  await chrome.storage.local.set({
    lastResult: null,
    lastError: null,
    loading: true,
  });

  try {
    const body = {};
    if (text) body.text = text;
    if (url) body.url = url;

    const response = await fetch(`${API_BASE}/api/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    await chrome.storage.local.set({
      lastResult: result,
      lastError: null,
      loading: false,
      checkedText: text || null,
      checkedUrl: url || null,
    });

    setBadge(tabId, result.verdict);

    // Notify popup if open
    chrome.runtime.sendMessage({ type: 'RESULT_READY', result }).catch(() => {});

    // Notify content script for inline tooltip
    chrome.tabs.sendMessage(tabId, {
      type: 'SHOW_TOOLTIP',
      verdict: result.verdict,
      confidence: result.confidence,
    }).catch(() => {});

    // Open popup
    chrome.action.openPopup().catch(() => {});
  } catch (err) {
    const errorMsg = err.message || 'Eroare necunoscută';
    await chrome.storage.local.set({
      lastResult: null,
      lastError: errorMsg,
      loading: false,
    });
    clearBadge(tabId);
    chrome.runtime.sendMessage({ type: 'RESULT_ERROR', error: errorMsg }).catch(() => {});
    chrome.action.openPopup().catch(() => {});
  }
}

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;

  if (info.menuItemId === 'check-selection') {
    checkContent(tab.id, info.selectionText, null);
  } else if (info.menuItemId === 'check-link') {
    checkContent(tab.id, null, info.linkUrl);
  }
});
