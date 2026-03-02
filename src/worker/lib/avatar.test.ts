import { describe, it, expect, vi } from 'vitest';
import { generateAvatar, avatarDataUri, getOrGenerateAvatar } from './avatar';

describe('generateAvatar', () => {
  it('is deterministic — same seed same output', () => {
    const a = generateAvatar({ seed: 'Maria' });
    const b = generateAvatar({ seed: 'Maria' });
    expect(a).toBe(b);
  });

  it('different seeds produce different SVGs', () => {
    const a = generateAvatar({ seed: 'Maria' });
    const b = generateAvatar({ seed: 'Andrei' });
    expect(a).not.toBe(b);
  });

  it('produces valid SVG', () => {
    const svg = generateAvatar({ seed: 'test' });
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('flip option works', () => {
    const normal = generateAvatar({ seed: 'test', flip: false });
    const flipped = generateAvatar({ seed: 'test', flip: true });
    expect(normal).not.toBe(flipped);
  });

  it('sad mood produces valid SVG', () => {
    const svg = generateAvatar({ seed: 'sad-bot', mood: 'sad' });
    expect(svg).toContain('<svg');
  });

  it('happy mood produces valid SVG', () => {
    const svg = generateAvatar({ seed: 'happy-bot', mood: 'happy' });
    expect(svg).toContain('<svg');
  });

  it('lorelei-neutral style works', () => {
    const svg = generateAvatar({ seed: 'neutral', style: 'lorelei-neutral' });
    expect(svg).toContain('<svg');
  });
});

describe('avatarDataUri', () => {
  it('returns valid data URI', () => {
    const uri = avatarDataUri({ seed: 'test' });
    expect(uri).toMatch(/^data:image\/svg\+xml;utf8,%3Csvg/);
  });
});

describe('getOrGenerateAvatar', () => {
  it('returns cached value on hit', async () => {
    const kv = { get: vi.fn().mockResolvedValue('<svg>cached</svg>'), put: vi.fn() } as unknown as KVNamespace;
    const result = await getOrGenerateAvatar(kv, { seed: 'test' });
    expect(result).toBe('<svg>cached</svg>');
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('generates and caches on miss', async () => {
    const kv = { get: vi.fn().mockResolvedValue(null), put: vi.fn() } as unknown as KVNamespace;
    const result = await getOrGenerateAvatar(kv, { seed: 'test' });
    expect(result).toContain('<svg');
    expect(kv.put).toHaveBeenCalledOnce();
  });
});
