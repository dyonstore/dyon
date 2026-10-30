/* Runs the in-browser harnesses headlessly and fails on any failure.
   Usage: node scripts/run-harness.mjs [baseUrl]   (default http://127.0.0.1:8080/) */
import { chromium } from 'playwright';

const BASE = process.argv[2] || process.env.DYON_BASE || 'http://127.0.0.1:8080/';
const PAGES = ['tests.html', 'route-check.html', 'flow-check.html', 'i18n-tests.html'];

const browser = await chromium.launch();
let failed = 0;
for (const p of PAGES) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  const res = await page.goto(BASE + p).catch(() => null);
  if (!res || res.status() === 404) { console.log(`- ${p}: (absent, skipped)`); await ctx.close(); continue; }
  try {
    await page.waitForFunction(() => /passed/.test(document.getElementById('summary')?.textContent || ''), null, { timeout: 90000 });
  } catch { errors.push('timeout waiting for summary'); }
  const summary = (await page.textContent('#summary').catch(() => '')).trim();
  const m = summary.match(/(\d+) passed · (\d+) failed/);
  const bad = !m || +m[2] > 0;
  if (bad) failed++;
  console.log(`${bad ? '✗' : '✓'} ${p}: ${summary}`);
  if (bad) errors.slice(0, 40).forEach(e => console.log('    ' + e));
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
