import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { fetchCounter } from '../utils/api';
import { useTranslation } from '../i18n/index.jsx';

function padCenter(text, width) {
  const pad = Math.max(0, width - text.length);
  const left = Math.floor(pad / 2);
  const right = pad - left;
  return ' '.repeat(left) + text + ' '.repeat(right);
}

function repeat(ch, n) { return ch.repeat(Math.max(0, n)); }

function padRight(text, width) {
  return text + ' '.repeat(Math.max(0, width - text.length));
}

function buildShieldLines(t) {
  const W = 52;
  const bar = repeat('─', W);
  const v = t('hero.shield_verify') || 'VERIFICA';
  const r = t('hero.shield_report') || 'RAPORTEAZA';
  const p = t('hero.shield_protect') || 'PROTEJEAZA-TE';
  return [
    '┌' + bar + '┐',
    '│ ' + padRight('$ ai-grija --scan mesaj-suspect.txt', W - 2) + ' │',
    '│' + repeat(' ', W) + '│',
    '│ ' + padRight('⠋ Se analizeaza mesajul...', W - 2) + ' │',
    '│ ' + padRight('✓ Date personale mascate (CNP, IBAN)', W - 2) + ' │',
    '│ ' + padRight('✓ Campanie de phishing identificata', W - 2) + ' │',
    '│ ' + padRight('✓ Domeniu suspect detectat', W - 2) + ' │',
    '│' + repeat(' ', W) + '│',
    '│ ┌' + repeat('─', W - 4) + '┐ │',
    '│ │  ⚠  PHISHING DETECTAT' + repeat(' ', W - 26) + '│ │',
    '│ │  Incredere: 94%' + repeat(' ', W - 20) + '│ │',
    '│ │  ' + padRight('» ' + v, W - 6) + '│ │',
    '│ │  ' + padRight('» ' + r, W - 6) + '│ │',
    '│ │  ' + padRight('» ' + p, W - 6) + '│ │',
    '│ └' + repeat('─', W - 4) + '┘ │',
    '│' + repeat(' ', W) + '│',
    '│ ' + padRight('$ _', W - 2) + ' │',
    '└' + bar + '┘',
  ];
}

function buildMobileShieldLines(t) {
  const W = 36;
  const bar = repeat('─', W);
  const v = t('hero.shield_mobile_verify') || 'VERIFICA';
  const p = t('hero.shield_mobile_protect') || 'PROTEJEAZA';
  return [
    '┌' + bar + '┐',
    '│ ' + padRight('$ ai-grija --scan', W - 2) + ' │',
    '│' + repeat(' ', W) + '│',
    '│ ' + padRight('✓ Date mascate', W - 2) + ' │',
    '│ ' + padRight('✓ Campanie identificata', W - 2) + ' │',
    '│ ' + padRight('✓ Domeniu suspect', W - 2) + ' │',
    '│' + repeat(' ', W) + '│',
    '│ ┌' + repeat('─', W - 4) + '┐ │',
    '│ │ ⚠ PHISHING' + repeat(' ', W - 15) + '│ │',
    '│ │ Incredere: 94%' + repeat(' ', W - 19) + '│ │',
    '│ │ » ' + padRight(v, W - 7) + '│ │',
    '│ │ » ' + padRight(p, W - 7) + '│ │',
    '│ └' + repeat('─', W - 4) + '┘ │',
    '│ ' + padRight('$ _', W - 2) + ' │',
    '└' + bar + '┘',
  ];
}

const NOISE_CHARS = ['░','▒','▓','╔','╗','╚','╝','║','═','◆','●','◉','▲','■','╬','╠','╣','◈','◇','▪','┌','┐','└','┘','─','│'];

function getCharColor(col, cols, cellT) {
  const brightness = 0.6 + (col / cols) * 0.4;
  const base = Math.round(197 * brightness);
  const alpha = 0.3 + cellT * 0.7;
  return { r: 34, g: base, b: Math.round(94 * brightness), alpha };
}

function buildTargetCells(lines) {
  const cells = [];
  lines.forEach((line, row) => {
    for (let col = 0; col < line.length; col++) {
      if (line[col] !== ' ') cells.push({ row, col, char: line[col] });
    }
  });
  return cells;
}

function AsciiShield({ isMobile, t }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const lines = isMobile ? buildMobileShieldLines(t) : buildShieldLines(t);
    const targetCells = buildTargetCells(lines);
    const ROWS = lines.length;
    const COLS = Math.max(...lines.map(l => l.length));

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const fontSize = isMobile ? 10 : 13;
    const lineHeight = fontSize * 1.6;

    ctx.font = fontSize + "px 'Courier New', monospace";
    const charWidth = ctx.measureText('M').width;

    canvas.width = Math.ceil(COLS * charWidth);
    canvas.height = Math.ceil(ROWS * lineHeight);

    const ANIM_DURATION = 2400;
    let finished = false;

    function rnd() {
      return NOISE_CHARS[Math.floor(Math.random() * NOISE_CHARS.length)];
    }

    function draw(ts) {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const globalT = Math.min(elapsed / ANIM_DURATION, 1);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = fontSize + "px 'Courier New', monospace";

      let allSettled = true;

      targetCells.forEach(function(cell, idx) {
        const row = cell.row, col = cell.col, char = cell.char;
        const delay = (idx / targetCells.length) * 0.5;
        const cellT = Math.max(0, Math.min((globalT - delay) / 0.5, 1));

        if (cellT < 1) allSettled = false;

        const displayChar = cellT >= 0.85 ? char : (cellT > 0 ? rnd() : ' ');
        const c = getCharColor(col, COLS, cellT);

        if (cellT >= 1) {
          ctx.shadowColor = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',0.6)';
          ctx.shadowBlur = 4;
        } else if (cellT > 0) {
          ctx.shadowColor = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',0.2)';
          ctx.shadowBlur = 2;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + c.alpha + ')';
        ctx.fillText(displayChar, col * charWidth, (row + 1) * lineHeight - 3);
      });

      ctx.shadowBlur = 0;

      if (!allSettled) {
        rafRef.current = requestAnimationFrame(draw);
      } else if (!finished) {
        finished = true;
        setDone(true);
      }
    }

    rafRef.current = requestAnimationFrame(draw);
    return function() { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isMobile, t]);

  return (
    React.createElement('div', {
      'data-testid': 'hero-ascii-shield',
      className: 'relative flex items-center justify-center select-none overflow-hidden w-full',
      'aria-label': 'Scut AI-GRIJA animat',
      role: 'img',
    },
      React.createElement('div', {
        className: 'absolute inset-0 pointer-events-none',
        style: { background: 'radial-gradient(ellipse at center, rgba(34,197,94,0.08) 0%, transparent 70%)', filter: 'blur(20px)' },
      }),
      React.createElement('canvas', { ref: canvasRef, className: 'relative z-10 max-w-full' }),
      React.createElement('div', {
        className: 'absolute inset-0 pointer-events-none z-20',
        style: { backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.07) 2px, rgba(0,0,0,0.07) 4px)' },
      }),
      React.createElement('div', {
        className: 'absolute bottom-0 left-0 right-0 z-30 flex justify-between px-2',
        style: { opacity: done ? 1 : 0, transition: 'opacity 0.6s ease-in', transitionDelay: '0.2s' },
      },
        React.createElement('span', { className: 'text-xs font-mono text-green-500/50' }, '[01] INIT'),
        React.createElement('span', { className: 'text-xs font-mono text-green-500/50' }, '[02] SECURE')
      )
    )
  );
}

function CornerAccents() {
  const cls = 'absolute w-6 h-6 border-green-500/30';
  return React.createElement(React.Fragment, null,
    React.createElement('div', { className: cls + ' top-4 left-4 border-t-2 border-l-2' }),
    React.createElement('div', { className: cls + ' top-4 right-4 border-t-2 border-r-2' }),
    React.createElement('div', { className: cls + ' bottom-4 left-4 border-b-2 border-l-2' }),
    React.createElement('div', { className: cls + ' bottom-4 right-4 border-b-2 border-r-2' })
  );
}

export default function HeroAscii() {
  const { t, lang } = useTranslation();
  const [count, setCount] = useState(0);
  const [targetCount, setTargetCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(function() {
    var check = function() { setIsMobile(window.innerWidth < 640); };
    check();
    window.addEventListener('resize', check);
    return function() { window.removeEventListener('resize', check); };
  }, []);

  useEffect(function() {
    fetchCounter().then(function(data) {
      if (data && data.count) setTargetCount(data.count);
    });
  }, []);

  useEffect(function() {
    if (targetCount === 0) return;
    var start = 0;
    var duration = 2000;
    var increment = targetCount / (duration / 16);
    var timer = setInterval(function() {
      start += increment;
      if (start >= targetCount) { setCount(targetCount); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return function() { clearInterval(timer); };
  }, [targetCount]);

  var scrollToChecker = function() {
    var el = document.getElementById('verifica');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    React.createElement(React.Fragment, null,
      React.createElement('style', null, `
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        @keyframes hero-fade-up { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .haf { animation: hero-fade-up 0.7s ease-out both; }
        .haf1 { animation: hero-fade-up 0.7s ease-out 0.15s both; }
        .haf2 { animation: hero-fade-up 0.7s ease-out 0.3s both; }
        .haf3 { animation: hero-fade-up 0.7s ease-out 0.45s both; }
        .blink-cursor { display:inline-block;width:2px;height:14px;background:#4ade80;margin-left:4px;vertical-align:middle;animation:blink 1s step-end infinite; }
      `),
      React.createElement('section', {
        'data-testid': 'hero-ascii-section',
        className: 'relative min-h-[60vh] flex items-center justify-center pt-12 overflow-hidden bg-gray-950',
      },
        React.createElement(CornerAccents),
        React.createElement('div', {
          className: 'absolute inset-x-0 top-0 h-px bg-green-400/10 pointer-events-none z-0',
          style: { animation: 'scanline 8s linear infinite' },
        }),
        React.createElement('div', {
          className: 'absolute inset-0 pointer-events-none',
          style: { background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(34,197,94,0.05) 0%, transparent 70%)' },
        }),
        React.createElement('div', {
          className: 'relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center',
        },
          React.createElement('div', {
            'data-testid': 'hero-terminal-header',
            className: 'inline-flex items-center gap-3 px-4 py-1.5 mb-6 rounded font-mono text-xs border border-green-500/20 bg-green-500/5 haf',
          },
            React.createElement('span', { className: 'flex items-center gap-1.5' },
              React.createElement('span', { className: 'w-2 h-2 rounded-full bg-red-500/70' }),
              React.createElement('span', { className: 'w-2 h-2 rounded-full bg-yellow-500/70' }),
              React.createElement('span', { className: 'w-2 h-2 rounded-full bg-green-500/70' })
            ),
            React.createElement('span', { className: 'text-green-400/70 tracking-widest' }, 'terminal :: ai-grija.ro'),
            React.createElement('span', { className: 'blink-cursor' })
          ),

          React.createElement('div', { className: 'haf1' },
            React.createElement('div', {
              'data-testid': 'hero-counter-badge',
              className: 'inline-flex items-center gap-2 px-3 py-1 rounded-full border border-green-500/20 bg-green-500/5 mb-6',
            },
              React.createElement('span', { className: 'flex h-2 w-2 relative' },
                React.createElement('span', { className: 'animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75' }),
                React.createElement('span', { className: 'relative inline-flex rounded-full h-2 w-2 bg-green-500' })
              ),
              React.createElement('span', { className: 'text-xs font-mono text-green-400/80' },
                count > 0
                  ? t('hero.counter_done', { count: count.toLocaleString(lang === 'ro' ? 'ro-RO' : undefined) })
                  : t('hero.counter_loading')
              )
            )
          ),

          React.createElement('div', { className: 'mb-8 haf1' },
            React.createElement(AsciiShield, { isMobile: isMobile, t: t })
          ),

          React.createElement('div', { className: 'haf2' },
            React.createElement('h1', {
              className: 'text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight mb-4 font-mono',
            },
              React.createElement('span', { className: 'text-green-400' }, '> '),
              React.createElement('span', { className: 'text-white' }, t('hero.title_main')),
              React.createElement('span', { className: 'text-green-400' }, t('hero.title_highlight'))
            ),
            React.createElement('p', {
              className: 'text-base sm:text-xl md:text-2xl text-gray-400 mb-12 md:mb-16 max-w-2xl mx-auto leading-relaxed font-mono',
            },
              React.createElement('span', { className: 'text-green-500/60' }, '// '),
              t('hero.subtitle')
            )
          ),

          React.createElement('div', {
            className: 'haf3 flex flex-col sm:flex-row items-center justify-center gap-4',
          },
            React.createElement('button', {
              'data-testid': 'hero-cta-btn',
              onClick: scrollToChecker,
              className: 'group relative px-8 py-4 font-mono font-semibold text-lg rounded border border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:border-green-400 hover:text-green-300 transition-all duration-200 w-full sm:w-auto flex items-center justify-center gap-2',
              style: { boxShadow: '0 0 20px rgba(34,197,94,0.15)' },
            },
              React.createElement('span', { className: 'text-green-500/70' }, '['),
              t('hero.cta'),
              React.createElement('span', { className: 'text-green-500/70' }, ']'),
              React.createElement(ArrowRight, { className: 'w-4 h-4 group-hover:translate-x-1 transition-transform' })
            )
          ),

          React.createElement('p', {
            'data-testid': 'hero-tagline',
            className: 'mt-8 text-xs font-mono tracking-widest text-green-500/40 uppercase haf3',
          }, t('hero.tagline'))
        )
      )
    )
  );
}
