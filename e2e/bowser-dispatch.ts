/**
 * Bowser Layer 2 — Subagent-per-Story Dispatcher
 *
 * Reads all e2e/stories/*.yaml files, runs each via bowser-run.sh
 * with max 4 concurrent processes, retries failures once, then writes
 * playwright-report/bowser-summary.json.
 *
 * Usage: npx tsx e2e/bowser-dispatch.ts [--base-url URL]
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.join(__dirname, '..');
const STORIES_DIR = path.join(__dirname, 'stories');
const REPORT_DIR = path.join(REPO_ROOT, 'playwright-report');
const SUMMARY_PATH = path.join(REPORT_DIR, 'bowser-summary.json');
const MAX_CONCURRENCY = 4;

// ── types ─────────────────────────────────────────────────────────────────────

interface StoryEntry {
  name: string;
  status: 'pass' | 'fail';
  duration_ms: number;
  screenshots: string[];
  error?: string;
}

interface BowserSummary {
  timestamp: string;
  base_url: string;
  total: number;
  passed: number;
  failed: number;
  stories: StoryEntry[];
}

// ── helpers ───────────────────────────────────────────────────────────────────

function parseArgs(): { baseUrl: string } {
  const args = process.argv.slice(2);
  const baseUrlIdx = args.findIndex(a => a === '--base-url');
  const baseUrl =
    baseUrlIdx !== -1 && args[baseUrlIdx + 1]
      ? args[baseUrlIdx + 1]
      : process.env.BASE_URL || '';
  return { baseUrl };
}

function runStory(storyName: string, baseUrl: string): Promise<{ exitCode: number; output: string }> {
  return new Promise(resolve => {
    const args = ['scripts/bowser-run.sh', '--story', storyName];
    if (baseUrl) args.push('--base-url', baseUrl);

    const env = { ...process.env };
    if (baseUrl) env['BASE_URL'] = baseUrl;

    const start = Date.now();
    const child = spawn('bash', args, {
      cwd: REPO_ROOT,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    child.stdout.on('data', (d: Buffer) => { output += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { output += d.toString(); });

    child.on('close', exitCode => {
      resolve({ exitCode: exitCode ?? 1, output });
    });
  });
}

function extractScreenshots(storyName: string): string[] {
  const dir = path.join(REPO_ROOT, 'test-results', 'stories', storyName);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.png'))
    .map(f => path.join(dir, f));
}

function extractError(output: string): string | undefined {
  const lines = output.split('\n');
  const errLine = lines.find(l => l.includes('Error:') || l.includes('FAIL'));
  return errLine?.trim() || output.slice(-300).trim() || undefined;
}

// ── semaphore / pool ──────────────────────────────────────────────────────────

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  max: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;

  async function worker() {
    while (next < tasks.length) {
      const idx = next++;
      results[idx] = await tasks[idx]();
    }
  }

  const workers = Array.from({ length: Math.min(max, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { baseUrl } = parseArgs();

  const storyFiles = fs.readdirSync(STORIES_DIR)
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
    .map(f => f.replace(/\.ya?ml$/, ''));

  if (storyFiles.length === 0) {
    console.error('[bowser-dispatch] No story files found in', STORIES_DIR);
    process.exit(2);
  }

  const effectiveUrl = baseUrl || (process.env.CF_ACCESS_CLIENT_ID
    ? process.env.CF_PREVIEW_URL || 'https://preview.aigrija.ro'
    : 'http://localhost:8787');

  console.log(`[bowser-dispatch] ${storyFiles.length} stories | concurrency: ${MAX_CONCURRENCY} | url: ${effectiveUrl}`);

  const storyResults: StoryEntry[] = [];

  const tasks = storyFiles.map(name => async (): Promise<StoryEntry> => {
    const t0 = Date.now();
    console.log(`  [start] ${name}`);

    let result = await runStory(name, baseUrl);

    // Retry once on failure
    if (result.exitCode !== 0) {
      console.log(`  [retry] ${name} (exit ${result.exitCode})`);
      result = await runStory(name, baseUrl);
    }

    const duration_ms = Date.now() - t0;
    const passed = result.exitCode === 0;
    const screenshots = extractScreenshots(name);
    const entry: StoryEntry = {
      name,
      status: passed ? 'pass' : 'fail',
      duration_ms,
      screenshots,
    };
    if (!passed) entry.error = extractError(result.output);

    console.log(`  [${entry.status.toUpperCase()}] ${name} (${duration_ms}ms)`);
    return entry;
  });

  const entries = await runWithConcurrency(tasks, MAX_CONCURRENCY);
  storyResults.push(...entries);

  const passed = storyResults.filter(s => s.status === 'pass').length;
  const failed = storyResults.length - passed;

  const summary: BowserSummary = {
    timestamp: new Date().toISOString(),
    base_url: effectiveUrl,
    total: storyResults.length,
    passed,
    failed,
    stories: storyResults,
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2));

  console.log('\n─────────────────────────────────────');
  console.log(`Bowser Summary: ${passed}/${storyResults.length} passed`);
  if (failed > 0) {
    storyResults.filter(s => s.status === 'fail').forEach(s => {
      console.log(`  FAIL  ${s.name}: ${s.error ?? 'unknown error'}`);
    });
  }
  console.log(`Report: ${SUMMARY_PATH}`);
  console.log('─────────────────────────────────────');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('[bowser-dispatch] Fatal:', err);
  process.exit(2);
});
