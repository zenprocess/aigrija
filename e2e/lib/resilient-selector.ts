/**
 * Bowser Layer 4 — Self-Healing Selector Helper
 *
 * Resolves logical selector names to CSS selectors, trying primary first
 * then falling back. Self-heals the registry when a fallback is used.
 */

import selectorsRaw from '../selectors.json' assert { type: 'json' };
import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cast to mutable record so we can update during self-healing
const selectors = selectorsRaw as Record<string, { primary: string; fallback: string }>;

const SELECTORS_PATH = path.join(__dirname, '..', 'selectors.json');

export async function resolve(page: Page, name: string): Promise<string> {
  const entry = selectors[name];
  if (!entry) throw new Error(`Unknown selector: ${name}`);

  // Try primary
  const primary = await page.$(entry.primary);
  if (primary) return entry.primary;

  // Try each fallback (comma-separated)
  for (const fb of entry.fallback.split(',').map(s => s.trim())) {
    const el = await page.$(fb);
    if (el) {
      console.warn(`[bowser] Self-healed "${name}": ${entry.primary} → ${fb}`);
      entry.primary = fb;
      fs.writeFileSync(SELECTORS_PATH, JSON.stringify(selectors, null, 2));
      return fb;
    }
  }

  throw new Error(
    `No selector found for "${name}" — primary: ${entry.primary}, fallback: ${entry.fallback}`,
  );
}

export function getSelectorNames(): string[] {
  return Object.keys(selectors);
}

export function getEntry(name: string): { primary: string; fallback: string } | undefined {
  return selectors[name];
}
