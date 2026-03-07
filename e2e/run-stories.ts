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

interface JsonFieldCheck {
  path: string;
  equals?: unknown;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
}

interface Step {
  action: 'navigate' | 'fill' | 'click' | 'wait' | 'screenshot' | 'assert';
  url?: string;
  selector?: string;
  value?: string;
  name?: string;
  timeout?: number;
  exists?: boolean;
  visible?: boolean;
  text_equals?: string;
  matches?: string;
  json_has_property?: string;
  json_field?: JsonFieldCheck;
  element_count_gte?: number;
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
      const selector = step.selector ?? 'body';

      if (step.exists != null) {
        const el = await page.$(selector);
        if (step.exists && !el) {
          throw new Error(`Assertion failed: expected "${selector}" to exist`);
        }
        if (!step.exists && el) {
          throw new Error(`Assertion failed: expected "${selector}" to NOT exist`);
        }
      }

      if (step.visible) {
        const loc = page.locator(selector).first();
        const isVisible = await loc.isVisible();
        if (!isVisible) {
          throw new Error(`Assertion failed: expected "${selector}" to be visible`);
        }
      }

      if (step.text_equals != null) {
        const el = await page.locator(selector).first();
        const text = (await el.textContent())?.trim() ?? '';
        if (text !== step.text_equals) {
          throw new Error(`Assertion failed: expected "${selector}" text to equal "${step.text_equals}", got: "${text.slice(0, 100)}"`);
        }
      }

      if (step.matches) {
        const el = await page.locator(selector).first();
        const text = await el.textContent() ?? '';
        const re = new RegExp(step.matches);
        if (!re.test(text)) {
          throw new Error(`Assertion failed: expected "${selector}" text to match /${step.matches}/, got: "${text.slice(0, 100)}"`);
        }
      }

      if (step.json_has_property) {
        const el = await page.locator(selector).first();
        const text = await el.textContent() ?? '';
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error(`Assertion failed: expected "${selector}" to contain valid JSON, got: "${text.slice(0, 100)}"`);
        }
        if (!(step.json_has_property in parsed)) {
          throw new Error(`Assertion failed: expected JSON to have property "${step.json_has_property}", keys: [${Object.keys(parsed).join(', ')}]`);
        }
      }

      if (step.json_field) {
        const el = await page.locator(selector).first();
        const text = await el.textContent() ?? '';
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error(`Assertion failed: expected "${selector}" to contain valid JSON, got: "${text.slice(0, 100)}"`);
        }
        const keys = step.json_field.path.split('.');
        let current: unknown = parsed;
        for (const key of keys) {
          if (current == null || typeof current !== 'object') {
            throw new Error(`Assertion failed: JSON path "${step.json_field.path}" not traversable at "${key}"`);
          }
          current = (current as Record<string, unknown>)[key];
        }
        if (step.json_field.type) {
          const actualType = Array.isArray(current) ? 'array' : typeof current;
          if (actualType !== step.json_field.type) {
            throw new Error(`Assertion failed: expected JSON field "${step.json_field.path}" to be type "${step.json_field.type}", got "${actualType}"`);
          }
        }
        if (step.json_field.equals !== undefined) {
          const actual = JSON.stringify(current);
          const expected = JSON.stringify(step.json_field.equals);
          if (actual !== expected) {
            throw new Error(`Assertion failed: expected JSON field "${step.json_field.path}" to equal ${expected}, got ${actual}`);
          }
        }
      }

      if (step.element_count_gte != null) {
        const count = await page.locator(selector).count();
        if (count < step.element_count_gte) {
          throw new Error(`Assertion failed: expected "${selector}" count >= ${step.element_count_gte}, got ${count}`);
        }
      }

      if (step.contains) {
        const el = await page.locator(selector).first();
        const text = await el.textContent();
        if (!text?.includes(step.contains)) {
          throw new Error(`Assertion failed: expected "${selector}" to contain "${step.contains}", got: "${text?.slice(0, 100)}"`);
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

  const cfHeaders: Record<string, string> = {};
  if (process.env.CF_ACCESS_CLIENT_ID) {
    cfHeaders['CF-Access-Client-Id'] = process.env.CF_ACCESS_CLIENT_ID;
  }
  if (process.env.CF_ACCESS_CLIENT_SECRET) {
    cfHeaders['CF-Access-Client-Secret'] = process.env.CF_ACCESS_CLIENT_SECRET;
  }
  const context = await browser.newContext({
    extraHTTPHeaders: cfHeaders,
  });
  const page = await context.newPage();

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
    await context.close();
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
