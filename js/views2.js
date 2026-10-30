/* DYON — secondary views: Promises, Services, Trusts, Plans, Calendar, Inbox,
   Vault, Reports & Estate, Islamic corner, Calm, Settings, About, Onboarding. */

import { t, tr, formatDate, formatDateDual, formatDateTime, formatNumber, getLocale, getDir, weekdayShort, LOCALES } from './i18n.js';
import { CURRENCIES, unitShort, unitLabel, toMinor, fromMinor, formatAmount, isMonetary, FX_SOURCE } from './units.js';
import * as S from './store.js';
import * as C from './content.js';
import * as F from './flows.js';
import * as db from './db.js';
import * as VAL from './validate.js';
import * as AUTH from './auth.js';
import { el, frag, icon, card, emptyState, progressBar, meterRing, sparkline, amountEl,
         statusBadge, directionBadge, avatar, dueLabel, commitmentRow, chipGroup, disclaimer,
         ayahBlock, toast, sheet, closeSheet, confirmSheet, field, input, textarea, select,
         switchRow, settingRow, download, copyText } from './ui.js';

const go = (h) => { location.hash = h; };

/* ====================== MODULE VIEWS ====================== */
function moduleView({ title, subtitle, iconName, module, addType, extraRows }) {
  const items = S.byModule(module);
  const open = items.filter(c => S.OPEN_STATUSES.includes(c.status));
  const closed = items.filter(c => S.CLOSED_STATUSES.includes(c.status));
  return el('div', { class: 'stack fade-in' }, [
    el('div', { class: 'row between' }, [
      el('h1', {}, [icon(iconName), el('span', { text: ' ' + title })]),
      el('button', { class: 'btn btn-primary', onclick: () => F.openQuickAdd({ type: addType }) },
        [icon('fa-plus'), el('span', { text: t('action.add_short') })])
    ]),
    el('p', { class: 'notice', text: subtitle }),
    extraRows || null,
    el('section', { class: 'card flush' }, [
      open.length
        ? el('ul', { class: 'listy' }, open.map(c => commitmentRow(c, F.openDetail)))
        : emptyState(iconName, t('ledger.empty'), '')
    ]),
    closed.length ? el('section', { class: 'card' }, [
      el('h3', { text: t('ledger.closed') }),
      el('ul', { class: 'listy' }, closed.slice(0, 10).map(c => commitmentRow(c, F.openDetail)))
    ]) : null,
    disclaimer('legal')
  ]);
}

export function renderPromises() {
  const items = S.byModule('promises').filter(c => S.OPEN_STATUSES.includes(c.status));
  const streaks = items.filter(c => c.due_mode === 'recurring');
  return moduleView({
    title: t('widget.promises'), iconName: 'fa-comment-dots', module: 'promises', addType: 'T-07',
    subtitle: t('views2.promise_commitment_scholars_differ'),
    extraRows: streaks.length ? el('section', { class: 'card' }, [
      el('h3', { text: t('views2.recurring_promises') }),
      el('div', { class: 'row tight' }, streaks.map(c => el('span', { class: 'badge' }, [
        icon('fa-repeat'),
        el('span', { text: (c.description || t('type.' + c.type)) + ' · ' + formatNumber(c.streak || 0) + ' ' + t('misc.streak') })
      ])))
    ]) : null
  });
}

export function renderServices() {
  const items = S.byModule('services').filter(c => S.OPEN_STATUSES.includes(c.status));
  const hours = items.filter(c => c.unit_code === 'HOUR');
  const owedHours = hours.filter(c => c.direction === 'OWED_TO_ME').reduce((s, c) => s + S.remainingMinor(c), 0);
  const oweHours = hours.filter(c => c.direction === 'I_OWE').reduce((s, c) => s + S.remainingMinor(c), 0);
  return moduleView({
    title: t('widget.services'), iconName: 'fa-clock-rotate-left', module: 'services', addType: 'T-05',
    subtitle: t('views2.give_worker_his_wage'),
    extraRows: hours.length ? el('section', { class: 'card' }, [
      el('div', { class: 'row' }, [
        el('span', { class: 'badge badge-owe' }, [el('span', { text: t('dir.i_owe') + ' ' }), amountEl(oweHours, 'HOUR')]),
        el('span', { class: 'badge badge-owed' }, [el('span', { text: t('dir.owed_to_me') + ' ' }), amountEl(owedHours, 'HOUR')])
      ])
    ]) : null
  });
}

export function renderTrusts() {
  return moduleView({
    title: t('widget.trusts'), iconName: 'fa-box-archive', module: 'trusts', addType: 'T-08',
    subtitle: t('views2.god_commands_render_trusts')
  });
}

/* ====================== PLANS (S-04, S-16) ====================== */
export function renderPlans() {
  const plan = S.getPlan() || { strategy: 'snowball', capacity: {} };
  const wrap = el('div', { class: 'stack fade-in' });
  const units = [...new Set(S.openCommitments()
    .filter(c => c.direction === 'I_OWE' && isMonetary(c.unit_code)).map(c => c.unit_code))];

  let strategy = plan.strategy;
  const capInputs = {};
  const orderBox = el('div');
  const v = new VAL.Validator();

  const renderOrder = () => {
    const order = S.planOrder(strategy);
    orderBox.replaceChildren(order.length
      ? el('ol', { class: 'listy', style: { paddingInlineStart: '0' } }, order.map((c, i) => el('li', {}, [
          el('button', { class: 'item-row', onclick: () => F.openDetail(c.id) }, [
            el('span', { class: 'badge', text: formatNumber(i + 1) }),
            el('span', { class: 'item-main' }, [
              el('b', { text: S.cpName(c.counterparty_id) + ' · ' + (c.description || t('type.' + c.type)) }),
              el('small', { text: dueLabel(c) })
            ]),
            amountEl(S.remainingMinor(c), c.unit_code, { calmHide: true })
          ])
        ])))
      : el('p', { class: 'hint', text: t('ledger.empty') }));
  };

  const stratWrap = el('div');
  const renderStrat = () => stratWrap.replaceChildren(chipGroup([
    { value: 'snowball', label: t('plan.snowball') },
    { value: 'avalanche_urgency', label: t('plan.avalanche_urgency') },
    { value: 'relationship_first', label: t('plan.relationship_first') },
    { value: 'custom', label: t('plan.custom') }
  ], strategy, v => { strategy = v; renderStrat(); renderOrder(); }));
  renderStrat();
  renderOrder();

  const capFields = el('div', { class: 'stack' }, units.map(u => {
    const inp = input({ inputmode: 'decimal',
      value: plan.capacity && plan.capacity[u] ? fromMinor(plan.capacity[u], u).replace(/[^\d.,٫]/g, '') : '' });
    capInputs[u] = inp;
    const f = field(t('plan.capacity') + ' — ' + unitShort(u), inp);
    v.rule(inp, VAL.amountRule(inp, () => u, { optional: true }),
      { label: t('plan.capacity') + ' ' + unitShort(u), appendTo: f });
    return f;
  }));
  const capErr = el('div', { class: 'err' });

  const monthsBox = el('div');
  const renderMonths = () => {
    const m = S.monthsToClear() || {};
    monthsBox.replaceChildren(...Object.entries(m).map(([u, n]) =>
      el('p', { class: 'notice', text: unitShort(u) + ': ' + t('plan.months_to_clear', { count: n }) })));
  };
  renderMonths();

  wrap.append(
    el('h1', { text: t('nav.plans') }),
    el('p', { class: 'notice', text: t('limit.no_riba') }),
    el('section', { class: 'card' }, [
      el('h3', { text: t('plan.strategy') }),
      stratWrap,
      el('div', { style: { height: '12px' } }),
      v.summary,
      capFields,
      capErr,
      el('p', { class: 'hint', text: t('plan.capacity_hint') }),
      el('p', { class: 'notice', text: t('flow.capacity_warn') }),
      el('button', { class: 'btn btn-primary', text: t('action.save'), onclick: async () => {
        capErr.replaceChildren();
        if (!v.check()) return;
        const capacity = {};
        for (const [u, inp] of Object.entries(capInputs)) {
          const minor = toMinor(inp.value, u);
          if (minor > 0) capacity[u] = minor;
        }
        if (units.length && !Object.keys(capacity).length) {
          capErr.append(icon('fa-circle-exclamation'), el('span', { text: VAL.MSG.capacityRequired() }));
          const firstInput = Object.values(capInputs)[0];
          if (firstInput) firstInput.focus();
          return;
        }
        await S.savePlan({ strategy, capacity });
        renderMonths();
        toast(t('misc.saved'), 'good');
      } }),
      monthsBox
    ]),
    el('section', { class: 'card' }, [
      el('h3', { text: t('plan.order') }),
      el('p', { class: 'card-sub', text: t('views2.suggested_order_only_no') }),
      orderBox
    ]),
    disclaimer('legal')
  );
  return wrap;
}

/* ====================== CALENDAR ====================== */
export function renderCalendar() {
  const wrap = el('div', { class: 'stack fade-in' });
  const today = new Date();
  let cursor = new Date(today.getFullYear(), today.getMonth(), 1);

  const gridBox = el('div');
  const monthLabel = el('h2', { style: { margin: '0', fontSize: '1rem', textAlign: 'center', flex: '1' } });

  const render = () => {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    monthLabel.textContent = formatDateDual(new Date(y, m, 1).toISOString().slice(0, 10), { year: 'numeric', month: 'long' });
    const first = new Date(y, m, 1);
    const weekStartPref = { sat: 6, sun: 0, mon: 1 }[S.state.settings.week_start] ?? 1;
    let offset = (first.getDay() - weekStartPref + 7) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    const events = {};
    S.upcoming(400).forEach(i => { (events[i.on] = events[i.on] || []).push(i); });
    S.openCommitments().forEach(c => {
      if (c.due_on && !events[c.due_on]) events[c.due_on] = [{ on: c.due_on, commitment: c, kind: 'due', days: S.daysUntil(c.due_on) }];
    });

    const cells = [];
    const dayNames = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(2024, 0, 7 + ((weekStartPref + i) % 7));
      dayNames.push(el('div', { class: 'hint', style: { textAlign: 'center', fontWeight: '700' },
        text: weekdayShort(d) }));
    }
    for (let i = 0; i < offset; i++) cells.push(el('div'));
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = new Date(y, m, d, 12).toISOString().slice(0, 10);
      const evs = events[iso] || [];
      const isToday = iso === S.todayISO();
      cells.push(el('button', {
        class: 'card', type: 'button', 'aria-label': formatDate(iso) + (evs.length ? ' · ' + evs.map(e2 => S.cpName(e2.commitment.counterparty_id)).join(', ') : ''),
        style: {
          padding: '8px', minHeight: '74px', textAlign: 'start', cursor: 'pointer',
          background: isToday ? 'var(--grad-soft)' : 'var(--surface-2)',
          border: isToday ? '1px solid var(--brand-1)' : '1px solid var(--border)'
        },
        onclick: () => { if (evs.length) F.openDetail(evs[0].commitment.id); }
      }, [
        el('div', { class: 'amount', style: { fontSize: '.82rem' }, text: formatNumber(d) }),
        ...evs.slice(0, 2).map(e2 => el('div', {
          class: 'badge ' + (e2.days < 0 ? 'badge-needs' : e2.commitment.direction === 'I_OWE' ? 'badge-owe' : 'badge-owed'),
          style: { fontSize: '.6rem', marginTop: '3px', maxWidth: '100%', overflow: 'hidden' },
          text: S.cpName(e2.commitment.counterparty_id)
        })),
        evs.length > 2 ? el('small', { text: '+' + formatNumber(evs.length - 2) }) : null
      ]));
    }
    gridBox.replaceChildren(el('div', {
      class: 'cal-grid',
      style: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '6px' }
    }, [...dayNames, ...cells]));
  };
  render();

  wrap.append(
    el('div', { class: 'row between' }, [
      el('h1', { text: t('nav.calendar') }),
      el('div', { class: 'row tight', style: { flexWrap: 'nowrap', flex: '1 1 260px', justifyContent: 'flex-end' } }, [
        el('button', { class: 'icon-btn', type: 'button', 'aria-label': t('views2.previous_month'), onclick: () => { cursor.setMonth(cursor.getMonth() - 1); render(); } },
          [icon(getDir() === 'rtl' ? 'fa-chevron-right' : 'fa-chevron-left')]),
        monthLabel,
        el('button', { class: 'icon-btn', type: 'button', 'aria-label': t('views2.next_month'), onclick: () => { cursor.setMonth(cursor.getMonth() + 1); render(); } },
          [icon(getDir() === 'rtl' ? 'fa-chevron-left' : 'fa-chevron-right')])
      ])
    ]),
    el('section', { class: 'card' }, [gridBox]),
    el('p', { class: 'notice', text: t('views2.due_dates_are_local') })
  );
  return wrap;
}

/* ====================== INBOX ====================== */
export function renderInbox() {
  const q = S.actionQueue();
  const group = (kind) => q.filter(i => i.kind === kind);
  const section = (title, items, renderAction) => items.length ? el('section', { class: 'card' }, [
    el('h3', { text: title + ' · ' + formatNumber(items.length) }),
    el('ul', { class: 'listy' }, items.map(item => el('li', {}, [
      el('div', { class: 'item-row', style: { cursor: 'default' } }, [
        avatar(S.cpName(item.commitment.counterparty_id), 1),
        el('span', { class: 'item-main' }, [
          el('b', { text: S.cpName(item.commitment.counterparty_id) }),
          el('small', { text: (item.commitment.description || t('type.' + item.commitment.type)) + ' · ' + dueLabel(item.commitment) })
        ]),
        renderAction(item)
      ])
    ])))
  ]) : null;

  return el('div', { class: 'stack fade-in' }, [
    el('h1', { text: t('inbox.title') }),
    el('p', { class: 'notice', text: t('count.items_need', { count: q.length }) }),
    section(t('inbox.confirmations'), group('confirm'), item =>
      el('div', { class: 'row tight' }, [
        el('button', { class: 'btn btn-sm btn-good', text: t('action.confirm'), onclick: async () => {
          await S.updateCommitment(item.commitment.id, { status: 'active', acknowledged_at: Date.now() }, 'commitment.acknowledged');
          toast(t('status.acknowledged'), 'good');
        } }),
        el('button', { class: 'btn btn-sm', text: t('action.open'), onclick: () => F.openShare(item.commitment.id) })
      ])),
    section(t('inbox.respite'), group('respite'), item =>
      el('button', { class: 'btn btn-sm btn-good', text: t('action.grant_respite'),
        onclick: () => F.openGrantRespite(item.commitment.id, item.respite.id) })),
    section(t('inbox.disputes'), group('dispute'), item =>
      el('button', { class: 'btn btn-sm', text: t('action.open'), onclick: () => F.openDispute(item.commitment.id) })),
    section(t('inbox.settlements'), group('settlement'), item =>
      el('button', { class: 'btn btn-sm btn-good', text: t('flows.both_agreed'), onclick: async () => {
        await S.acceptSettlement(item.settlement.id); toast(t('status.settled'), 'good');
      } })),
    section(t('inbox.overdue_ptp'), group('ptp'), item =>
      el('div', { class: 'row tight' }, [
        el('button', { class: 'btn btn-sm', text: t('action.promise_to_pay'), onclick: () => F.openPromiseToPay(item.commitment.id) }),
        el('button', { class: 'btn btn-sm', text: t('action.record_payment'), onclick: () => F.openRecordPayment(item.commitment.id) })
      ])),
    !q.length ? el('section', { class: 'card' }, [emptyState('fa-inbox', t('dash.queue_empty'), '')]) : null,
    el('p', { class: 'notice', text: t('views2.reminders_go_only_debtor') })
  ]);
}

/* ====================== VAULT ====================== */
export function renderVault() {
  const all = S.state.evidence;
  const bytes = all.reduce((s, e) => s + (e.size || 0), 0);
  const th = S.state.settings.evidence_threshold_minor;
  const gaps = S.openCommitments().filter(c => (c.amount_minor || 0) >= th && !S.evidenceOf(c.id).length);
  const thV = new VAL.Validator();
  const thInput = input({ inputmode: 'decimal',
    value: fromMinor(th, S.state.settings.base_currency).replace(/[^\d.,٫]/g, '') });
  const thField = field(t('vault.threshold'), thInput);
  thV.rule(thInput, VAL.amountRule(thInput, () => S.state.settings.base_currency, { allowZero: true, optional: true }),
    { label: t('vault.threshold'), appendTo: thField });

  return el('div', { class: 'stack fade-in' }, [
    el('h1', { text: t('vault.title') }),
    el('p', { class: 'notice', text: t('vault.intro') }),
    el('section', { class: 'card' }, [
      el('div', { class: 'row' }, [
        el('span', { class: 'badge', text: t('vault.storage') + ': ' + formatNumber(Math.round(bytes / 1024)) + ' KB' }),
        el('span', { class: 'badge', text: formatNumber(all.length) + ' ' + t('misc.items') })
      ]),
      el('div', { class: 'row tight', style: { marginTop: '12px', alignItems: 'flex-start' } }, [
        el('div', { style: { flex: '1 1 180px' } }, [thField]),
        el('button', { class: 'btn btn-sm', text: t('action.save'), onclick: async () => {
          if (!thV.check()) return;
          await S.saveSettings({ evidence_threshold_minor: toMinor(thInput.value, S.state.settings.base_currency) });
          toast(t('misc.saved'), 'good');
        } })
      ]),
      thV.summary
    ]),
    gaps.length ? el('section', { class: 'card' }, [
      el('h3', { text: t('vault.missing') }),
      el('ul', { class: 'listy' }, gaps.map(c => commitmentRow(c, F.openDetail)))
    ]) : null,
    el('section', { class: 'card flush' }, [
      all.length
        ? el('ul', { class: 'listy' }, all.map(e2 => {
            const c = S.commitmentOf(e2.commitment_id);
            return el('li', {}, [
              el('div', { class: 'item-row', style: { cursor: 'default' } }, [
                icon(e2.mime.startsWith('image') ? 'fa-image' : e2.mime.startsWith('audio') ? 'fa-microphone' : 'fa-file'),
                el('span', { class: 'item-main' }, [
                  el('b', { text: e2.name }),
                  el('small', { text: (c ? S.cpName(c.counterparty_id) + ' · ' : '') + t('vault.hash') + ' ' + e2.sha256.slice(0, 16) + '…' })
                ]),
                el('div', { class: 'row tight' }, [
                  el('a', { class: 'btn btn-sm', href: e2.data, download: e2.name, text: t('action.open') }),
                  c ? el('button', { class: 'btn btn-sm btn-ghost', text: t('nav.ledger'), onclick: () => F.openDetail(c.id) }) : null
                ])
              ])
            ]);
          }))
        : emptyState('fa-shield-halved', t('misc.nothing_yet'), t('vault.intro'))
    ])
  ]);
}

/* ====================== REPORTS & ESTATE ====================== */
export function renderReports() {
  const k = S.kpis();
  const s = S.state.settings;
  const byType = {}, byStatus = {}, byUnit = {};
  S.visibleCommitments().forEach(c => {
    byType[c.type] = (byType[c.type] || 0) + 1;
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    byUnit[c.unit_code] = (byUnit[c.unit_code] || 0) + 1;
  });
  const bars = (obj, labeler) => {
    const max = Math.max(1, ...Object.values(obj));
    return el('div', { class: 'stack' }, Object.entries(obj)
      .sort((a, b) => b[1] - a[1]).map(([kk, v]) => el('div', {}, [
        el('div', { class: 'row between' }, [
          el('small', { text: labeler(kk) }), el('small', { text: formatNumber(v) })
        ]),
        progressBar(Math.round(v / max * 100))
      ])));
  };

  const kpiRow = (label, value, target) => el('div', { class: 'setting' }, [
    el('div', { class: 's-main' }, [el('b', { text: label }), target ? el('small', { text: target }) : null]),
    el('span', { class: 'badge', text: value })
  ]);

  const exV = new VAL.Validator();
  const executorInput = input({ value: s.executor_name || '', placeholder: t('estate.executor'), maxlength: '80' });
  const executorField = field(t('estate.executor'), executorInput);
  exV.rule(executorInput, VAL.optionalText(executorInput, 80), { label: t('estate.executor'), appendTo: executorField });
  const e = S.estateReadiness();
  const chainBox = el('div');

  return el('div', { class: 'stack fade-in' }, [
    el('h1', { text: t('report.title') }),
    el('section', { class: 'card' }, [
      el('h3', { text: t('report.kpis') }),
      el('p', { class: 'card-sub', text: t('views2.all_private_device_session') }),
      kpiRow(t('report.kpi.clarity'), formatNumber(k.clarity), '—'),
      kpiRow(t('report.kpi.ack'), k.ackPct === null ? '—' : formatNumber(k.ackPct) + '%', '≥ 40%'),
      kpiRow(t('report.kpi.fulfil'), formatNumber(k.fulfilPct) + '%', '—'),
      kpiRow(t('report.kpi.disputes'), formatNumber(k.disputesPer100), '≤ 3'),
      kpiRow(t('report.kpi.anxiety'), k.checkinDelta === null ? '—' : formatNumber(k.checkinDelta), '+0.5'),
      kpiRow(t('report.kpi.release_undo'), formatNumber(k.releaseUndoPct) + '%', '< 5%')
    ]),
    el('div', { class: 'grid' }, [
      el('section', { class: 'card col-4 col-m6' }, [el('h3', { text: t('report.by_type') }), bars(byType, kk => t('type.' + kk))]),
      el('section', { class: 'card col-4 col-m6' }, [el('h3', { text: t('report.by_status') }), bars(byStatus, kk => t('status.' + kk))]),
      el('section', { class: 'card col-4 col-m6' }, [el('h3', { text: t('report.by_unit') }), bars(byUnit, kk => unitShort(kk))])
    ]),
    el('section', { class: 'card' }, [
      el('h3', { text: t('views2.record_integrity_hash_chain') }),
      el('p', { class: 'card-sub', text: t('views2.every_change_written_append') }),
      el('button', { class: 'btn btn-sm', text: t('views2.verify_now'), onclick: async () => {
        const r = await db.verifyChain();
        chainBox.replaceChildren(el('p', { class: 'notice', text: r.ok
          ? (t('views2.chain_intact_events', { count: formatNumber(r.count) }))
          : t('views2.chain_broken', { reason: r.reason }) }));
      } }),
      chainBox
    ]),
    el('section', { class: 'card' }, [
      el('h3', { text: t('estate.title') }),
      el('p', { class: 'card-sub', text: t('estate.intro') }),
      progressBar(e.pct, e.pct >= 80),
      el('div', { class: 'row between' }, [
        el('small', { text: t('estate.readiness') + ': ' + formatNumber(e.pct) + '%' }),
        el('small', { text: t('estate.last_export') + ': ' + (s.last_estate_export ? formatDateTime(s.last_estate_export) : t('estate.never')) })
      ]),
      el('div', { class: 'row tight', style: { marginTop: '12px', alignItems: 'flex-start' } }, [
        el('div', { style: { flex: '1 1 200px' } }, [executorField]),
        el('button', { class: 'btn btn-sm', text: t('action.save'), onclick: async () => {
          if (!exV.check()) return;
          await S.saveSettings({ executor_name: executorInput.value.trim() }); toast(t('misc.saved'), 'good');
        } })
      ]),
      exV.summary,
      el('div', { class: 'row tight' }, [
        el('button', { class: 'btn btn-primary', text: t('estate.generate'), onclick: () => openEstateSheet() }),
        el('button', { class: 'btn', text: t('set.export_csv'), onclick: exportCSV })
      ]),
      S.state.settings.islamic_mode ? ayahBlock(C.ayahFor('estate')) : null
    ]),
    disclaimer('legal')
  ]);
}

function estateHTML() {
  const s = S.state.settings;
  const open = S.openCommitments();
  const rows = open.map(c => ({
    who: S.cpName(c.counterparty_id),
    dir: c.direction === 'I_OWE' ? t('dir.i_owe') : t('dir.owed_to_me'),
    what: c.description || t('type.' + c.type),
    amount: c.amount_minor ? formatAmount(S.remainingMinor(c), c.unit_code) : '—',
    due: dueLabel(c),
    status: t('status.' + c.status),
    evidence: S.evidenceOf(c.id).length ? (t('views2.yes')) : '—'
  }));
  return { rows, executor: s.executor_name };
}

function openEstateSheet() {
  const { rows, executor } = estateHTML();
  const table = el('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' } }, [
    el('thead', {}, [el('tr', {}, [t('add.who'), t('add.direction'), t('add.what'), t('add.amount'), t('add.due'), t('views2.status'), t('detail.evidence')]
      .map(h => el('th', { text: h, style: { textAlign: 'start', borderBottom: '1px solid var(--border)', padding: '6px' } })))]),
    el('tbody', {}, rows.map(r => el('tr', {}, [r.who, r.dir, r.what, r.amount, r.due, r.status, r.evidence]
      .map(v => el('td', { text: String(v), style: { borderBottom: '1px solid var(--border)', padding: '6px' } })))))
  ]);
  const body = el('div', { class: 'stack' }, [
    el('p', { class: 'notice', text: t('estate.intro') }),
    el('p', {}, [el('b', { text: t('estate.executor') + ': ' }), el('span', { text: executor || t('misc.none') })]),
    el('p', { text: t('views2.date_line', { date: formatDateDual(S.todayISO()) }) }),
    table,
    disclaimer('legal'),
    S.state.settings.islamic_mode ? ayahBlock(C.ayahFor('estate')) : null
  ]);
  sheet({
    title: t('estate.title'), body, wide: true,
    footer: [
      el('button', { class: 'btn', text: t('action.close'), onclick: () => closeSheet() }),
      el('button', { class: 'btn btn-primary', text: t('estate.print'), onclick: async () => {
        await S.saveSettings({ last_estate_export: Date.now() });
        window.print();
      } })
    ]
  });
}

function exportCSV() {
  const head = ['id','who','direction','type','description','amount_minor','unit','incurred_on','due_on','due_mode','status','approximate'];
  const rows = S.visibleCommitments().map(c => [
    c.id, S.cpName(c.counterparty_id), c.direction, c.type, (c.description || '').replace(/"/g, "'"),
    c.amount_minor, c.unit_code, c.incurred_on, c.due_on || '', c.due_mode, c.status, c.approximate
  ]);
  const csv = [head, ...rows].map(r => r.map(v => `"${String(v ?? '')}"`).join(',')).join('\n');
  download('dyon-ledger.csv', '\uFEFF' + csv, 'text/csv;charset=utf-8');
  toast(t('misc.saved'), 'good');
}

/* ====================== ISLAMIC CORNER ====================== */
export function renderIslamic() {
  const s = S.state.settings;
  if (!s.islamic_mode) {
    return el('div', { class: 'stack fade-in' }, [
      el('h1', { text: t('islamic.title') }),
      el('section', { class: 'card' }, [
        emptyState('fa-mosque', t('mode.islamic'), t('set.islamic_hint'),
          el('button', { class: 'btn btn-primary', text: t('mode.islamic'), onclick: async () => {
            await S.saveSettings({ islamic_mode: true });
          } }))
      ])
    ]);
  }

  const dua = C.duaOfDay();
  const hadith = C.reflectionHadith();
  const spiritual = S.state.spiritual;

  const addSpiritual = () => {
    const v = new VAL.Validator();
    const label = input({ maxlength: '120',
      placeholder: t('views2.e_g_6_days') });
    const unit = select([
      { value: 'FASTDAY', label: unitLabel('FASTDAY') },
      { value: 'PRAYER', label: unitLabel('PRAYER') },
      { value: 'DAY', label: unitLabel('DAY') },
      { value: 'ITEM', label: t('views2.other') }
    ]);
    const count = input({ type: 'number', min: '1', max: '9999', step: '1', value: '1' });
    const labelField = field(t('views2.description'), label, null, { required: true });
    const countField = field(t('views2.count'), count, null, { required: true });
    v.rule(label, VAL.requiredText(label, 120), { label: t('views2.description'), appendTo: labelField });
    v.rule(count, () => {
      if (!String(count.value).trim()) return VAL.MSG.required();
      const n = Number(VAL.normalizeNumeric(count.value));
      if (!Number.isInteger(n) || n < 1 || n > 9999)
        return t('views2.use_whole_number_between');
      return null;
    }, { label: t('views2.count'), appendTo: countField });
    sheet({
      title: t('islamic.spiritual_ledger'),
      body: el('div', { class: 'stack' }, [
        el('p', { class: 'notice', text: t('islamic.spiritual_hint') }),
        v.summary,
        labelField,
        el('div', { class: 'field-row' }, [field(t('add.unit'), unit), countField]),
        el('p', { class: 'notice', text: t('fiqh.disclaimer') })
      ]),
      footer: [
        el('button', { class: 'btn', text: t('action.cancel'), onclick: () => closeSheet() }),
        el('button', { class: 'btn btn-primary', text: t('action.save'), onclick: async () => {
          if (!v.check()) return;
          await S.addSpiritual({ label: label.value.trim(), unit_code: unit.value,
            count: parseInt(VAL.normalizeNumeric(count.value), 10) || 1 });
          closeSheet(); toast(t('misc.saved'), 'good');
        } })
      ]
    });
  };

  return el('div', { class: 'stack fade-in' }, [
    el('h1', { text: t('islamic.title') }),
    el('p', { class: 'notice', text: t('fiqh.disclaimer') }),
    el('div', { class: 'grid' }, [
      el('section', { class: 'card col-6 col-m6' }, [
        el('h3', { text: t('islamic.dua_of_day') }),
        ayahBlock(dua)
      ]),
      el('section', { class: 'card col-6 col-m6' }, [
        el('h3', { text: t('islamic.intention') }),
        el('p', { class: 'ayah', text: t('islamic.intention_text') }),
        el('p', { class: 'hint', text: s.last_intention_at ? formatDateTime(s.last_intention_at) : '' }),
        el('button', { class: 'btn btn-primary', text: t('islamic.renew'), onclick: async () => {
          await S.saveSettings({ last_intention_at: Date.now() });
          toast(t('islamic.renewed'), 'good');
        } })
      ])
    ]),
    el('section', { class: 'card' }, [
      el('h3', { text: t('islamic.cycle') }),
      el('div', { class: 'row tight' }, C.ETHIC_CYCLE.map((x, i) => el('span', { class: 'chip static' }, [
        el('span', { text: t('list.numbered', { n: formatNumber(i + 1), text: tr(x) }) }),
        el('small', { text: ' (' + x.note + ')', style: { color: 'var(--text-3)' } })
      ])))
    ]),
    el('section', { class: 'card' }, [
      el('h3', { text: t('views2.for_own_reflection') }),
      ayahBlock(hadith),
      el('p', { class: 'hint', text: t('views2.hypocrisy_delay_texts_are') })
    ]),
    el('section', { class: 'card' }, [
      el('div', { class: 'row between' }, [
        el('h3', { text: t('islamic.spiritual_ledger'), style: { margin: '0' } }),
        s.spiritual_ledger
          ? el('button', { class: 'btn btn-sm btn-primary', onclick: addSpiritual }, [icon('fa-plus'), el('span', { text: t('action.add_short') })])
          : el('button', { class: 'btn btn-sm', text: t('set.spiritual'), onclick: async () => { await S.saveSettings({ spiritual_ledger: true }); } })
      ]),
      el('p', { class: 'notice', text: t('islamic.spiritual_hint') }),
      s.spiritual_ledger
        ? (spiritual.length
            ? el('ul', { class: 'listy' }, spiritual.map(sp => el('li', {}, [
                el('div', { class: 'item-row', style: { cursor: 'default' } }, [
                  icon('fa-moon'),
                  el('span', { class: 'item-main' }, [
                    el('b', { text: sp.label }),
                    el('small', { text: formatNumber(sp.done) + ' / ' + formatNumber(sp.count) + ' ' + unitLabel(sp.unit_code) })
                  ]),
                  el('div', { class: 'row tight' }, [
                    el('button', { class: 'btn btn-sm', text: '+1', onclick: async () => {
                      await S.updateSpiritual(sp.id, { done: Math.min(sp.count, sp.done + 1) });
                    } }),
                    el('button', { class: 'btn btn-sm btn-ghost', 'aria-label': t('action.delete'),
                      onclick: async () => { await S.deleteSpiritual(sp.id); } }, [icon('fa-trash')])
                  ])
                ])
              ])))
            : el('p', { class: 'hint', text: t('misc.nothing_yet') }))
        : null
    ]),
    el('section', { class: 'card' }, [
      el('h3', { text: t('islamic.wasiyyah') }),
      el('p', { class: 'card-sub', text: t('estate.intro') }),
      el('button', { class: 'btn', text: t('estate.generate'), onclick: () => go('#/reports') })
    ]),
    el('section', { class: 'card' }, [
      el('h3', { text: t('views2.sources_shown_in_app') }),
      el('ul', { class: 'listy' }, [...C.AYAT, ...C.HADITH, ...C.DUAS].map(x => el('li', {}, [
        el('div', { class: 'item-row', style: { cursor: 'default' } }, [
          el('span', { class: 'item-main' }, [
            el('b', { text: tr(x) }),
            el('small', { text: C.renderSource(x) + (x.note ? ' · ' + x.note : '') })
          ])
        ])
      ])))
    ]),
    el('p', { class: 'notice', text: t('views2.declared_limit_madhhabs_differ') })
  ]);
}

/* ====================== CALM ====================== */
export function renderCalm() {
  const s = S.state.settings;
  const breathBox = el('div', { class: 'card', style: { textAlign: 'center', minHeight: '140px', display: 'grid', placeItems: 'center' } },
    [el('b', { text: t('calm.breathe') })]);
  let timer = null;
  const breathe = () => {
    if (timer) { clearInterval(timer); timer = null; }
    let step = 0;
    const total = 30;
    const tick = () => {
      const phase = Math.floor(step / 4) % 2 === 0 ? t('calm.breathe_in') : t('calm.breathe_out');
      breathBox.replaceChildren(
        el('div', { style: { fontSize: '1.4rem', fontWeight: '650' }, text: phase }),
        el('div', { class: 'hint', text: formatNumber(total - step) })
      );
      step++;
      if (step > total) { clearInterval(timer); timer = null; breathBox.replaceChildren(el('b', { text: t('calm.breathe') })); }
    };
    tick();
    timer = setInterval(tick, 1000);
  };

  return el('div', { class: 'stack fade-in' }, [
    el('h1', { text: t('mode.calm') }),
    el('section', { class: 'card card-accent' }, [
      el('p', { text: t('views2.calm_mode_lowers_arousal') }),
      switchRow(t('mode.calm'), s.calm_mode, async v => { await S.saveSettings({ calm_mode: v }); }, t('dash.calm_hidden'))
    ]),
    el('section', { class: 'card' }, [
      el('h3', { text: t('calm.breathe') }),
      breathBox,
      el('button', { class: 'btn btn-primary', text: t('calm.breathe'), onclick: breathe })
    ]),
    el('section', { class: 'card' }, [
      el('h3', { text: t('calm.resources') }),
      el('p', { class: 'notice', text: t('wellbeing.note') }),
      el('ul', { class: 'listy' }, C.WELLBEING.links.map(l => el('li', {}, [
        el('a', { class: 'item-row', href: l.url, target: '_blank', rel: 'noopener' }, [
          icon('fa-life-ring'),
          el('span', { class: 'item-main' }, [el('b', { text: tr({ en: l.label_en, ar: l.label_ar, fr: l.label_fr }) }), el('small', { text: l.url })])
        ])
      ]))),
      el('p', { class: 'hint', text: t('views2.last_checked', { date: C.WELLBEING.checked }) })
    ]),
    s.islamic_mode ? el('section', { class: 'card' }, [ayahBlock(C.ayahFor('calm'))]) : null
  ]);
}

/* ====================== SETTINGS ====================== */
export function renderSettings(ctx) {
  const s = S.state.settings;
  const wrap = el('div', { class: 'stack fade-in' });

  const langSel = select(Object.entries(LOCALES).map(([k, v]) =>
    ({ value: k, label: v.native, selected: s.locale === k })), {
    onchange: async e => { await S.saveSettings({ locale: e.target.value }); ctx.applyLocale(); }
  });
  const digitsSel = select(['latn', 'arab', 'extarab'].map(d =>
    ({ value: d, label: t('set.digits.' + d), selected: s.digits === d })), {
    onchange: async e => { await S.saveSettings({ digits: e.target.value }); ctx.applyLocale(); }
  });
  const calSel = select(['gregory', 'islamic-umalqura', 'islamic-civil', 'persian'].map(c =>
    ({ value: c, label: t('set.cal.' + c), selected: s.calendar_primary === c })), {
    onchange: async e => {
      const patch = { calendar_primary: e.target.value };
      if (S.state.settings.calendar_secondary === e.target.value) patch.calendar_secondary = 'none';
      await S.saveSettings(patch); ctx.applyLocale();
    }
  });
  const cal2Sel = select(['none', 'gregory', 'islamic-umalqura', 'islamic-civil', 'persian']
    .filter(c => c !== s.calendar_primary).map(c =>
    ({ value: c, label: t('set.cal.' + c), selected: s.calendar_secondary === c })), {
    onchange: async e => { await S.saveSettings({ calendar_secondary: e.target.value }); ctx.applyLocale(); }
  });
  const curSel = select(Object.keys(CURRENCIES).map(c =>
    ({ value: c, label: `${c} — ${unitLabel(c)}`, selected: s.base_currency === c })), {
    onchange: async e => { await S.saveSettings({ base_currency: e.target.value }); }
  });
  const weekSel = select([['mon', t('views2.monday')], ['sun', t('views2.sunday')], ['sat', t('views2.saturday')]]
    .map(([v, l]) => ({ value: v, label: l, selected: s.week_start === v })), {
    onchange: async e => { await S.saveSettings({ week_start: e.target.value }); }
  });
  const themeSel = select([['system', t('set.theme.system')], ['light', t('mode.light')], ['dark', t('mode.dark')]]
    .map(([v, l]) => ({ value: v, label: l, selected: s.theme === v })), {
    onchange: async e => { await S.saveSettings({ theme: e.target.value }); ctx.applyTheme(); }
  });
  const toneSel = select(S.TONES.filter(x => x !== 'islamic' || s.islamic_mode || s.default_tone === x)
    .map(x => ({ value: x, label: t('tone.' + x), selected: s.default_tone === x })), {
    onchange: async e => { await S.saveSettings({ default_tone: e.target.value }); }
  });
  const quietErr = el('div', { class: 'err' });
  const saveQuiet = async () => {
    quietErr.replaceChildren();
    if (!quietFrom.value || !quietTo.value || quietFrom.value === quietTo.value) {
      quietErr.append(icon('fa-circle-exclamation'), el('span', { text: t('views2.choose_different_start_end') }));
      quietTo.setAttribute('aria-invalid', 'true');
      return;
    }
    quietTo.removeAttribute('aria-invalid');
    await S.saveSettings({ quiet_from: quietFrom.value, quiet_to: quietTo.value });
  };
  const quietFrom = el('input', { type: 'time', value: s.quiet_from, 'aria-label': t('qr.from'), onchange: saveQuiet });
  const quietTo = el('input', { type: 'time', value: s.quiet_to, 'aria-label': t('views2.text'), onchange: saveQuiet });
  const nameV = new VAL.Validator();
  const nameInput = input({ value: s.display_name, maxlength: '60',
    placeholder: t('views2.name_stays_on_device'),
    onchange: async e => {
      if (!nameV.check()) return;
      await S.saveSettings({ display_name: e.target.value.trim() });
      ctx.refreshHeader();
    } });
  const nameField = field(t('views2.name'), nameInput);
  nameV.rule(nameInput, VAL.optionalText(nameInput, 60),
    { label: t('views2.name'), appendTo: nameField });

  const importErr = el('div', { class: 'err' });
  const importInput = el('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' },
    onchange: async e => {
      importErr.replaceChildren();
      const f = e.target.files[0];
      if (!f) return;
      const fail = (msg) => {
        importErr.append(icon('fa-circle-exclamation'), el('span', { text: msg }));
        e.target.value = '';
      };
      if (f.size > 25 * 1024 * 1024) return fail(VAL.MSG.fileTooBig(25));
      let obj;
      try { obj = JSON.parse(await f.text()); }
      catch { return fail(t('views2.that_file_not_valid')); }
      if (!obj || obj.app !== 'DYON')
        return fail(t('views2.that_not_dyon_backup'));
      try {
        await S.importPayload(obj);
        e.target.value = '';
        toast(t('misc.saved'), 'good');
        ctx.applyLocale();
      } catch (err) { fail(String(err.message || err)); }
    } });

  wrap.append(
    el('h1', { text: t('nav.settings') }),
    AUTH.accountCard(),

    el('section', { class: 'card' }, [
      el('h3', { text: t('views2.language_display') }),
      nameField,
      settingRow(t('set.language'), langSel),
      settingRow(t('set.digits'), digitsSel),
      settingRow(t('set.calendar'), calSel),
      settingRow(t('set.calendar2'), cal2Sel),
      settingRow(t('set.week_start'), weekSel),
      settingRow(t('set.theme'), themeSel)
    ]),

    el('section', { class: 'card' }, [
      el('h3', { text: t('views2.currencies_units') }),
      settingRow(t('set.base_currency'), curSel),
      switchRow(t('set.converted'), s.converted_totals, async v => { await S.saveSettings({ converted_totals: v }); }, t('set.converted_hint')),
      el('p', { class: 'notice', text: t('views2.debt_stays_in_unit', { source: FX_SOURCE.source, as_of: FX_SOURCE.as_of }) }),
      el('p', { class: 'notice', text: t('limit.no_riba') })
    ]),

    el('section', { class: 'card' }, [
      el('h3', { text: t('set.notifications') }),
      settingRow(t('add.tone'), toneSel),
      settingRow(t('set.quiet'), el('div', { class: 'row tight quiet-row' }, [quietFrom, el('span', { text: t('views2.text_2'), 'aria-hidden': 'true' }), quietTo])),
      quietErr,
      switchRow(t('set.prayer_quiet'), s.prayer_quiet, async v => { await S.saveSettings({ prayer_quiet: v }); }),
      switchRow(t('views2.self_reminders'), s.self_reminders,
        async v => { await S.saveSettings({ self_reminders: v }); }, t('remind.self_default')),
      el('p', { class: 'notice', text: t('remind.cap', { from: s.quiet_from, to: s.quiet_to }) }),
      el('p', { class: 'notice', text: t('views2.no_marketing_ever_no') }),
      el('button', { class: 'btn btn-sm', text: t('views2.allow_device_notifications'),
        onclick: async () => {
          if (!('Notification' in window)) return toast('—', 'warn');
          const p = await Notification.requestPermission();
          toast(p, p === 'granted' ? 'good' : 'warn');
        } })
    ]),

    el('section', { class: 'card' }, [
      el('h3', { text: t('views2.privacy_modes') }),
      switchRow(t('mode.calm'), s.calm_mode, async v => { await S.saveSettings({ calm_mode: v }); }),
      switchRow(t('mode.islamic'), s.islamic_mode, async v => {
        const patch = { islamic_mode: v };
        if (!v) { patch.spiritual_ledger = false; if (S.state.settings.default_tone === 'islamic') patch.default_tone = 'gentle'; }
        await S.saveSettings(patch);
      }, t('set.islamic_hint')),
      s.islamic_mode
        ? el('div', { class: 'setting-child' }, [switchRow(t('set.spiritual'), s.spiritual_ledger, async v => { await S.saveSettings({ spiritual_ledger: v }); }, t('set.spiritual_hint'))])
        : null,
      switchRow(t('set.blur'), s.blur_amounts, async v => { await S.saveSettings({ blur_amounts: v }); }),
      switchRow(t('set.discreet'), s.discreet_mode, async v => { await S.saveSettings({ discreet_mode: v }); ctx.refreshHeader(); }, t('set.discreet_hint')),
      switchRow(t('flow.hardship'), s.hardship, async v => { await S.saveSettings({ hardship: v }); }, t('flow.hardship_hint')),
      switchRow(t('set.lock'), s.pin_enabled, async on => {
        if (on) openPinSetup(ctx);
        else { await S.saveSettings({ pin_enabled: false, pin: '' }); toast(t('misc.saved'), 'good'); }
      }, t('set.lock_hint')),
      el('p', { class: 'notice', text: t('views2.pin_local_convenience_not') })
    ]),

    el('section', { class: 'card', id: 'data-card', 'data-tour': 'set-data' }, [
      el('h3', { text: t('set.data') }),
      el('p', { class: 'notice', text: t('set.offline_ready') }),
      el('div', { class: 'row tight' }, [
        el('button', { class: 'btn btn-sm', onclick: () => {
          download('dyon-backup-' + S.todayISO() + '.json', JSON.stringify(S.exportPayload(false), null, 2));
          toast(t('misc.saved'), 'good');
        } }, [icon('fa-file-export'), el('span', { text: t('set.export_all') })]),
        el('button', { class: 'btn btn-sm', onclick: exportCSV }, [icon('fa-file-csv'), el('span', { text: t('set.export_csv') })]),
        importInput,
        el('button', { class: 'btn btn-sm', onclick: () => importInput.click() }, [icon('fa-file-import'), el('span', { text: t('set.import') })])
      ]),
      importErr,
      el('p', { class: 'hint', text: t('views2.exports_exclude_spiritual_ledger') }),
      el('div', { class: 'row tight', style: { marginTop: '12px' } }, [
        el('button', { class: 'btn btn-sm', onclick: () => ctx.seed() }, [icon('fa-wand-magic-sparkles'), el('span', { text: t('set.seed') })]),
        el('button', { class: 'btn btn-sm', type: 'button', onclick: async () => { resetOnboardingStep(); await S.saveSettings({ onboarded: false }); go('#/onboarding'); } },
          [icon('fa-rotate'), el('span', { text: t('set.reset_onboarding') })]),
        el('button', { class: 'btn btn-sm btn-warn', onclick: () => openWipeConfirm() },
          [icon('fa-trash'), el('span', { text: t('set.delete_all') })])
      ])
    ]),

    el('section', { class: 'card' }, [
      el('h3', { text: t('views2.install') }),
      el('p', { class: 'card-sub', text: t('views2.install_dyon_as_app') }),
      el('button', { class: 'btn btn-primary', id: 'install-btn-settings', text: t('set.install'),
        onclick: () => ctx.promptInstall() })
    ]),

      el('section', { class: 'card' }, [
      el('h3', { text: t('nav.guide') }),
      el('p', { class: 'card-sub', text: t('guide.new_here') }),
      el('div', { class: 'row tight' }, [
        el('button', { class: 'btn btn-primary', onclick: () => go('#/guide') },
          [icon('fa-graduation-cap'), el('span', { text: t('guide.open') })]),
        el('button', { class: 'btn', onclick: () => go('#/tour') },
          [icon('fa-location-crosshairs'), el('span', { text: t('guide.tour') })]),
        el('button', { class: 'btn', text: t('nav.about'), onclick: () => go('#/about') })
      ])
    ])
  );
  return wrap;
}

/* Delete everything — typed confirmation, validated before the button arms. */
function openWipeConfirm() {
  const confirmInput = input({ placeholder: 'DELETE', autocomplete: 'off', maxlength: '10' });
  const err = el('div', { class: 'err' });
  const wipeBtn = el('button', { class: 'btn btn-warn', disabled: true, text: t('action.delete'),
    onclick: async () => {
      await S.wipe();
      closeSheet();
      toast(t('misc.deleted'), 'good');
      go('#/onboarding');
    } });
  confirmInput.addEventListener('input', () => {
    const ok = confirmInput.value.trim().toUpperCase() === 'DELETE';
    wipeBtn.disabled = !ok;
    err.replaceChildren();
    if (!ok && confirmInput.value.trim()) {
      err.append(icon('fa-circle-exclamation'), el('span', { text: t('views2.type_delete_exactly_confirm') }));
    }
  });
  sheet({
    title: t('set.delete_all'),
    body: el('div', { class: 'stack' }, [
      el('p', { class: 'form-summary', text: t('set.delete_confirm') }),
      el('p', { class: 'hint', text: t('views2.tip_export_backup_first') }),
      confirmInput, err
    ]),
    footer: [
      el('button', { class: 'btn', text: t('action.cancel'), onclick: () => closeSheet() }),
      wipeBtn
    ]
  });
}

/* PIN setup — validated, confirmed twice, and honest about what it is not. */
function openPinSetup(ctx) {
  const v = new VAL.Validator();
  const pin1 = input({ type: 'password', inputmode: 'numeric', maxlength: '8', autocomplete: 'new-password' });
  const pin2 = input({ type: 'password', inputmode: 'numeric', maxlength: '8', autocomplete: 'new-password' });
  const f1 = field(t('views2.new_pin'), pin1, null, { required: true });
  const f2 = field(t('views2.confirm_pin'), pin2, null, { required: true });
  v.rule(pin1, VAL.pinRule(pin1), { label: t('views2.new_pin'), appendTo: f1 });
  v.rule(pin2, () => {
    if (!pin2.value.trim()) return VAL.MSG.required();
    if (pin1.value !== pin2.value) return VAL.MSG.pinMismatch();
    return null;
  }, { label: t('views2.confirm_pin_2'), appendTo: f2 });

  sheet({
    title: t('set.lock'),
    body: el('div', { class: 'stack' }, [
      el('p', { class: 'form-summary', text: t('set.lock_hint') }),
      v.summary, f1, f2
    ]),
    onClose: () => ctx.rerender(),
    footer: [
      el('button', { class: 'btn', text: t('action.cancel'), onclick: () => closeSheet() }),
      el('button', { class: 'btn btn-primary', text: t('action.save'), onclick: async () => {
        if (!v.check()) return;
        await S.saveSettings({ pin_enabled: true, pin: pin1.value.trim() });
        closeSheet(); toast(t('misc.saved'), 'good');
      } })
    ]
  });
}

/* ====================== ABOUT & LIMITS ====================== */
export function renderAbout() {
  const row = (a, b) => el('div', { class: 'setting' }, [
    el('div', { class: 's-main' }, [el('b', { text: a }), el('small', { text: b })])
  ]);
  const redLines = [
    ['RL-01', t('views2.no_riba_or_interest')],
    ['RL-02', t('views2.no_selling_or_sharing')],
    ['RL-03', t('views2.no_public_shaming_no')],
    ['RL-04', t('views2.no_credit_score_shared')],
    ['RL-05', t('views2.no_dark_patterns_or')],
    ['RL-06', t('views2.no_lending_or_loan')],
    ['RL-07', t('views2.no_algorithmic_decisions_against')],
    ['RL-08', t('views2.minimal_data_for_non')],
    ['RL-09', t('views2.right_export_delete_everything')],
    ['RL-10', t('views2.irreversibility_guard_24h_undo')],
    ['RL-11', t('views2.no_ethics_laundering_red')],
    ['RL-12', t('views2.no_linguistic_flattening_arabic')]
  ];
  const notList = [
    t('views2.not_lender'),
    t('views2.not_debt_collector'),
    t('views2.not_credit_bureau'),
    t('views2.not_interest_engine'),
    t('views2.not_shaming_platform'),
    t('views2.not_fatwa_authority'),
    t('views2.not_replacement_for_therapy')
  ];
  return el('div', { class: 'stack fade-in' }, [
    el('h1', { text: t('nav.about') }),
    el('section', { class: 'card card-hero' }, [
      el('h2', { text: t('app.name') + ' — ' + t('app.tagline') }),
      el('p', { text: t('app.mission') })
    ]),
    el('section', { class: 'card' }, [
      el('h3', { text: t('views2.what_dyon_not') }),
      el('div', { class: 'row tight' }, notList.map(x => el('span', { class: 'chip static' }, [icon('fa-ban'), el('span', { text: x })])))
    ]),
    el('section', { class: 'card' }, [
      el('h3', { text: t('views2.red_lines') }),
      ...redLines.map(([id, text]) => row(id, text))
    ]),
    el('section', { class: 'card' }, [
      el('h3', { text: t('views2.declared_limits') }),
      el('ul', { class: 'listy' }, [
        t('views2.not_legal_advice_enforceability'),
        t('views2.not_fatwa_islamic_content'),
        t('views2.not_therapy_severe_distress'),
        t('views2.evidence_mostly_correlational_interventions'),
        t('views2.cultural_coverage_partial'),
        t('views2.dyon_cannot_make_anyone')
      ].map(x => el('li', {}, [el('div', { class: 'item-row', style: { cursor: 'default' } }, [icon('fa-circle-info'), el('span', { class: 'item-main', text: x })])])))
    ]),
    el('section', { class: 'card' }, [
      el('h3', { text: t('views2.project_falsifier') }),
      el('p', { text: t('views2.if_after_six_months') })
    ]),
    el('section', { class: 'card' }, [
      el('h3', { text: t('views2.guide') }),
      el('p', { class: 'card-sub', text: t('guide.new_here') }),
      el('button', { class: 'btn btn-primary', onclick: () => go('#/guide') },
        [icon('fa-graduation-cap'), el('span', { text: t('guide.open') })])
    ]),
    el('section', { class: 'card' }, [
      el('h3', { text: t('views2.source_version') }),
      el('p', { class: 'hint', text: 'DYON Canonical Specification v0.1 · 2026-10-10 · © Maher — Founder.' }),
      el('a', { class: 'source-link', href: 'docs/dyon-source-of-truth.md', target: '_blank', rel: 'noopener',
        text: t('views2.open_full_source_truth') })
    ]),
    disclaimer('legal'),
    disclaimer('fiqh')
  ]);
}

/* ====================== ONBOARDING (S-19 brain dump) ====================== */
/* The step survives re-renders (language switch, saves), so adding an entry
   never throws the person back to the first screen. */
let onbStep = 0;
export function resetOnboardingStep() { onbStep = 0; }
export function renderOnboarding(ctx) {
  const s = S.state.settings;
  let step = onbStep;
  const cats = C.DUMP_CATEGORIES.filter(c => !c.islamicOnly || s.islamic_mode);
  const wrap = el('div', { class: 'stack fade-in', style: { maxWidth: '680px', margin: '0 auto' } });
  const stage = el('div');
  wrap.appendChild(stage);

  const quickRow = (cat) => {
    const name = input({ placeholder: t('add.who_ph'), maxlength: '80' });
    const what = input({ maxlength: '120',
      placeholder: t('views2.what_e_g_300') });
    const dirSel = select([
      { value: 'I_OWE', label: t('dir.i_owe'), selected: cat.dir === 'I_OWE' },
      { value: 'OWED_TO_ME', label: t('dir.owed_to_me'), selected: cat.dir === 'OWED_TO_ME' }
    ], { style: { width: 'auto' } });
    const rowErr = el('div', { class: 'err' });

    const addEntry = async () => {
      rowErr.replaceChildren();
      const who = name.value.trim();
      const whatVal = what.value.trim();
      if (!who) {
        rowErr.append(icon('fa-circle-exclamation'), el('span', { text: VAL.MSG.whoRequired() }));
        name.setAttribute('aria-invalid', 'true'); name.focus();
        return;
      }
      name.removeAttribute('aria-invalid');
      if (!whatVal) {
        rowErr.append(icon('fa-circle-exclamation'), el('span', { text: t('views2.add_rough_amount_or') }));
        what.setAttribute('aria-invalid', 'true'); what.focus();
        return;
      }
      what.removeAttribute('aria-invalid');

      const numeric = /^[\d٠-٩۰-۹.,\s٫٬]+$/.test(whatVal);
      const unit = numeric ? S.state.settings.base_currency : (S.TYPE_DEFAULT_UNIT[cat.type] || 'ITEM');
      if (numeric && VAL.decimalsOf(whatVal) > 6) {
        rowErr.append(icon('fa-circle-exclamation'), el('span', { text: VAL.MSG.amountNumber() }));
        what.focus();
        return;
      }
      await S.createCommitment({
        type: cat.type,
        direction: dirSel.value,
        counterparty_name: who,
        unit_code: unit,
        amount_minor: numeric ? toMinor(whatVal, unit) : 1,
        description: numeric ? '' : whatVal,
        approximate: true,
        visibility: 'private'
      });
      name.value = ''; what.value = '';
      counter.textContent = t('count.commitments', { count: S.visibleCommitments().length });
      name.focus();
      toast(t('misc.saved'), 'good');
    };

    [name, what].forEach(c => c.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addEntry(); }
    }));

    return el('div', { style: { marginBottom: '8px' } }, [
      el('div', { class: 'row tight' }, [
        el('div', { style: { flex: '1 1 140px' } }, [name]),
        el('div', { style: { flex: '1 1 140px' } }, [what]),
        dirSel,
        el('button', { class: 'btn btn-sm btn-primary', 'aria-label': t('action.add'), onclick: addEntry }, [icon('fa-plus')])
      ]),
      rowErr
    ]);
  };
  const counter = el('span', { class: 'badge', text: t('count.commitments', { count: S.visibleCommitments().length }) });

  const render = () => {
    onbStep = step;
    stage.replaceChildren();
    if (step === 0) {
      stage.append(
        el('section', { class: 'card card-hero' }, [
          el('h1', { text: t('onboarding.welcome_title') }),
          el('p', { text: t('onboarding.welcome') })
        ]),
        el('section', { class: 'card', 'data-tour': 'onb-lang' }, [
          el('h3', { text: t('onboarding.language') }),
          el('div', { class: 'row tight' }, Object.entries(LOCALES).map(([k, v]) =>
            el('button', { class: 'chip' + (S.state.settings.locale === k ? ' on' : ''), onclick: async () => {
              await S.saveSettings({ locale: k }); ctx.applyLocale(); render();
            } }, [el('span', { text: v.native })]))),
          el('div', { style: { height: '12px' } }),
          switchRow(t('mode.islamic'), S.state.settings.islamic_mode,
            async v => { await S.saveSettings({ islamic_mode: v }); }, t('set.islamic_hint')),
          el('p', { class: 'notice', text: t('onboarding.privacy_promise') }),
          el('p', { class: 'notice', text: t('limit.no_riba') })
        ]),
        el('section', { class: 'card', 'data-tour': 'onb-guide' }, [
          el('h3', {}, [icon('fa-graduation-cap'), el('span', { text: ' ' + (t('views2.new')) })]),
          el('p', { class: 'card-sub', text: t('views2.guide_explains_every_screen') }),
          el('div', { class: 'row tight' }, [
            el('button', { class: 'btn btn-sm', type: 'button', onclick: () => go('#/guide?p=start') },
              [icon('fa-book-open'), el('span', { text: t('guide.open') })]),
            el('button', { class: 'btn btn-sm', type: 'button', onclick: () => go('#/guide?p=glossary') },
              [icon('fa-spell-check'), el('span', { text: t('guide.glossary') })])
          ])
        ]),
        el('div', { class: 'row tight onb-actions', 'data-tour': 'onb-start' }, [
          el('button', { class: 'btn btn-primary btn-lg', type: 'button', text: t('onboarding.start'), onclick: () => { step = 1; render(); window.scrollTo(0, 0); } }),
          el('button', { class: 'btn btn-lg', type: 'button', text: t('onboarding.skip'), onclick: () => { step = cats.length + 1; render(); window.scrollTo(0, 0); } })
        ])
      );
      return;
    }
    if (step <= cats.length) {
      const cat = cats[step - 1];
      const rows = el('div');
      for (let i = 0; i < 3; i++) rows.appendChild(quickRow(cat));
      stage.append(
        el('section', { class: 'card' }, [
          el('div', { class: 'row between' }, [
            el('h2', {}, [icon('fa-' + cat.icon.replace(/^fa-/, '')), el('span', { text: ' ' + t(cat.i18n) })]),
            counter
          ]),
          el('p', { class: 'card-sub', text: t('onboarding.rough') }),
          rows,
          el('button', { class: 'btn btn-sm btn-ghost', onclick: () => rows.appendChild(quickRow(cat)) },
            [icon('fa-plus'), el('span', { text: t('views2.another_line') })])
        ]),
        el('div', { class: 'row between' }, [
          el('button', { class: 'btn', type: 'button', text: step === 1 ? t('action.back') : (t('guide.previous')), onclick: () => { step--; render(); window.scrollTo(0, 0); } }),
          el('div', { class: 'row tight' }, [
            el('span', { class: 'badge', text: formatNumber(step) + '/' + formatNumber(cats.length) }),
            el('button', { class: 'btn btn-primary', type: 'button', text: step === cats.length ? t('onboarding.finish') : t('onboarding.next'),
              onclick: () => { step++; render(); window.scrollTo(0, 0); } })
          ])
        ])
      );
      return;
    }
    // summary without totals (§7.9 step 4)
    const items = S.visibleCommitments().length;
    const people = S.state.counterparties.length;
    const step1 = S.openCommitments()[0];
    stage.append(
      el('section', { class: 'card card-hero celebrate' }, [
        el('h2', { text: t('onboarding.summary', {
          items: t('count.commitments', { count: items }),
          people: t('count.people', { count: people })
        }) })
      ]),
      step1 ? el('section', { class: 'card' }, [
        el('h3', { text: t('calm.next_step') }),
        el('p', { text: S.cpName(step1.counterparty_id) + ' · ' + (step1.description || t('type.' + step1.type)) }),
        el('button', { class: 'btn btn-primary', type: 'button', text: t('action.open'), onclick: () => { finish(); setTimeout(() => F.openDetail(step1.id), 400); } })
      ]) : null,
      el('section', { class: 'card' }, [
        el('h3', { text: t('views2.what_next') }),
        el('ul', { class: 'listy' }, [
          [ 'fa-location-crosshairs', t('views2.quick_tour_overview'), t('guide.short_steps_with_next'), () => finish('#/tour') ],
          [ 'fa-graduation-cap', t('views2.beginner_guide'), t('views2.every_screen_every_word'), () => finish('#/guide') ],
          [ 'fa-user-shield', t('views2.account_only_later'), t('views2.only_needed_share_or'), () => finish('#/guide?p=account') ]
        ].map(([ic, b, sm, fn]) => el('li', {}, [el('button', { class: 'item-row', type: 'button', onclick: fn }, [
          icon(ic, 'fa-fw'), el('span', { class: 'item-main' }, [el('b', { text: b }), el('small', { text: sm })]),
          icon(document.documentElement.dir === 'rtl' ? 'fa-chevron-left' : 'fa-chevron-right')
        ])])))
      ]),
      el('button', { class: 'btn btn-lg btn-block btn-primary', type: 'button', text: t('onboarding.finish'), onclick: () => finish() })
    );
  };

  async function finish(next = '#/') {
    onbStep = 0;
    await S.saveSettings({ onboarded: true });
    go(next);
  }

  render();
  return wrap;
}
