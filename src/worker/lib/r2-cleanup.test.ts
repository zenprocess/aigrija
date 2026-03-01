import { describe, it, expect, vi } from 'vitest';
import { deleteOldShareCards } from './r2-cleanup';

const DAY_MS = 86_400_000;

function makeR2Object(key: string, daysAgo: number): R2Object {
  return {
    key,
    size: 1024,
    etag: 'abc',
    httpEtag: '"abc"',
    uploaded: new Date(Date.now() - daysAgo * DAY_MS),
    checksums: {},
    httpMetadata: {},
    customMetadata: {},
    version: 'v1',
    storageClass: 'Standard',
    writeHttpMetadata: vi.fn(),
  } as unknown as R2Object;
}

function makeBucket(objects: R2Object[]) {
  const deletedKeys: string[] = [];
  const bucket = {
    list: vi.fn(async () => ({
      objects,
      truncated: false,
      cursor: undefined,
    })),
    delete: vi.fn(async (key: string) => {
      deletedKeys.push(key);
    }),
    _deletedKeys: deletedKeys,
  } as unknown as R2Bucket & { _deletedKeys: string[] };
  return bucket;
}

describe('deleteOldShareCards', () => {
  it('deletes objects older than maxAgeDays', async () => {
    const objects = [
      makeR2Object('card-old.png', 35),
      makeR2Object('card-new.png', 10),
    ];
    const bucket = makeBucket(objects);
    const result = await deleteOldShareCards(bucket as unknown as R2Bucket, 30);
    expect(result.deleted).toBe(1);
    expect(result.errors).toBe(0);
    expect(result.listed).toBe(2);
    expect((bucket as any)._deletedKeys).toContain('card-old.png');
    expect((bucket as any)._deletedKeys).not.toContain('card-new.png');
  });

  it('returns zero deleted when all objects are fresh', async () => {
    const objects = [makeR2Object('new1.png', 5), makeR2Object('new2.png', 1)];
    const bucket = makeBucket(objects);
    const result = await deleteOldShareCards(bucket as unknown as R2Bucket, 30);
    expect(result.deleted).toBe(0);
    expect(result.listed).toBe(2);
  });

  it('counts errors on delete failure', async () => {
    const objects = [makeR2Object('old.png', 60)];
    const bucket = {
      list: vi.fn(async () => ({ objects, truncated: false })),
      delete: vi.fn(async () => { throw new Error('R2 error'); }),
    } as unknown as R2Bucket;
    const result = await deleteOldShareCards(bucket, 30);
    expect(result.errors).toBe(1);
    expect(result.deleted).toBe(0);
  });

  it('handles empty bucket', async () => {
    const bucket = makeBucket([]);
    const result = await deleteOldShareCards(bucket as unknown as R2Bucket, 30);
    expect(result.deleted).toBe(0);
    expect(result.listed).toBe(0);
    expect(result.errors).toBe(0);
  });

  it('uses default 30-day threshold when no maxAgeDays provided', async () => {
    const objects = [makeR2Object('borderline.png', 31)];
    const bucket = makeBucket(objects);
    const result = await deleteOldShareCards(bucket as unknown as R2Bucket);
    expect(result.deleted).toBe(1);
  });
});
