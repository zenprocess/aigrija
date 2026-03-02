import { describe, it, expect } from 'vitest';
import { isGibberish } from './gibberish-detector';

describe('isGibberish', () => {
  it('normal Romanian text → not gibberish', () => {
    const result = isGibberish('Buna ziua, am primit un mesaj suspect de la banca.');
    expect(result.gibberish).toBe(false);
  });

  it('normal English text → not gibberish', () => {
    const result = isGibberish('Hello, your account has been suspended. Please verify your identity.');
    expect(result.gibberish).toBe(false);
  });

  it('"asdfjkl;asdfjkl;asdfjkl;" → gibberish (entropy or vowel ratio)', () => {
    const result = isGibberish('asdfjkl;asdfjkl;asdfjkl;');
    expect(result.gibberish).toBe(true);
  });

  it('"aaaaaaaaaaaaaaaaaaa" → gibberish (repeated char)', () => {
    const result = isGibberish('aaaaaaaaaaaaaaaaaaa');
    expect(result.gibberish).toBe(true);
    // Caught by repeated-char or vowel-ratio heuristic — both are valid
    expect(result.reason).toBeDefined();
  });

  it('"xzqwjkplmvbncxz" → gibberish (low vowel ratio)', () => {
    const result = isGibberish('xzqwjkplmvbncxz');
    expect(result.gibberish).toBe(true);
    expect(result.reason).toMatch(/vocale/);
  });

  it('real scam SMS text → not gibberish', () => {
    const scamText =
      'ALERTA: Contul dvs. a fost blocat din motive de securitate. ' +
      'Accesati imediat https://brd-secure.ro/verificare pentru a debloca accesul.';
    const result = isGibberish(scamText);
    expect(result.gibberish).toBe(false);
  });

  it('short text (< 10 chars) → not gibberish (skip check)', () => {
    // Even complete garbage that's short should pass
    expect(isGibberish('xzqwj').gibberish).toBe(false);
    expect(isGibberish('aaaaaaa').gibberish).toBe(false);
    expect(isGibberish('').gibberish).toBe(false);
  });
});
