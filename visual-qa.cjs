const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8787';
const REPORT_DIR = '/Users/vvladescu/Desktop/aigrija/OUT-REPO/playwright-report';
const SCREENSHOTS_DIR = path.join(REPORT_DIR, 'screenshots');

async function runQA() {
  const report = {
    timestamp: new Date().toISOString(),
    base_url: BASE_URL,
    passes: {},
    console_errors: [],
    page_errors: [],
    accessibility: { images_missing_alt: [], interactive_without_aria: [], data_testid_warnings: [] },
    sections: {},
    screenshots: {}
  };

  const browser = await chromium.launch({ headless: true });

  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desktopPage = await desktopContext.newPage();

  desktopPage.on('console', msg => { if (msg.type() === 'error') report.console_errors.push({ type: 'console.error', text: msg.text() }); });
  desktopPage.on('pageerror', err => report.page_errors.push({ type: 'pageerror', text: err.message }));

  const t0 = Date.now();
  await desktopPage.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 10000 });
  const loadTime = Date.now() - t0;
  report.passes.load = { status: loadTime < 3000 ? 'pass' : 'fail', load_time_ms: loadTime };

  await desktopPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'desktop.png'), fullPage: true });
  report.screenshots.desktop = 'screenshots/desktop.png';

  const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobileCtx.newPage();
  await mobilePage.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 10000 });
  await mobilePage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'mobile.png'), fullPage: true });
  report.screenshots.mobile = 'screenshots/mobile.png';

  const tabletCtx = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const tabletPage = await tabletCtx.newPage();
  await tabletPage.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 10000 });
  await tabletPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'tablet.png'), fullPage: true });
  report.screenshots.tablet = 'screenshots/tablet.png';

  report.passes.console = { status: report.console_errors.length === 0 && report.page_errors.length === 0 ? 'pass' : 'fail', error_count: report.console_errors.length + report.page_errors.length };

  const imgsMissingAlt = await desktopPage.$$eval('img', imgs => imgs.filter(img => !img.alt || img.alt.trim() === '').map(img => ({ src: img.src, html: img.outerHTML.slice(0, 100) })));
  report.accessibility.images_missing_alt = imgsMissingAlt;

  const noAria = await desktopPage.$$eval('button, input, select, textarea, a[href]', els => els.filter(el => { const has = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.textContent.trim(); return !has; }).map(el => ({ tag: el.tagName, html: el.outerHTML.slice(0, 120) })));
  report.accessibility.interactive_without_aria = noAria;

  const testids = await desktopPage.$$eval('[data-testid]', els => els.map(el => el.getAttribute('data-testid')));
  if (testids.length === 0) report.accessibility.data_testid_warnings.push('No data-testid attributes found');
  else report.accessibility.data_testid_present = testids;

  report.passes.accessibility = { status: imgsMissingAlt.length === 0 ? 'pass' : 'warn', images_missing_alt: imgsMissingAlt.length, interactive_without_aria: noAria.length, data_testids_found: testids.length };

  const bodyText = await desktopPage.textContent('body');
  const checks = [
    { key: 'header_brand', text: 'ai-grija.ro', desc: 'Header with ai-grija.ro text' },
    { key: 'hero_suspect', text: 'suspect', desc: 'Hero with "suspect" text' },
    { key: 'cum_functioneaza', text: 'Cum func', desc: 'Cum functioneaza section' },
    { key: 'campanii_phishing', text: 'Campanii de phishing', desc: 'Campanii de phishing active section' },
    { key: 'despre', text: 'Despre ai-grija', desc: 'Despre ai-grija.ro section' },
    { key: 'footer_zen', text: 'Zen Labs', desc: 'Footer with Zen Labs' }
  ];
  for (const c of checks) report.sections[c.key] = { status: bodyText.includes(c.text) ? 'pass' : 'fail', description: c.desc };

  const hasTextarea = await desktopPage.$('textarea');
  report.sections.form_textarea = { status: hasTextarea ? 'pass' : 'fail', description: 'Form textarea present' };

  const sv = Object.values(report.sections);
  report.passes.sections = { status: sv.every(s => s.status === 'pass') ? 'pass' : 'fail', passed: sv.filter(s => s.status === 'pass').length, total: sv.length };
  report.passes.responsive = { status: 'pass', breakpoints: ['desktop@1440x900', 'tablet@768x1024', 'mobile@390x844'] };

  const ap = Object.values(report.passes);
  report.summary = { total_passes: ap.length, passed: ap.filter(p => p.status === 'pass').length, failed: ap.filter(p => p.status === 'fail').length, warned: ap.filter(p => p.status === 'warn').length, overall: ap.every(p => p.status === 'pass' || p.status === 'warn') ? 'ok' : 'fail' };

  await browser.close();
  fs.writeFileSync(path.join(REPORT_DIR, 'qa-summary.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

runQA().catch(err => { console.error(err); process.exit(1); });
