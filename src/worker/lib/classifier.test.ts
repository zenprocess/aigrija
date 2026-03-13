import { describe, it, expect, vi } from 'vitest';
import { ClassificationValidationError, createClassifier } from './classifier';

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
