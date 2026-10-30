/* DYON — language aside (v2.0 §2.5). Opened by the header language button
   or the L key. Search, native + English names, a tick on the current one,
   where the detected language came from, and an opt-in switch to also apply
   that language's digit/calendar defaults. It never changes the route. */

import { t, LOCALES, PLANNED_LOCALES, getLocale, detectLocale } from './i18n.js';
import * as S from './store.js';
import { el, icon } from './ui.js';
import { openAside, closeAside } from './aside.js';

/* Defaults offered (never forced) when a language is picked with the switch on. */
export const LOCALE_DEFAULTS = {
  en: { digits: 'latn' },
  fr: { digits: 'latn' },
  ar: { digits: 'arab' }
};

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u0652]/g, '');

export function openLanguageAside(opener, { applyLocale } = {}) {
  const s = S.state.settings;
  const current = getLocale();
  const detected = s.locale_detected || detectLocale({ languages: navigator.languages });
  let applyDefaults = s.locale_apply_defaults !== false;

  const search = el('input', { type: 'search', id: 'lang-search', enterkeyhint: 'search', autocomplete: 'off',
    placeholder: t('lang.search'), 'aria-label': t('lang.search') });
  const list = el('ul', { class: 'pick-list', id: 'lang-list', role: 'list' });
  const empty = el('p', { class: 'hint', hidden: true, text: t('lang.no_match') });

  const choose = async (code) => {
    const patch = { locale: code, locale_chosen: true, locale_apply_defaults: applyDefaults };
    if (applyDefaults && LOCALE_DEFAULTS[code]) Object.assign(patch, LOCALE_DEFAULTS[code]);
    await S.saveSettings(patch);
    closeAside();
    if (applyLocale) await applyLocale();
  };

  const rows = [
    ...Object.entries(LOCALES).map(([code, v]) => ({ code, v, ready: true })),
    ...Object.entries(PLANNED_LOCALES).map(([code, v]) => ({ code, v, ready: false }))
  ];
  const draw = () => {
    const q = norm(search.value.trim());
    const shown = rows.filter(r => !q || norm(r.v.native).includes(q) || norm(r.v.name).includes(q) || r.code.startsWith(q));
    list.replaceChildren(...shown.map(({ code, v, ready }) => el('li', {}, [
      el('button', {
        type: 'button', lang: code, dir: v.dir, 'data-lang': code, disabled: !ready,
        'aria-current': code === current ? 'true' : null,
        onclick: () => ready && choose(code)
      }, [
        el('span', { class: 'pk-main' }, [
          el('b', { text: v.native }),
          el('small', { text: ready ? v.name : t('lang.coming', { name: v.name }) })
        ]),
        code === current ? el('span', { class: 'pk-check' }, [icon('fa-check')]) : null
      ])
    ])));
    empty.hidden = shown.length > 0;
  };
  search.addEventListener('input', draw);
  draw();

  const det = LOCALES[detected.locale];
  const sw = el('input', { type: 'checkbox', checked: applyDefaults, id: 'lang-defaults',
    onchange: (e) => { applyDefaults = e.target.checked; } });

  const body = el('div', { class: 'stack' }, [
    search,
    list,
    empty,
    det ? el('p', { class: 'pick-note', id: 'lang-detected',
      text: t('lang.detected', { language: det.native, source: detected.source }) }) : null,
    el('div', { class: 'setting' }, [
      el('div', { class: 's-main' }, [
        el('b', { text: t('lang.defaults') }),
        el('small', { text: t('lang.defaults_hint') })
      ]),
      el('label', { class: 'switch' }, [sw, el('span', { class: 'track' })])
    ])
  ]);
  return openAside({ id: 'lang', title: t('lang.title'), body, opener });
}
