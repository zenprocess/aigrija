const API_BASE = 'https://ai-grija.ro';

const VERDICT_META = {
  phishing: {
    label: 'PHISHING — Pericol ridicat',
    icon: '🚨',
    barColor: '#DC2626',
    className: 'phishing',
  },
  suspicious: {
    label: 'SUSPECT — Fii precaut',
    icon: '⚠️',
    barColor: '#F59E0B',
    className: 'suspicious',
  },
  safe: {
    label: 'SIGUR — Nicio amenințare detectată',
    icon: '✅',
    barColor: '#16A34A',
    className: 'safe',
  },
};

function showState(name) {
  for (const id of ['idle', 'loading', 'error', 'result']) {
    document.getElementById(`state-${id}`).classList.add('hidden');
  }
  document.getElementById(`state-${name}`).classList.remove('hidden');
}

function renderResult(result, checkedText, checkedUrl) {
  const meta = VERDICT_META[result.verdict] || {
    label: result.verdict,
    icon: '🔍',
    barColor: '#6B7280',
    className: '',
  };

  const card = document.getElementById('verdict-card');
  card.className = `verdict-card ${meta.className}`;

  document.getElementById('verdict-icon').textContent = meta.icon;

  const labelEl = document.getElementById('verdict-label');
  labelEl.textContent = meta.label;
  labelEl.className = `verdict-label ${meta.className}`;

  const pct = Math.round((result.confidence ?? 0) * 100);
  const bar = document.getElementById('confidence-bar');
  bar.style.setProperty('--pct', `${pct}%`);
  bar.style.setProperty('--bar-color', meta.barColor);
  document.getElementById('confidence-pct').textContent = `${pct}% siguranță`;

  // Scam type
  const scamRow = document.getElementById('scam-type-row');
  if (result.scam_type) {
    document.getElementById('scam-type').textContent = result.scam_type;
    scamRow.classList.remove('hidden');
  } else {
    scamRow.classList.add('hidden');
  }

  // Explanation
  document.getElementById('explanation').textContent =
    result.explanation || 'Nicio explicație disponibilă.';

  // Red flags
  const flagsSection = document.getElementById('red-flags-section');
  const flagsList = document.getElementById('red-flags-list');
  if (result.red_flags && result.red_flags.length > 0) {
    flagsList.innerHTML = result.red_flags
      .map((f) => `<li>${escapeHtml(f)}</li>`)
      .join('');
    flagsSection.classList.remove('hidden');
  } else {
    flagsSection.classList.add('hidden');
  }

  // Checked content preview
  const checkedSection = document.getElementById('checked-content');
  const checkedEl = document.getElementById('checked-text');
  const preview = checkedText || checkedUrl;
  if (preview) {
    checkedEl.textContent = preview;
    checkedSection.classList.remove('hidden');
  } else {
    checkedSection.classList.add('hidden');
  }

  // Full analysis link
  const params = new URLSearchParams();
  if (checkedText) params.set('text', checkedText.substring(0, 500));
  if (checkedUrl) params.set('url', checkedUrl);
  document.getElementById('open-full-link').href =
    `${API_BASE}/?${params.toString()}`;

  showState('result');
}

function renderError(msg) {
  document.getElementById('error-msg').textContent =
    msg || 'Eroare de conexiune. Încearcă din nou.';
  showState('error');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function loadState() {
  const data = await chrome.storage.local.get([
    'loading',
    'lastResult',
    'lastError',
    'checkedText',
    'checkedUrl',
  ]);

  if (data.loading) {
    showState('loading');
    return;
  }

  if (data.lastError) {
    renderError(data.lastError);
    return;
  }

  if (data.lastResult) {
    renderResult(data.lastResult, data.checkedText, data.checkedUrl);
    return;
  }

  showState('idle');
}

// Retry button — clear error and trigger re-check from storage
document.getElementById('retry-btn').addEventListener('click', async () => {
  const data = await chrome.storage.local.get(['checkedText', 'checkedUrl']);
  if (!data.checkedText && !data.checkedUrl) {
    showState('idle');
    return;
  }

  showState('loading');
  await chrome.storage.local.set({ loading: true, lastError: null, lastResult: null });

  try {
    const body = {};
    if (data.checkedText) body.text = data.checkedText;
    if (data.checkedUrl) body.url = data.checkedUrl;

    const response = await fetch(`${API_BASE}/api/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    await chrome.storage.local.set({ lastResult: result, loading: false, lastError: null });
    renderResult(result, data.checkedText, data.checkedUrl);
  } catch (err) {
    await chrome.storage.local.set({ loading: false, lastError: err.message, lastResult: null });
    renderError(err.message);
  }
});

// Listen for live updates from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'RESULT_READY') {
    chrome.storage.local.get(['checkedText', 'checkedUrl'], (data) => {
      renderResult(msg.result, data.checkedText, data.checkedUrl);
    });
  } else if (msg.type === 'RESULT_ERROR') {
    renderError(msg.error);
  }
});

// Init
loadState();
