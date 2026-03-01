/**
 * Story runner — reads YAML story files from e2e/stories/ and executes them
 * using Playwright. Screenshots are saved to test-results/stories/{storyName}/.
 *
 * Usage: npx tsx e2e/run-stories.ts [--story=<name>]
 */

import { chromium, type Browser, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.BASE_URL || 'http://localhost:8787';
const STORIES_DIR = path.join(__dirname, 'stories');
const OUTPUT_DIR = path.join(__dirname, '..', 'test-results', 'stories');

interface Step {
  action: 'navigate' | 'fill' | 'click' | 'wait' | 'screenshot' | 'assert';
  url?: string;
  selector?: string;
  value?: string;
  name?: string;
  timeout?: number;
  contains?: string;
}

interface Story {
  name: string;
  description: string;
  steps: Step[];
}

interface StoryResult {
  story: string;
  passed: boolean;
  error?: string;
  screenshots: string[];
}

async function executeStep(page: Page, step: Step, storyDir: string, screenshots: string[]): Promise<void> {
  switch (step.action) {
    case 'navigate': {
      const url = step.url!.startsWith('http') ? step.url! : `${BASE_URL}${step.url}`;
      await page.goto(url);
      break;
    }
    case 'fill': {
      await page.fill(step.selector!, step.value!);
      break;
    }
    case 'click': {
      await page.click(step.selector!);
      break;
    }
    case 'wait': {
      const timeout = step.timeout ?? 10_000;
      await page.waitForSelector(step.selector!, { timeout });
      break;
    }
    case 'screenshot': {
      fs.mkdirSync(storyDir, { recursive: true });
      const screenshotPath = path.join(storyDir, `${step.name ?? 'screenshot'}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      screenshots.push(screenshotPath);
      console.log(`  [screenshot] saved: ${screenshotPath}`);
      break;
    }
    case 'assert': {
      if (step.contains) {
        const el = await page.locator(step.selector!).first();
        const text = await el.textContent();
        if (!text?.includes(step.contains)) {
          throw new Error(`Assertion failed: expected "${step.selector}" to contain "${step.contains}", got: "${text?.slice(0, 100)}"`);
        }
      }
      break;
    }
    default:
      throw new Error(`Unknown action: ${(step as Step).action}`);
  }
}

async function runStory(browser: Browser, story: Story, storySlug: string): Promise<StoryResult> {
  const screenshots: string[] = [];
  const storyOutputDir = path.join(OUTPUT_DIR, storySlug);
  const page = await browser.newPage();

  try {
    console.log(`\nRunning story: ${story.name}`);
    console.log(`Description: ${story.description}`);

    for (let i = 0; i < story.steps.length; i++) {
      const step = story.steps[i];
      process.stdout.write(`  Step ${i + 1}/${story.steps.length} [${step.action}]... `);
      await executeStep(page, step, storyOutputDir, screenshots);
      process.stdout.write('OK\n');
    }

    return { story: story.name, passed: true, screenshots };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    process.stdout.write(`FAIL\n`);
    console.error(`  Error: ${errMsg}`);
    // Take failure screenshot
    const failPath = path.join(storyOutputDir, 'FAILURE.png');
    fs.mkdirSync(storyOutputDir, { recursive: true });
    await page.screenshot({ path: failPath, fullPage: true }).catch(() => {});
    screenshots.push(failPath);
    return { story: story.name, passed: false, error: errMsg, screenshots };
  } finally {
    await page.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const storyFilter = args.find(a => a.startsWith('--story='))?.replace('--story=', '');

  const storyFiles = fs.readdirSync(STORIES_DIR)
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
    .filter(f => !storyFilter || f.replace(/\.ya?ml$/, '') === storyFilter);

  if (storyFiles.length === 0) {
    console.error(`No story files found${storyFilter ? ` matching "${storyFilter}"` : ''} in ${STORIES_DIR}`);
    process.exit(1);
  }

  console.log(`Found ${storyFiles.length} stories. Base URL: ${BASE_URL}`);

  const browser = await chromium.launch();
  const results: StoryResult[] = [];

  for (const file of storyFiles) {
    const storySlug = file.replace(/\.ya?ml$/, '');
    const raw = fs.readFileSync(path.join(STORIES_DIR, file), 'utf-8');
    const story = yaml.load(raw) as Story;
    const result = await runStory(browser, story, storySlug);
    results.push(result);
  }

  await browser.close();

  // Summary
  console.log('\n─────────────────────────────────────');
  console.log('Story Run Summary');
  console.log('─────────────────────────────────────');
  let passed = 0, failed = 0;
  for (const r of results) {
    const icon = r.passed ? 'PASS' : 'FAIL';
    console.log(`${icon}  ${r.story}`);
    if (!r.passed) {
      console.log(`      ${r.error}`);
      failed++;
    } else {
      passed++;
    }
  }
  console.log('─────────────────────────────────────');
  console.log(`Total: ${results.length}  Passed: ${passed}  Failed: ${failed}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
