/**
 * Bowser Layer 4 — Visual Regression Diff Helper
 *
 * On first run (no baseline): saves screenshot as baseline.
 * On subsequent runs: compares against baseline with pixelmatch,
 * flags if diff > 5% of pixels and writes diff image to playwright-report/diffs/.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.join(__dirname, '..', '..');
const BASELINES_DIR = path.join(REPO_ROOT, 'e2e', 'baselines');
const DIFFS_DIR = path.join(REPO_ROOT, 'playwright-report', 'diffs');
const DIFF_THRESHOLD = 0.05; // 5%

export interface VisualDiffResult {
  name: string;
  status: 'baseline-created' | 'match' | 'diff' | 'size-mismatch';
  diffPixels?: number;
  totalPixels?: number;
  diffPercent?: number;
  diffPath?: string;
}

export async function visualDiff(name: string, screenshotBuffer: Buffer): Promise<VisualDiffResult> {
  fs.mkdirSync(BASELINES_DIR, { recursive: true });
  fs.mkdirSync(DIFFS_DIR, { recursive: true });

  const baselinePath = path.join(BASELINES_DIR, `${name}.png`);

  if (!fs.existsSync(baselinePath)) {
    fs.writeFileSync(baselinePath, screenshotBuffer);
    return { name, status: 'baseline-created' };
  }

  const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
  const current = PNG.sync.read(screenshotBuffer);

  if (baseline.width !== current.width || baseline.height !== current.height) {
    // Update baseline on size change
    fs.writeFileSync(baselinePath, screenshotBuffer);
    return { name, status: 'size-mismatch' };
  }

  const { width, height } = baseline;
  const diffPng = new PNG({ width, height });

  const diffPixels = pixelmatch(
    baseline.data,
    current.data,
    diffPng.data,
    width,
    height,
    { threshold: 0.1 },
  );

  const totalPixels = width * height;
  const diffPercent = diffPixels / totalPixels;

  if (diffPercent > DIFF_THRESHOLD) {
    const diffPath = path.join(DIFFS_DIR, `${name}-diff.png`);
    fs.writeFileSync(diffPath, PNG.sync.write(diffPng));
    return {
      name,
      status: 'diff',
      diffPixels,
      totalPixels,
      diffPercent,
      diffPath,
    };
  }

  return {
    name,
    status: 'match',
    diffPixels,
    totalPixels,
    diffPercent,
  };
}
