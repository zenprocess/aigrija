/**
 * Bowser Layer 2 — Subagent-per-Story Dispatcher
 *
 * Reads all e2e/stories/*.yaml files, runs each via bowser-run.sh
 * with max 4 concurrent processes, retries failures once, then writes
 * playwright-report/bowser-summary.json + allure-results/.
 *
 * Usage: npx tsx e2e/bowser-dispatch.ts [--base-url URL] [--tags smoke,critical]
 */

import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.join(__dirname, '..');
const STORIES_DIR = path.join(__dirname, 'stories');
const REPORT_DIR = path.join(REPO_ROOT, 'playwright-report');
const ALLURE_DIR = path.join(REPO_ROOT, 'allure-results');
const SUMMARY_PATH = path.join(REPORT_DIR, 'bowser-summary.json');
const MAX_CONCURRENCY = 4;

// ── types ─────────────────────────────────────────────────────────────────────

interface StoryEntry {
  name: string;
  status: 'pass' | 'fail';
  duration_ms: number;
  startedAt: number;
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

function parseArgs(): { baseUrl: string; tags: string[] } {
  const args = process.argv.slice(2);
  const baseUrlIdx = args.findIndex(a => a === '--base-url');
  const baseUrl =
    baseUrlIdx !== -1 && args[baseUrlIdx + 1]
      ? args[baseUrlIdx + 1]
      : process.env.BASE_URL || '';
  const tagsIdx = args.findIndex(a => a === '--tags');
  const tags =
    tagsIdx !== -1 && args[tagsIdx + 1]
      ? args[tagsIdx + 1].split(',').map(t => t.trim())
      : [];
  return { baseUrl, tags };
}

/** Parse tags from YAML frontmatter: `tags: [smoke, critical]` */
function parseStoryTags(yamlPath: string): string[] {
  const content = fs.readFileSync(yamlPath, 'utf-8');
  const match = content.match(/^tags:\s*\[([^\]]*)\]/m);
  if (!match) return [];
  return match[1].split(',').map(t => t.trim()).filter(Boolean);
}

function runStory(storyName: string, baseUrl: string): Promise<{ exitCode: number; output: string }> {
  return new Promise(resolve => {
    const args = ['scripts/bowser-run.sh', '--story', storyName];
    if (baseUrl) args.push('--base-url', baseUrl);

    const env = { ...process.env };
    if (baseUrl) env['BASE_URL'] = baseUrl;

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

// ── allure output ─────────────────────────────────────────────────────────────

function writeAllureResults(summary: BowserSummary): void {
  fs.mkdirSync(ALLURE_DIR, { recursive: true });

  for (const story of summary.stories) {
    const uuid = randomUUID();
    const result = {
      uuid,
      historyId: story.name,
      name: story.name,
      fullName: `bowser/${story.name}`,
      status: story.status === 'pass' ? 'passed' : 'failed',
      stage: 'finished',
      start: story.startedAt,
      stop: story.startedAt + story.duration_ms,
      labels: [
        { name: 'suite', value: 'bowser' },
        { name: 'parentSuite', value: 'E2E Stories' },
      ],
      attachments: [] as { name: string; source: string; type: string }[],
      ...(story.error ? { statusDetails: { message: story.error } } : {}),
    };

    for (const screenshot of story.screenshots) {
      const screenshotPath = path.resolve(screenshot);
      if (fs.existsSync(screenshotPath)) {
        const attachId = randomUUID();
        const ext = path.extname(screenshot);
        const attachName = `${attachId}-attachment${ext}`;
        fs.copyFileSync(screenshotPath, path.join(ALLURE_DIR, attachName));
        result.attachments.push({
          name: path.basename(screenshot),
          source: attachName,
          type: ext === '.png' ? 'image/png' : 'image/jpeg',
        });
      }
    }

    fs.writeFileSync(
      path.join(ALLURE_DIR, `${uuid}-result.json`),
      JSON.stringify(result, null, 2),
    );
  }
  console.log(`Allure: wrote ${summary.stories.length} results to allure-results/`);
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
  const { baseUrl, tags } = parseArgs();

  let storyFiles = fs.readdirSync(STORIES_DIR)
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
    .map(f => f.replace(/\.ya?ml$/, ''));

  // Filter by tags if provided
  if (tags.length > 0) {
    storyFiles = storyFiles.filter(name => {
      const yamlPath = path.join(STORIES_DIR, `${name}.yaml`);
      if (!fs.existsSync(yamlPath)) return false;
      const storyTags = parseStoryTags(yamlPath);
      return storyTags.some(t => tags.includes(t));
    });
    console.log(`[bowser-dispatch] Tag filter: ${tags.join(',')} → ${storyFiles.length} stories`);
  }

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
      startedAt: t0,
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

  // Generate Allure results
  writeAllureResults(summary);

  console.log('\n─────────────────────────────────────');
  console.log(`Bowser Summary: ${passed}/${storyResults.length} passed`);
  if (failed > 0) {
    storyResults.filter(s => s.status === 'fail').forEach(s => {
      console.log(`  FAIL  ${s.name}: ${s.error ?? 'unknown error'}`);
    });
  }
  console.log(`Report: ${SUMMARY_PATH}`);
  console.log(`Allure: ${ALLURE_DIR}`);
  console.log('─────────────────────────────────────');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('[bowser-dispatch] Fatal:', err);
  process.exit(2);
});
