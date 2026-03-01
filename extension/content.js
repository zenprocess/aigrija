(function () {
  'use strict';

  const VERDICT_CONFIG = {
    phishing: {
      bg: '#FEF2F2',
      border: '#DC2626',
      color: '#991B1B',
      icon: '🚨',
      label: 'PHISHING',
    },
    suspicious: {
      bg: '#FFFBEB',
      border: '#F59E0B',
      color: '#92400E',
      icon: '⚠️',
      label: 'SUSPECT',
    },
    safe: {
      bg: '#F0FDF4',
      border: '#16A34A',
      color: '#14532D',
      icon: '✅',
      label: 'SIGUR',
    },
  };

  let activeTooltip = null;
  let dismissTimer = null;

  function removeTooltip() {
    if (activeTooltip) {
      activeTooltip.remove();
      activeTooltip = null;
    }
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
  }

  function showTooltip(verdict, confidence) {
    removeTooltip();

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) return;

    const cfg = VERDICT_CONFIG[verdict];
    if (!cfg) return;

    const pct = Math.round((confidence ?? 0) * 100);

    const tooltip = document.createElement('div');
    tooltip.setAttribute('data-aigrija-tooltip', '1');
    tooltip.style.cssText = [
      'position:fixed',
      `top:${Math.max(8, rect.top - 60)}px`,
      `left:${Math.max(8, rect.left)}px`,
      `background:${cfg.bg}`,
      `border:1.5px solid ${cfg.border}`,
      `color:${cfg.color}`,
      'border-radius:8px',
      'padding:6px 10px',
      'font:600 13px/1.4 system-ui,sans-serif',
      'z-index:2147483647',
      'pointer-events:none',
      'box-shadow:0 4px 12px rgba(0,0,0,.15)',
      'max-width:260px',
      'white-space:nowrap',
    ].join(';');

    tooltip.textContent = `${cfg.icon} ${cfg.label} · ${pct}% siguranță — ai-grija.ro`;

    document.body.appendChild(tooltip);
    activeTooltip = tooltip;

    dismissTimer = setTimeout(removeTooltip, 5000);
  }

  // Listen for messages from the background service worker
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SHOW_TOOLTIP') {
      showTooltip(msg.verdict, msg.confidence);
    }
  });

  // Remove tooltip on next selection change
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (sel && sel.isCollapsed) {
      removeTooltip();
    }
  });
})();
