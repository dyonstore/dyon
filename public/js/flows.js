/* DYON — interaction flows: Quick Add, commitment detail, payments, respite,
   release (24h undo), dispute, ṣulḥ, ḥawālah, reminders, sharing, witnesses.

   Every form is validated through js/validate.js: messages are plain language,
   carried by text and icon as well as colour, and no submit ever fails silently.
   Every irreversible path carries an explicit guard (RL-10) and every message
   is sent BY THE USER, never by the app (R-D10, limit.not_collector). */

import { t, formatDate, formatDateDual, formatDateTime, getLocale, intlTag, formatNumber } from './i18n.js';
import { CURRENCIES, SPECIAL_UNITS, unitLabel, unitShort, toMinor, fromMinor, formatAmount,
         isMonetary, minorDigits, fxNotice, convertMinor, inputValue } from './units.js';
import * as S from './store.js';
import * as C from './content.js';
import * as VAL from './validate.js';
import { el, frag, icon, sheet, closeSheet, confirmSheet, toast, field, input, textarea,
         select, chipGroup, statusBadge, directionBadge, avatar, amountEl, dueLabel, card,
         emptyState, progressBar, disclaimer, ayahBlock, copyText, download, switchRow } from './ui.js';
import * as AUTH from './auth.js';
import * as QR from './qr.js';


/* amount string for prefilling an input (digits only, no unit label) */
const amtValue = (minor, unit) => inputValue(minor, unit);

/* ---------- unit <select> options ---------- */
function unitSelectOptions(selected) {
  return [
    { group: t('flows.currencies'), options: Object.keys(CURRENCIES).map(c => ({
        value: c, label: `${c} — ${unitLabel(c)}`, selected: c === selected })) },
    { group: t('flows.gold_silver'), options: ['XAU_G24','XAU_G21','XAU_G18','XAG_G'].map(c => ({
        value: c, label: unitLabel(c), selected: c === selected })) },
    { group: t('flows.non_monetary'), options: ['HOUR','DAY','SHIFT','ITEM','TASK','OCCASION','PROMISE'].map(c => ({
        value: c, label: unitLabel(c), selected: c === selected })) }
  ];
}
function typeSelectOptions(selected) {
  return S.TYPES.filter(x => x !== 'T-10' || S.state.settings.spiritual_ledger)
    .map(x => ({ value: x, label: `${t('type.' + x)}`, selected: x === selected }));
}
function cpDatalist(id = 'cp-list') {
  const dl = el('datalist', { id });
  S.state.counterparties.forEach(c => dl.appendChild(el('option', { value: c.alias })));
  return dl;
}

/* ============================================================
   AUTH GATE — features that reach another person need a linked
   social account (stage 2). Everything else stays local (stage 1).
   ============================================================ */
const gate = (feature, fn) => (id) => AUTH.requireAuth(feature, { id }, () => fn(id));
export const openShare = gate('share', id => _openShare(id));
export const openReminder = gate('remind', id => _openReminder(id));
export const openSettlement = gate('settlement', id => _openSettlement(id));
export const openTransfer = gate('transfer', id => _openTransfer(id));
export const openThanks = gate('thanks', id => _openThanks(id));
const addWitnessPrompt = gate('witness', id => _addWitnessPrompt(id));
AUTH.registerResume('share', p => p && _openShare(p.id));
AUTH.registerResume('remind', p => p && _openReminder(p.id));
AUTH.registerResume('settlement', p => p && _openSettlement(p.id));
AUTH.registerResume('transfer', p => p && _openTransfer(p.id));
AUTH.registerResume('thanks', p => p && _openThanks(p.id));
AUTH.registerResume('witness', p => p && _addWitnessPrompt(p.id));

/* ============================================================
   QUICK ADD (§7.5) — target ≤ 20 seconds
   ============================================================ */
export function openQuickAdd(prefill = {}) {
  const s = S.state.settings;
  const draft = S.newCommitmentDraft(Object.assign({
    direction: s.last_direction, unit_code: s.last_unit || s.base_currency, tone: s.default_tone
  }, prefill));
  if (prefill.type && !prefill.unit_code) {
    const def = S.TYPE_DEFAULT_UNIT[prefill.type];
    if (def) draft.unit_code = def;
  }

  const v = new VAL.Validator();
  const body = el('div', { class: 'stack qa-form' });

  /* Form order follows how people actually think about a debt:
       1. Who & which way  →  2. What (type → unit → amount)  →
       3. When (incurred → due)  →  4. Who sees it  →  5. Extras.
     Fields that only make sense after an earlier answer are hidden until then:
       - amount is hidden for a pure promise (unit = PROMISE);
       - "approximate" only appears once an amount exists;
       - installments only appear for an amount AND a real due date;
       - the gold reference only appears for gold/silver units;
       - witness names only appear when privacy is "witnessed";
       - the counterparty kind is pre-filled & locked for a known person. */

  /* --- natural language box (optional shortcut) --- */
  const nlInput = input({ placeholder: t('add.nl_ph'), 'aria-label': t('add.nl_title'), maxlength: '300', enterkeyhint: 'go' });
  nlInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); runParse(); } });
  const nlBox = el('details', { class: 'card qa-nl', style: { background: 'var(--surface-2)' } }, [
    el('summary', {}, [icon('fa-wand-magic-sparkles'), el('span', { text: ' ' + t('add.nl_title') })]),
    el('div', { class: 'row tight', style: { marginTop: '10px' } }, [
      el('div', { style: { flex: '1 1 200px', minWidth: '0' } }, [nlInput]),
      el('button', { class: 'btn btn-sm', type: 'button', onclick: () => runParse() },
        [el('span', { text: t('add.nl_parse') })])
    ]),
    el('p', { class: 'hint', text: t('add.nl_limit') })
  ]);

  const step = (n, title) => el('div', { class: 'qa-step' }, [
    el('span', { class: 'qa-num', text: String(n) }), el('span', { text: title })
  ]);

  /* --- 1. direction --- */
  const dirWrap = el('div');
  const renderDir = () => {
    dirWrap.replaceChildren(chipGroup([
      { value: 'I_OWE', label: t('dir.i_owe'), icon: 'fa-arrow-up-long' },
      { value: 'OWED_TO_ME', label: t('dir.owed_to_me'), icon: 'fa-arrow-down-long' },
      { value: 'MUTUAL', label: t('dir.mutual'), icon: 'fa-arrows-left-right' }
    ], draft.direction, val => { draft.direction = val; renderDir(); }));
  };
  renderDir();

  /* --- 1. counterparty (kind depends on whether the person is known) --- */
  const whoInput = input({ placeholder: t('add.who_ph'), list: 'cp-list', autocomplete: 'off',
    value: prefill.counterparty_name || '', maxlength: '80', enterkeyhint: 'next' });
  const kindSel = select(S.CP_KINDS
      .filter(k => k !== 'divine_private' || s.islamic_mode)
      .map(k => ({ value: k, label: t('people.kind.' + k) })), {});
  const kindHint = el('div', { class: 'hint' });
  const kindField = field(t('flows.counterparty_kind'), kindSel);
  kindField.appendChild(kindHint);
  const syncKind = () => {
    const known = S.findCounterpartyByName(whoInput.value.trim());
    if (known) {
      kindSel.value = known.kind; kindSel.disabled = true;
      kindHint.textContent = t('flows.known_person_their_saved');
    } else {
      kindSel.disabled = false;
      kindHint.textContent = whoInput.value.trim()
        ? (t('flows.new_person_they_will')) : '';
    }
  };
  whoInput.addEventListener('input', syncKind);
  whoInput.addEventListener('change', syncKind);

  /* --- 2. type → unit → amount --- */
  const unitSel = select(unitSelectOptions(draft.unit_code), {});
  const typeSel = select(typeSelectOptions(draft.type), {
    onchange: e => applyType(e.target.value)
  });
  const typeChips = el('div');
  const renderTypeChips = () => {
    typeChips.replaceChildren(chipGroup(
      S.TOP_TYPES.map(x => ({ value: x, label: t('type.' + x) })), draft.type, val => applyType(val)));
  };
  function applyType(val) {
    draft.type = val; typeSel.value = val;
    const def = S.TYPE_DEFAULT_UNIT[val];
    if (def) { draft.unit_code = def; unitSel.value = def; }
    else if (!isMonetary(unitSel.value)) { draft.unit_code = s.last_unit && isMonetary(s.last_unit) ? s.last_unit : s.base_currency; unitSel.value = draft.unit_code; }
    renderTypeChips(); syncDependents();
  }
  renderTypeChips();
  unitSel.addEventListener('change', () => { draft.unit_code = unitSel.value; syncDependents(); v.checkOne(amountEntry); });

  const amtInput = input({ inputmode: 'decimal', placeholder: '0', autocomplete: 'off', enterkeyhint: 'next' });
  const amountField = field(t('add.amount'), amtInput, null, { required: true });
  const unitField = field(t('add.unit'), unitSel, null, { required: true });
  const amountRow = el('div', { class: 'field-row' }, [unitField, amountField]);
  const approxChk = el('input', { type: 'checkbox' });
  const approxRow = el('label', { class: 'row tight check-row' }, [approxChk, el('span', { text: t('add.approximate') })]);

  const descInput = input({ placeholder: t('add.description_ph'), value: prefill.description || '', maxlength: '200', enterkeyhint: 'next' });
  const descField = field(t('add.description'), descInput);
  const descLabel = descField.querySelector('label');

  function amountNeeded() { return unitSel.value !== 'PROMISE'; }
  const hasAmount = () => amountNeeded() && toMinor(amtInput.value, unitSel.value) > 0;
  const isMetal = () => /^XA[UG]_/.test(unitSel.value);

  /* --- 3. dates (due depends on incurred) --- */
  const incurred = input({ type: 'date', value: draft.incurred_on, max: S.todayISO() });
  const dueInput = input({ type: 'date', min: draft.incurred_on });
  const dueField = field(t('add.due'), dueInput);
  incurred.addEventListener('change', () => {
    dueInput.min = incurred.value || '';
    if (dueInput.value) v.checkOne(dueEntry);
  });
  const dueWrap = el('div');
  const renderDue = () => {
    dueWrap.replaceChildren(
      chipGroup([
        { value: 'week', label: t('add.chip_week') },
        { value: 'month', label: t('add.chip_month') },
        { value: 'date', label: t('flows.pick_date') },
        { value: 'when_able', label: t('add.chip_able') },
        { value: 'on_return', label: t('status.on_return') },
        { value: 'none', label: t('add.chip_none') }
      ], draft._dueChip || 'none', val => {
        draft._dueChip = val;
        const d = new Date();
        if (val === 'week') { d.setDate(d.getDate() + 7); draft.due_mode = 'date'; dueInput.value = d.toISOString().slice(0,10); }
        else if (val === 'month') { d.setMonth(d.getMonth() + 1); draft.due_mode = 'date'; dueInput.value = d.toISOString().slice(0,10); }
        else if (val === 'date') { draft.due_mode = 'date'; }
        else if (val === 'none') { draft.due_mode = 'none'; dueInput.value = ''; }
        else { draft.due_mode = val; dueInput.value = ''; }
        renderDue(); syncDependents();
        v.checkOne(dueEntry); v.checkOne(instEntry);
        if (val === 'date') setTimeout(() => dueInput.focus(), 30);
      })
    );
  };
  renderDue();
  dueInput.addEventListener('change', () => {
    if (dueInput.value) { draft.due_mode = 'date'; if (draft._dueChip !== 'date') draft._dueChip = 'date'; renderDue(); }
    syncDependents();
  });

  /* --- 4. privacy (witness names depend on "witnessed") --- */
  let visibility = 'private';
  const witnessInput = input({ placeholder: t('add.witness_ph'), maxlength: '200' });
  const witnessField = field(t('add.witness'), witnessInput);
  const privHint = el('p', { class: 'hint' });
  const privWrap = el('div');
  const renderPriv = () => {
    privWrap.replaceChildren(chipGroup([
      { value: 'private', label: t('add.privacy.private'), icon: 'fa-lock' },
      { value: 'shared', label: t('add.privacy.shared'), icon: 'fa-user-group' },
      { value: 'witnessed', label: t('add.privacy.witnessed'), icon: 'fa-users-viewfinder' }
    ], visibility, val => { visibility = val; renderPriv(); syncDependents(); }));
  };
  renderPriv();

  /* --- 5. extras --- */
  const instCount = input({ type: 'number', min: '0', max: '60', step: '1', value: '0', inputmode: 'numeric' });
  const instField = field(t('add.installments'), instCount, t('add.installments_hint'));
  const notesInput = textarea({ placeholder: t('add.notes'), maxlength: '2000' });
  const guarantorInput = input({ placeholder: t('add.guarantor'), maxlength: '80' });
  const goldInput = input({ placeholder: t('add.gold_ref'), maxlength: '120' });
  const goldField = field(t('add.gold_ref'), goldInput, t('flows.display_reference_only_never'));
  const toneSel = select(S.TONES.filter(x => x !== 'islamic' || s.islamic_mode)
    .map(x => ({ value: x, label: t('tone.' + x), selected: x === draft.tone })), {});

  const advanced = el('details', { class: 'card', style: { background: 'var(--surface-2)' } }, [
    el('summary', { text: t('flows.more_details_optional'), style: { cursor: 'pointer', fontWeight: '600' } }),
    el('div', { style: { marginTop: '12px' } }, [
      instField,
      goldField,
      field(t('add.guarantor'), guarantorInput),
      field(t('add.tone'), toneSel),
      field(t('add.notes'), notesInput)
    ])
  ]);

  /* One place decides which dependent fields are visible. */
  function syncDependents() {
    const needAmt = amountNeeded();
    amountField.hidden = !needAmt;
    approxRow.hidden = !needAmt;
    descInput.setAttribute('aria-required', needAmt ? 'false' : 'true');
    descLabel.querySelector('.req')?.remove();
    if (!needAmt) descLabel.appendChild(el('span', { class: 'req', text: ' *' }));
    const hasDate = draft.due_mode === 'date';
    dueField.hidden = !hasDate;
    instField.hidden = !(hasAmount() && hasDate && dueInput.value);
    if (instField.hidden) instCount.value = '0';
    goldField.hidden = !isMetal();
    witnessField.hidden = visibility !== 'witnessed';
    privHint.textContent = visibility === 'private'
      ? (t('flows.stays_on_device_only'))
      : (AUTH.isSignedIn()
          ? (t('flows.will_write_message_other'))
          : (t('flows.sharing_needs_linked_social')));
    saveBtn.textContent = visibility === 'private' ? t('action.save') : t('action.save_share');
  }
  amtInput.addEventListener('input', syncDependents);

  const parseNotice = el('div');

  /* --- rules --- */
  v.rule(whoInput, VAL.requiredWho(whoInput), { label: t('add.who') });
  v.rule(amtInput, () => amountNeeded() ? VAL.amountRule(amtInput, () => unitSel.value)() : null,
    { label: t('add.amount'), appendTo: amountField });
  const amountEntry = v.rules[v.rules.length - 1];
  v.rule(descInput, () => {
    const txt = (descInput.value || '').trim();
    if (!amountNeeded() && !txt) return t('flows.describe_what_was_promised');
    return VAL.optionalText(descInput, 200)();
  }, { label: t('add.description'), appendTo: descField });
  v.rule(incurred, VAL.dateRule(incurred, { required: true, noFuture: true }), { label: t('add.incurred') });
  v.rule(dueInput, () => {
    if (draft.due_mode === 'date' && draft._dueChip === 'date' && !dueInput.value)
      return t('flows.pick_due_date_or');
    return VAL.dateRule(dueInput, { notBefore: () => incurred.value })();
  }, { label: t('add.due'), appendTo: dueField });
  const dueEntry = v.rules[v.rules.length - 1];
  v.rule(instCount, () => instField.hidden ? null : VAL.installmentsRule(instCount,
    () => hasAmount(), () => dueInput.value || S.todayISO())(), { label: t('add.installments'), appendTo: instField });
  const instEntry = v.rules[v.rules.length - 1];
  v.rule(witnessInput, () => {
    if (visibility !== 'witnessed') return null;
    if (!witnessInput.value.trim()) return t('flows.add_at_least_one');
    return VAL.optionalText(witnessInput, 200)();
  }, { label: t('add.witness'), appendTo: witnessField });
  v.rule(notesInput, VAL.optionalText(notesInput, 2000), { label: t('add.notes') });

  function runParse() {
    const r = C.parseNaturalLanguage(nlInput.value, { direction: draft.direction });
    draft.direction = r.direction; renderDir();
    applyType(r.type);
    if (r.counterparty_name) whoInput.value = r.counterparty_name;
    if (r.amount) amtInput.value = r.amount;
    if (r.unit_code) { draft.unit_code = r.unit_code; unitSel.value = r.unit_code; }
    if (r.due_on) { dueInput.value = r.due_on; draft.due_mode = 'date'; draft._dueChip = 'date'; }
    else if (r.due_mode !== 'none') { draft.due_mode = r.due_mode; draft._dueChip = r.due_mode; }
    draft.recurrence = r.recurrence || null;
    renderDue();
    if (!descInput.value) descInput.value = (r.description || '').slice(0, 200);
    syncKind(); syncDependents();
    v.clear();
    const msgs = [];
    if (r.confidence.includes('unit_ambiguous'))
      msgs.push(t('flows.which_currency_candidates', { list: new Intl.ListFormat(intlTag(), { type: 'disjunction' }).format(r.unit_candidates) }));
    if (r.confidence.includes('year_assumed'))
      msgs.push(t('flows.year_was_assumed_please'));
    if (r.confidence.includes('start_date_needed'))
      msgs.push(t('flows.recurring_promise_please_set'));
    parseNotice.replaceChildren(el('div', { class: 'notice', text: msgs.length ? msgs.join(' · ') : t('add.nl_limit') }));
  }

  const saveBtn = el('button', { class: 'btn btn-primary', type: 'button', text: t('action.save'), onclick: () => save() });

  body.append(
    nlBox, parseNotice, v.summary,
    step(1, t('flows.who_which_way')),
    field(t('add.direction'), dirWrap, null, { required: true }),
    el('div', { class: 'field-row' }, [field(t('add.who'), whoInput, null, { required: true }), kindField]),
    cpDatalist(),
    step(2, t('flows.what')),
    field(t('add.type'), frag([typeChips, el('div', { style: { height: '8px' } }), typeSel]), null, { required: true }),
    amountRow,
    approxRow,
    descField,
    step(3, t('flows.when')),
    field(t('add.incurred'), incurred, null, { required: true }),
    field(t('add.due'), dueWrap),
    dueField,
    step(4, t('flows.who_sees')),
    field(t('add.privacy'), privWrap, null, { required: true }),
    privHint,
    witnessField,
    advanced,
    el('p', { class: 'notice', text: t('limit.no_riba') }),
    s.islamic_mode ? ayahBlock(C.ayahFor('writing')) : null,
    disclaimer('legal')
  );
  /* Prefill from a scanned request (#/r) or any caller. */
  if (prefill.amount_minor && amountNeeded()) amtInput.value = amtValue(prefill.amount_minor, unitSel.value);
  if (prefill.incurred_on && prefill.incurred_on <= S.todayISO()) incurred.value = prefill.incurred_on;
  if (prefill.due_on) { dueInput.value = prefill.due_on; draft.due_mode = 'date'; draft._dueChip = 'date'; renderDue(); }
  syncKind();
  syncDependents();

  async function save() {
    if (!v.check()) return;
    const unit = unitSel.value;
    const amount_minor = amountNeeded() ? toMinor(amtInput.value, unit) : 0;
    const known = S.findCounterpartyByName(whoInput.value.trim());
    const c = await S.createCommitment({
      type: typeSel.value,
      direction: draft.direction,
      counterparty_name: whoInput.value.trim(),
      counterparty_kind: known ? known.kind : kindSel.value,
      unit_code: unit,
      amount_minor,
      description: descInput.value.trim(),
      incurred_on: incurred.value || S.todayISO(),
      due_on: draft.due_mode === 'date' ? (dueInput.value || null) : null,
      due_mode: draft.due_mode === 'date' ? (dueInput.value ? 'date' : 'none') : draft.due_mode,
      recurrence: draft.recurrence || null,
      visibility,
      approximate: amountNeeded() && approxChk.checked,
      tone: toneSel.value,
      notes: notesInput.value.trim(),
      gold_reference: isMetal() ? goldInput.value.trim() : '',
      guarantor: guarantorInput.value.trim()
    });
    const n = instField.hidden ? 0 : parseInt(VAL.normalizeNumeric(instCount.value) || '0', 10);
    if (n > 1 && amount_minor > 0) {
      await S.setInstallments(c.id, n, dueInput.value || S.todayISO(), 30);
    }
    if (visibility === 'witnessed') {
      const wits = witnessInput.value.split(/[,،]/).map(x => x.trim()).filter(Boolean).slice(0, 10);
      for (const w of wits) await S.addWitness(c.id, w, 'terms');
    }
    closeSheet();
    toast(t('add.saved', { count: S.visibleCommitments().length }), 'good');
    if (visibility !== 'private') setTimeout(() => openShare(c.id), 400);
    return c;
  }

  sheet({
    title: t('add.title'),
    body,
    footer: [
      el('button', { class: 'btn', type: 'button', text: t('action.cancel'), onclick: () => closeSheet() }),
      saveBtn
    ]
  });
  syncDependents();
}

/* ============================================================
   SHARE / CO-ACKNOWLEDGEMENT (§7.7)
   ============================================================ */
function _openShare(id) {
  const c = S.commitmentOf(id);
  if (!c) return;
  const cp = S.cpOf(c.counterparty_id);
  const amountTxt = c.amount_minor ? formatAmount(S.remainingMinor(c), c.unit_code) : (c.description || t('type.' + c.type));
  const msg = t('share.message', {
    name: cp?.alias || '', amount: amountTxt, type: t('type.' + c.type),
    date: formatDate(c.incurred_on), hasDue: c.due_on ? 'yes' : 'no', due: c.due_on ? formatDate(c.due_on) : '',
    disclaimer: t('legal.disclaimer')
  });

  const ta = textarea({ value: msg, rows: 10, maxlength: '2000' });
  const links = el('div', { class: 'row tight' });
  const buildLinks = () => {
    const text = encodeURIComponent(ta.value);
    links.replaceChildren(
      QR.qrButton(() => QR.buildPayload('confirm', c), { cls: 'btn-sm btn-primary' }),
      el('button', { class: 'btn btn-sm', onclick: async () => {
        if (!ta.value.trim()) return toast(VAL.MSG.required(), 'warn');
        await copyText(ta.value); toast(t('remind.copied'), 'good');
      } }, [icon('fa-copy'), el('span', { text: t('action.copy') })]),
      el('a', { class: 'btn btn-sm', href: 'https://wa.me/?text=' + text, target: '_blank', rel: 'noopener' },
        [icon('fa-brands fa-whatsapp'), el('span', { text: 'WhatsApp' })]),
      el('a', { class: 'btn btn-sm', href: 'sms:?&body=' + text }, [icon('fa-comment-sms'), el('span', { text: 'SMS' })]),
      el('a', { class: 'btn btn-sm', href: 'mailto:?subject=' + encodeURIComponent(t('app.name')) + '&body=' + text },
        [icon('fa-envelope'), el('span', { text: 'Email' })]),
      navigator.share ? el('button', { class: 'btn btn-sm', onclick: async () => {
        try { await navigator.share({ text: ta.value }); } catch {}
      } }, [icon('fa-share-nodes'), el('span', { text: t('flows.share') })]) : null
    );
  };
  buildLinks();
  ta.addEventListener('input', buildLinks);

  const body = el('div', { class: 'stack' }, [
    el('p', { class: 'notice', text: t('limit.not_collector') }),
    field(t('remind.preview'), ta),
    links,
    el('p', { class: 'notice', text: t('flows.link_shows_only_one') }),
    el('div', { class: 'card', style: { background: 'var(--surface-2)' } }, [
      el('b', { text: t('flows.record_other_party_s') }),
      el('div', { class: 'row tight', style: { marginTop: '10px' } }, [
        el('button', { class: 'btn btn-sm btn-good', text: t('action.confirm'), onclick: async () => {
          await S.updateCommitment(id, { status: 'acknowledged', acknowledged_at: Date.now() }, 'commitment.acknowledged');
          await S.updateCommitment(id, { status: 'active' }, 'commitment.active');
          closeSheet(); toast(t('status.acknowledged'), 'good');
        } }),
        el('button', { class: 'btn btn-sm', text: t('flows.requested_edit'), onclick: () => {
          closeSheet(true); openEdit(id);
        } }),
        el('button', { class: 'btn btn-sm', text: t('action.dispute'), onclick: () => { closeSheet(true); openDispute(id); } })
      ])
    ]),
    disclaimer('legal')
  ]);
  sheet({ title: t('action.share'), body, footer: [
    el('button', { class: 'btn btn-primary', text: t('action.close'), onclick: () => closeSheet() })
  ] });
}

/* ============================================================
   COMMITMENT DETAIL (§7.6)
   ============================================================ */
export function openDetail(id) {
  const c = S.commitmentOf(id);
  if (!c) { toast(t('flows.that_record_no_longer'), 'warn'); return; }
  const s = S.state.settings;
  const cp = S.cpOf(c.counterparty_id);
  const rem = S.remainingMinor(c);
  const paid = S.paidMinor(c.id);
  const pct = S.progressPct(c);
  const amCreditor = c.direction === 'OWED_TO_ME';
  const closed = S.CLOSED_STATUSES.includes(c.status);
  const reopen = () => { closeSheet(true); openDetail(id); };

  const header = el('div', { class: 'stack' }, [
    el('div', { class: 'row' }, [
      avatar(cp?.alias, Math.max(0, S.state.counterparties.findIndex(x => x.id === c.counterparty_id)), 'lg'),
      el('div', { style: { flex: '1', minWidth: '0' } }, [
        el('h3', { text: cp?.alias || '—', style: { margin: '0' } }),
        el('div', { class: 'row tight', style: { marginTop: '4px' } }, [
          directionBadge(c.direction), statusBadge(c.status),
          el('span', { class: 'badge', text: t('type.' + c.type) }),
          c.approximate ? el('span', { class: 'badge', text: t('status.approximate') }) : null
        ])
      ])
    ]),
    c.amount_minor ? el('div', {}, [
      amountEl(rem, c.unit_code, { size: 'amount-xl' }),
      s.converted_totals && isMonetary(c.unit_code) && c.unit_code !== s.base_currency
        ? el('div', { class: 'hint', text: fxNotice(c.unit_code, s.base_currency) }) : null
    ]) : null,
    c.description ? el('p', { text: c.description, style: { fontSize: '1rem', color: 'var(--text)' } }) : null
  ]);

  /* Terms */
  const terms = el('dl', { class: 'kv' });
  const kv = (k, val) => { terms.appendChild(el('dt', { text: k })); terms.appendChild(el('dd', { text: val })); };
  kv(t('add.incurred'), formatDateDual(c.incurred_on));
  kv(t('add.due'), dueLabel(c));
  if (c.gold_reference) kv(t('add.gold_ref'), c.gold_reference);
  if (c.guarantor) kv(t('add.guarantor'), c.guarantor);
  kv(t('add.privacy'), t('add.privacy.' + (c.visibility === 'witnessed' ? 'witnessed' : c.visibility === 'shared' ? 'shared' : 'private')));
  kv(t('add.tone'), t('tone.' + (c.tone || 'gentle')));
  if (c.notes) kv(t('add.notes'), c.notes);

  /* Progress */
  const insts = S.installmentsOf(c.id);
  const fuls = S.fulfilmentsOf(c.id);
  const progress = el('div', { class: 'stack' }, [
    c.amount_minor ? progressBar(pct, pct >= 100) : null,
    c.amount_minor ? el('div', { class: 'row between' }, [
      el('small', {}, [el('span', { text: t('detail.paid') + ': ' }), amountEl(paid, c.unit_code)]),
      el('small', {}, [el('span', { text: t('detail.remaining') + ': ' }), amountEl(rem, c.unit_code)])
    ]) : null,
    insts.length ? el('div', {}, [
      el('b', { text: t('detail.installments') }),
      el('ul', { class: 'listy' }, insts.map(i => el('li', {}, [
        el('div', { class: 'item-row', style: { cursor: 'default' } }, [
          el('span', { class: 'item-main' }, [
            el('b', { text: `#${i.seq} · ${formatDateDual(i.due_on)}` }),
            el('small', { text: t('status.' + (i.status === 'pending' ? 'active' : 'fulfilled')) })
          ]),
          amountEl(i.amount_minor, c.unit_code)
        ])
      ])))
    ]) : null,
    fuls.length ? el('div', {}, [
      el('b', { text: t('detail.payments') }),
      el('ul', { class: 'listy' }, fuls.map(f => el('li', {}, [
        el('div', { class: 'item-row', style: { cursor: 'default' } }, [
          el('span', { class: 'item-main' }, [
            el('b', {}, [amountEl(f.amount_minor, f.unit_code)]),
            el('small', { text: formatDateDual(f.on) + (f.method_note ? ' · ' + f.method_note : '') })
          ]),
          el('span', { class: 'badge badge-good', text: t('status.fulfilled') })
        ])
      ])))
    ]) : null
  ]);

  /* Parties */
  const wits = S.witnessesOf(c.id);
  const parties = el('div', { class: 'stack' }, [
    el('div', { class: 'row' }, [
      el('span', { class: 'badge', text: t('detail.creditor') + ': ' + (amCreditor ? t('detail.me') : cp?.alias || '—') }),
      el('span', { class: 'badge', text: t('detail.debtor') + ': ' + (amCreditor ? cp?.alias || '—' : t('detail.me')) })
    ]),
    el('div', {}, [
      el('b', { text: t('detail.witnesses') }),
      wits.length
        ? el('ul', { class: 'listy' }, wits.map(w => el('li', {}, [
            el('div', { class: 'item-row', style: { cursor: 'default' } }, [
              el('span', { class: 'item-main' }, [
                el('b', { text: w.name }),
                el('small', { text: w.attested_at ? formatDateTime(w.attested_at) : (t('flows.not_attested_yet')) })
              ]),
              w.attested_at ? el('span', { class: 'badge badge-good' }, [icon('fa-check')])
                : el('button', { class: 'btn btn-sm', text: t('flows.record_attestation'),
                    onclick: async () => { await S.attestWitness(w.id); reopen(); } })
            ])
          ])))
        : el('p', { class: 'hint', text: t('misc.nothing_yet') }),
      el('div', { class: 'row tight' }, [
        el('button', { class: 'btn btn-sm', onclick: () => addWitnessPrompt(id) },
          [icon('fa-user-plus'), el('span', { text: t('flows.add_witness') })])
      ])
    ])
  ]);

  /* Evidence */
  const evs = S.evidenceOf(c.id);
  const fileErr = el('div', { class: 'err' });
  const fileInput = el('input', { type: 'file', accept: 'image/*,application/pdf,audio/*', style: { display: 'none' },
    onchange: async e => {
      const f = e.target.files[0];
      fileErr.replaceChildren();
      if (!f) return;
      const problem = VAL.checkFile(f);
      if (problem) {
        fileErr.append(icon('fa-circle-exclamation'), el('span', { text: problem }));
        e.target.value = '';
        return;
      }
      await S.addEvidence(id, f);
      reopen();
    } });
  const evidence = el('div', { class: 'stack' }, [
    evs.length
      ? el('ul', { class: 'listy' }, evs.map(e2 => el('li', {}, [
          el('div', { class: 'item-row', style: { cursor: 'default' } }, [
            icon(e2.mime.startsWith('image') ? 'fa-image' : e2.mime.startsWith('audio') ? 'fa-microphone' : 'fa-file-pdf'),
            el('span', { class: 'item-main' }, [
              el('b', { text: e2.name }),
              el('small', { text: t('vault.hash') + ': ' + e2.sha256.slice(0, 16) + '…' })
            ]),
            el('a', { class: 'btn btn-sm', href: e2.data, download: e2.name, text: t('action.open') })
          ])
        ])))
      : el('p', { class: 'hint', text: t('detail.no_evidence') }),
    el('div', { class: 'row tight' }, [
      fileInput,
      el('button', { class: 'btn btn-sm', onclick: () => fileInput.click() },
        [icon('fa-paperclip'), el('span', { text: t('action.attach') })])
    ]),
    fileErr,
    el('p', { class: 'hint', text: t('flows.mb_per_file_images', { mb: formatNumber(VAL.MAX_FILE_MB) }) })
  ]);

  /* Append-only history */
  const events = S.state.audit.filter(a => a.entity_id === id).sort((a, b) => b.at - a.at);
  const history = el('div', { class: 'timeline' }, events.length ? events.map(e2 => {
    const done = /fulfil|release|settle|acknowledg/.test(e2.action);
    const warn = /dispute|respite|reminder/.test(e2.action);
    return el('div', { class: 'tl-item ' + (done ? 'done' : warn ? 'warn' : '') }, [
      el('b', { text: e2.action }),
      el('small', { text: formatDateTime(e2.at) }),
      e2.diff && Object.keys(e2.diff).length
        ? el('small', { text: Object.keys(e2.diff).slice(0, 4).join(', ') }) : null,
      el('small', { text: '#' + e2.hash.slice(0, 10), style: { opacity: '.6' } })
    ]);
  }) : [el('p', { class: 'hint', text: t('misc.nothing_yet') })]);

  /* Actions */
  const act = (label, iconName, fn, cls = 'btn-sm') =>
    el('button', { class: 'btn ' + cls, onclick: fn }, [icon(iconName), el('span', { text: label })]);
  const actions = el('div', { class: 'row tight' });
  if (!closed) {
    actions.append(
      act(t('action.record_payment'), 'fa-receipt', () => openRecordPayment(id)),
      act(t('action.remind'), 'fa-paper-plane', () => openReminder(id)),
      act(t('action.self_remind'), 'fa-bell', () => openSelfReminder(id))
    );
    if (amCreditor) {
      actions.append(
        act(t('action.grant_respite'), 'fa-clock', () => openGrantRespite(id)),
        act(t('action.release'), 'fa-dove', () => openRelease(id), 'btn-sm btn-good'),
        act(t('action.write_off'), 'fa-eraser', () => openWriteOff(id)),
        act(t('action.transfer'), 'fa-right-left', () => openTransfer(id))
      );
    } else {
      actions.append(
        act(t('action.request_respite'), 'fa-clock', () => openRequestRespite(id)),
        act(t('action.promise_to_pay'), 'fa-calendar-check', () => openPromiseToPay(id))
      );
    }
    actions.append(
      act(t('action.propose_settlement'), 'fa-handshake', () => openSettlement(id)),
      act(t('action.dispute'), 'fa-comments', () => openDispute(id)),
      act(t('action.mark_fulfilled'), 'fa-circle-check', () => markFulfilled(id), 'btn-sm btn-good')
    );
    if (c.visibility === 'private') actions.append(act(t('action.share'), 'fa-share-nodes', () => { closeSheet(true); openShare(id); }));
    actions.append(act(t('flows.qr_code'), 'fa-qrcode', () => { closeSheet(true); QR.openRequestQR(QR.buildPayload(amCreditor ? 'remind' : 'confirm', c)); }));
  } else {
    actions.append(act(t('action.thank'), 'fa-heart', () => openThanks(id)));
    const rel = S.state.releases.find(r => r.commitment_id === id && !r.undone && Date.now() < r.undo_until);
    if (rel) {
      const hrs = Math.ceil((rel.undo_until - Date.now()) / 36e5);
      actions.append(act(t('flow.release_undo_left', { hours: hrs }), 'fa-rotate-left',
        async () => { await S.undoRelease(rel.id); closeSheet(); toast(t('action.undo'), 'good'); }, 'btn-sm btn-warn'));
    }
    if (c.status !== 'archived') {
      actions.append(act(t('action.archive'), 'fa-box-archive', async () => {
        await S.updateCommitment(id, { status: 'archived' }, 'commitment.archived');
        closeSheet(); toast(t('status.archived'), 'good');
      }));
    }
  }
  actions.append(
    act(t('action.edit'), 'fa-pen', () => { closeSheet(true); openEdit(id); }),
    act(t('action.delete'), 'fa-trash', () => {
      confirmSheet({
        title: t('action.delete'), danger: true,
        message: c.visibility === 'private'
          ? (t('flows.record_removed_from_device'))
          : (t('flows.shared_record_tombstone_created')),
        confirmLabel: t('action.delete'),
        onConfirm: async () => { await S.deleteCommitment(id); toast(t('misc.deleted')); }
      });
    })
  );

  const sect = (title, node, wid) => el('details', { class: 'card', open: true, style: { background: 'var(--surface-2)' } }, [
    el('summary', { style: { cursor: 'pointer', fontWeight: '650' } }, [
      el('span', { text: title }), wid ? el('span', { class: 'wid', text: wid, style: { marginInlineStart: '8px' } }) : null
    ]),
    el('div', { style: { marginTop: '12px' } }, [node])
  ]);

  const respiteList = S.respitesOf(id);
  const ptps = S.ptpOf(id);

  const body = el('div', { class: 'stack' }, [
    header,
    sect(t('detail.actions'), actions),
    sect(t('detail.terms'), terms),
    c.amount_minor || insts.length || fuls.length ? sect(t('detail.progress'), progress) : null,
    ptps.length ? sect(t('detail.ptp'), el('ul', { class: 'listy' }, ptps.map(p => el('li', {}, [
      el('div', { class: 'item-row', style: { cursor: 'default' } }, [
        el('span', { class: 'item-main' }, [
          el('b', {}, [amountEl(p.amount_minor, c.unit_code)]),
          el('small', { text: t('flow.ptp_date') + ' ' + formatDateDual(p.by_date) })
        ]),
        p.by_date < S.todayISO() && p.kept === null
          ? el('span', { class: 'badge badge-needs', text: t('flows.passed') })
          : el('span', { class: 'badge', text: t('status.active') })
      ])
    ])))) : null,
    respiteList.length ? sect(t('detail.respite_history'), el('ul', { class: 'listy' }, respiteList.map(r => el('li', {}, [
      el('div', { class: 'item-row', style: { cursor: 'default' } }, [
        el('span', { class: 'item-main' }, [
          el('b', { text: formatDateDual(r.proposed_due_on) }),
          el('small', { text: r.reason || '—' })
        ]),
        el('span', { class: 'badge ' + (r.status === 'granted' ? 'badge-good' : 'badge-needs'), text: r.status })
      ])
    ])))) : null,
    sect(t('detail.parties'), parties),
    sect(t('detail.evidence'), evidence),
    sect(t('detail.history'), history),
    s.islamic_mode ? ayahBlock(C.ayahFor(amCreditor ? 'respite' : 'intention') || C.ayahFor('writing')) : null,
    disclaimer('legal')
  ]);

  sheet({ title: t('nav.ledger'), body, wide: true, footer: [
    el('button', { class: 'btn btn-primary', text: t('action.close'), onclick: () => closeSheet() })
  ] });
}

function _addWitnessPrompt(id) {
  const v = new VAL.Validator();
  const nameInput = input({ placeholder: t('add.who_ph'), maxlength: '80' });
  const scopeSel = select([
    { value: 'terms', label: t('flows.terms_only') },
    { value: 'full', label: t('flows.full_witness') }
  ]);
  const f = field(t('flows.witness_name'), nameInput, null, { required: true });
  v.rule(nameInput, VAL.requiredText(nameInput, 80), { label: t('flows.witness_name'), appendTo: f });
  sheet({
    title: t('detail.witnesses'),
    body: el('div', { class: 'stack' }, [
      v.summary, f,
      field(t('flows.scope'), scopeSel),
      el('p', { class: 'notice', text: t('flows.witness_read_only_can') }),
      S.state.settings.islamic_mode ? ayahBlock(C.AYAT.find(a => a.id === '2:283')) : null
    ]),
    footer: [
      el('button', { class: 'btn', text: t('action.cancel'), onclick: () => closeSheet() }),
      QR.qrButton(() => v.check() ? QR.buildPayload('witness', S.commitmentOf(id), {
        note: t('flows.to_name', { name: nameInput.value.trim() }) }) : null, { cls: '' }),
      el('button', { class: 'btn btn-primary', text: t('action.save'), onclick: async () => {
        if (!v.check()) return;
        await S.addWitness(id, nameInput.value.trim(), scopeSel.value);
        closeSheet(true); toast(t('misc.saved'), 'good'); openDetail(id);
      } })
    ]
  });
}

/* ---------- Edit ---------- */
export function openEdit(id) {
  const c = S.commitmentOf(id);
  if (!c) return;
  const v = new VAL.Validator();
  const desc = input({ value: c.description || '', maxlength: '200' });
  const amt = input({ inputmode: 'decimal', value: amtValue(c.amount_minor, c.unit_code) });
  const unitSel = select(unitSelectOptions(c.unit_code), { onchange: () => v.checkOne(amtEntry) });
  const incurred = input({ type: 'date', value: c.incurred_on || S.todayISO(), max: S.todayISO() });
  const due = input({ type: 'date', value: c.due_on || '' });
  const notes = textarea({ value: c.notes || '', maxlength: '2000' });
  const approx = el('input', { type: 'checkbox', checked: c.approximate });
  const toneSel = select(S.TONES.map(x => ({ value: x, label: t('tone.' + x), selected: x === c.tone })));

  const amtField = field(t('add.amount'), amt);
  const needsAmount = () => unitSel.value !== 'PROMISE';
  const approxRow = el('label', { class: 'row tight check-row' }, [approx, el('span', { text: t('add.approximate') })]);
  const syncEdit = () => { amtField.hidden = !needsAmount(); approxRow.hidden = !needsAmount(); due.min = incurred.value || ''; };
  unitSel.addEventListener('change', syncEdit);
  incurred.addEventListener('change', syncEdit);
  syncEdit();
  v.rule(desc, VAL.optionalText(desc, 200), { label: t('add.description') });
  v.rule(amt, () => needsAmount() ? VAL.amountRule(amt, () => unitSel.value, { optional: true })() : null,
    { label: t('add.amount'), appendTo: amtField });
  const amtEntry = v.rules[v.rules.length - 1];
  v.rule(incurred, VAL.dateRule(incurred, { required: true, noFuture: true }), { label: t('add.incurred') });
  v.rule(due, VAL.dateRule(due, { notBefore: () => incurred.value }), { label: t('add.due') });
  v.rule(notes, VAL.optionalText(notes, 2000), { label: t('add.notes') });

  sheet({
    title: t('action.edit'),
    body: el('div', { class: 'stack' }, [
      el('p', { class: 'notice', text: t('flows.every_edit_written_into') }),
      v.summary,
      el('div', { class: 'field-row' }, [field(t('add.unit'), unitSel), amtField]),
      approxRow,
      field(t('add.description'), desc),
      el('div', { class: 'field-row' }, [
        field(t('add.incurred'), incurred, null, { required: true }),
        field(t('add.due'), due)
      ]),
      field(t('add.tone'), toneSel),
      field(t('add.notes'), notes)
    ]),
    footer: [
      el('button', { class: 'btn', text: t('action.cancel'), onclick: () => closeSheet() }),
      el('button', { class: 'btn btn-primary', text: t('action.save'), onclick: async () => {
        if (!v.check()) return;
        await S.updateCommitment(id, {
          description: desc.value.trim(),
          unit_code: unitSel.value,
          amount_minor: needsAmount() ? toMinor(amt.value, unitSel.value) : 0,
          incurred_on: incurred.value,
          due_on: due.value || null,
          due_mode: due.value ? 'date' : (c.due_mode === 'date' ? 'none' : c.due_mode),
          notes: notes.value.trim(),
          tone: toneSel.value,
          approximate: needsAmount() && approx.checked
        });
        closeSheet(); toast(t('misc.saved'), 'good');
      } })
    ]
  });
}

/* ---------- Record payment ---------- */
export function openRecordPayment(id) {
  const c = S.commitmentOf(id);
  if (!c) return;
  const rem = S.remainingMinor(c);
  const v = new VAL.Validator();
  const amt = input({ inputmode: 'decimal', value: c.amount_minor ? amtValue(rem, c.unit_code) : '1' });
  const on = input({ type: 'date', value: S.todayISO(), max: S.todayISO() });
  const note = input({ placeholder: t('flows.bank_transfer_cash'), maxlength: '120' });

  const amtField = field(t('flow.payment_amount') + ` (${unitShort(c.unit_code)})`, amt, null, { required: true });
  v.rule(amt, VAL.amountRule(amt, () => c.unit_code, {
    max: () => (c.amount_minor ? rem : null),
    maxLabel: () => formatAmount(rem, c.unit_code)
  }), { label: t('flow.payment_amount'), appendTo: amtField });
  const amtEntry = v.rules[0];
  v.rule(on, VAL.dateRule(on, { required: true, noFuture: true }), { label: t('flow.payment_date') });
  v.rule(note, VAL.optionalText(note, 120), { label: t('flow.payment_method') });

  const quick = c.amount_minor ? el('div', { class: 'row tight' }, [
    el('button', { class: 'chip', type: 'button',
      onclick: () => { amt.value = amtValue(rem, c.unit_code); v.checkOne(amtEntry); } },
      [el('span', { text: t('flows.all_remaining') })]),
    el('button', { class: 'chip', type: 'button',
      onclick: () => { amt.value = amtValue(Math.floor(rem / 2), c.unit_code); v.checkOne(amtEntry); } },
      [el('span', { text: t('flows.half') })])
  ]) : null;

  sheet({
    title: t('action.record_payment'),
    body: el('div', { class: 'stack' }, [
      v.summary,
      c.amount_minor ? el('p', { class: 'hint' }, [
        el('span', { text: t('detail.remaining') + ': ' }), amountEl(rem, c.unit_code)
      ]) : null,
      quick,
      el('div', { class: 'field-row' }, [amtField, field(t('flow.payment_date'), on, null, { required: true })]),
      field(t('flow.payment_method'), note),
      el('p', { class: 'notice', text: t('limit.no_riba') }),
      S.state.settings.islamic_mode ? ayahBlock(C.HADITH.find(h => h.id === 'h-excellence')) : null
    ]),
    footer: [
      el('button', { class: 'btn', text: t('action.cancel'), onclick: () => closeSheet() }),
      el('button', { class: 'btn btn-primary', text: t('action.save'), onclick: async () => {
        if (!v.check()) return;
        await S.recordFulfilment(id, toMinor(amt.value, c.unit_code), { on: on.value, method_note: note.value.trim() });
        closeSheet(true);
        const after = S.commitmentOf(id);
        if (after.status === 'fulfilled') celebrateFulfilled(id);
        else toast(t('misc.saved'), 'good');
      } })
    ]
  });
}

export async function markFulfilled(id) {
  const c = S.commitmentOf(id);
  if (!c) return;
  const rem = S.remainingMinor(c);
  if (rem > 0 && c.amount_minor) await S.recordFulfilment(id, rem, { method_note: 'marked fulfilled' });
  else await S.updateCommitment(id, { status: 'fulfilled', closed_at: Date.now() }, 'commitment.fulfilled');
  closeSheet(true);
  celebrateFulfilled(id);
}

export function celebrateFulfilled(id) {
  const c = S.commitmentOf(id);
  if (!c) return;
  const s = S.state.settings;
  const unitClear = !S.openCommitments().some(x => x.direction === 'I_OWE' && x.unit_code === c.unit_code);
  const body = el('div', { class: 'stack celebrate', style: { textAlign: 'center' } }, [
    el('div', { style: { fontSize: '2.6rem', color: 'var(--good)' } }, [icon('fa-circle-check')]),
    el('h2', { text: s.islamic_mode ? t('celebrate.fulfilled_islamic') : t('celebrate.fulfilled') }),
    unitClear && c.direction === 'I_OWE'
      ? el('p', { class: 'notice', text: t('celebrate.debt_free', { unit: unitShort(c.unit_code) }) }) : null,
    el('div', { class: 'row tight', style: { justifyContent: 'center' } }, [
      el('button', { class: 'btn btn-primary', text: t('action.thank'), onclick: () => { closeSheet(true); openThanks(id); } }),
      unitClear ? el('button', { class: 'btn', text: t('celebrate.badge'), onclick: async () => {
        await copyText(t('flows.i_closed_commitment_today'));
        toast(t('remind.copied'), 'good');
      } }) : null
    ]),
    s.islamic_mode ? ayahBlock(C.HADITH.find(h => h.id === 'h-excellence')) : null
  ]);
  sheet({ title: t('celebrate.fulfilled'), body, footer: [
    el('button', { class: 'btn btn-primary', text: t('action.close'), onclick: () => closeSheet() })
  ] });
}

function _openThanks(id) {
  const c = S.commitmentOf(id);
  if (!c) return;
  const cp = S.cpOf(c.counterparty_id);
  const ta = textarea({ value: C.thanksTemplate({ name: cp?.alias || '' }), rows: 5, maxlength: '1000' });
  sheet({
    title: t('action.thank'),
    body: el('div', { class: 'stack' }, [
      field(t('remind.preview'), ta),
      el('p', { class: 'notice', text: t('limit.not_collector') })
    ]),
    footer: [
      el('button', { class: 'btn', text: t('action.cancel'), onclick: () => closeSheet() }),
      QR.qrButton(() => ta.value.trim() ? QR.buildPayload('thanks', c, { note: ta.value.trim() }) : (toast(VAL.MSG.required(), 'warn'), null), { cls: '' }),
      el('button', { class: 'btn btn-primary', text: t('action.copy'), onclick: async () => {
        if (!ta.value.trim()) { toast(VAL.MSG.required(), 'warn'); return; }
        await copyText(ta.value);
        await S.logReminder(id, 'counterparty', 'gentle', '[thanks]');
        closeSheet(); toast(t('flow.thanks_sent'), 'good');
      } })
    ]
  });
}

/* ---------- Promise to pay (anti planning-fallacy, S-04) ---------- */
export function openPromiseToPay(id) {
  const c = S.commitmentOf(id);
  if (!c) return;
  const v = new VAL.Validator();
  const rem = S.remainingMinor(c);
  const amt = input({ inputmode: 'decimal', value: amtValue(rem, c.unit_code) });
  const d = new Date(); d.setDate(d.getDate() + 7);
  const by = input({ type: 'date', value: d.toISOString().slice(0, 10), min: S.todayISO() });

  const amtField = field(t('flow.ptp_amount'), amt, null, { required: true });
  v.rule(amt, VAL.amountRule(amt, () => c.unit_code, {
    max: () => (c.amount_minor ? rem : null), maxLabel: () => formatAmount(rem, c.unit_code)
  }), { label: t('flow.ptp_amount'), appendTo: amtField });
  v.rule(by, VAL.dateRule(by, { required: true, future: true }), { label: t('flow.ptp_date') });

  sheet({
    title: t('action.promise_to_pay'),
    body: el('div', { class: 'stack' }, [
      v.summary,
      el('div', { class: 'field-row' }, [amtField, field(t('flow.ptp_date'), by, null, { required: true })]),
      el('p', { class: 'notice', text: t('flow.capacity_warn') }),
      S.state.settings.islamic_mode ? ayahBlock(C.AYAT.find(a => a.id === '61:2')) : null
    ]),
    footer: [
      el('button', { class: 'btn', text: t('action.cancel'), onclick: () => closeSheet() }),
      el('button', { class: 'btn btn-primary', text: t('action.save'), onclick: async () => {
        if (!v.check()) return;
        await S.addPromiseToPay(id, toMinor(amt.value, c.unit_code), by.value);
        closeSheet(); toast(t('misc.saved'), 'good');
      } })
    ]
  });
}

/* ---------- Respite (inẓār) ---------- */
export function openRequestRespite(id) {
  const c = S.commitmentOf(id);
  if (!c) return;
  const cp = S.cpOf(c.counterparty_id);
  const v = new VAL.Validator();
  const d = new Date(); d.setMonth(d.getMonth() + 1);
  const date = input({ type: 'date', value: d.toISOString().slice(0, 10), min: S.todayISO() });
  const reason = textarea({ placeholder: t('flow.respite_reason'), maxlength: '600' });
  const hardship = el('input', { type: 'checkbox', checked: S.state.settings.hardship });
  const preview = textarea({ rows: 5, maxlength: '1200' });

  v.rule(date, VAL.dateRule(date, { required: true, future: true }), { label: t('flow.respite_new_date') });
  v.rule(reason, VAL.optionalText(reason, 600), { label: t('flow.respite_reason') });

  const sync = () => {
    preview.value = C.respiteRequestTemplate({
      name: cp?.alias || '',
      amount: formatAmount(S.remainingMinor(c), c.unit_code),
      date: date.value ? formatDate(date.value) : '—'
    });
  };
  sync();
  date.addEventListener('change', sync);

  sheet({
    title: t('action.request_respite'),
    body: el('div', { class: 'stack' }, [
      v.summary,
      field(t('flow.respite_new_date'), date, null, { required: true }),
      field(t('flow.respite_reason'), reason),
      el('label', { class: 'row tight' }, [hardship, el('span', { text: t('flow.hardship') })]),
      el('p', { class: 'hint', text: t('flow.hardship_hint') }),
      field(t('remind.preview'), preview),
      S.state.settings.islamic_mode ? ayahBlock(C.ayahFor('respite')) : null
    ]),
    footer: [
      el('button', { class: 'btn', text: t('action.cancel'), onclick: () => closeSheet() }),
      QR.qrButton(() => v.check() ? QR.buildPayload('respite', c, { new_date: date.value, note: reason.value.trim() }) : null, { cls: '' }),
      el('button', { class: 'btn btn-primary', text: t('action.request_respite'), onclick: async () => {
        if (!v.check()) return;
        await S.requestRespite(id, date.value, reason.value.trim());
        if (hardship.checked !== S.state.settings.hardship) await S.saveSettings({ hardship: hardship.checked });
        await copyText(preview.value);
        closeSheet(); toast(t('flow.respite_sent'), 'good');
      } })
    ]
  });
}

export function openGrantRespite(id, respiteId) {
  const c = S.commitmentOf(id);
  if (!c) return;
  const r = respiteId ? S.state.respites.find(x => x.id === respiteId) : null;
  const v = new VAL.Validator();
  const d = new Date(); d.setMonth(d.getMonth() + 1);
  const date = input({ type: 'date', value: (r && r.proposed_due_on) || d.toISOString().slice(0, 10), min: S.todayISO() });
  v.rule(date, VAL.dateRule(date, { required: true, future: true }), { label: t('flow.respite_new_date') });

  sheet({
    title: t('action.grant_respite'),
    body: el('div', { class: 'stack' }, [
      r && r.reason ? el('p', { class: 'notice', text: r.reason }) : null,
      v.summary,
      field(t('flow.respite_new_date'), date, null, { required: true }),
      S.state.settings.islamic_mode ? ayahBlock(C.ayahFor('respite')) : null,
      S.state.settings.islamic_mode ? ayahBlock(C.HADITH.find(h => h.id === 'h-ease')) : null
    ]),
    footer: [
      r ? el('button', { class: 'btn', text: t('flows.decline_kindly'), onclick: async () => {
        await S.answerRespite(r.id, 'declined');
        closeSheet(); toast(t('misc.saved'));
      } }) : el('button', { class: 'btn', text: t('action.cancel'), onclick: () => closeSheet() }),
      el('button', { class: 'btn btn-good', text: t('action.grant_respite'), onclick: async () => {
        if (!v.check()) return;
        if (r) await S.answerRespite(r.id, 'granted', date.value);
        else {
          const nr = await S.requestRespite(id, date.value, '', 'counterparty');
          await S.answerRespite(nr.id, 'granted', date.value);
        }
        closeSheet(); toast(t('flow.respite_granted', { date: formatDate(date.value) }), 'good');
      } })
    ]
  });
}

/* ---------- Release (ibrāʾ) — RL-10 guard ---------- */
export function openRelease(id) {
  const c = S.commitmentOf(id);
  if (!c) return;
  const cp = S.cpOf(c.counterparty_id);
  const rem = S.remainingMinor(c);
  const v = new VAL.Validator();
  let scope = 'full';
  const amt = input({ inputmode: 'decimal', value: amtValue(rem, c.unit_code), disabled: true });
  const note = input({ placeholder: t('flow.release_sadaqah'), maxlength: '200' });
  const amtField = field(t('add.amount'), amt, null, { required: true });
  amtField.style.display = 'none';
  v.rule(amt, () => scope === 'partial'
    ? VAL.amountRule(amt, () => c.unit_code, { max: () => rem, maxLabel: () => formatAmount(rem, c.unit_code) })()
    : null, { label: t('add.amount'), appendTo: amtField });
  v.rule(note, VAL.optionalText(note, 200), { label: t('flow.release_sadaqah') });

  const scopeWrap = el('div');
  const renderScope = () => scopeWrap.replaceChildren(chipGroup([
    { value: 'full', label: t('flow.release_full') },
    { value: 'partial', label: t('flow.release_partial') }
  ], scope, val => {
    scope = val;
    amt.disabled = val === 'full';
    amtField.style.display = val === 'full' ? 'none' : '';
    renderScope();
  }));
  renderScope();

  /* RL-10: an explicit acknowledgement, so release is never a one-tap slip.
     The checkbox is re-checked inside the handler too — a disabled button alone
     is not a guard, it is only a hint. */
  const ack = el('input', { type: 'checkbox' });
  const ackErr = el('div', { class: 'err' });
  const relBtn = el('button', { class: 'btn btn-good', disabled: true, text: t('action.release'), onclick: doRelease });
  ack.addEventListener('change', () => { relBtn.disabled = !ack.checked; ackErr.replaceChildren(); });

  async function doRelease() {
    ackErr.replaceChildren();
    if (!ack.checked) {
      ackErr.append(icon('fa-circle-exclamation'), el('span', { text: t('flows.please_confirm_understand_becomes') }));
      ack.focus();
      return;
    }
    if (!v.check()) return;
    const minor = scope === 'partial' ? toMinor(amt.value, c.unit_code) : null;
    const rel = await S.releaseCommitment(id, scope, minor, note.value.trim());
    closeSheet(true);
    toast(t('flow.release_done'), 'good', {
      label: t('action.undo'),
      onClick: async () => { await S.undoRelease(rel.id); toast(t('action.undo'), 'good'); }
    });
    setTimeout(() => {
      const msg = C.releaseTemplate({ name: cp?.alias || '', amount: formatAmount(c.amount_minor, c.unit_code) });
      const ta = textarea({ value: msg, rows: 4, maxlength: '1000' });
      sheet({
        title: t('action.release'),
        body: el('div', { class: 'stack' }, [
          el('p', { class: 'notice', text: t('action.release_confirm') }),
          field(t('remind.preview'), ta)
        ]),
        footer: [
          el('button', { class: 'btn', text: t('action.close'), onclick: () => closeSheet() }),
          el('button', { class: 'btn btn-primary', text: t('action.copy'),
            onclick: async () => { await copyText(ta.value); closeSheet(); toast(t('remind.copied'), 'good'); } })
        ]
      });
    }, 450);
  }

  sheet({
    title: t('action.release'),
    body: el('div', { class: 'stack' }, [
      el('p', { text: t('flows.are_about_release_from', { name: cp?.alias || '' }) }),
      v.summary,
      field(t('flow.release_scope'), scopeWrap, null, { required: true }),
      amtField,
      field(t('flow.release_sadaqah'), note),
      el('p', { class: 'notice', text: t('action.release_confirm') }),
      el('label', { class: 'row tight', style: { cursor: 'pointer' } }, [
        ack, el('span', { text: t('flows.i_understand_becomes_final') })
      ]),
      ackErr,
      S.state.settings.islamic_mode ? ayahBlock(C.ayahFor('respite')) : null,
      S.state.settings.islamic_mode ? ayahBlock(C.HADITH.find(h => h.id === 'h-respite')) : null
    ]),
    footer: [
      el('button', { class: 'btn', text: t('action.cancel'), onclick: () => closeSheet() }),
      relBtn
    ]
  });
}

/* ---------- Write off (distinct from release, Q-06) ---------- */
export function openWriteOff(id) {
  confirmSheet({
    title: t('action.write_off'), danger: true,
    message: t('flow.writeoff_note'),
    confirmLabel: t('action.write_off'),
    onConfirm: async () => {
      await S.updateCommitment(id, { status: 'written_off', closed_at: Date.now() }, 'commitment.written_off');
      toast(t('status.written_off'), 'good');
    }
  });
}

/* ---------- Transfer (ḥawālah) ---------- */
function _openTransfer(id) {
  const v = new VAL.Validator();
  const toInput = input({ placeholder: t('add.who_ph'), list: 'cp-list-transfer', maxlength: '80' });
  const toField = field(t('flow.transfer_to'), toInput, null, { required: true });
  v.rule(toInput, VAL.requiredWho(toInput), { label: t('flow.transfer_to'), appendTo: toField });

  const c1 = el('input', { type: 'checkbox' }), c2 = el('input', { type: 'checkbox' }), c3 = el('input', { type: 'checkbox' });
  const consentErr = el('div', { class: 'err' });
  const clearConsentErr = () => consentErr.replaceChildren();
  [c1, c2, c3].forEach(x => x.addEventListener('change', clearConsentErr));

  const btn = el('button', { class: 'btn btn-primary', text: t('action.transfer'), onclick: async () => {
    clearConsentErr();
    const okForm = v.check();
    const okConsent = c1.checked && c2.checked && c3.checked;
    if (!okConsent) consentErr.append(icon('fa-circle-exclamation'), el('span', { text: VAL.MSG.consentAll() }));
    if (!okForm || !okConsent) return;
    await S.transferCommitment(id, toInput.value.trim(), { creditor: true, old_debtor: true, new_debtor: true });
    closeSheet(); toast(t('status.transferred'), 'good');
  } });

  sheet({
    title: t('action.transfer'),
    body: el('div', { class: 'stack' }, [
      v.summary, toField, cpDatalist('cp-list-transfer'),
      el('p', { class: 'notice', text: t('flow.transfer_consent') }),
      el('label', { class: 'row tight' }, [c1, el('span', { text: t('flows.creditor_consents') })]),
      el('label', { class: 'row tight' }, [c2, el('span', { text: t('flows.original_debtor_consents') })]),
      el('label', { class: 'row tight' }, [c3, el('span', { text: t('flows.new_debtor_consents') })]),
      consentErr,
      el('p', { class: 'notice', text: t('action.release_confirm') })
    ]),
    footer: [el('button', { class: 'btn', text: t('action.cancel'), onclick: () => closeSheet() }), btn]
  });
}

/* ---------- Dispute & settlement ---------- */
export function openDispute(id) {
  const c = S.commitmentOf(id);
  if (!c) return;
  const v = new VAL.Validator();
  const claim = textarea({ placeholder: t('flow.dispute_claim'), maxlength: '1000' });
  const existing = S.disputesOf(id).find(d => d.status === 'open');
  const claimField = field(t('flow.dispute_claim'), claim, null, { required: true });
  v.rule(claim, VAL.requiredText(claim, 1000), { label: t('flow.dispute_claim'), appendTo: claimField });

  const neutral = () => t('flows.one_record_two_views', { amount: formatAmount(c.amount_minor, c.unit_code), date: formatDate(c.incurred_on) });

  sheet({
    title: t('widget.disputes'),
    body: el('div', { class: 'stack' }, [
      el('div', { class: 'notice', text: t('flow.dispute_neutral') + ': ' + neutral() }),
      existing ? el('ul', { class: 'listy' }, existing.claims.map(cl => el('li', {}, [
        el('div', { class: 'item-row', style: { cursor: 'default' } }, [
          el('span', { class: 'item-main' }, [el('b', { text: cl.by }), el('small', { text: cl.text })])
        ])
      ]))) : null,
      v.summary, claimField,
      el('p', { class: 'notice', text: t('flows.dispute_recorded_never_escalated') }),
      S.state.settings.islamic_mode ? ayahBlock(C.ayahFor('settlement')) : null
    ]),
    footer: [
      el('button', { class: 'btn', text: t('action.cancel'), onclick: () => closeSheet() }),
      existing ? el('button', { class: 'btn btn-good', text: t('flows.resolved_as_recorded'),
        onclick: async () => { await S.resolveDispute(existing.id, 'resolved'); closeSheet(); toast(t('misc.saved'), 'good'); } }) : null,
      el('button', { class: 'btn btn-primary', text: existing ? (t('flows.add_claim')) : t('action.dispute'),
        onclick: async () => {
          if (!v.check()) return;
          if (existing) await S.addDisputeClaim(existing.id, 'me', claim.value.trim());
          else { await S.openDispute(id, claim.value.trim()); await S.updateCommitment(id, { tone: 'neutral' }); }
          closeSheet(); toast(t('misc.saved'), 'good');
        } })
    ].filter(Boolean)
  });
}

function _openSettlement(id) {
  const c = S.commitmentOf(id);
  if (!c) return;
  const v = new VAL.Validator();
  const amt = input({ inputmode: 'decimal', value: amtValue(S.remainingMinor(c), c.unit_code) });
  const unitSel = select(unitSelectOptions(c.unit_code), {
    onchange: () => { v.checkOne(amtEntry); v.checkOne(rateEntry); }
  });
  /* §6.3: changing the unit is only valid as an explicit ṣulḥ with a recorded rate. */
  const due = input({ type: 'date', value: c.due_on || '', min: S.todayISO() });
  const rate = input({ placeholder: t('flow.settlement_fx'), inputmode: 'decimal' });
  const note = textarea({ placeholder: t('flow.settlement_terms'), maxlength: '1000' });

  const amtField = field(t('flow.settlement_amount'), amt, null, { required: true });
  v.rule(amt, VAL.amountRule(amt, () => unitSel.value), { label: t('flow.settlement_amount'), appendTo: amtField });
  const amtEntry = v.rules[v.rules.length - 1];
  v.rule(due, VAL.dateRule(due), { label: t('add.due') });
  const rateField = field(t('flow.settlement_fx'), rate, t('flows.unit_change_happens_only'));
  v.rule(rate, () => {
    const changed = unitSel.value !== c.unit_code;
    const val = (rate.value || '').trim();
    if (changed && !val) return t('flows.record_agreed_rate_when');
    if (val && !/^[\d٠-٩۰-۹]*(?:[.,٫][\d٠-٩۰-۹]+)?$/.test(val)) return VAL.MSG.amountNumber();
    return null;
  }, { label: t('flow.settlement_fx'), appendTo: rateField });
  const rateEntry = v.rules[v.rules.length - 1];
  v.rule(note, VAL.optionalText(note, 1000), { label: t('flow.settlement_terms') });
  const syncRate = () => {
    rateField.hidden = unitSel.value === c.unit_code;
    if (rateField.hidden) rate.value = '';
  };
  unitSel.addEventListener('change', syncRate);
  syncRate();

  sheet({
    title: t('action.propose_settlement'),
    body: el('div', { class: 'stack' }, [
      v.summary,
      el('div', { class: 'field-row' }, [field(t('add.unit'), unitSel), amtField]),
      rateField,
      field(t('add.due'), due),
      field(t('flow.settlement_terms'), note),
      el('p', { class: 'notice', text: t('flows.settlement_needs_both_parties') }),
      S.state.settings.islamic_mode ? ayahBlock(C.ayahFor('settlement')) : null
    ]),
    footer: [
      el('button', { class: 'btn', text: t('action.cancel'), onclick: () => closeSheet() }),
      QR.qrButton(() => v.check() ? QR.buildPayload('settlement', c, {
        amount_minor: toMinor(amt.value, unitSel.value), unit_code: unitSel.value,
        new_date: due.value || '', note: note.value.trim() }) : null, { cls: '' }),
      el('button', { class: 'btn btn-primary', text: t('action.propose_settlement'), onclick: async () => {
        if (!v.check()) return;
        const st = await S.proposeSettlement(id, {
          amount_minor: toMinor(amt.value, unitSel.value),
          unit_code: unitSel.value,
          due_on: due.value || null,
          fx_rate: rate.value.trim() || null,
          note: note.value.trim()
        });
        closeSheet();
        toast(t('flows.proposal_recorded_awaiting_agreement'), 'good', {
          label: t('flows.both_agreed'),
          onClick: async () => { await S.acceptSettlement(st.id); toast(t('status.settled'), 'good'); }
        });
      } })
    ]
  });
}

/* ---------- Reminders (§7.8) ---------- */
function _openReminder(id) {
  const c = S.commitmentOf(id);
  if (!c) return;
  const cp = S.cpOf(c.counterparty_id);
  const s = S.state.settings;
  const allowed = S.reminderAllowed(id);
  let tone = c.tone || s.default_tone;
  let template = 'standard';

  const ctx = () => ({
    name: cp?.alias || '',
    amount: formatAmount(S.remainingMinor(c), c.unit_code),
    date: formatDate(c.incurred_on)
  });
  const ta = textarea({ rows: 6, maxlength: '1200' });
  const lintBox = el('div', { class: 'err' });

  const checkLint = () => {
    lintBox.replaceChildren();
    const txt = ta.value.trim();
    if (!txt) {
      lintBox.append(icon('fa-circle-exclamation'), el('span', { text: VAL.MSG.required() }));
      sendBtn.disabled = true; return;
    }
    const r = S.lintMessage(ta.value);
    if (!r.clean) {
      lintBox.append(icon('fa-circle-exclamation'), el('span', { text: t('remind.lint') }));
      sendBtn.disabled = true; return;
    }
    sendBtn.disabled = !allowed.ok;
  };
  const sync = () => {
    if (template === 'ask_for_me') ta.value = C.askForMeTemplate(ctx());
    else if (s.hardship || c.status === 'respite') ta.value = C.hardshipTemplate(ctx());
    else ta.value = C.reminderTemplate(tone, ctx());
    checkLint();
  };
  ta.addEventListener('input', checkLint);

  const toneWrap = el('div');
  const renderTone = () => toneWrap.replaceChildren(chipGroup(
    S.TONES.map(x => ({ value: x, label: t('tone.' + x) })), tone, val => { tone = val; renderTone(); sync(); }));
  renderTone();
  const tmplWrap = el('div');
  const renderTmpl = () => tmplWrap.replaceChildren(chipGroup([
    { value: 'standard', label: t('flows.standard') },
    { value: 'ask_for_me', label: t('remind.ask_for_me') }
  ], template, val => { template = val; renderTmpl(); sync(); }));
  renderTmpl();

  const sendBtn = el('button', { class: 'btn btn-primary', onclick: async () => {
    await copyText(ta.value);
    await S.logReminder(id, 'counterparty', tone, ta.value);
    closeSheet(); toast(t('remind.copied'), 'good');
  } }, [icon('fa-copy'), el('span', { text: t('action.copy') })]);

  sync();

  sheet({
    title: t('action.remind'),
    body: el('div', { class: 'stack' }, [
      el('p', { class: 'notice', text: t('remind.cap', { from: s.quiet_from, to: s.quiet_to }) }),
      !allowed.ok ? el('p', { class: 'form-summary', text: t('remind.capped') }) : null,
      (s.hardship || c.status === 'respite')
        ? el('p', { class: 'notice', text: t('flows.hardship_declared_so_template') }) : null,
      field(t('add.tone'), toneWrap),
      field(t('flows.template'), tmplWrap),
      field(t('remind.preview'), ta),
      lintBox,
      el('p', { class: 'notice', text: t('limit.not_collector') })
    ]),
    footer: [el('button', { class: 'btn', text: t('action.cancel'), onclick: () => closeSheet() }),
      QR.qrButton(() => {
        checkLint();
        if (sendBtn.disabled) { toast(allowed.ok ? t('remind.lint') : t('remind.capped'), 'warn'); return null; }
        return QR.buildPayload('remind', c, { note: ta.value.trim().slice(0, 140) });
      }, { cls: '' }),
      sendBtn]
  });
}

export function openSelfReminder(id) {
  const c = S.commitmentOf(id);
  if (!c) return;
  const v = new VAL.Validator();
  const d = new Date(); d.setDate(d.getDate() + 3);
  const when = input({ type: 'date', min: S.todayISO(),
    value: (c.due_on && c.due_on >= S.todayISO()) ? c.due_on : d.toISOString().slice(0, 10) });
  v.rule(when, VAL.dateRule(when, { required: true, future: true }), { label: t('flows.remind_me_on') });
  sheet({
    title: t('action.self_remind'),
    body: el('div', { class: 'stack' }, [
      el('p', { class: 'notice', text: t('remind.self_default') }),
      v.summary,
      field(t('flows.remind_me_on'), when, null, { required: true })
    ]),
    footer: [
      el('button', { class: 'btn', text: t('action.cancel'), onclick: () => closeSheet() }),
      el('button', { class: 'btn btn-primary', text: t('action.save'), onclick: async () => {
        if (!v.check()) return;
        await S.logReminder(id, 'self', 'gentle', when.value);
        if ('Notification' in window && Notification.permission === 'default') {
          try { await Notification.requestPermission(); } catch {}
        }
        closeSheet(); toast(t('misc.saved'), 'good');
      } })
    ]
  });
}

/* ---------- Counterparty editor ---------- */
export function openCounterparty(cpId) {
  const cp = cpId ? S.cpOf(cpId) : null;
  const v = new VAL.Validator();
  const name = input({ value: cp?.alias || '', maxlength: '80' });
  const kind = select(S.CP_KINDS
    .filter(k => k !== 'divine_private' || S.state.settings.islamic_mode)
    .map(k => ({ value: k, label: t('people.kind.' + k), selected: cp?.kind === k })));
  const rel = input({ value: cp?.relationship_label || '', maxlength: '60',
    placeholder: t('flows.brother_neighbour_colleague') });
  const contact = input({ value: cp?.contact_hint || '', maxlength: '80',
    placeholder: t('flows.contact_hint_optional') });

  const nameField = field(t('add.who'), name, null, { required: true });
  v.rule(name, () => {
    const val = (name.value || '').trim();
    if (!val) return VAL.MSG.whoRequired();
    if (val.length > 80) return VAL.MSG.textTooLong(80);
    const clash = S.state.counterparties.find(x =>
      x.id !== (cp && cp.id) && (x.alias || '').trim().toLowerCase() === val.toLowerCase());
    if (clash) return t('flows.that_name_already_exists');
    return null;
  }, { label: t('add.who'), appendTo: nameField });
  v.rule(rel, VAL.optionalText(rel, 60), { label: t('people.relationship') });
  v.rule(contact, VAL.optionalText(contact, 80), { label: t('flows.contact_hint') });

  let health = cp?.relationship_health || 0;
  const starsWrap = el('div', { class: 'stars', role: 'group', 'aria-label': t('people.health') });
  const renderStars = () => {
    starsWrap.replaceChildren(
      ...[1,2,3,4,5].map(n => el('button', {
        type: 'button', class: n <= health ? 'on' : '', 'aria-label': String(n),
        'aria-pressed': n === health ? 'true' : 'false',
        onclick: () => { health = (health === n ? 0 : n); renderStars(); }
      }, [icon('fa-star')]))
    );
  };
  renderStars();

  sheet({
    title: cp ? cp.alias : t('people.new'),
    body: el('div', { class: 'stack' }, [
      v.summary, nameField,
      field(t('flows.kind'), kind, null, { required: true }),
      field(t('people.relationship'), rel),
      field(t('flows.contact_hint'), contact, t('flows.non_users_are_stored')),
      field(t('people.health'), starsWrap, t('people.health_hint')),
      cp ? el('button', { class: 'btn btn-sm', onclick: () => {
        confirmSheet({
          title: t('flows.delete_person_s_data'),
          danger: true,
          message: t('flows.personal_details_are_erased'),
          confirmLabel: t('action.delete'),
          onConfirm: async () => { await S.anonymizeCounterparty(cp.id); toast(t('misc.deleted')); }
        });
      } }, [icon('fa-user-slash'), el('span', { text: t('flows.erase_non_user_data') })]) : null
    ]),
    footer: [
      el('button', { class: 'btn', text: t('action.cancel'), onclick: () => closeSheet() }),
      el('button', { class: 'btn btn-primary', text: t('action.save'), onclick: async () => {
        if (!v.check()) return;
        await S.upsertCounterparty({
          id: cp && cp.id, alias: name.value.trim(), kind: kind.value,
          relationship_label: rel.value.trim(), contact_hint: contact.value.trim(),
          relationship_health: health || null
        });
        closeSheet(); toast(t('misc.saved'), 'good');
      } })
    ]
  });
}
