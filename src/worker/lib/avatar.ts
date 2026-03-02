import { createAvatar } from '@dicebear/core';
import { lorelei, loreleiNeutral } from '@dicebear/collection';

export interface AvatarOptions {
  seed: string;
  flip?: boolean;
  size?: number;
  mood?: 'happy' | 'sad';
  style?: 'lorelei' | 'lorelei-neutral';
  backgroundColor?: string[];
}

const DEFAULT_BG = ['b6e3f4', '60a5fa', '38bdf8'];

const HAPPY_MOUTHS = [
  'happy01', 'happy02', 'happy03', 'happy04', 'happy05', 'happy06',
  'happy07', 'happy08', 'happy09', 'happy10', 'happy11', 'happy12',
  'happy13', 'happy14', 'happy15', 'happy16',
] as const;

const SAD_MOUTHS = [
  'sad01', 'sad02', 'sad03', 'sad04', 'sad05',
  'sad06', 'sad07', 'sad08', 'sad09',
] as const;

export function generateAvatar(opts: AvatarOptions): string {
  const {
    seed,
    flip = false,
    size = 80,
    mood,
    style = 'lorelei',
    backgroundColor = DEFAULT_BG,
  } = opts;

  const collection = style === 'lorelei-neutral' ? loreleiNeutral : lorelei;

  const avatarOpts: Record<string, unknown> = {
    seed,
    size,
    flip,
    backgroundColor,
  };

  if (mood === 'happy') avatarOpts.mouth = [...HAPPY_MOUTHS];
  if (mood === 'sad') avatarOpts.mouth = [...SAD_MOUTHS];

  return createAvatar(collection, avatarOpts).toString();
}

export function avatarDataUri(opts: AvatarOptions): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(generateAvatar(opts))}`;
}

export async function getOrGenerateAvatar(
  kv: KVNamespace,
  opts: AvatarOptions,
): Promise<string> {
  const key = `avatar:${opts.seed}:${opts.mood || 'default'}:${opts.flip ? 'f' : 'n'}:${opts.style || 'lorelei'}`;
  const cached = await kv.get(key);
  if (cached) return cached;
  const svg = generateAvatar(opts);
  await kv.put(key, svg, { expirationTtl: 7 * 24 * 60 * 60 });
  return svg;
}
