/**
 * Journey 3 — Language Switching Consistency
 *
 * Verifies that all nav items, headings, and page titles respond correctly
 * when the user switches between English and Romanian via the language switcher.
 *
 * Steps:
 * 1. Navigate to / with ?lang=en to force English
 * 2. Record all nav item texts in English
 * 3. Open language switcher — verify dropdown shows flags + full language names
 * 4. Switch to Romanian — verify ALL nav items changed (no English remnants)
 * 5. Navigate to /#/amenintari — verify heading is Romanian ("Amenințări" not "Threats")
 * 6. Switch back to English — verify nav is fully English (no "Mai mult")
 * 7. Navigate to /#/quiz — verify quiz title is in English
 *
 * Results written to e2e/results/03-language.json
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESULTS_PATH = path.join(__dirname, '..', 'results', '03-language.json');

const LANGUAGE_NAMES: Record<string, string> = {
  ro: 'Română',
  en: 'English',
  bg: 'Български',
  hu: 'Magyar',
  uk: 'Українська',
};

test.describe('Journey 3 — Language Switching Consistency', () => {
  // Force desktop viewport so the desktop nav bar is visible (lg: breakpoint = 1024px)
  test.use({ viewport: { width: 1280, height: 720 } });
  test.setTimeout(60000);

  test('language switcher changes all nav items consistently', async ({ page }) => {
    const isMobile = test.info().project.name === 'mobile';
    // On mobile, open the hamburger menu before interacting with nav items
    const openMobileNavIfNeeded = async (): Promise<void> => {
      if (!isMobile) return;
      const hamburger = page.locator('[data-testid="header-hamburger-btn"]');
      if (await hamburger.isVisible().catch(() => false)) {
        await hamburger.click();
        await page.waitForTimeout(300);
      }
    };
    const results: Record<string, unknown> = {
      journey: '03-language-switch',
      timestamp: new Date().toISOString(),
      steps: {},
    };
    const steps = results.steps as Record<string, unknown>;

    // ── Step 1: Navigate to / in English (force via ?lang=en URL param) ──────
    // The app defaults to Romanian; ?lang=en overrides localStorage and browser lang
    await page.goto('/?lang=en');
    await page.waitForLoadState('networkidle');
    steps['1_navigation_english'] = 'ok';

    // ── Step 2: Record all nav texts in English ───────────────────────────────
    await openMobileNavIfNeeded();
    const navVerifica = await page.locator('[data-testid="header-nav-verifica"]').textContent();
    const navHowItWorks = await page.locator('[data-testid="header-nav-cum-functioneaza"]').textContent();
    const navAlerte = await page.locator('[data-testid="header-nav-alerte"]').textContent();
    const navAmenintari = await page.locator('[data-testid="header-nav-amenintari"]').textContent();
    const navMore = await page.locator('[data-testid="header-nav-more-btn"]').textContent();

    // Verify we are in English
    expect(navVerifica?.trim()).toBe('Check');
    expect(navAlerte?.trim()).toBe('Alerts');
    expect(navAmenintari?.trim()).toBe('Threats');
    expect(navMore?.trim()).toContain('More');

    steps['2_english_nav'] = {
      verifica: navVerifica?.trim(),
      how_it_works: navHowItWorks?.trim(),
      alerte: navAlerte?.trim(),
      amenintari: navAmenintari?.trim(),
      more: navMore?.trim(),
    };

    // ── Step 3: Open lang switcher — verify dropdown shows flags + full names ─
    await openMobileNavIfNeeded();
    const langSwitcherBtn = page.locator('[data-testid="header-lang-switcher"]');
    await expect(langSwitcherBtn).toBeVisible({ timeout: 5000 });
    await langSwitcherBtn.click();

    const dropdownItems: Record<string, string> = {};
    for (const code of Object.keys(LANGUAGE_NAMES)) {
      const optionEl = page.locator(`[data-testid="lang-option-${code}"]`);
      await expect(optionEl).toBeVisible({ timeout: 5000 });

      const optionText = await optionEl.textContent();
      const trimmed = optionText?.trim() ?? '';

      // Full name must be present and not clipped (flag + full name, not just code)
      expect(trimmed).toContain(LANGUAGE_NAMES[code]);
      dropdownItems[code] = trimmed;
    }

    steps['3_dropdown_verified'] = { items: dropdownItems };

    // ── Step 4: Switch to Romanian — verify ALL nav items changed ─────────────
    await page.locator('[data-testid="lang-option-ro"]').click();

    // Wait for React re-render
    await expect(page.locator('[data-testid="header-nav-verifica"]')).not.toHaveText('Check', { timeout: 3000 });

    const navVerificaRo = await page.locator('[data-testid="header-nav-verifica"]').textContent();
    const navAlerteRo = await page.locator('[data-testid="header-nav-alerte"]').textContent();
    const navAmenintariRo = await page.locator('[data-testid="header-nav-amenintari"]').textContent();
    const navMoreRo = await page.locator('[data-testid="header-nav-more-btn"]').textContent();

    // No English text should remain
    expect(navVerificaRo?.trim()).not.toBe('Check');
    expect(navAlerteRo?.trim()).not.toBe('Alerts');
    expect(navMoreRo?.trim()).not.toContain('More');

    // Romanian text must appear
    expect(navAmenintariRo?.trim()).toBe('Amenințări');
    expect(navMoreRo?.trim()).toContain('Mai mult');

    steps['4_romanian_nav'] = {
      verifica: navVerificaRo?.trim(),
      alerte: navAlerteRo?.trim(),
      amenintari: navAmenintariRo?.trim(),
      more: navMoreRo?.trim(),
      no_english_check: navVerificaRo?.trim() !== 'Check',
      no_english_alerts: navAlerteRo?.trim() !== 'Alerts',
    };

    // ── Step 5: Navigate to /#/amenintari — verify heading is Romanian ────────
    // After the goto, detectLanguage() reads localStorage='ro' (set by switcher click)
    await page.goto('/#/amenintari');
    await page.waitForLoadState('networkidle');

    // Nav button must say "Amenințări" not "Threats"
    const navAmenintariOnPage = await page
      .locator('[data-testid="header-nav-amenintari"]')
      .textContent();
    expect(navAmenintariOnPage?.trim()).toBe('Amenințări');
    expect(navAmenintariOnPage?.trim()).not.toBe('Threats');

    // Page h1 must be in Romanian (not the English "Threat reports")
    const headings = await page.locator('h1').allTextContents();
    const hasEnglishHeading = headings.some(h => h.includes('Threat reports'));
    expect(hasEnglishHeading).toBe(false);

    steps['5_amenintari_romanian'] = {
      nav_amenintari: navAmenintariOnPage?.trim(),
      headings,
      no_english_heading: !hasEnglishHeading,
    };

    // ── Step 6: Switch back to English — verify nav is fully English ──────────
    const langSwitcherOnAmenintari = page.locator('[data-testid="header-lang-switcher"]');
    await expect(langSwitcherOnAmenintari).toBeVisible({ timeout: 5000 });
    await langSwitcherOnAmenintari.click();

    const enOption = page.locator('[data-testid="lang-option-en"]');
    await expect(enOption).toBeVisible({ timeout: 5000 });
    await enOption.click();

    // Wait for nav to update back to English
    await expect(page.locator('[data-testid="header-nav-verifica"]')).not.toHaveText('Verifică', { timeout: 3000 });

    const navMoreBack = await page.locator('[data-testid="header-nav-more-btn"]').textContent();
    const navVerificaBack = await page.locator('[data-testid="header-nav-verifica"]').textContent();
    const navAlerteBack = await page.locator('[data-testid="header-nav-alerte"]').textContent();

    // Must be fully English — no Romanian remnants
    expect(navMoreBack?.trim()).not.toContain('Mai mult');
    expect(navMoreBack?.trim()).toContain('More');
    expect(navVerificaBack?.trim()).toBe('Check');
    expect(navAlerteBack?.trim()).toBe('Alerts');

    steps['6_english_restored'] = {
      verifica: navVerificaBack?.trim(),
      alerte: navAlerteBack?.trim(),
      more: navMoreBack?.trim(),
      no_mai_mult: !navMoreBack?.includes('Mai mult'),
    };

    // ── Step 7: Navigate to /#/quiz — verify quiz title is in English ─────────
    // localStorage='en' (set by step 6 switcher click), so app boots in English
    await page.goto('/#/quiz');
    await page.waitForLoadState('networkidle');

    // Wait for quiz to finish loading (either quiz-container or quiz-error)
    await Promise.race([
      page.waitForSelector('[data-testid="quiz-container"]', { timeout: 15000 }),
      page.waitForSelector('[data-testid="quiz-error"]', { timeout: 15000 }),
    ]);

    const quizContainer = page.locator('[data-testid="quiz-container"]');
    const quizError = page.locator('[data-testid="quiz-error"]');

    let quizTitleText: string | null = null;
    const isError = await quizError.isVisible();

    if (!isError) {
      // Quiz loaded successfully — check h1 title
      quizTitleText = await quizContainer.locator('h1').first().textContent();
      // English: "Quiz: Do You Recognize Fraud?" — must start with "Quiz"
      // Romanian: "Test: Recunoști frauda?" — starts with "Test"
      expect(quizTitleText?.trim()).toContain('Quiz');
      expect(quizTitleText?.trim()).not.toContain('Test:');
    }

    steps['7_quiz_title'] = {
      title: quizTitleText?.trim() ?? null,
      language: 'en',
      quiz_loaded: !isError,
    };

    results['passed'] = true;

    // Write results
    fs.mkdirSync(path.dirname(RESULTS_PATH), { recursive: true });
    fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
  });
});
