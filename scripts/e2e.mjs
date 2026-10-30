/* DYON end-to-end scenarios (Playwright, Chromium).
   Usage: node scripts/e2e.mjs [baseUrl]    default http://127.0.0.1:8080/
   Each scenario gets a fresh context (fresh IndexedDB). Failures exit 1. */
import { chromium } from 'playwright';

const BASE = process.argv[2] || process.env.DYON_BASE || 'http://127.0.0.1:8080/';
const PHONE = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const results = [];
const browser = await chromium.launch();

async function scenario(name, opts, fn) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { const u = new URL(r.url()); if (!['127.0.0.1', 'localhost'].includes(u.hostname) && !u.protocol.startsWith('data')) errors.push('third-party request: ' + r.url()); });
  try {
    await fn(page);
    if (errors.length) throw new Error(errors.join(' | '));
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, detail: e.message.split('\n')[0] });
    await page.screenshot({ path: `/tmp/e2e-${name.replace(/\W+/g, '_')}.png` }).catch(() => {});
  }
  await ctx.close();
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const rendered = (page) => page.evaluate(() => new Promise(r => document.addEventListener('dyon:rendered', () => r(), { once: true })));

async function boot(page, { onboarded = true, locale = 'en', seed = true } = {}) {
  await page.goto(BASE + 'index.html#/');
  await page.waitForFunction(() => window.DYON && document.getElementById('boot-screen') === null);
  await page.evaluate(async ({ onboarded, locale, seed }) => {
    const S = window.DYON.store;
    await S.saveSettings({ onboarded, locale, digits: 'latn' });
    if (seed && !S.visibleCommitments().length) { const m = await import('./js/seed.js'); await m.seedDemo(); }
    window.DYON.ctx.applyLocale();
  }, { onboarded, locale, seed });
  await page.waitForTimeout(150);
}
async function tourInfo(page) {
  return page.evaluate(async () => (await import('./js/guide.js')).tourInfo());
}

/* 1. onboarding → guide → tour */
await scenario('onboarding → guide → tour (375×812)', PHONE, async (page) => {
  await boot(page, { onboarded: false, seed: false });
  await page.goto(BASE + 'index.html#/');
  await page.waitForFunction(() => location.hash === '#/onboarding');
  // Overview tour is refused before setup is done, with an explanatory toast.
  const started = await page.evaluate(async () => (await import('./js/guide.js')).startTour(0, ''));
  assert(started === false, 'overview tour started during onboarding');
  assert(/Finish setup first/.test(await page.textContent('#toast-wrap')), 'no "finish setup" toast');
  // The onboarding-specific tour runs instead.
  const onb = await page.evaluate(async () => (await import('./js/guide.js')).startTour());
  assert(onb === true, 'onboarding tour did not start');
  assert((await tourInfo(page)).page === 'onboarding', 'wrong tour page');
  await page.keyboard.press('Escape');
  // Guide opens during onboarding and back.
  await page.click('[data-tour="onb-guide"] button');
  await page.waitForFunction(() => location.hash.startsWith('#/guide'));
  await page.goto(BASE + 'index.html#/onboarding');
  await page.click('[data-tour="onb-start"] .btn:not(.btn-primary)');      // skip brain-dump
  await page.click('text=A quick tour of the Overview');
  await page.waitForSelector('.tour-bubble');
  const info = await tourInfo(page);
  assert(info && info.page === '', 'overview tour not running after finishing onboarding');
  const settings = await page.evaluate(() => window.DYON.store.state.settings);
  assert(settings.onboarded === true, 'not onboarded');
});

/* 2. tour + bottom bar */
await scenario('tour bubble stays above the bottom bar; bar is inert', PHONE, async (page) => {
  await boot(page);
  const p = rendered(page);
  await page.evaluate(() => { location.hash = '#/tour'; });
  await p;
  await page.waitForSelector('.tour-bubble');
  for (let i = 0; i < 12; i++) {
    const g = await page.evaluate(() => {
      const b = document.querySelector('.tour-bubble').getBoundingClientRect();
      const bar = document.getElementById('mobile-bar');
      const r = bar.getBoundingClientRect();
      return { bBottom: b.bottom, bTop: b.top, barTop: r.top, inert: bar.hasAttribute('inert'),
        z: [getComputedStyle(bar).zIndex, getComputedStyle(document.querySelector('.tour-bubble')).zIndex, getComputedStyle(document.querySelector('.tour-scrim')).zIndex].map(Number),
        H: innerHeight, docked: document.querySelector('.tour-bubble').classList.contains('docked') };
    });
    assert(g.inert, 'bottom bar not inert');
    assert(g.z[0] < g.z[2] && g.z[1] === 310, 'z-order wrong ' + g.z);
    assert(g.docked, 'bubble not docked on phone');
    assert(g.bTop >= 0 && g.bBottom <= g.H, 'bubble off screen');
    const info = await tourInfo(page);
    if (!(await page.evaluate(() => document.querySelector('.tour-bubble').classList.contains('dock-top'))))
      assert(g.bBottom <= g.barTop + 1, `bubble overlaps the bottom bar (${g.bBottom} > ${g.barTop}) at step ${info.step}`);
    // dock side must not change during a step, even while scrolling
    const before = info.dockTop;
    await page.mouse.wheel(0, 120); await page.waitForTimeout(450);
    const after = (await tourInfo(page)).dockTop;
    assert(before === after, 'dock side flipped during a step');
    const next = await page.$('.tour-bubble .btn-primary');
    const label = await next.textContent();
    if (/guide/i.test(label)) break;
    await next.click(); await page.waitForTimeout(500);
  }
  await page.keyboard.press('Escape');
  assert(!(await page.evaluate(() => document.getElementById('mobile-bar').hasAttribute('inert'))), 'bar stays inert after tour');
});

/* 3. route change ends the tour */
await scenario('leaving the tour page ends the tour', PHONE, async (page) => {
  await boot(page);
  await page.evaluate(async () => (await import('./js/guide.js')).startTour(0, ''));
  await page.waitForSelector('.tour-bubble');
  await page.evaluate(() => { location.hash = '#/ledger'; });
  await page.waitForTimeout(200);
  assert(!(await page.$('.tour-bubble')), 'bubble still shown after route change');
});

/* 4. missing anchors are announced, not silently dropped */
await scenario('missing targets show "not on screen yet" with Skip', PHONE, async (page) => {
  await boot(page);
  await page.evaluate(async () => {
    const gc = await import('./js/guide-content.js');
    gc.TOURS.__test = [
      { sel: '#app-header', title: { en: 'A', ar: 'A' }, body: { en: 'a', ar: 'a' } },
      { sel: '#nope-1', title: { en: 'B', ar: 'B' }, body: { en: 'b', ar: 'b' } },
      { sel: '#nope-2', title: { en: 'C', ar: 'C' }, body: { en: 'c', ar: 'c' } }
    ];
    history.replaceState(null, '', '#/__test');
  });
  await page.evaluate(async () => (await import('./js/guide.js')).startTour(0, '__test'));
  await page.waitForSelector('.tour-bubble');
  assert((await tourInfo(page)).total === 3, 'missing steps were dropped');
  await page.click('.tour-bubble .btn-primary');
  await page.waitForTimeout(100);
  assert(/isn’t on screen yet/.test(await page.textContent('.tour-bubble')), 'no missing message');
  assert(await page.$('.tour-bubble.missing'), 'missing class not set');
});

/* 5. RTL tour */
await scenario('Arabic RTL tour (375×812)', PHONE, async (page) => {
  await boot(page, { locale: 'ar' });
  assert(await page.evaluate(() => document.documentElement.dir) === 'rtl', 'not RTL');
  await page.evaluate(async () => (await import('./js/guide.js')).startTour(0, ''));
  await page.waitForSelector('.tour-bubble');
  const txt = await page.textContent('.tour-bubble');
  assert(/التالي/.test(txt), 'Arabic Next missing');
  const step0 = (await tourInfo(page)).step;
  await page.keyboard.press('ArrowLeft');                 // in RTL ← is "next"
  await page.waitForTimeout(500);
  assert((await tourInfo(page)).step === step0 + 1, 'ArrowLeft did not advance in RTL');
  const g = await page.evaluate(() => { const b = document.querySelector('.tour-bubble').getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth; });
  assert(g, 'bubble overflows horizontally');
  assert(await page.evaluate(() => document.title.includes('ديون')), 'title not localised');
});

/* 5b. French tour (T-1.10b) */
await scenario('French tour (375×812)', PHONE, async (page) => {
  await boot(page, { locale: 'fr' });
  const h = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir }));
  assert(h.lang === 'fr' && h.dir === 'ltr', `lang/dir ${h.lang}/${h.dir}`);
  await page.evaluate(async () => (await import('./js/guide.js')).startTour(0, ''));
  await page.waitForSelector('.tour-bubble');
  assert(/Suivant/.test(await page.textContent('.tour-bubble')), 'French "Suivant" missing');
  const step0 = (await tourInfo(page)).step;
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(500);
  assert((await tourInfo(page)).step === step0 + 1, 'ArrowRight did not advance');
  const g = await page.evaluate(() => {
    const b = document.querySelector('.tour-bubble'); const r = b.getBoundingClientRect();
    const bar = document.getElementById('mobile-bar').getBoundingClientRect();
    return { ok: r.left >= 0 && r.right <= innerWidth, above: b.classList.contains('dock-top') || r.bottom <= bar.top + 1,
      over: document.documentElement.scrollWidth - innerWidth };
  });
  assert(g.ok && g.over <= 1, 'bubble or page overflows horizontally');
  assert(g.above, 'bubble overlaps the bottom bar');
});

/* 5c. language aside (T-2.5b) */
for (const [label, opts] of [['375×812', PHONE], ['1280×800', { viewport: { width: 1280, height: 800 } }]]) {
  for (const loc of ['en', 'ar']) {
    await scenario(`language aside ${loc} (${label})`, opts, async (page) => {
      await boot(page, { locale: loc });
      const hash0 = await page.evaluate(() => location.hash);
      const hist0 = await page.evaluate(() => history.length);
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      await page.keyboard.press('l');
      await page.waitForSelector('#aside-lang');
      const a = await page.evaluate(() => {
        const p = document.getElementById('aside-lang'); const r = p.getBoundingClientRect();
        return { role: p.getAttribute('role'), modal: p.getAttribute('aria-modal'),
          exp: document.getElementById('lang-toggle').getAttribute('aria-expanded'),
          left: r.left, right: r.right, W: innerWidth, dir: document.documentElement.dir };
      });
      assert(a.role === 'dialog' && a.modal === 'true', 'aside is not a modal dialog');
      assert(a.exp === 'true', 'lang-toggle not aria-expanded');
      if (a.dir === 'rtl') assert(a.left <= 1, `RTL aside not at the left edge (${a.left})`);
      else assert(a.right >= a.W - 1, `LTR aside not at the right edge (${a.right}/${a.W})`);
      await page.fill('#lang-search', 'fran');
      const shown = await page.$$eval('#lang-list button', bs => bs.map(b => b.dataset.lang));
      assert(shown.length === 1 && shown[0] === 'fr', 'filter "fran" → ' + shown.join(','));
      await page.fill('#lang-search', '');
      for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
      assert(await page.evaluate(() => document.getElementById('aside-lang').contains(document.activeElement)), 'focus escaped the aside');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.getElementById('aside-lang'));
      assert(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'lang-toggle', 'focus not returned to #lang-toggle');
      const after = await page.evaluate(() => ({ h: location.hash, n: history.length }));
      assert(after.h === hash0 && after.n === hist0, 'aside changed the route or history');
      // choose French
      await page.click('#lang-toggle');
      await page.waitForSelector('#aside-lang');
      await page.click('#lang-list button[data-lang="fr"]');
      await page.waitForFunction(() => document.documentElement.lang === 'fr');
      assert(await page.evaluate(() => window.DYON.store.state.settings.locale_chosen) === true, 'locale_chosen not saved');
      // never auto-switch after an explicit choice
      await page.goto(BASE + 'index.html?lang=en#/');
      await page.waitForFunction(() => window.DYON && document.getElementById('boot-screen') === null);
      await page.waitForTimeout(200);
      assert(await page.evaluate(() => document.documentElement.lang) === 'fr', '?lang=en overrode the chosen language');
    });
  }
}

/* 5d. offline in all three languages (T-2.1b) */
await scenario('works offline in en, ar and fr', { viewport: { width: 1280, height: 800 } }, async (page) => {
  await boot(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 10000 });
  await page.context().setOffline(true);
  await page.reload();
  await page.waitForFunction(() => window.DYON && document.getElementById('boot-screen') === null, null, { timeout: 10000 });
  for (const loc of ['ar', 'fr', 'en']) {
    await page.evaluate(async (loc) => { await window.DYON.store.saveSettings({ locale: loc }); await window.DYON.ctx.applyLocale(); }, loc);
    await page.waitForFunction((loc) => document.documentElement.lang === loc, loc, { timeout: 5000 });
    const txt = await page.textContent('#app-header');
    assert(!/\b[a-z]+\.[a-z_]+\b/.test(txt.replace(/dyon\.store/g, '')), `raw key visible offline in ${loc}: ${txt.slice(0, 80)}`);
  }
  await page.context().setOffline(false);
});

/* 6. no horizontal overflow at the three breakpoints, light and dark */
for (const w of [360, 768, 1280]) {
  for (const theme of ['light', 'dark']) {
    await scenario(`no horizontal scroll at ${w}px (${theme})`, { viewport: { width: w, height: 800 } }, async (page) => {
      await boot(page);
      await page.evaluate(async (theme) => { await window.DYON.store.saveSettings({ theme }); window.DYON.ctx.applyTheme(); }, theme);
      for (const loc of ['en', 'ar', 'fr']) {
        await page.evaluate(async (loc) => { await window.DYON.store.saveSettings({ locale: loc }); await window.DYON.ctx.applyLocale(); }, loc);
        for (const r of ['', 'ledger', 'settings', 'guide']) {
          await page.evaluate(r => { location.hash = '#/' + r; }, r);
          await page.waitForTimeout(150);
          const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
          assert(over <= 1, `overflow ${over}px on #/${r} (${loc})`);
        }
      }
    });
  }
}

await browser.close();
const failed = results.filter(r => !r.ok);
for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
console.log(`e2e: ${results.length - failed.length} passed · ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
