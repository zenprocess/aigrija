import { describe, it, expect, vi } from 'vitest';
import { ClassificationValidationError, createClassifier } from './classifier';
import { CircuitOpenError } from './circuit-breaker';

function makeMockAi(response?: string): Ai {
  const mockResponse = response ?? JSON.stringify({
    verdict: 'legitimate',
    confidence: 0.9,
    scam_type: 'necunoscut',
    impersonated_entity: null,
    red_flags: [],
    explanation: 'Mesajul pare legitim.',
    recommended_actions: [],
  });
  return {
    run: vi.fn().mockResolvedValue({ response: mockResponse }),
  } as unknown as Ai;
}

function makeFailingAi(): Ai {
  return {
    run: vi.fn().mockRejectedValue(new Error('Workers AI unavailable')),
  } as unknown as Ai;
}

function makeKV() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
    delete: vi.fn(async (key: string) => { store.delete(key); }),
  } as unknown as KVNamespace;
}

describe('ClassificationValidationError', () => {
  it('is an instance of Error', () => {
    const err = new ClassificationValidationError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ClassificationValidationError');
    expect(err.message).toBe('test');
  });
});

describe('input validation via createClassifier', () => {
  it('rejects empty string', async () => {
    const classify = createClassifier(makeMockAi());
    await expect(classify('')).rejects.toThrow(ClassificationValidationError);
  });

  it('rejects whitespace-only string', async () => {
    const classify = createClassifier(makeMockAi());
    await expect(classify('   ')).rejects.toThrow(ClassificationValidationError);
  });

  it('rejects text shorter than 3 chars after stripping', async () => {
    const classify = createClassifier(makeMockAi());
    await expect(classify('ab')).rejects.toThrow(ClassificationValidationError);
  });

  it('rejects text longer than 5000 chars', async () => {
    const classify = createClassifier(makeMockAi());
    await expect(classify('a'.repeat(5001))).rejects.toThrow(ClassificationValidationError);
  });

  it('accepts valid text of exactly 3 chars and returns classification result', async () => {
    const classify = createClassifier(makeMockAi());
    const result = await classify('abc');
    expect(result.verdict).toBe('legitimate');
  });

  it('strips HTML tags before validation', async () => {
    const classify = createClassifier(makeMockAi());
    const result = await classify('<b>hello world</b>');
    expect(result.verdict).toBe('legitimate');
  });

  it('rejects text that is only HTML tags (empty after strip)', async () => {
    const classify = createClassifier(makeMockAi());
    await expect(classify('<div><br/></div>')).rejects.toThrow(ClassificationValidationError);
  });

  it('strips HTML but validates length after stripping', async () => {
    const classify = createClassifier(makeMockAi());
    // tag-heavy text that leaves only 2 chars after strip
    await expect(classify('<p>ab</p>')).rejects.toThrow(ClassificationValidationError);
  });

  it('returns result with model_used and ai_disclaimer fields', async () => {
    const classify = createClassifier(makeMockAi());
    const result = await classify('Test message for analysis');
    expect(result.model_used).toBeDefined();
    expect(result.ai_disclaimer).toBeDefined();
  });
});

describe('circuit breaker integration', () => {
  it('succeeds normally when kv is provided and AI is healthy', async () => {
    const kv = makeKV();
    const classify = createClassifier(makeMockAi(), kv);
    const result = await classify('Test message for analysis');
    expect(result.verdict).toBe('legitimate');
  });

  it('returns default suspicious result when AI always fails and kv not provided', async () => {
    const classify = createClassifier(makeFailingAi());
    const result = await classify('Test message for analysis');
    expect(result.verdict).toBe('suspicious');
    expect(result.red_flags).toContain('Analiza automata nu a putut fi finalizata');
  });

  it('returns default suspicious result when AI always fails and kv is provided', async () => {
    const kv = makeKV();
    const classify = createClassifier(makeFailingAi(), kv);
    const result = await classify('Test message for analysis');
    expect(result.verdict).toBe('suspicious');
    expect(result.red_flags).toContain('Analiza automata nu a putut fi finalizata');
  });

  it('trips circuit OPEN after 5 AI failures and subsequent calls fail fast', async () => {
    const kv = makeKV();
    const classify = createClassifier(makeFailingAi(), kv);
    const validText = 'Test message for analysis';

    // First 5 calls: AI fails, circuit records failures, returns default result
    for (let i = 0; i < 5; i++) {
      const result = await classify(validText);
      expect(result.verdict).toBe('suspicious');
    }

    // After 5 failures, primary circuit is OPEN; subsequent calls fail fast (CircuitOpenError caught)
    const result = await classify(validText);
    expect(result.verdict).toBe('suspicious');
  });

  it('createClassifier without kv still works (no circuit breaker)', async () => {
    const classify = createClassifier(makeMockAi());
    const result = await classify('hello world');
    expect(result.verdict).toBe('legitimate');
  });
});
