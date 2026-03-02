import React, { useEffect, useRef, useState } from 'react';

const SHIELD_LINES = [
  '        ╔══════════════╗        ',
  '       ╔╝              ╚╗       ',
  '      ║   ◆ AI-GRIJA ◆   ║      ',
  '      ║                  ║      ',
  '      ║  ░░░░░░░░░░░░░░  ║      ',
  '      ║  ░░ VERIFICĂ  ░░  ║     ',
  '      ║  ░░RAPORTEAZĂ ░░  ║     ',
  '      ║  ░░PROTEJEAZĂ ░░  ║     ',
  '      ║  ░░░░░░░░░░░░░░  ║      ',
  '       ╚╗              ╔╝       ',
  '        ╚╗            ╔╝        ',
  '         ╚╗          ╔╝         ',
  '          ╚╗        ╔╝          ',
  '           ╚╗      ╔╝           ',
  '            ╚══════╝            ',
];

const NOISE_CHARS = ['░','▒','▓','█','╔','╗','╚','╝','║','═','◆','●','◉','▲','■','╬','╠','╣','╦','╩','▼','◈','◇','□','▪'];

function buildTargetCells(lines) {
  const cells = [];
  lines.forEach((line, row) => {
    for (let col = 0; col < line.length; col++) {
      if (line[col] !== ' ') cells.push({ row, col, char: line[col] });
    }
  });
  return cells;
}

const TARGET_CELLS = buildTargetCells(SHIELD_LINES);
const ROWS = SHIELD_LINES.length;
const COLS = Math.max(...SHIELD_LINES.map(l => l.length));

function buildInitialGrid() {
  const grid = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) row.push({ target: ' ' });
    grid.push(row);
  }
  TARGET_CELLS.forEach(({ row, col, char }) => {
    grid[row][col] = { target: char };
  });
  return grid;
}

const INITIAL_GRID = buildInitialGrid();

export default function HeroAsciiShield() {
  const canvasRef = useRef(null);
  const startTimeRef = useRef(null);
  const rafRef = useRef(null);
  const [shieldDone, setShieldDone] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const isMobile = window.innerWidth < 640;
    const fontSize = isMobile ? 10 : 14;
    const charHeight = fontSize * 1.5;

    ctx.font = `${fontSize}px 'Courier New', monospace`;
    const charWidth = ctx.measureText('M').width;

    const canvasW = Math.ceil(COLS * charWidth);
    const canvasH = Math.ceil(ROWS * charHeight);
    canvas.width = canvasW;
    canvas.height = canvasH;

    const ANIM_DURATION = 2200;
    let done = false;

    function rnd() {
      return NOISE_CHARS[Math.floor(Math.random() * NOISE_CHARS.length)];
    }

    function draw(timestamp) {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const globalT = Math.min(elapsed / ANIM_DURATION, 1);

      ctx.clearRect(0, 0, canvasW, canvasH);
      ctx.font = `${fontSize}px 'Courier New', monospace`;

      let allSettled = true;

      TARGET_CELLS.forEach(({ row, col, char }, idx) => {
        const delay = (idx / TARGET_CELLS.length) * 0.45;
        const cellT = Math.max(0, Math.min((globalT - delay) / 0.55, 1));

        if (cellT < 1) allSettled = false;

        const displayChar = cellT >= 0.88 ? char : (cellT > 0 ? rnd() : rnd());

        const colRatio = col / COLS;
        const rowRatio = row / ROWS;
        const r = Math.round(59  + (6   - 59)  * colRatio);
        const g = Math.round(130 + (182 - 130) * rowRatio);
        const b = Math.round(246 + (212 - 246) * colRatio);
        const alpha = 0.35 + cellT * 0.65;

        if (cellT >= 1) {
          ctx.shadowColor = `rgba(${r},${g},${b},0.55)`;
          ctx.shadowBlur = 5;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fillText(displayChar, col * charWidth, (row + 1) * charHeight - 2);
      });

      ctx.shadowBlur = 0;

      if (!allSettled) {
        rafRef.current = requestAnimationFrame(draw);
      } else if (!done) {
        done = true;
        setShieldDone(true);
      }
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      data-testid="hero-ascii-shield"
      className="flex flex-col items-center justify-center select-none"
      aria-label="Scut AI-GRIJA animat"
      role="img"
    >
      <div className="relative">
        <div className="absolute inset-0 bg-blue-500/10 blur-2xl rounded-full pointer-events-none" />
        <canvas
          ref={canvasRef}
          className="relative z-10 max-w-full"
        />
      </div>
      <div
        className={`mt-3 text-center transition-all duration-700 ease-in ${shieldDone ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
      >
        <p className="text-xs sm:text-sm font-mono tracking-widest text-cyan-400/70 uppercase">
          verifică · raportează · protejează
        </p>
      </div>
    </div>
  );
}
