/* DYON — the beginner guide view and the in-app coach-mark tour.
   Both are paged with explicit Next / Previous controls, so nobody has to
   guess where they are or how to get back. */

import { t, tr, getLocale, getDir, formatNumber } from './i18n.js';
import * as S from './store.js';
import { GUIDE, TOURS, SCREEN_HELP } from './guide-content.js';
import { el, icon, clear, toast, sheet, closeSheet } from './ui.js';

const L = (obj) => tr(obj);
const go = (h) => { location.hash = h; };

/* Guide progress lives in the IndexedDB settings row (1.9), so export and
   import carry it and "Delete everything" clears it with the rest. */
export function readChapters() {
  const v = S.state.settings.guide_read;
  return Array.isArray(v) ? v : [];
}
function markRead(id) {
  const seen = readChapters();
  if (seen.includes(id)) return;
  S.saveProgress({ guide_read: [...seen, id] });
}

/* ======================================================================
   GUIDE VIEW  —  #/guide  and  #/guide?p=<id>
   ====================================================================== */
export function renderGuide(params) {
  const id = params.get('p');
  if (id === 'glossary') return renderGlossary(params.get('q') || '');
  if (!id) return renderGuideIndex();

  const i = GUIDE.findIndex(c => c.id === id);
  if (i === -1) return renderGuideIndex();
  const chapter = GUIDE[i];
  const prev = GUIDE[i - 1] || null;
  const next = GUIDE[i + 1] || null;
  markRead(chapter.id);

  const wrap = el('div', { class: 'stack fade-in', style: { maxWidth: '820px', margin: '0 auto' } });

  const pct = Math.round(((i + 1) / GUIDE.length) * 100);
  wrap.append(
    el('div', { class: 'row between' }, [
      el('button', { class: 'btn btn-sm btn-ghost', onclick: () => go('#/guide') },
        [icon(getDir() === 'rtl' ? 'fa-arrow-right' : 'fa-arrow-left'),
         el('span', { text: t('guide.all_chapters') })]),
      el('span', { class: 'badge', text: `${formatNumber(i + 1)} / ${formatNumber(GUIDE.length)}` })
    ]),
    el('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': String(pct),
      'aria-valuemin': '0', 'aria-valuemax': '100',
      'aria-label': t('guide.guide_progress') },
      [el('i', { style: { width: pct + '%' } })])
  );

  wrap.append(el('section', { class: 'card card-hero' }, [
    el('div', { class: 'row tight' }, [
      el('span', { style: { fontSize: '1.6rem' } }, [icon(chapter.icon)]),
      el('h1', { text: L(chapter.title), style: { margin: '0' } })
    ]),
    el('p', { text: L(chapter.lead), style: { marginBottom: '0' } })
  ]));

  for (const b of chapter.blocks || []) {
    if (b.type === 'why' || b.type === 'tip') {
      wrap.append(el('section', { class: 'card card-accent' }, [
        el('div', { class: 'row tight' }, [
          icon(b.type === 'tip' ? 'fa-lightbulb' : 'fa-circle-question'),
          el('h3', { style: { margin: '0' },
            text: L(b.title) || (b.type === 'tip' ? (t('guide.tip')) : (t('guide.why'))) })
        ]),
        el('p', { text: L(b.body), style: { marginBottom: '0', marginTop: '8px' } })
      ]));
    } else if (b.type === 'list') {
      wrap.append(el('section', { class: 'card' }, [
        b.title ? el('h3', { text: L(b.title) }) : null,
        el('ul', { class: 'listy' }, b.items.map(it => el('li', {}, [
          el('div', { class: 'item-row', style: { cursor: 'default', alignItems: 'flex-start' } }, [
            el('span', { style: { color: 'var(--brand-1)', paddingTop: '3px' } }, [icon('fa-circle-check')]),
            el('span', { class: 'item-main' }, [el('span', { text: L(it) })])
          ])
        ])))
      ]));
    } else if (b.type === 'defs' || b.type === 'steps') {
      wrap.append(el('section', { class: 'card' }, [
        b.title ? el('h3', { text: L(b.title) }) : null,
        el('dl', { class: 'guide-defs' }, b.items.flatMap(it => [
          el('dt', { text: L(it.k) }),
          el('dd', { text: L(it.v) })
        ]))
      ]));
    }
  }

  wrap.append(el('nav', { class: 'guide-nav', 'aria-label': t('guide.chapter_navigation') }, [
    prev
      ? navCard(prev, 'prev')
      : el('div', { class: 'guide-nav-card ghost' }, [
          el('small', { text: t('guide.start') }),
          el('b', { text: t('guide.first_chapter') })
        ]),
    next
      ? navCard(next, 'next')
      : el('button', { class: 'guide-nav-card done', onclick: () => go('#/') }, [
          el('small', { text: t('guide.guide_complete') }),
          el('b', {}, [icon('fa-circle-check'), el('span', { text: ' ' + (t('guide.start_using_dyon')) })])
        ])
  ]));

  wrap.append(el('div', { class: 'row tight', style: { justifyContent: 'center' } }, [
    el('button', { class: 'btn btn-sm', onclick: () => startTour() },
      [icon('fa-location-crosshairs'), el('span', { text: t('guide.take_in_app_tour') })]),
    el('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => go('#/guide') },
      [icon('fa-list'), el('span', { text: t('guide.chapter_index') })]),
    el('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => go('#/guide?p=glossary') },
      [icon('fa-spell-check'), el('span', { text: t('guide.glossary') })])
  ]));

  return wrap;
}

function navCard(chapter, dir) {
  const isNext = dir === 'next';
  const arrow = getDir() === 'rtl'
    ? (isNext ? 'fa-arrow-left' : 'fa-arrow-right')
    : (isNext ? 'fa-arrow-right' : 'fa-arrow-left');
  const label = isNext ? (t('guide.next')) : (t('guide.previous'));
  return el('button', {
    class: 'guide-nav-card' + (isNext ? ' next' : ''),
    'aria-label': label + ': ' + L(chapter.title),
    onclick: () => go('#/guide?p=' + chapter.id)
  }, [
    el('small', {}, [
      !isNext ? icon(arrow) : null,
      el('span', { text: ' ' + label + ' ' }),
      isNext ? icon(arrow) : null
    ]),
    el('b', {}, [icon(chapter.icon), el('span', { text: ' ' + L(chapter.title) })])
  ]);
}

function renderGuideIndex() {
  const seen = new Set(readChapters());
  const wrap = el('div', { class: 'stack fade-in', style: { maxWidth: '820px', margin: '0 auto' } });

  wrap.append(el('section', { class: 'card card-hero' }, [
    el('h1', { text: t('guide.beginner_s_guide') }),
    el('p', { text: t('guide.short_chapters_explaining_every', { count: GUIDE.length }) }),
    el('div', { class: 'row tight' }, [
      el('button', { class: 'btn', onclick: () => go('#/guide?p=' + GUIDE[0].id) },
        [icon('fa-play'), el('span', { text: t('guide.start_from_chapter_1') })]),
      el('button', { class: 'btn', type: 'button', onclick: () => startTour() },
        [icon('fa-location-crosshairs'), el('span', { text: t('guide.in_app_tour') })]),
      el('button', { class: 'btn', type: 'button', onclick: () => go('#/guide?p=glossary') },
        [icon('fa-spell-check'), el('span', { text: t('guide.z_glossary') })])
    ])
  ]));

  if (seen.size) {
    const pct = Math.round((seen.size / GUIDE.length) * 100);
    wrap.append(el('section', { class: 'card' }, [
      el('div', { class: 'row between' }, [
        el('b', { text: t('guide.reading_progress') }),
        el('span', { class: 'badge', text: `${formatNumber(seen.size)} / ${formatNumber(GUIDE.length)}` })
      ]),
      el('div', { class: 'progress good', style: { marginTop: '8px' } }, [el('i', { style: { width: pct + '%' } })])
    ]));
  }

  wrap.append(el('section', { class: 'card flush' }, [
    el('ol', { class: 'listy', style: { margin: '0', padding: '0' } }, GUIDE.map((c, i) => el('li', {}, [
      el('button', { class: 'item-row', type: 'button', onclick: () => go('#/guide?p=' + c.id) }, [
        el('span', { class: 'guide-num' + (seen.has(c.id) ? ' done' : '') },
          seen.has(c.id) ? [icon('fa-check')] : [el('span', { text: formatNumber(i + 1) })]),
        el('span', { class: 'item-main' }, [
          el('b', {}, [icon(c.icon), el('span', { text: ' ' + L(c.title) })]),
          el('small', { text: L(c.lead) })
        ]),
        icon(getDir() === 'rtl' ? 'fa-chevron-left' : 'fa-chevron-right')
      ])
    ])))
  ]));

  wrap.append(el('p', { class: 'notice', text: t('guide.guide_educational_religious_content') }));

  return wrap;
}

/* ======================================================================
   GLOSSARY  —  #/guide?p=glossary
   Built from every defined term in every chapter, so it can never drift
   out of sync with the guide itself. Each entry links back to its chapter.
   ====================================================================== */
export function glossaryEntries() {
  const out = [];
  GUIDE.forEach((c, ci) => (c.blocks || []).forEach(b => {
    if (b.type !== 'defs' && b.type !== 'steps') return;
    b.items.forEach(it => out.push({ term: it.k, def: it.v, chapter: c, ci }));
  }));
  return out;
}

function renderGlossary(initialQ) {
  const all = glossaryEntries();
  const wrap = el('div', { class: 'stack fade-in', style: { maxWidth: '820px', margin: '0 auto' } });
  const listBox = el('div');
  const countBadge = el('span', { class: 'badge' });
  const search = el('input', { type: 'search', value: initialQ, id: 'glossary-search', enterkeyhint: 'search',
    placeholder: t('guide.search_word'), 'aria-label': t('guide.search_glossary') });

  const norm = (x) => String(x || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u0652]/g, '');
  const draw = () => {
    const q = norm(search.value.trim());
    const items = all.filter(e => !q || norm(L(e.term)).includes(q) || norm(L(e.def)).includes(q)
      || norm(e.term.en).includes(q) || norm(e.term.ar).includes(q))
      .sort((a, b) => L(a.term).replace(/^[^\p{L}]+/u, '').localeCompare(L(b.term).replace(/^[^\p{L}]+/u, ''), getLocale()));
    countBadge.textContent = `${formatNumber(items.length)} / ${formatNumber(all.length)}`;
    let lastLetter = '';
    const nodes = [];
    for (const e of items) {
      const letter = (L(e.term).replace(/^[^\p{L}]+/u, '')[0] || '#').toUpperCase();
      if (letter !== lastLetter && !q) { nodes.push(el('h3', { class: 'gloss-letter', text: letter })); lastLetter = letter; }
      nodes.push(el('div', { class: 'gloss-item' }, [
        el('b', { text: L(e.term) }),
        el('p', { text: L(e.def) }),
        el('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => go('#/guide?p=' + e.chapter.id) },
          [icon(e.chapter.icon), el('span', { text: t('guide.chapter_link', { title: L(e.chapter.title) }) })])
      ]));
    }
    listBox.replaceChildren(...(nodes.length ? nodes
      : [el('p', { class: 'hint', text: t('guide.no_match_try_shorter') })]));
  };
  search.addEventListener('input', draw);

  wrap.append(
    el('div', { class: 'row between' }, [
      el('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => go('#/guide') },
        [icon(getDir() === 'rtl' ? 'fa-arrow-right' : 'fa-arrow-left'),
         el('span', { text: t('guide.all_chapters') })]),
      countBadge
    ]),
    el('section', { class: 'card card-hero' }, [
      el('h1', { text: t('guide.z_glossary') }),
      el('p', { text: t('guide.every_term_button_status'), style: { marginBottom: '0' } })
    ]),
    el('section', { class: 'card' }, [search, el('div', { style: { height: '12px' } }), listBox])
  );
  draw();
  return wrap;
}

/* ======================================================================
   HELP SHEET  —  the ? button. Context first: what this screen is for,
   then its tour, then the guide.
   ====================================================================== */
export function openHelp(path = '') {
  const h = SCREEN_HELP[path] || SCREEN_HELP[''];
  const chapter = GUIDE.find(c => c.id === h.chapter) || GUIDE[0];
  const hasTour = (TOURS[path] || []).some(st => find(st.sel));
  const row = (ic, title, sub, fn) => el('li', {}, [
    el('button', { class: 'item-row', type: 'button', onclick: () => { closeSheet(true); fn(); } }, [
      icon(ic, 'fa-fw'),
      el('span', { class: 'item-main' }, [el('b', { text: title }), sub ? el('small', { text: sub }) : null]),
      icon(getDir() === 'rtl' ? 'fa-chevron-left' : 'fa-chevron-right')
    ])
  ]);
  sheet({
    title: t('guide.help'),
    body: el('div', { class: 'stack' }, [
      el('p', { class: 'notice', style: { color: 'var(--text)' }, text: L(h) }),
      el('ul', { class: 'listy' }, [
        hasTour ? row('fa-location-crosshairs', t('guide.tour_screen'),
          t('guide.short_steps_with_next'), () => startTour(0, path)) : null,
        row(chapter.icon, L(chapter.title), t('guide.chapter_that_explains_screen'),
          () => go('#/guide?p=' + chapter.id)),
        row('fa-spell-check', t('guide.z_glossary'),
          t('guide.every_word_its_purpose'), () => go('#/guide?p=glossary')),
        row('fa-graduation-cap', t('guide.full_beginner_guide'),
          t('guide.chapters_count', { count: GUIDE.length }), () => go('#/guide')),
        path !== '' ? row('fa-gauge-high', t('guide.overview_tour'),
          t('guide.main_tour'), () => startTour(0, '')) : null
      ].filter(Boolean)),
      el('p', { class: 'hint', text: t('guide.shortcut_press_on_keyboard') })
    ])
  });
}

/* ======================================================================
   COACH-MARK TOUR  —  anchored bubbles with Next / Previous
   Rules (v2.0 §1.1–1.2):
   - never runs the Overview tour before onboarding is finished;
   - waits for the router's `dyon:rendered` event instead of a timer;
   - ends itself when the route leaves the tour's page;
   - drops at most ONE missing step silently; any other missing anchor gets
     an honest "This part isn't on screen yet" bubble with Skip;
   - on phones the bubble docks above the bottom bar, and the dock side is
     decided once per step (no flip-flopping while scrolling).
   ====================================================================== */
let tourState = null;
let tourDoneMemory = false;

function isVisible(node) {
  if (!node || !node.isConnected) return false;
  const r = node.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const cs = getComputedStyle(node);
  return cs.visibility !== 'hidden' && cs.display !== 'none';
}
/* First VISIBLE match: the same data-tour can exist in the desktop header
   and the phone bottom bar, and only one is on screen at a time. */
function find(sel) {
  for (const n of document.querySelectorAll(sel)) if (isVisible(n)) return n;
  return null;
}
function currentPath() { return location.hash.replace(/^#\/?/, '').split('?')[0]; }

/* Resolves when the router has painted `path` (or after `timeout` ms, so a
   broken render can never hang the tour). */
export function waitForRender(path, timeout = 2000) {
  return new Promise(resolve => {
    let done = false;
    const finish = (ok) => { if (done) return; done = true; document.removeEventListener('dyon:rendered', on); clearTimeout(timer); resolve(ok); };
    const on = (e) => { if (!e.detail || e.detail.path === path) finish(true); };
    const timer = setTimeout(() => finish(false), timeout);
    document.addEventListener('dyon:rendered', on);
  });
}

/* Pure planning step, exported for tests: which steps to keep, and which are
   shown as "not on screen yet". At most one missing step is dropped. */
export function planSteps(steps, present) {
  const missing = steps.map((st, i) => (present(st) ? -1 : i)).filter(i => i >= 0);
  const drop = missing.length === 1 ? missing[0] : -1;
  return steps.filter((_, i) => i !== drop).map(st => ({ ...st, missing: !present(st) }));
}

/* startTour(step, page): page defaults to the current screen when it has a
   tour, otherwise the Overview. Returns true when a tour actually started. */
export async function startTour(fromStep = 0, page) {
  endTour(true);
  const path = currentPath();
  let target = page !== undefined ? page : (TOURS[path] ? path : '');

  if (!S.state.settings.onboarded && target !== 'onboarding') {
    /* "Tour this screen" on the setup screen gets the setup tour; an explicit
       request for any other tour waits until setup is finished. */
    if (page === undefined && path === 'onboarding' && TOURS.onboarding) target = 'onboarding';
    else { toast(t('tour.finish_setup')); return false; }
  }

  if (path !== target) {
    const rendered = waitForRender(target);
    location.hash = '#/' + target;
    await rendered;
    if (currentPath() !== target) return false;     // the user went elsewhere meanwhile
  }

  const all = TOURS[target] || [];
  const steps = planSteps(all, st => !!find(st.sel));
  if (!steps.length || steps.every(st => st.missing)) { toast(t('tour.none')); return false; }

  const scrim = el('div', { class: 'tour-scrim', onclick: () => endTour() });
  const ring = el('div', { class: 'tour-ring', 'aria-hidden': 'true' });
  const bubble = el('div', { class: 'tour-bubble', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('tour.label') });
  document.body.append(scrim, ring, bubble);
  document.body.classList.add('touring');
  const mbar = document.getElementById('mobile-bar');
  if (mbar) {
    mbar.setAttribute('inert', '');
    const h = mbar.offsetHeight;
    if (h) document.documentElement.style.setProperty('--mbar-h', h + 'px');
  }
  let raf = 0;
  const onMove = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => placeOnly()); };
  const onRoute = () => { if (tourState && currentPath() !== tourState.page) endTour(true); };
  tourState = { step: Math.max(0, Math.min(fromStep, steps.length - 1)), steps, page: target,
    scrim, ring, bubble, onMove, onRoute, dockTop: false, token: 0 };
  window.addEventListener('resize', onMove);
  window.addEventListener('scroll', onMove, { passive: true });
  window.addEventListener('hashchange', onRoute);
  document.addEventListener('keydown', tourKeys);
  paintStep();
  return true;
}

/* Called by the router after a same-route re-render (e.g. a save), so the
   ring keeps pointing at the fresh element instead of a detached one. */
export function repaintTour() { if (tourState) paintStep(true); }

function tourKeys(e) {
  if (!tourState) return;
  const rtl = getDir() === 'rtl';
  if (e.key === 'Escape') { e.preventDefault(); endTour(); }
  if (e.key === 'ArrowRight') { e.preventDefault(); rtl ? prevStep() : nextStep(); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); rtl ? nextStep() : prevStep(); }
}

function currentTarget() {
  const st = tourState && tourState.steps[tourState.step];
  return st ? find(st.sel) : null;
}

const isPhone = () => window.innerWidth <= 640;

function waitScrollEnd() {
  return new Promise(resolve => {
    let done = false;
    const fin = () => { if (done) return; done = true; window.removeEventListener('scrollend', fin); resolve(); };
    if ('onscrollend' in window) window.addEventListener('scrollend', fin, { once: true });
    setTimeout(fin, 400);                         // fallback: Safari < 18, no scroll happened
  });
}

async function paintStep(noScroll) {
  if (!tourState) return;
  const token = ++tourState.token;
  const { steps } = tourState;
  tourState.step = Math.max(0, Math.min(tourState.step, steps.length - 1));
  const target = currentTarget();
  const missing = !isVisible(target);
  buildBubble(missing);
  tourState.ring.style.display = missing ? 'none' : '';
  if (missing) { placeMissing(); focusPrimary(); return; }

  const r = target.getBoundingClientRect();
  const fixed = getComputedStyle(target).position === 'fixed' || target.closest('.mobile-bar, .app-header');
  const bottomReserve = isPhone() ? tourState.bubble.offsetHeight + mbarHeight() + 24 : 80;
  const header = document.getElementById('app-header');
  const fixedTop = header && getComputedStyle(header).position !== 'static' ? header.offsetHeight + 12 : 12;
  if (!noScroll && !fixed && (r.top < fixedTop || r.bottom > window.innerHeight - bottomReserve)) {
    const y = window.scrollY + r.top - (isPhone() ? fixedTop : Math.max(fixedTop, (window.innerHeight - r.height) / 3));
    window.scrollTo({ top: Math.max(0, y), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    await waitScrollEnd();
    if (!tourState || token !== tourState.token) return;
  }
  decideDock();
  placeOnly();
  focusPrimary();
}

function focusPrimary() {
  const primary = tourState && tourState.bubble.querySelector('.btn-primary');
  if (primary) primary.focus({ preventScroll: true });
}

function mbarHeight() {
  const mbar = document.getElementById('mobile-bar');
  return mbar && isVisible(mbar) ? mbar.offsetHeight : 0;
}

/* Decide once per step (after any scroll has settled) whether the docked
   bubble sits above the bottom bar or at the top of the screen. */
function decideDock() {
  if (!tourState) return;
  const target = currentTarget();
  if (!target || !isPhone()) { tourState.dockTop = false; return; }
  const r = target.getBoundingClientRect();
  const inBar = !!target.closest('.mobile-bar');
  const H = window.innerHeight;
  const bubbleTop = H - mbarHeight() - 10 - tourState.bubble.offsetHeight;
  /* Dock at the top only when the target's own top edge would be hidden by a
     bottom bubble. A tall target (taller than the space left) keeps the
     bottom dock, so its heading stays readable under the header. */
  tourState.dockTop = !inBar && r.top > bubbleTop - 8;
}

function buildBubble(missing) {
  const { bubble, steps, step: i } = tourState;
  const step = steps[i];
  clear(bubble);
  const prevIcon = getDir() === 'rtl' ? 'fa-chevron-right' : 'fa-chevron-left';
  const nextIcon = getDir() === 'rtl' ? 'fa-chevron-left' : 'fa-chevron-right';
  const last = i === steps.length - 1;
  bubble.classList.toggle('missing', !!missing);
  bubble.append(
    el('div', { class: 'row between', style: { marginBottom: '6px', flexWrap: 'nowrap' } }, [
      el('span', { class: 'badge', text: t('tour.step_of', { n: formatNumber(i + 1), total: formatNumber(steps.length) }) }),
      el('div', { class: 'tour-dots', 'aria-hidden': 'true' }, steps.map((_, k) => el('i', { class: k === i ? 'on' : '' }))),
      el('button', { class: 'icon-btn', type: 'button', 'aria-label': t('action.close'), onclick: () => endTour() },
        [icon('fa-xmark')])
    ]),
    el('h3', { text: L(step.title), style: { margin: '0 0 6px' } }),
    el('p', { text: missing ? t('tour.missing') : L(step.body), style: { margin: '0 0 12px', fontSize: '.9rem' } }),
    el('div', { class: 'tour-actions' }, [
      el('button', { class: 'btn btn-sm', type: 'button', disabled: i === 0, onclick: prevStep },
        [icon(prevIcon), el('span', { text: t('tour.prev') })]),
      el('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => endTour(), text: t('tour.skip') }),
      missing
        ? el('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: nextStep },
            [el('span', { text: last ? t('tour.done') : t('tour.skip_step') }), icon(nextIcon)])
        : last
          ? el('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: () => finishTour() },
              [icon('fa-book-open'), el('span', { text: t('guide.open') })])
          : el('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: nextStep },
              [el('span', { text: t('tour.next') }), icon(nextIcon)])
    ])
  );
}

function placeMissing() {
  const { bubble } = tourState;
  if (isPhone()) {
    bubble.classList.add('docked'); bubble.classList.remove('dock-top');
    Object.assign(bubble.style, { top: '', left: '', width: '' });
    return;
  }
  bubble.classList.remove('docked', 'dock-top');
  const bw = Math.min(360, window.innerWidth - 24);
  Object.assign(bubble.style, { width: bw + 'px', left: (window.innerWidth - bw) / 2 + 'px', top: '96px' });
}

function placeOnly() {
  if (!tourState) return;
  const target = currentTarget();
  if (!target) return;
  const { ring, bubble } = tourState;
  const r = target.getBoundingClientRect();
  const pad = 6;
  const W = window.innerWidth, H = window.innerHeight;
  const left = Math.max(4, r.left - pad), top = Math.max(4, r.top - pad);
  Object.assign(ring.style, {
    top: top + 'px', left: left + 'px',
    width: Math.max(0, Math.min(W - 4, r.right + pad) - left) + 'px',
    height: Math.max(0, Math.min(H - 4, r.bottom + pad) - top) + 'px'
  });

  if (isPhone()) {
    bubble.classList.add('docked');
    bubble.classList.toggle('dock-top', !!tourState.dockTop);
    Object.assign(bubble.style, { top: '', left: '', width: '' });
    return;
  }
  bubble.classList.remove('docked', 'dock-top');
  const bw = Math.min(360, W - 24);
  bubble.style.width = bw + 'px';
  const bh = bubble.offsetHeight || 220;
  let y = r.bottom + 14;
  if (y + bh > H - 12) y = Math.max(12, r.top - bh - 14);
  let x = r.left + r.width / 2 - bw / 2;
  x = Math.max(12, Math.min(x, W - bw - 12));
  bubble.style.top = y + 'px';
  bubble.style.left = x + 'px';
}

function nextStep() {
  if (!tourState) return;
  if (tourState.step >= tourState.steps.length - 1) { finishTour(); return; }
  tourState.step++;
  paintStep();
}
function prevStep() {
  if (!tourState || tourState.step === 0) return;
  tourState.step--;
  paintStep();
}
function finishTour() {
  const page = tourState && tourState.page;
  endTour();
  if (page !== 'onboarding') go('#/guide');
}

export function endTour(silent) {
  if (!tourState) return;
  const { scrim, ring, bubble, onMove, onRoute } = tourState;
  window.removeEventListener('resize', onMove);
  window.removeEventListener('scroll', onMove);
  window.removeEventListener('hashchange', onRoute);
  document.removeEventListener('keydown', tourKeys);
  [scrim, ring, bubble].forEach(n => n && n.remove());
  document.body.classList.remove('touring');
  document.getElementById('mobile-bar')?.removeAttribute('inert');
  const page = tourState.page;
  tourState = null;
  if (!silent && page !== 'onboarding') markTourDone();
}

/* Tour completion lives in IndexedDB settings (1.9). If storage fails, the
   state is kept in memory for this session and tourDone() answers honestly:
   false until something was actually recorded (1.6). */
export function markTourDone() {
  tourDoneMemory = true;
  S.saveProgress({ tour_done: true }).catch(() => {});
}
export function tourDone() {
  if (tourDoneMemory) return true;
  try { return S.state.settings.tour_done === true; } catch { return false; }
}
export function tourActive() { return !!tourState; }
export function tourInfo() {
  return tourState ? { page: tourState.page, step: tourState.step, total: tourState.steps.length,
    missing: !!tourState.steps[tourState.step].missing, dockTop: tourState.dockTop } : null;
}
