/* DYON — application shell: theme, locale, router, navigation, PWA install. */

import { t, setLocale, setDigits, setCalendars, getLocale, getDir, LOCALES, formatNumber, ensureLocale } from './i18n.js';
import * as S from './store.js';
import * as F from './flows.js';
import * as V from './views.js';
import * as V2 from './views2.js';
import { seedDemo } from './seed.js';
import { renderGuide, startTour, endTour, tourDone, tourActive, repaintTour, openHelp } from './guide.js';
import * as AUTH from './auth.js';
import * as QR from './qr.js';
import { el, icon, clear, toast, registerShortcut, closeSheet, sheet, input, confirmSheet } from './ui.js';
import * as VAL from './validate.js';
import { openLanguageAside } from './lang-aside.js';
import { detectLocale } from './i18n.js';

const app = {
  root: null,
  deferredPrompt: null
};

/* ---------------- theme ---------------- */
function applyTheme() {
  const pref = S.state.settings.theme || 'system';
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0b1020' : '#f6f7fb');
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    clear(btn).appendChild(icon(dark ? 'fa-sun' : 'fa-moon'));
    btn.setAttribute('aria-label', dark ? t('mode.light') : t('mode.dark'));
  }
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if ((S.state.settings.theme || 'system') === 'system') applyTheme();
});

/* ---------------- locale ---------------- */
async function applyLocale() {
  const s = S.state.settings;
  await ensureLocale(s.locale);
  setLocale(s.locale);
  setDigits(s.digits);
  setCalendars(s.calendar_primary, s.calendar_secondary);
  const dir = getDir();
  document.documentElement.lang = s.locale;
  document.documentElement.dir = dir;
  document.body.dir = dir;
  document.title = s.discreet_mode ? t('app.title_discreet') : t('app.title');
  buildChrome();
  render();
}

/* ---------------- greeting ---------------- */
export function greeting(date = new Date()) {
  const s = S.state.settings;
  const h = date.getHours();
  const g = s.islamic_mode ? t('greet.salam')
    : h < 12 ? t('greet.morning') : h < 18 ? t('greet.afternoon') : t('greet.evening');
  const name = (s.display_name || '').trim();
  return name ? t('greet.with_name', { greeting: g, name }) : g;
}

/* ---------------- navigation model ---------------- */
const NAV = [
  { group: 'nav.group.main', items: [
    { route: '', i18n: 'nav.overview', icon: 'fa-gauge-high' },
    { route: 'ledger', i18n: 'nav.ledger', icon: 'fa-book-open' },
    { route: 'people', i18n: 'nav.people', icon: 'fa-users' },
    { route: 'inbox', i18n: 'nav.inbox', icon: 'fa-inbox', badge: true },
    { route: 'calendar', i18n: 'nav.calendar', icon: 'fa-calendar-days' }
  ]},
  { group: 'nav.group.modules', items: [
    { route: 'promises', i18n: 'nav.promises', icon: 'fa-comment-dots' },
    { route: 'services', i18n: 'nav.services', icon: 'fa-clock-rotate-left' },
    { route: 'trusts', i18n: 'nav.trusts', icon: 'fa-box-archive' },
    { route: 'plans', i18n: 'nav.plans', icon: 'fa-list-check' }
  ]},
  { group: 'nav.group.care', items: [
    { route: 'guide', i18n: 'nav.guide', icon: 'fa-graduation-cap' },
    { route: 'calm', i18n: 'mode.calm', icon: 'fa-dove' },
    { route: 'vault', i18n: 'nav.vault', icon: 'fa-shield-halved' },
    { route: 'reports', i18n: 'nav.reports', icon: 'fa-chart-simple' },
    { route: 'islamic', i18n: 'nav.islamic', icon: 'fa-mosque', islamic: true },
    { route: 'settings', i18n: 'nav.settings', icon: 'fa-gear' },
    { route: 'about', i18n: 'nav.about', icon: 'fa-circle-info' }
  ]}
];

/* ---------------- chrome (header, rail, mobile bar) ---------------- */
function buildChrome() {
  const s = S.state.settings;
  const header = document.getElementById('app-header');
  const rail = document.getElementById('side-rail');
  const mbar = document.getElementById('mobile-bar');
  const queueCount = S.actionQueue().length;

  clear(header).append(
    el('a', { class: 'brand', href: '#/', 'aria-label': 'DYON' }, [
      el('span', { class: 'brand-mark', text: s.discreet_mode ? 'N' : 'د' }),
      el('span', { class: 'brand-text' }, [
        el('b', { text: s.discreet_mode ? 'Notes' : t('app.name') }),
        el('span', { text: s.discreet_mode ? 'list' : t('app.tagline') })
      ])
    ]),
    el('span', { class: 'greeting', text: greeting() }),
    el('div', { class: 'header-spacer' }),
    el('div', { class: 'header-tools' }, [
      el('button', {
        class: 'icon-btn', id: 'lang-toggle', type: 'button', 'data-tour': 'lang',
        'aria-label': t('lang.button', { language: LOCALES[getLocale()].native }),
        title: t('lang.button', { language: LOCALES[getLocale()].native }),
        'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': 'aside-lang',
        onclick: (e) => openLanguageAside(e.currentTarget, { applyLocale })
      }, [icon('fa-language')]),
      el('button', {
        class: 'icon-btn', id: 'help-btn', 'data-tour': 'guide', type: 'button',
        'aria-label': t('nav.guide'), title: t('nav.guide'), 'aria-haspopup': 'dialog',
        onclick: () => openHelp(parseHash().path)
      }, [icon('fa-circle-question')]),
      el('button', {
        class: 'icon-btn' + (s.calm_mode ? ' on' : ''), id: 'calm-toggle', type: 'button',
        'aria-label': t('mode.calm'), title: t('mode.calm'), 'data-tour': 'calm',
        onclick: () => V.toggleCalm()
      }, [icon('fa-dove')]),
      el('button', {
        class: 'icon-btn hide-mobile', id: 'theme-toggle', type: 'button', 'aria-label': t('mode.dark'),
        onclick: async () => {
          const dark = document.documentElement.getAttribute('data-theme') === 'dark';
          await S.saveSettings({ theme: dark ? 'light' : 'dark' });
          applyTheme();
        }
      }, [icon('fa-moon')]),
      el('button', {
        class: 'icon-btn hide-mobile', id: 'inbox-btn', type: 'button', 'aria-label': t('inbox.title'),
        style: { position: 'relative' },
        onclick: () => { location.hash = '#/inbox'; }
      }, [icon('fa-bell'), queueCount ? el('span', { class: 'dot' }) : null]),
      accountButton(),
      el('button', {
        class: 'btn btn-primary hide-mobile', id: 'quick-add-btn', type: 'button', 'data-tour': 'add',
        onclick: () => F.openQuickAdd()
      }, [icon('fa-plus'), el('span', { text: t('action.add_short') })])
    ])
  );

  clear(rail);
  for (const g of NAV) {
    const items = g.items.filter(i => !i.islamic || s.islamic_mode);
    const grp = el('div', { class: 'rail-group' }, [el('h4', { text: t(g.group) })]);
    for (const i of items) {
      grp.appendChild(el('a', {
        class: 'rail-link', href: '#/' + i.route, 'data-route': i.route
      }, [
        icon(i.icon, 'ri'),
        el('span', { text: t(i.i18n) }),
        i.badge && queueCount ? el('span', { class: 'rail-badge', text: formatNumber(queueCount) }) : null
      ]));
    }
    rail.appendChild(grp);
  }
  rail.appendChild(el('p', { class: 'notice', text: t('set.offline_ready') }));

  clear(mbar).appendChild(el('nav', { 'aria-label': 'primary' }, [
    mbItem('', 'fa-gauge-high', t('nav.overview')),
    mbItem('ledger', 'fa-book-open', t('nav.ledger')),
    el('button', { class: 'mb-fab', type: 'button', 'data-tour': 'add', 'aria-label': t('action.add'), onclick: () => F.openQuickAdd() }, [icon('fa-plus')]),
    mbItem('inbox', 'fa-inbox', t('nav.inbox'), queueCount),
    el('button', { class: 'mb-item', type: 'button', id: 'more-btn', 'aria-haspopup': 'dialog', onclick: () => openMore() },
      [icon('fa-bars'), el('span', { text: t('nav.more') })])
  ]));

  applyTheme();
  markActive();
}
function accountButton() {
  const a = AUTH.session();
  return el('button', {
    class: 'icon-btn' + (a ? ' on' : ''), id: 'account-btn', type: 'button',
    'aria-label': a ? (a.name || 'Account') : (t('app.link_account')),
    title: a ? (a.name || '') : (t('app.link_account')),
    onclick: () => { if (a) location.hash = '#/settings?s=account'; else AUTH.openSignIn(); }
  }, [a ? el('span', { class: 'acct-initial', text: (a.name || '?').trim().slice(0, 1).toUpperCase() }) : icon('fa-user')]);
}
function mbItem(route, iconName, label, badge) {
  return el('a', { class: 'mb-item', href: '#/' + route, 'data-route': route }, [
    icon(iconName), el('span', { text: label }), badge ? el('span', { class: 'mb-dot' }) : null
  ]);
}
function markActive() {
  const current = (location.hash.replace(/^#\/?/, '').split('?')[0]) || '';
  document.querySelectorAll('[data-route]').forEach(a => {
    a.classList.toggle('active', a.dataset.route === current);
    if (a.dataset.route === current) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

/* ---------------- "More" sheet for mobile ---------------- */
/* Opened as a sheet, never as a route: closing it must not touch history,
   otherwise tapping a link would navigate and then immediately go "back". */
function openMore() {
  const s = S.state.settings;
  const chevron = getDir() === 'rtl' ? 'fa-chevron-left' : 'fa-chevron-right';
  const go = (hash) => { closeSheet(true); if (location.hash === hash) render(); else location.hash = hash; };
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const quick = el('div', { class: 'more-quick' }, [
    el('button', { class: 'chip', type: 'button', onclick: async () => {
      closeSheet(true); await S.saveSettings({ theme: dark ? 'light' : 'dark' }); applyTheme();
    } }, [icon(dark ? 'fa-sun' : 'fa-moon'), el('span', { text: dark ? t('mode.light') : t('mode.dark') })]),
    el('button', { class: 'chip' + (s.calm_mode ? ' on' : ''), type: 'button', onclick: () => { closeSheet(true); V.toggleCalm(); } },
      [icon('fa-dove'), el('span', { text: t('mode.calm') })]),
    el('button', { class: 'chip', type: 'button', onclick: () => { closeSheet(true); startTour(); } },
      [icon('fa-location-crosshairs'), el('span', { text: t('guide.tour') })]),
    el('button', { class: 'chip', type: 'button', onclick: () => {
      closeSheet(true);
      if (AUTH.isSignedIn()) go('#/settings?s=account'); else setTimeout(() => AUTH.openSignIn(), 60);
    } }, [icon('fa-user-shield'), el('span', { text: AUTH.isSignedIn() ? (t('app.my_account')) : (t('app.link_account_2')) })])
  ]);
  const groups = NAV.map(g => {
    const items = g.items.filter(i => !i.islamic || s.islamic_mode);
    return el('div', { class: 'more-group' }, [
      el('h4', { text: t(g.group) }),
      el('ul', { class: 'listy' }, items.map(i => el('li', {}, [
        el('button', { class: 'item-row', type: 'button', onclick: () => go('#/' + i.route) }, [
          icon(i.icon, 'fa-fw'), el('span', { class: 'item-main' }, [el('b', { text: t(i.i18n) })]),
          icon(chevron)
        ])
      ])))
    ]);
  });
  sheet({ title: t('nav.more'), body: el('div', { class: 'stack' }, [quick, ...groups]) });
}

/* ---------------- router ---------------- */
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  return { path: path || '', params: new URLSearchParams(qs || '') };
}

let lastRoute = null;
function render() {
  const { path, params } = parseHash();
  const routeKey = location.hash || '#/';
  const routeChanged = routeKey !== lastRoute;
  lastRoute = routeKey;
  /* One-shot routes act and then rewrite themselves to '#/', so a later
     re-render (every save re-renders) never repeats the action. */
  const oneShot = (fn, delay) => {
    history.replaceState(null, '', location.pathname + location.search + '#/');
    lastRoute = '#/';
    setTimeout(fn, delay);
  };
  const main = document.getElementById('main-area');
  const s = S.state.settings;

  document.body.classList.toggle('calm', !!s.calm_mode);

  if (!s.onboarded && !['onboarding', 'about', 'guide', 'r'].includes(path)) {
    location.hash = '#/onboarding';
    return;
  }

  let view;
  switch (path) {
    case '': view = V.renderOverview(); break;
    case 'ledger': view = V.renderLedger(params); break;
    case 'people': view = V.renderPeople(params); break;
    case 'promises': view = V2.renderPromises(); break;
    case 'services': view = V2.renderServices(); break;
    case 'trusts': view = V2.renderTrusts(); break;
    case 'plans': view = V2.renderPlans(); break;
    case 'calendar': view = V2.renderCalendar(); break;
    case 'inbox': view = V2.renderInbox(); break;
    case 'vault': view = V2.renderVault(); break;
    case 'reports': view = V2.renderReports(); break;
    case 'islamic': view = V2.renderIslamic(); break;
    case 'calm': view = V2.renderCalm(); break;
    case 'settings': view = V2.renderSettings(ctx); break;
    case 'about': view = V2.renderAbout(); break;
    case 'guide': view = renderGuide(params); break;
    case 'r': view = QR.renderRequest(params, { onAdd: (pre) => {
      const { amount, ...rest } = pre;
      const prefill = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined && v !== ''));
      prefill.amount_minor = amount || 0;
      if (!amount) { prefill.type = 'T-07'; prefill.unit_code = 'PROMISE'; }
      F.openQuickAdd(prefill);
    } }); break;
    case 'tour': view = V.renderOverview(); oneShot(() => startTour(0, ''), 0); break;
    case 'onboarding': view = V2.renderOnboarding(ctx); break;
    case 'add': view = V.renderOverview(); oneShot(() => F.openQuickAdd(), 100); break;
    case 'demo':
      view = V.renderOverview();
      if (!S.visibleCommitments().length) {
        seedDemo().then(() => { location.hash = '#/'; });
      } else location.hash = '#/';
      break;
    case 'more': view = V.renderOverview(); oneShot(openMore, 50); break;
    default: view = V.renderOverview();
  }
  /* Re-renders caused by a save keep the reader exactly where they were;
     only an actual navigation starts the new screen at the top. */
  const keepY = routeChanged ? 0 : window.scrollY;
  if (routeChanged) endTour(true);   // a route change invalidates any anchored coach mark
  clear(main).appendChild(view);
  markActive();
  if (routeChanged) {
    window.scrollTo(0, 0);
    if (params.get('s')) setTimeout(() => document.getElementById(params.get('s') + '-card')?.scrollIntoView({ block: 'start' }), 60);
  } else {
    window.scrollTo(0, keepY);
    if (tourActive()) repaintTour();
  }
  /* Signals "this route is painted" — the tour (and tests) await this
     instead of guessing with a timer. */
  document.dispatchEvent(new CustomEvent('dyon:rendered', { detail: { path, routeChanged } }));
}

/* ---------------- context for views ---------------- */
const ctx = {
  applyLocale,
  applyTheme,
  rerender: render,
  refreshHeader: buildChrome,
  promptInstall: async () => {
    if (app.deferredPrompt) {
      app.deferredPrompt.prompt();
      const res = await app.deferredPrompt.userChoice;
      app.deferredPrompt = null;
      toast(res.outcome === 'accepted' ? t('misc.saved') : t('action.cancel'), 'good');
    } else {
      toast(t('app.use_browser_menu_add'));
    }
  },
  seed: async () => {
    confirmSheet({
      title: t('set.seed'),
      message: t('app.adds_demo_ledger_alongside'),
      confirmLabel: t('set.seed'),
      onConfirm: async () => { await seedDemo(); toast(t('misc.saved'), 'good'); applyLocale(); }
    });
  }
};

/* ---------------- PIN gate (local convenience only, never real security) --- */
function pinGate() {
  return new Promise(resolve => {
    const s = S.state.settings;
    if (!s.pin_enabled || !s.pin) return resolve();
    const pinInput = input({ type: 'password', inputmode: 'numeric', placeholder: '••••',
      maxlength: '8', autocomplete: 'current-password', 'aria-label': t('set.lock') });
    const err = el('div', { class: 'err' });
    let attempts = 0;

    const overlay = el('div', {
      style: {
        position: 'fixed', inset: '0', zIndex: '400', background: 'var(--bg)',
        display: 'grid', placeItems: 'center', padding: '24px'
      }
    }, [
      el('div', { class: 'card', style: { maxWidth: '380px', width: '100%' } }, [
        el('div', { class: 'brand-mark', style: { marginBottom: '12px' }, text: 'د' }),
        el('h2', { text: t('set.lock') }),
        pinInput,
        err,
        el('button', { class: 'btn btn-primary btn-block', style: { marginTop: '12px' },
          text: t('action.open'), onclick: check }),
        el('p', { class: 'notice', text: t('set.lock_hint') })
      ])
    ]);

    function check() {
      err.replaceChildren();
      const val = pinInput.value.trim();
      if (!val) {
        pinInput.setAttribute('aria-invalid', 'true');
        err.append(icon('fa-circle-exclamation'), el('span', { text: VAL.MSG.required() }));
        return;
      }
      if (val === s.pin) { overlay.remove(); resolve(); return; }
      attempts++;
      pinInput.value = '';
      pinInput.setAttribute('aria-invalid', 'true');
      err.append(icon('fa-circle-exclamation'), el('span', {
        text: t('app.pin_wrong', { hint: attempts >= 3 ? 'yes' : 'no' })
      }));
      pinInput.focus();
    }
    pinInput.addEventListener('input', () => { pinInput.removeAttribute('aria-invalid'); err.replaceChildren(); });
    pinInput.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
    document.body.appendChild(overlay);
    setTimeout(() => pinInput.focus(), 100);
  });
}

/* ---------------- service worker: ask, never update silently (1.8) ---- */
let swPrompted = false;
function promptUpdate(worker) {
  if (swPrompted || !worker) return;
  swPrompted = true;
  toast(t('sw.update_ready'), '', {
    label: t('sw.reload'),
    persist: true,
    onClick: () => worker.postMessage({ type: 'SKIP_WAITING' })
  });
}
async function registerSW() {
  let reg;
  try { reg = await navigator.serviceWorker.register('sw.js'); } catch { return; }
  const hadController = !!navigator.serviceWorker.controller;
  if (reg.waiting && hadController) promptUpdate(reg.waiting);
  reg.addEventListener('updatefound', () => {
    const w = reg.installing;
    if (!w) return;
    w.addEventListener('statechange', () => {
      if (w.state === 'installed' && navigator.serviceWorker.controller) promptUpdate(w);
    });
  });
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;      // first install: nothing to reload
    reloading = true;
    location.reload();
  });
  setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
}

/* ---------------- boot ---------------- */
/* Remove the first-paint loader. Idempotent so it can be called at several
   points (before the PIN gate, after a successful boot, and in the catch). */
function hideBootScreen() {
  document.getElementById('boot-screen')?.remove();
}

/* First-run language (v2.0 §2.4): saved choice → ?lang= → browser languages
   → country default → en. Once the user has chosen (locale_chosen), never
   auto-switch again. */
export async function firstRunLocale(countryLocales = []) {
  const s = S.state.settings;
  if (s.locale_chosen) return;
  const r = detectLocale({ search: location.search, languages: navigator.languages, countryLocales });
  if (r.locale !== s.locale || !s.locale_detected) await S.saveProgress({ locale: r.locale, locale_detected: r });
}

async function boot() {
  await S.load();
  await firstRunLocale();
  await AUTH.handleRedirect();   // must run before the hash router sees #id_token=…
  if (window.DYON_AUTOSEED && !S.visibleCommitments().length) {
    await seedDemo();
    await S.load();
  }
  if (window.DYON_FORCE_AR) {
    await S.saveSettings({ locale: 'ar', digits: 'arab', islamic_mode: true,
      calendar_primary: 'islamic-umalqura', calendar_secondary: 'gregory', theme: 'dark' });
  }
  await applyLocale();    // loads locale files, builds chrome + first render

  /* Hide the boot loader BEFORE the PIN gate. The loader sits at z-index 500;
     the PIN overlay at 400. If we leave the loader up during pinGate() it
     covers the prompt, the user can never type the PIN, pinGate() never
     resolves and the page is stuck on the loader after a reload. Removing it
     here also covers every other path that awaits something after the first
     render (e.g. the onboarding-defaults suggestion). */
  hideBootScreen();
  await pinGate();

  /* Views that manage their own live state (the onboarding brain-dump keeps
     half-typed rows) are not rebuilt by a save on the same route. */
  S.subscribe(() => {
    buildChrome();
    const { path } = parseHash();
    if (path === 'onboarding' && (location.hash || '#/') === lastRoute && S.state.settings.onboarded === false) return;
    render();
  });
  window.addEventListener('hashchange', render);

  registerShortcut('n', () => F.openQuickAdd());
  registerShortcut('c', () => V.toggleCalm());
  registerShortcut('l', () => { const b = document.getElementById('lang-toggle'); if (b) openLanguageAside(b, { applyLocale }); });
  registerShortcut('?', () => { location.hash = '#/guide'; });
  registerShortcut('/', () => {
    if (!location.hash.startsWith('#/ledger')) location.hash = '#/ledger';
    setTimeout(() => document.getElementById('search-input')?.focus(), 150);
  });

  /* Release undo-window reminders (RL-10) */
  const pending = S.activeUndoWindows();
  if (pending.length) {
    const hrs = Math.ceil((pending[0].undo_until - Date.now()) / 36e5);
    setTimeout(() => toast(t('flow.release_undo_left', { hours: hrs })), 1500);
  }

  /* PWA */
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); app.deferredPrompt = e; });
  if ('serviceWorker' in navigator) registerSW();

  hideBootScreen();   // idempotent — already hidden before the PIN gate
}

boot().catch(err => {
  console.error(err);
  const main = document.getElementById('main-area');
  if (main) main.textContent = 'Startup error: ' + err.message;
  hideBootScreen();
});

window.DYON = { store: S, ctx };
