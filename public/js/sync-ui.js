/* DYON §6 — sync UI: Settings cards (Sync, Devices), the setup/connect wizard, "Needs a look" screen, header net chip. */
import { t, formatDateTime, getLocale } from './i18n.js';
import { formatAmount } from './units.js';
import { el, icon, clear, toast, sheet, closeSheet, confirmSheet, field, input, settingRow } from './ui.js';
import * as S from './store.js';
import * as SY from './sync.js';
import * as ACCT from './account.js';
import * as SC from './sync-crypto.js';

const MIN_PASS = 12;
const when = (ms) => ms ? formatDateTime(ms) : t('sync.never');
const errText = (e) => !e ? '' : e.code === 'network' || e.status === 0 ? t('sync.err.network') : e.status === 401 ? t('sync.err.signin') : t('sync.err.generic');
const busy = (btn, on) => { btn.disabled = on; btn.setAttribute('aria-busy', on ? 'true' : 'false'); };

/* ---------- header net chip ---------- */
export function netChip() {
  const chip = el('span', { class: 'net-chip', id: 'net-chip', role: 'status', hidden: true });
  paintNetChip(chip); return chip;
}
export function paintNetChip(chip) {
  if (!chip) return;
  const on = SY.isEnabled();
  chip.hidden = !on;
  if (!on) return;
  const st = SY.netState();
  const ic = st === 'syncing' ? 'fa-rotate' : st === 'offline' ? 'fa-cloud-arrow-up' : 'fa-circle-check';
  chip.className = 'net-chip ' + st; chip.dataset.state = st;
  chip.replaceChildren(icon(ic), el('span', { text: t('sync.net.' + st) }));
  chip.title = t('sync.net.' + st);
}

/* ---------- Settings → Sync card ---------- */
export function renderSyncCard() {
  const card = el('section', { class: 'card', id: 'sync-card', 'data-tour': 'set-sync' });
  const paint = () => {
    const st = SY.status(); const me = ACCT.current(); const signedIn = !!(me && me.signed_in);
    const kids = [
      el('h2', {}, [icon('fa-rotate'), el('span', { text: ' ' + t('sync.title') })]),
      el('p', { class: 'card-sub', text: t('sync.sub') })
    ];
    const prob = SY.lastProblem() || (st.enabled && ['quota', 'other_account', 'retry'].includes(st.problem) ? st.problem : null);
    if (prob) kids.push(el('p', { class: 'notice', role: 'status' }, [el('span', { text: t('sync.problem.' + prob) }),
      !st.enabled ? el('button', { class: 'btn btn-sm', type: 'button', style: { marginInlineStart: '8px' }, text: t('sync.dismiss'), onclick: () => SY.dismissProblem() }) : null]));
    if (st.enabled) {
      kids.push(el('div', { class: 'setting' }, [el('div', { class: 's-main' }, [
        el('b', { text: t('sync.phase.' + st.phase) }),
        el('small', { text: t('sync.last', { time: when(st.lastSynced) }) }),
        st.pending ? el('small', { text: t('sync.pending', { count: st.pending }) }) : null
      ]), el('span', { class: 'sync-dot inline ' + ACCT.syncStatus(), 'aria-hidden': 'true' })]));
      if (st.conflicts) kids.push(el('a', { class: 'notice', href: '#/sync/conflicts', 'data-testid': 'conflicts-link' }, [icon('fa-code-compare'), el('span', { text: ' ' + t('nav.badge_open', { count: st.conflicts }) })]));
      kids.push(el('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, [
        el('button', { class: 'btn btn-sm', type: 'button', id: 'sync-now', text: t('sync.now'), onclick: () => SY.syncNow() }),
        el('button', { class: 'btn btn-sm', type: 'button', id: 'sync-off', text: t('sync.turn_off'), onclick: turnOffDialog }),
        el('button', { class: 'btn btn-sm', type: 'button', id: 'sync-wipe', text: t('sync.delete_copy'), onclick: wipeDialog })
      ]));
    } else if (!signedIn) {
      kids.push(el('p', { class: 'muted', text: t('sync.needs_account') }),
        el('button', { class: 'btn btn-sm', type: 'button', text: t('sync.sign_in'), onclick: () => document.getElementById('acct-btn')?.click() }));
    } else {
      kids.push(el('p', { class: 'muted', text: t('sync.off_hint') }), el('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, [
        el('button', { class: 'btn btn-primary btn-sm', type: 'button', id: 'sync-on', text: t('sync.turn_on'), onclick: () => openWizard(card) }),
        el('button', { class: 'btn btn-sm', type: 'button', id: 'sync-join', text: t('sync.connect'), onclick: () => openJoin() })
      ]));
    }
    kids.push(el('p', { class: 'notice', text: t('sync.loss_warning') }), el('p', { class: 'muted small', text: t('sync.export_note') }));
    clear(card).append(...kids);
  };
  paint();
  const off = [SY.subscribe(paint), ACCT.subscribe(paint)];
  const obs = new MutationObserver(() => { if (!card.isConnected) { off.forEach(f => f()); obs.disconnect(); } });
  obs.observe(document.body, { childList: true, subtree: true });
  return card;
}

function turnOffDialog() {
  confirmSheet({ title: t('sync.turn_off'), message: t('sync.turn_off_msg'), confirmLabel: t('sync.turn_off_do'),
    onConfirm: async () => { await SY.turnOff(); toast(t('sync.turned_off'), 'good'); } });
}
function wipeDialog() {
  const word = t('sync.confirm_word');
  const inp = input({ id: 'wipe-word', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  const err = el('div', { class: 'err', role: 'alert' });
  const go = el('button', { class: 'btn btn-danger', type: 'button', text: t('sync.delete_do') });
  go.onclick = async () => {
    if (inp.value.trim().toLowerCase() !== word.toLowerCase()) { err.textContent = t('sync.confirm_label'); inp.focus(); return; }
    busy(go, true);
    try { await SY.deleteServerCopy(); closeSheet(); toast(t('sync.deleted'), 'good'); }
    catch (e) { err.textContent = errText(e); busy(go, false); }
  };
  sheet({ title: t('sync.delete_copy'), body: el('div', { class: 'stack' }, [el('p', { text: t('sync.delete_msg', { word }) }), field(t('sync.confirm_label'), inp), err]),
    footer: [el('button', { class: 'btn', type: 'button', text: t('action.cancel'), onclick: () => closeSheet() }), go] });
}

/* ---------- wizard: new sync ---------- */
function deviceNameField() {
  return input({ id: 'sync-device', maxlength: '60', value: t('sync.w.device_default') });
}
function openWizard() {
  const body = el('div', { class: 'stack' });
  const foot = el('div', { class: 'row', style: { gap: '8px', justifyContent: 'flex-end', width: '100%' } });
  let keys = null, check = null;
  const panel = sheet({ title: t('sync.w.title'), body, footer: [foot] });
  const setFoot = (...b) => { clear(foot).append(...b); };

  const stepPass = () => {
    const p1 = input({ id: 'sync-pass', type: 'password', autocomplete: 'new-password', minlength: String(MIN_PASS) });
    const p2 = input({ id: 'sync-pass2', type: 'password', autocomplete: 'new-password' });
    const err = el('div', { class: 'err', role: 'alert' });
    const next = el('button', { class: 'btn btn-primary', type: 'button', id: 'sync-next', text: t('sync.w.next') });
    next.onclick = async () => {
      err.textContent = '';
      if ([...p1.value].length < MIN_PASS) { err.textContent = t('sync.w.err_short'); p1.focus(); return; }
      if (p1.value !== p2.value) { err.textContent = t('sync.w.err_mismatch'); p2.focus(); return; }
      busy(next, true); clear(body).append(el('p', { text: t('sync.w.securing'), role: 'status' }));
      try { keys = await SY.prepareKeys(p1.value); stepPhrase(); }
      catch (e) { stepPass(); document.querySelector('.sheet .err').textContent = errText(e); }
    };
    clear(body).append(field(t('sync.w.pass_label'), p1, t('sync.w.pass_hint')), field(t('sync.w.pass2_label'), p2), err,
      el('p', { class: 'notice', text: t('sync.loss_warning') }));
    setFoot(el('button', { class: 'btn', type: 'button', text: t('action.cancel'), onclick: () => closeSheet() }), next);
  };
  const stepPhrase = () => {
    const words = keys.phrase.split(' ');
    const grid = el('ol', { class: 'phrase-grid', 'data-testid': 'phrase', dir: 'ltr' }, words.map(w => el('li', {}, [el('span', { text: w })])));
    clear(body).append(el('h3', { text: t('sync.w.phrase_title') }), el('p', { text: t('sync.w.phrase_body') }), grid);
    setFoot(el('button', { class: 'btn btn-primary', type: 'button', id: 'sync-written', text: t('sync.w.written'), onclick: stepCheck }));
  };
  const stepCheck = () => {
    check = SC.pickCheckWords(3); const words = keys.phrase.split(' ');
    const ins = check.map(n => input({ 'data-n': String(n), autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', dir: 'ltr' }));
    const err = el('div', { class: 'err', role: 'alert' });
    const dev = deviceNameField();
    const fin = el('button', { class: 'btn btn-primary', type: 'button', id: 'sync-finish', text: t('sync.w.finish') });
    fin.onclick = async () => {
      err.textContent = '';
      if (!ins.every((i, k) => i.value.trim().toLowerCase() === words[check[k] - 1])) { err.textContent = t('sync.w.err_words'); return; }
      busy(fin, true);
      try { await SY.activateNew({ keys, deviceLabel: dev.value.trim() || t('sync.w.device_default') }); keys = null; closeSheet(); toast(t('sync.w.on'), 'good'); }
      catch (e) { err.textContent = errText(e); busy(fin, false); }
    };
    clear(body).append(el('h3', { text: t('sync.w.check_title') }), el('p', { text: t('sync.w.check_body', { a: check[0], b: check[1], c: check[2] }) }),
      ...ins.map((i, k) => field(t('sync.w.word_n', { n: check[k] }), i)), field(t('sync.w.device_label'), dev), err);
    setFoot(el('button', { class: 'btn', type: 'button', text: t('action.back'), onclick: stepPhrase }), fin);
  };
  stepPass();
  return panel;
}

/* ---------- connect another device ---------- */
function openJoin() {
  let usePhrase = false;
  const body = el('div', { class: 'stack' }); const foot = el('div', { class: 'row', style: { gap: '8px', justifyContent: 'flex-end', width: '100%' } });
  sheet({ title: t('sync.j.title'), body, footer: [foot] });
  const paint = () => {
    const secret = usePhrase ? el('textarea', { id: 'sync-secret', rows: '3', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', dir: 'ltr' })
                             : input({ id: 'sync-secret', type: 'password', autocomplete: 'current-password' });
    const dev = deviceNameField(); const err = el('div', { class: 'err', role: 'alert' });
    const go = el('button', { class: 'btn btn-primary', type: 'button', id: 'sync-join-go', text: t('sync.j.go') });
    go.onclick = async () => {
      err.textContent = ''; busy(go, true);
      try {
        await SY.activateJoin({ passphrase: usePhrase ? undefined : secret.value, phrase: usePhrase ? secret.value : undefined, deviceLabel: dev.value.trim() || t('sync.w.device_default') });
        closeSheet(); toast(t('sync.w.on'), 'good');
      } catch (e) {
        err.textContent = e && e.code === 'bad_phrase' ? t('sync.j.err_phrase') : e && (e.code === 'bad_secret' || e.code === 'kdf_too_weak') ? t('sync.j.err_secret') : errText(e);
        busy(go, false);
      }
    };
    clear(body).append(el('p', { text: t('sync.j.body') }), field(t(usePhrase ? 'sync.j.phrase_label' : 'sync.w.pass_label'), secret), field(t('sync.w.device_label'), dev), err,
      el('button', { class: 'btn btn-sm', type: 'button', text: t(usePhrase ? 'sync.j.use_pass' : 'sync.j.use_phrase'), onclick: () => { usePhrase = !usePhrase; paint(); } }));
    clear(foot).append(el('button', { class: 'btn', type: 'button', text: t('action.cancel'), onclick: () => closeSheet() }), go);
  };
  paint();
}

/* ---------- Settings → Devices card ---------- */
export function renderDevicesCard() {
  const card = el('section', { class: 'card', id: 'devices-card' });
  const list = el('div', { class: 'stack' });
  const head = [el('h2', {}, [icon('fa-laptop'), el('span', { text: ' ' + t('sync.dev.title') })]), el('p', { class: 'card-sub', text: t('sync.dev.sub') })];
  let loaded = false;
  const paint = async () => {
    const st = SY.status();
    if (!st.enabled) { clear(card).append(...head, el('p', { class: 'muted', text: t('sync.dev.off') })); loaded = false; return; }
    clear(card).append(...head, list);
    try {
      const ds = (await SY.devices()).filter(d => !d.revoked);
      clear(list);
      if (!ds.length) list.append(el('p', { class: 'muted', text: t('sync.dev.empty') }));
      for (const d of ds) {
        const me = d.id === st.deviceId;
        list.append(el('div', { class: 'setting', 'data-device': String(d.id) }, [
          el('div', { class: 's-main' }, [el('b', { text: d.label || '—' }), el('small', { text: me ? t('sync.dev.this') : t('sync.dev.last', { time: when((d.last_seen || d.created) * 1000) }) })]),
          el('div', { class: 'row', style: { gap: '6px' } }, [
            el('button', { class: 'btn btn-sm', type: 'button', text: t('sync.dev.rename'), onclick: () => renameDialog(d, paint) }),
            me ? null : el('button', { class: 'btn btn-sm', type: 'button', text: t('sync.dev.remove'), onclick: () => confirmSheet({ title: t('sync.dev.remove'), message: t('sync.dev.remove_msg', { label: d.label || '—' }), confirmLabel: t('sync.dev.remove'),
              onConfirm: async () => { try { await SY.revokeDevice(d.id); toast(t('sync.dev.removed'), 'good'); } catch (e) { toast(errText(e)); } paint(); } }) })
          ])]));
      }
      loaded = true;
    } catch (e) { clear(list).append(el('p', { class: 'muted', text: errText(e) })); }
  };
  paint();
  const unsub = SY.subscribe(() => { if (SY.isEnabled() !== loaded) paint(); });
  const obs = new MutationObserver(() => { if (!card.isConnected) { unsub(); obs.disconnect(); } });
  obs.observe(document.body, { childList: true, subtree: true });
  return card;
}
function renameDialog(d, done) {
  const inp = input({ id: 'dev-name', maxlength: '60', value: d.label || '' });
  const ok = el('button', { class: 'btn btn-primary', type: 'button', text: t('action.save') });
  ok.onclick = async () => { const v = inp.value.trim(); if (!v) return; busy(ok, true); try { await SY.renameDevice(d.id, v); closeSheet(); done(); } catch (e) { toast(errText(e)); busy(ok, false); } };
  sheet({ title: t('sync.dev.rename'), body: field(t('sync.dev.new_name'), inp), footer: [el('button', { class: 'btn', type: 'button', text: t('action.cancel'), onclick: () => closeSheet() }), ok] });
}

/* ---------- #/sync/conflicts — "Needs a look" ---------- */
function describeRecord(c) {
  const list = S.state[c.table] || [];
  const r = list.find(x => x.id === c.rid) || {};
  if (c.table === 'commitments') {
    const cp = S.state.counterparties.find(p => p.id === r.counterparty_id);
    return [cp && cp.name, r.description].filter(Boolean).join(' · ') || t('sync.c.untitled');
  }
  return r.name || r.description || t('sync.c.untitled');
}
function valueText(c, f, v) {
  if (v === null || v === undefined || v === '') return t('sync.c.none');
  if (f === 'amount_minor') { const r = (S.state[c.table] || []).find(x => x.id === c.rid) || {}; return formatAmount(v, r.unit_code || S.state.settings.base_currency); }
  if (f === 'status') return t('status.' + v);
  if (f === 'direction') return t('dir.' + String(v).toLowerCase());
  return String(v);
}
export function renderConflicts() {
  const wrap = el('div', { class: 'stack fade-in', style: { maxWidth: '680px', margin: '0 auto' } });
  const paint = () => {
    const items = SY.conflicts();
    clear(wrap).append(el('a', { class: 'btn btn-sm', href: '#/settings?s=sync' }, [icon('fa-arrow-left'), el('span', { text: ' ' + t('sync.c.back') })]),
      el('h1', { text: t('sync.c.title') }), el('p', { class: 'muted', text: t('sync.c.sub') }));
    if (!items.length) wrap.append(el('p', { class: 'empty', 'data-testid': 'no-conflicts', text: t('sync.c.empty') }));
    for (const c of items) {
      wrap.append(el('section', { class: 'card', 'data-conflict': c.id }, [
        el('h3', { text: describeRecord(c) }),
        ...c.fields.map(f => el('div', { class: 'setting' }, [el('div', { class: 's-main' }, [
          el('b', { text: t('sync.c.field.' + f.field) }),
          el('small', { text: t('sync.c.mine') + ': ' + valueText(c, f.field, f.mine) }),
          el('small', { text: t('sync.c.theirs') + ': ' + valueText(c, f.field, f.theirs) }),
          el('small', { text: t(f.kept === 'mine' ? 'sync.c.kept_mine' : 'sync.c.kept_theirs') })])])),
        el('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, [
          el('button', { class: 'btn btn-sm', type: 'button', 'data-act': 'other', text: t('sync.c.use_other'), onclick: async () => { await SY.resolveConflict(c.id, 'other'); toast(t('sync.c.resolved'), 'good'); } }),
          el('button', { class: 'btn btn-sm', type: 'button', 'data-act': 'keep', text: t('sync.c.keep'), onclick: async () => { await SY.resolveConflict(c.id, 'keep'); toast(t('sync.c.resolved'), 'good'); } })
        ])]));
    }
  };
  paint();
  const unsub = SY.subscribe(paint);
  const obs = new MutationObserver(() => { if (!wrap.isConnected) { unsub(); obs.disconnect(); } });
  obs.observe(document.body, { childList: true, subtree: true });
  return wrap;
}
