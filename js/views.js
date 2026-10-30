/* DYON — primary views: Overview dashboard (W-01..W-20), Ledger, People. */

import { t, formatDate, formatDateDual, formatNumber, getLocale } from './i18n.js';
import { formatAmount, unitShort, isMonetary, fxNotice, convertMinor } from './units.js';
import * as S from './store.js';
import * as C from './content.js';
import * as F from './flows.js';
import { el, frag, icon, card, emptyState, progressBar, meterRing, sparkline, amountEl,
         statusBadge, directionBadge, avatar, dueLabel, commitmentRow, chipGroup, disclaimer,
         ayahBlock, toast, sheet, closeSheet, field, input, textarea, select, confirmSheet } from './ui.js';
import * as VAL from './validate.js';
import { tourDone, markTourDone } from './guide.js';

const go = (hash) => { location.hash = hash; };

const tourSeen = () => tourDone();
const dismissTourBanner = () => markTourDone();

/* Zone band (§7.3): groups widgets under a quiet heading and remembers whether
   the group is collapsed, so the overview is scannable instead of 18 equal cards. */
function zoneKey(id) { return 'dyon.zone.' + id; }
function zoneCollapsed(id, defaultOpen = true) {
  const v = localStorage.getItem(zoneKey(id));
  return v === null ? !defaultOpen : v === '0';
}
function zone(id, title, cards, opts = {}) {
  const collapsed = zoneCollapsed(id, opts.defaultOpen !== false);
  const inner = el('div', { class: 'grid', id: 'zone-' + id });
  cards.filter(Boolean).forEach(c => inner.appendChild(c));
  if (collapsed) inner.style.display = 'none';

  const toggle = el('button', {
    class: 'zone-toggle', 'aria-expanded': collapsed ? 'false' : 'true', 'aria-controls': 'zone-' + id
  }, [
    icon(collapsed ? 'fa-chevron-down' : 'fa-chevron-up'),
    el('span', { text: collapsed ? (t('views.show')) : (t('views.hide')) })
  ]);
  toggle.addEventListener('click', () => {
    const nowCollapsed = inner.style.display === 'none';
    inner.style.display = nowCollapsed ? '' : 'none';
    localStorage.setItem(zoneKey(id), nowCollapsed ? '1' : '0');
    toggle.setAttribute('aria-expanded', nowCollapsed ? 'true' : 'false');
    toggle.replaceChildren(
      icon(nowCollapsed ? 'fa-chevron-up' : 'fa-chevron-down'),
      el('span', { text: nowCollapsed ? (t('views.hide')) : (t('views.show')) })
    );
  });

  return el('div', { class: 'zone' }, [
    el('div', { class: 'zone-head' }, [
      el('h2', { text: title }),
      el('span', { class: 'line' }),
      opts.count ? el('span', { class: 'badge', text: opts.count }) : null,
      toggle
    ]),
    el('div', { style: { height: '12px' } }),
    inner
  ]);
}

/* ======================================================================
   OVERVIEW (§7.3 zones A–G)
   ====================================================================== */
export function renderOverview() {
  const s = S.state.settings;
  const calm = s.calm_mode;
  const persona = S.userState();
  const grid = el('div', { class: 'grid fade-in' });

  if (persona === 'empty') return renderEmptyDashboard();

  /* A one-time, dismissible pointer to the guide — never nagging (RL-05). */
  if (!tourSeen()) {
    const banner = el('section', { class: 'card col-12 card-accent' }, [
      el('div', { class: 'row between' }, [
        el('div', { style: { flex: '1 1 260px' } }, [
          el('h3', {}, [icon('fa-graduation-cap'), el('span', { text: ' ' + t('guide.new_here') })])
        ]),
        el('div', { class: 'row tight' }, [
          el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => go('#/tour') },
            [icon('fa-location-crosshairs'), el('span', { text: t('guide.tour') })]),
          el('button', { class: 'btn btn-sm', onclick: () => go('#/guide') },
            [icon('fa-book-open'), el('span', { text: t('guide.open') })]),
          el('button', { class: 'btn btn-sm btn-ghost', 'aria-label': t('action.close'),
            onclick: () => { dismissTourBanner(); banner.remove(); } }, [icon('fa-xmark')])
        ])
      ])
    ]);
    grid.appendChild(banner);
  }

  /* Overwhelm banner (§7.9) */
  if (persona === 'overwhelm' && !calm) {
    grid.appendChild(el('section', { class: 'card col-12 card-accent' }, [
      el('div', { class: 'row between' }, [
        el('div', { style: { flex: '1 1 260px' } }, [
          el('h3', { text: t('dash.overwhelm') }),
          el('p', { class: 'card-sub', text: t('calm.next_step') })
        ]),
        el('button', { class: 'btn btn-primary', onclick: () => toggleCalm(true) },
          [icon('fa-dove'), el('span', { text: t('mode.calm') })])
      ])
    ]));
  }

  /* Dispute pin (§7.12) */
  const openDisputes = S.state.disputes.filter(d => d.status === 'open');
  if (openDisputes.length) {
    grid.appendChild(el('section', { class: 'card col-12' }, [
      el('div', { class: 'row between' }, [
        el('div', {}, [
          el('h3', {}, [icon('fa-comments'), el('span', { text: ' ' + t('widget.disputes') }), el('span', { class: 'wid', text: 'W-13' })]),
          el('p', { class: 'card-sub', text: t('flow.dispute_neutral') })
        ]),
        el('button', { class: 'btn', text: t('action.open'), onclick: () => go('#/inbox') })
      ]),
      el('ul', { class: 'listy' }, openDisputes.slice(0, 3).map(d => {
        const c = S.commitmentOf(d.commitment_id);
        return c ? commitmentRow(c, F.openDetail) : null;
      }).filter(Boolean))
    ]));
  }

  /* Calm / one-step card — always first, always visible */
  if (calm || persona === 'overwhelm' || persona === 'heavy') grid.appendChild(oneStepCard());

  /* ZONE A+B — clarity and what needs a response: never collapsed by default */
  const netCard = wrapCol(netPositionWidget(), 'col-8');
  netCard.dataset.tour = 'net';
  const clarityCard = wrapCol(clarityWidget(), 'col-4');
  clarityCard.dataset.tour = 'clarity';
  const queueCard = wrapCol(actionQueueWidget(), 'col-8');
  queueCard.dataset.tour = 'queue';
  grid.append(netCard, clarityCard, queueCard, wrapCol(nextDueWidget(), 'col-4'));

  /* ZONE C+D — what is coming, and who it is with */
  grid.appendChild(zone('time', t('views.what_s_coming_who'), [
    wrapCol(timelineWidget(), 'col-8'),
    wrapCol(peopleWidget(), 'col-4')
  ]));

  /* ZONE E — non-monetary modules + respite + plan */
  const promises = S.byModule('promises');
  const services = S.byModule('services');
  const trusts = S.byModule('trusts');
  const respites = S.state.respites.filter(r => r.status === 'pending');
  const zoneE = [
    promises.length ? wrapCol(moduleWidget('promises', 'W-07', t('widget.promises'), 'fa-comment-dots', promises), 'col-4 col-m6') : null,
    services.length ? wrapCol(moduleWidget('services', 'W-08', t('widget.services'), 'fa-clock-rotate-left', services), 'col-4 col-m6') : null,
    trusts.length ? wrapCol(moduleWidget('trusts', 'W-09', t('widget.trusts'), 'fa-box-archive', trusts), 'col-4 col-m6') : null,
    respites.length ? wrapCol(respiteWidget(respites), 'col-6 col-m6') : null,
    S.getPlan() ? wrapCol(planWidget(), 'col-6 col-m6') : null
  ].filter(Boolean);
  if (zoneE.length) {
    grid.appendChild(zone('modules', t('views.promises_services_trusts_plans'), zoneE));
  }

  /* ZONE F — progress & wellbeing: opt-in, so the money view stays uncluttered */
  grid.appendChild(zone('wellbeing', t('views.progress_wellbeing'), [
    wrapCol(closureWidget(), 'col-8'),
    wrapCol(checkinWidget(), 'col-4'),
    S.unitExposure().length >= 2 ? wrapCol(exposureWidget(), 'col-6 col-m6') : null,
    wrapCol(insightsWidget(), 'col-6 col-m6'),
    wrapCol(reflectionWidget(), 'col-6 col-m6'),
    S.openCommitments().length >= 5 ? wrapCol(estateWidget(), 'col-6 col-m6') : null,
    vaultGaps().length ? wrapCol(vaultWidget(), 'col-6 col-m6') : null
  ], { defaultOpen: false }));

  /* ZONE G */
  if (s.islamic_mode) {
    grid.appendChild(zone('islamic', t('nav.islamic'), [wrapCol(duaWidget(), 'col-12')]));
  }

  grid.appendChild(el('div', { class: 'col-12' }, [disclaimer('legal')]));
  return grid;
}

function wrapCol(node, cls) { if (node) node.classList.add(...cls.split(' ')); return node; }

function renderEmptyDashboard() {
  const wrap = el('div', { class: 'grid fade-in' });
  wrap.appendChild(el('section', { class: 'card col-12 card-hero' }, [
    el('h2', { text: t('onboarding.welcome_title') }),
    el('p', { text: t('app.mission') }),
    el('div', { class: 'row tight' }, [
      el('button', { class: 'btn', onclick: () => go('#/onboarding') },
        [icon('fa-brain'), el('span', { text: t('onboarding.start') })]),
      el('button', { class: 'btn', onclick: () => F.openQuickAdd() },
        [icon('fa-plus'), el('span', { text: t('action.add') })]),
      el('button', { class: 'btn', onclick: () => go('#/demo') },
        [icon('fa-wand-magic-sparkles'), el('span', { text: t('set.seed') })]),
      el('button', { class: 'btn', onclick: () => go('#/guide') },
        [icon('fa-graduation-cap'), el('span', { text: t('guide.open') })])
    ])
  ]));
  wrap.appendChild(el('section', { class: 'card col-12' }, [
    emptyState('fa-feather-pointed', t('ledger.empty'), t('onboarding.welcome'))
  ]));
  return wrap;
}

/* ---- the "one kind next step" (§7.10) ---- */
function pickNextStep() {
  const q = S.actionQueue();
  if (q.length) return { kind: q[0].kind, c: q[0].commitment, why: t('widget.action_queue') };
  const due = S.nextDue();
  if (due) return { kind: 'due', c: due, why: t('widget.next_due') };
  const smallest = S.openCommitments()
    .filter(c => c.direction === 'I_OWE' && c.amount_minor)
    .sort((a, b) => S.remainingMinor(a) - S.remainingMinor(b))[0];
  if (smallest) return { kind: 'small', c: smallest, why: t('views.smallest_closest_closing') };
  return null;
}
function oneStepCard() {
  const step = pickNextStep();
  const body = step
    ? el('div', { class: 'stack' }, [
        el('div', { class: 'row' }, [
          avatar(S.cpName(step.c.counterparty_id), 0, ''),
          el('div', { style: { flex: '1' } }, [
            el('b', { text: step.c.description || t('type.' + step.c.type) }),
            el('div', {}, [el('small', { text: S.cpName(step.c.counterparty_id) + ' · ' + dueLabel(step.c) })])
          ])
        ]),
        el('div', { class: 'row tight' }, [
          el('button', { class: 'btn btn-primary btn-sm', text: t('action.open'), onclick: () => F.openDetail(step.c.id) }),
          el('button', { class: 'btn btn-sm', text: t('action.record_payment'), onclick: () => F.openRecordPayment(step.c.id) }),
          step.c.direction === 'I_OWE'
            ? el('button', { class: 'btn btn-sm', text: t('action.request_respite'), onclick: () => F.openRequestRespite(step.c.id) })
            : el('button', { class: 'btn btn-sm', text: t('action.remind'), onclick: () => F.openReminder(step.c.id) })
        ])
      ])
    : el('p', { text: t('dash.nothing_due') });
  const c = card({ title: t('calm.next_step'), wid: 'W-03', sub: step ? step.why : null, body, accent: true });
  c.classList.add('col-12');
  return c;
}

/* ---- W-01 Net position ---- */
function netPositionWidget() {
  const s = S.state.settings;
  const rows = S.netPosition();
  const calm = s.calm_mode;
  let body;

  if (calm) {
    const people = new Set(S.openCommitments().map(c => c.counterparty_id)).size;
    body = el('div', { class: 'stack' }, [
      el('div', { class: 'row' }, [
        el('span', { class: 'badge', text: t('count.people', { count: people }) }),
        el('span', { class: 'badge', text: t('count.commitments', { count: S.openCommitments().length }) })
      ]),
      el('p', { class: 'hint', text: t('dash.calm_hidden') })
    ]);
  } else if (!rows.length) {
    body = el('p', { class: 'hint', text: t('misc.nothing_yet') });
  } else {
    /* An aligned numeric table reads far faster than crammed inline labels. */
    const table = el('table', { class: 'unit-table' }, [
      el('thead', {}, [el('tr', {}, [
        el('th', { text: t('add.unit') }),
        el('th', { text: t('dash.i_owe_total') }),
        el('th', { text: t('dash.owed_total') }),
        el('th', { text: t('dash.net') })
      ])]),
      el('tbody', {}, rows.map(r => {
        const tr = el('tr', { tabindex: '0', role: 'link',
          'aria-label': unitShort(r.unit) + ' — ' + t('count.commitments', { count: r.count }) });
        const open = () => go('#/ledger?unit=' + r.unit);
        tr.addEventListener('click', open);
        tr.addEventListener('keydown', e => { if (e.key === 'Enter') open(); });
        tr.append(
          el('td', {}, [
            el('b', { text: unitShort(r.unit) }),
            el('div', {}, [el('small', { text: t('count.commitments', { count: r.count }), style: { color: 'var(--text-3)' } })])
          ]),
          el('td', { 'data-label': t('dash.i_owe_total'), style: { color: 'var(--owe)' } }, [amountEl(r.owe, r.unit, { calmHide: true })]),
          el('td', { 'data-label': t('dash.owed_total'), style: { color: 'var(--owed)' } }, [amountEl(r.owed, r.unit, { calmHide: true })]),
          el('td', { 'data-label': t('dash.net') }, [el('span', { class: 'badge ' + (r.net >= 0 ? 'badge-owed' : 'badge-owe') },
            [amountEl(Math.abs(r.net), r.unit, { calmHide: true })])])
        );
        return tr;
      }))
    ]);
    body = el('div', { class: 'stack' }, [el('div', { class: 'table-scroll' }, [table])]);
    if (s.converted_totals) {
      const conv = S.convertedTotal(s.base_currency);
      body.appendChild(el('div', { class: 'card', style: { background: 'var(--surface-2)' } }, [
        el('div', { class: 'row between' }, [
          el('b', { text: t('dash.converted_view') + ' · ' + s.base_currency }),
          el('span', {}, [
            el('span', { text: t('dash.net') + ' ' }),
            amountEl(conv.net, s.base_currency)
          ])
        ]),
        el('p', { class: 'hint', text: fxNotice(rows[0]?.unit || s.base_currency, s.base_currency) })
      ]));
    }
  }

  return card({
    title: t('widget.net_position'), wid: 'W-01',
    sub: t('widget.net_position.sub'),
    actions: [
      el('button', { class: 'btn btn-sm btn-ghost', title: t('set.converted'), onclick: async () => {
        await S.saveSettings({ converted_totals: !S.state.settings.converted_totals });
      } }, [icon('fa-right-left')]),
      el('button', { class: 'btn btn-sm btn-ghost', title: t('dash.hide_amounts'), onclick: async () => {
        await S.saveSettings({ blur_amounts: !S.state.settings.blur_amounts });
      } }, [icon(S.state.settings.blur_amounts ? 'fa-eye' : 'fa-eye-slash')])
    ],
    body
  });
}

/* ---- W-02 Clarity ---- */
function clarityWidget() {
  const cl = S.clarityScore();
  const labels = {
    due: t('views.without_due_date'),
    ack: t('views.not_acknowledged'),
    desc: t('views.without_description'),
    exact: t('views.approximate'),
    fresh: t('views.stale'),
    evidence: t('views.without_evidence')
  };
  const missing = cl.checks.filter(c => c.missing > 0);
  return card({
    title: t('widget.clarity'), wid: 'W-02', sub: t('widget.clarity.sub'),
    body: el('div', { class: 'stack' }, [
      el('div', { class: 'row' }, [
        meterRing(cl.score, t('widget.clarity')),
        el('div', { style: { flex: '1' } }, [
          el('b', { text: t('dash.clarity_checklist') }),
          missing.length
            ? el('ul', { class: 'listy' }, missing.slice(0, 4).map(m => el('li', {}, [
                el('button', { class: 'item-row', onclick: () => go('#/ledger') }, [
                  icon('fa-circle-dot'),
                  el('span', { class: 'item-main' }, [
                    el('small', { text: formatNumber(m.missing) + ' · ' + labels[m.key] })
                  ])
                ])
              ])))
            : el('p', { class: 'hint', text: t('views.records_are_complete_well') })
        ])
      ])
    ])
  });
}

/* ---- W-03 Next due ---- */
function nextDueWidget() {
  const c = S.nextDue();
  return card({
    title: t('widget.next_due'), wid: 'W-03',
    body: c ? el('div', { class: 'stack' }, [
      el('div', { class: 'row' }, [
        avatar(S.cpName(c.counterparty_id), 1),
        el('div', { style: { flex: '1' } }, [
          el('b', { text: S.cpName(c.counterparty_id) }),
          el('div', {}, [el('small', { text: c.description || t('type.' + c.type) })])
        ])
      ]),
      c.amount_minor ? amountEl(S.remainingMinor(c), c.unit_code, { size: 'amount-lg', calmHide: true }) : null,
      el('span', { class: 'badge badge-needs', text: dueLabel(c) }),
      el('div', { class: 'row tight' }, [
        el('button', { class: 'btn btn-sm btn-primary', text: t('action.record_payment'), onclick: () => F.openRecordPayment(c.id) }),
        c.direction === 'I_OWE'
          ? el('button', { class: 'btn btn-sm', text: t('action.request_respite'), onclick: () => F.openRequestRespite(c.id) })
          : el('button', { class: 'btn btn-sm', text: t('action.grant_respite'), onclick: () => F.openGrantRespite(c.id) })
      ])
    ]) : el('p', { class: 'hint', text: t('dash.nothing_due') })
  });
}

/* ---- W-04 Action queue (never hidden while items wait) ---- */
function actionQueueWidget() {
  const q = S.actionQueue();
  const kindLabel = {
    confirm: t('views.awaiting_confirmation'),
    respite: t('inbox.respite'),
    dispute: t('inbox.disputes'),
    settlement: t('inbox.settlements'),
    ptp: t('inbox.overdue_ptp')
  };
  const body = q.length
    ? el('ul', { class: 'listy' }, q.slice(0, 6).map(item => el('li', {}, [
        el('div', { class: 'item-row', style: { cursor: 'default' } }, [
          icon(item.kind === 'respite' ? 'fa-clock' : item.kind === 'dispute' ? 'fa-comments'
             : item.kind === 'settlement' ? 'fa-handshake' : item.kind === 'ptp' ? 'fa-calendar-xmark' : 'fa-circle-question'),
          el('span', { class: 'item-main' }, [
            el('b', { text: S.cpName(item.commitment.counterparty_id) + ' · ' + (item.commitment.description || t('type.' + item.commitment.type)) }),
            el('small', { text: kindLabel[item.kind] })
          ]),
          el('span', { class: 'row tight' }, [
            el('button', { class: 'btn btn-sm btn-primary', text: t('action.open'), onclick: () => queueAction(item) }),
            el('button', { class: 'btn btn-sm btn-ghost', title: t('action.snooze'),
              onclick: () => { S.snoozeItem(item.commitment.id, 3); toast(t('action.snooze')); } }, [icon('fa-clock-rotate-left')])
          ])
        ])
      ])))
    : el('p', { class: 'hint', text: t('dash.queue_empty') });
  return card({
    title: t('widget.action_queue'), wid: 'W-04',
    sub: t('count.items_need', { count: q.length }),
    body
  });
}
function queueAction(item) {
  if (item.kind === 'respite') F.openGrantRespite(item.commitment.id, item.respite.id);
  else if (item.kind === 'settlement') {
    confirmSheet({
      title: t('inbox.settlements'),
      message: (item.settlement.new_terms.note || '') + ' — ' +
        formatAmount(item.settlement.new_terms.amount_minor, item.settlement.new_terms.unit_code),
      confirmLabel: t('flows.both_agreed'),
      onConfirm: async () => { await S.acceptSettlement(item.settlement.id); toast(t('status.settled'), 'good'); }
    });
  }
  else if (item.kind === 'confirm') F.openShare(item.commitment.id);
  else F.openDetail(item.commitment.id);
}

/* ---- W-05 Timeline ---- */
function timelineWidget() {
  const items = S.upcoming(30);
  const body = items.length
    ? el('div', { class: 'timeline' }, items.slice(0, 10).map(i => {
        const overdue = i.days < 0;
        return el('div', { class: 'tl-item ' + (overdue ? 'warn' : '') }, [
          el('b', {}, [
            el('span', { text: S.cpName(i.commitment.counterparty_id) + ' — ' }),
            i.commitment.amount_minor
              ? amountEl(i.installment ? i.installment.amount_minor : S.remainingMinor(i.commitment), i.commitment.unit_code, { calmHide: true })
              : el('span', { text: i.commitment.description || t('type.' + i.commitment.type) })
          ]),
          el('small', { text: formatDateDual(i.on) + ' · ' + (i.kind === 'installment' ? t('add.installments') : t('add.due')) }),
          el('button', { class: 'btn btn-sm btn-ghost', text: t('action.open'), onclick: () => F.openDetail(i.commitment.id) })
        ]);
      }))
    : el('p', { class: 'hint', text: t('dash.nothing_due') });
  return card({ title: t('widget.upcoming'), wid: 'W-05', body,
    actions: [el('button', { class: 'btn btn-sm btn-ghost', text: t('nav.calendar'), onclick: () => go('#/calendar') })] });
}

/* ---- W-06 People ---- */
function peopleWidget() {
  const people = S.peopleSummary().slice(0, 8);
  const body = people.length
    ? el('div', { class: 'scroller-wrap' }, [el('div', { class: 'scroller' }, people.map((p, idx) => el('button', {
        class: 'person-card', onclick: () => go('#/people?id=' + p.cp.id)
      }, [
        el('div', { class: 'row tight' }, [
          avatar(p.cp.alias, idx, 'sm'),
          el('b', { text: p.cp.alias, style: { fontSize: '.9rem' } })
        ]),
        el('small', { text: p.cp.relationship_label || t('people.kind.' + p.cp.kind), style: { color: 'var(--text-3)' } }),
        el('div', { class: 'stack', style: { gap: '2px', marginTop: '6px' } },
          Object.entries(p.balances).slice(0, 2).map(([u, v]) =>
            el('span', { class: 'badge ' + (v >= 0 ? 'badge-owed' : 'badge-owe') }, [
              amountEl(Math.abs(v), u, { calmHide: true })
            ]))),
        p.cp.relationship_health ? el('div', { class: 'stars', style: { marginTop: '6px' } },
          [1,2,3,4,5].map(n => el('span', { class: n <= p.cp.relationship_health ? 'on' : '',
            style: { color: n <= p.cp.relationship_health ? '#f59e0b' : 'var(--text-3)', fontSize: '.7rem' } }, [icon('fa-star')]))) : null
      ])))])
    : el('p', { class: 'hint', text: t('people.none') });
  return card({ title: t('widget.people'), wid: 'W-06', body,
    actions: [el('button', { class: 'btn btn-sm btn-ghost', text: t('action.view_all'), onclick: () => go('#/people') })] });
}

/* ---- W-07/08/09 modules ---- */
function moduleWidget(route, wid, title, iconName, items) {
  const open = items.filter(c => S.OPEN_STATUSES.includes(c.status));
  return card({
    title, wid,
    body: el('div', { class: 'stack' }, [
      el('div', { class: 'row tight' }, [
        icon(iconName), el('span', { class: 'badge', text: t('count.commitments', { count: open.length }) })
      ]),
      el('ul', { class: 'listy' }, open.slice(0, 4).map(c => commitmentRow(c, F.openDetail)))
    ]),
    actions: [el('button', { class: 'btn btn-sm btn-ghost', text: t('action.view_all'), onclick: () => go('#/' + route) })]
  });
}

/* ---- W-12 Respite ---- */
function respiteWidget(respites) {
  return card({
    title: t('widget.respite'), wid: 'W-12',
    body: el('ul', { class: 'listy' }, respites.map(r => {
      const c = S.commitmentOf(r.commitment_id);
      if (!c) return null;
      return el('li', {}, [
        el('div', { class: 'item-row', style: { cursor: 'default' } }, [
          icon('fa-clock'),
          el('span', { class: 'item-main' }, [
            el('b', { text: S.cpName(c.counterparty_id) }),
            el('small', { text: (r.reason || '—') + ' · ' + formatDateDual(r.proposed_due_on) })
          ]),
          el('button', { class: 'btn btn-sm btn-good', text: t('action.grant_respite'),
            onclick: () => F.openGrantRespite(c.id, r.id) })
        ])
      ]);
    }).filter(Boolean))
  });
}

/* ---- W-10 Plan ---- */
function planWidget() {
  const plan = S.getPlan();
  const months = S.monthsToClear() || {};
  const order = S.planOrder(plan.strategy).slice(0, 3);
  return card({
    title: t('widget.plan'), wid: 'W-10',
    sub: t('plan.' + plan.strategy),
    body: el('div', { class: 'stack' }, [
      ...Object.entries(months).map(([u, m]) =>
        el('div', { class: 'row between' }, [
          el('span', { class: 'badge', text: unitShort(u) }),
          el('small', { text: t('plan.months_to_clear', { count: m }) })
        ])),
      el('ul', { class: 'listy' }, order.map(c => commitmentRow(c, F.openDetail)))
    ]),
    actions: [el('button', { class: 'btn btn-sm btn-ghost', text: t('action.open'), onclick: () => go('#/plans') })]
  });
}

/* ---- W-11 Fulfilled & released ---- */
function closureWidget() {
  const items = S.closureWall(6);
  return card({
    title: t('widget.fulfilled_wall'), wid: 'W-11',
    body: items.length
      ? el('ul', { class: 'listy' }, items.map(c => el('li', {}, [
          el('button', { class: 'item-row', onclick: () => F.openDetail(c.id) }, [
            icon(c.status === 'released' ? 'fa-dove' : 'fa-circle-check', 'fa-fw'),
            el('span', { class: 'item-main' }, [
              el('b', { text: S.cpName(c.counterparty_id) + ' · ' + (c.description || t('type.' + c.type)) }),
              el('small', { text: formatDateDual(new Date(c.closed_at || c.updated_at).toISOString().slice(0, 10)) })
            ]),
            statusBadge(c.status)
          ])
        ])))
      : el('p', { class: 'hint', text: t('views.every_closure_will_appear') })
  });
}

/* ---- W-15 Check-in ---- */
function checkinWidget() {
  const latest = S.latestCheckin();
  const recent = [...S.state.checkins].sort((a, b) => a.at - b.at).slice(-12).map(c => c.score);
  const today = S.todayISO();
  const answeredToday = latest && latest.on === today;
  const body = el('div', { class: 'stack' }, [
    el('p', { class: 'card-sub', text: t('widget.checkin') }),
    answeredToday
      ? el('p', { class: 'hint', text: t('checkin.thanks') })
      : el('div', { class: 'row tight' }, [1,2,3,4,5].map(n => el('button', {
          class: 'chip', 'aria-label': String(n),
          onclick: async () => { await S.addCheckin(n); toast(t('checkin.thanks'), 'good'); }
        }, [el('span', { text: formatNumber(n) })]))),
    el('div', { class: 'row tight' }, [
      el('small', { text: t('checkin.1'), style: { color: 'var(--text-3)' } }),
      el('span', { style: { flex: '1' } }),
      el('small', { text: t('checkin.5'), style: { color: 'var(--text-3)' } })
    ]),
    recent.length > 1 ? el('div', {}, [
      el('small', { text: t('checkin.trend'), style: { color: 'var(--text-3)' } }),
      sparkline(recent, 5)
    ]) : null
  ]);
  return card({ title: t('widget.checkin'), wid: 'W-15', body });
}

/* ---- W-16 Reflection ---- */
function reflectionWidget() {
  const v = new VAL.Validator();
  const moved = input({ placeholder: t('reflect.moved'), maxlength: '200' });
  const next = input({ placeholder: t('reflect.next'), maxlength: '200' });
  const kind = input({ placeholder: t('reflect.kindness'), maxlength: '200' });
  const err = el('div', { class: 'err' });
  [moved, next, kind].forEach(c => v.rule(c, VAL.optionalText(c, 200), { label: t('widget.reflection') }));
  const last = [...S.state.reflections].sort((a, b) => b.at - a.at)[0];
  return card({
    title: t('widget.reflection'), wid: 'W-16',
    body: el('div', { class: 'stack' }, [
      last ? el('p', { class: 'hint', text: `${formatDate(new Date(last.at).toISOString().slice(0,10))} · ${last.moved || ''}` }) : null,
      moved, next, kind, err,
      el('button', { class: 'btn btn-sm btn-primary', text: t('action.save'), onclick: async () => {
        err.replaceChildren();
        if (!v.check()) return;
        if (!moved.value.trim() && !next.value.trim() && !kind.value.trim()) {
          err.append(icon('fa-circle-exclamation'), el('span', { text: t('views.write_at_least_one') }));
          moved.focus();
          return;
        }
        await S.addReflection(moved.value.trim(), next.value.trim(), kind.value.trim());
        moved.value = next.value = kind.value = '';
        toast(t('misc.saved'), 'good');
      } })
    ])
  });
}

/* ---- W-17 Estate ---- */
function estateWidget() {
  const e = S.estateReadiness();
  const s = S.state.settings;
  return card({
    title: t('widget.estate'), wid: 'W-17',
    body: el('div', { class: 'stack' }, [
      progressBar(e.pct, e.pct >= 80),
      el('div', { class: 'row between' }, [
        el('small', { text: t('estate.readiness') + ': ' + formatNumber(e.pct) + '%' }),
        el('small', { text: t('estate.executor') + ': ' + (s.executor_name || t('misc.none')) })
      ]),
      el('button', { class: 'btn btn-sm', text: t('estate.generate'), onclick: () => go('#/reports') })
    ])
  });
}

/* ---- W-14 Vault ---- */
function vaultGaps() {
  const th = S.state.settings.evidence_threshold_minor;
  return S.openCommitments().filter(c => (c.amount_minor || 0) >= th && !S.evidenceOf(c.id).length);
}
function vaultWidget() {
  const gaps = vaultGaps();
  return card({
    title: t('widget.vault_status'), wid: 'W-14',
    body: el('div', { class: 'stack' }, [
      el('p', { class: 'hint', text: t('vault.missing') + ': ' + formatNumber(gaps.length) }),
      el('ul', { class: 'listy' }, gaps.slice(0, 3).map(c => commitmentRow(c, F.openDetail))),
      el('button', { class: 'btn btn-sm', text: t('action.open'), onclick: () => go('#/vault') })
    ])
  });
}

/* ---- W-19 Exposure ---- */
function exposureWidget() {
  const rows = S.unitExposure();
  const max = Math.max(...rows.map(r => r.count));
  return card({
    title: t('widget.exposure'), wid: 'W-19',
    body: el('div', { class: 'stack' }, rows.map(r => el('div', {}, [
      el('div', { class: 'row between' }, [
        el('small', { text: unitShort(r.unit) + ' · ' + t('count.commitments', { count: r.count }) }),
        isMonetary(r.unit) ? el('small', {}, [amountEl(r.minor, r.unit, { calmHide: true })]) : null
      ]),
      progressBar(Math.round(r.count / max * 100))
    ])))
  });
}

/* ---- W-20 Insights ---- */
function insightsWidget() {
  const list = S.insights();
  const ins = list[0];
  return card({
    title: t('widget.insights'), wid: 'W-20',
    body: ins
      ? el('div', { class: 'stack' }, [
          el('p', { text: C.insightText(ins) }),
          el('div', { class: 'row tight' }, [
            el('button', { class: 'btn btn-sm btn-primary', text: t('action.open'), onclick: () => go(ins.route) }),
            el('button', { class: 'btn btn-sm btn-ghost', text: t('views.dismiss'), onclick: async () => {
              const d = [...(S.state.settings.insights_dismissed || []), ins.id];
              await S.saveSettings({ insights_dismissed: d });
            } })
          ])
        ])
      : el('p', { class: 'hint', text: t('views.no_tips_today_everything') })
  });
}

/* ---- W-18 Du'a & intention ---- */
function duaWidget() {
  const d = C.duaOfDay();
  return card({
    title: t('widget.dua'), wid: 'W-18',
    body: el('div', { class: 'stack' }, [
      ayahBlock(d),
      el('div', { class: 'row tight' }, [
        el('button', { class: 'btn btn-sm btn-primary', text: t('islamic.renew'), onclick: async () => {
          await S.saveSettings({ last_intention_at: Date.now() });
          toast(t('islamic.renewed'), 'good');
        } }),
        el('button', { class: 'btn btn-sm', text: t('nav.islamic'), onclick: () => go('#/islamic') })
      ]),
      el('p', { class: 'notice', text: t('fiqh.disclaimer') })
    ])
  });
}

export async function toggleCalm(on) {
  await S.saveSettings({ calm_mode: on === undefined ? !S.state.settings.calm_mode : on });
}

/* ======================================================================
   LEDGER
   ====================================================================== */
export function renderLedger(params) {
  const wrap = el('div', { class: 'stack fade-in' });
  let dirFilter = params.get('dir') || 'all';
  let unitFilter = params.get('unit') || 'all';
  let special = params.get('filter') || '';
  let showClosed = params.get('closed') === '1';
  let query = '';
  let sort = 'due';

  const listBox = el('div');

  const render = () => {
    let items = showClosed ? S.closedCommitments() : S.openCommitments();
    if (dirFilter !== 'all') items = items.filter(c => c.direction === dirFilter);
    if (unitFilter !== 'all') items = items.filter(c => c.unit_code === unitFilter);
    if (special === 'no_due') items = items.filter(c => !c.due_on && c.due_mode === 'none');
    if (special === 'approximate') items = items.filter(c => c.approximate);
    if (query) {
      const q = query.toLowerCase();
      items = items.filter(c => (c.description || '').toLowerCase().includes(q) ||
        (S.cpName(c.counterparty_id) || '').toLowerCase().includes(q) ||
        t('type.' + c.type).toLowerCase().includes(q));
    }
    const sorters = {
      due: (a, b) => (a.due_on || '9999') < (b.due_on || '9999') ? -1 : 1,
      amount: (a, b) => S.remainingMinor(b) - S.remainingMinor(a),
      recent: (a, b) => (b.created_at || 0) - (a.created_at || 0),
      person: (a, b) => S.cpName(a.counterparty_id).localeCompare(S.cpName(b.counterparty_id))
    };
    items = [...items].sort(sorters[sort]);

    listBox.replaceChildren(items.length
      ? el('ul', { class: 'listy' }, items.map(c => commitmentRow(c, F.openDetail)))
      : emptyState('fa-feather-pointed', t('ledger.empty'), t('onboarding.rough'),
          el('button', { class: 'btn btn-primary', text: t('action.add'), onclick: () => F.openQuickAdd() })));
  };

  const searchInput = input({ type: 'search', placeholder: t('ledger.search'), id: 'search-input',
    oninput: e => { query = e.target.value; render(); } });

  const dirChips = el('div');
  const renderDirChips = () => dirChips.replaceChildren(chipGroup([
    { value: 'all', label: t('ledger.all') },
    { value: 'I_OWE', label: t('dir.i_owe') },
    { value: 'OWED_TO_ME', label: t('dir.owed_to_me') },
    { value: 'MUTUAL', label: t('dir.mutual') }
  ], dirFilter, v => { dirFilter = v; renderDirChips(); render(); }));
  renderDirChips();

  const units = [...new Set(S.visibleCommitments().map(c => c.unit_code))];
  const unitSel = select([{ value: 'all', label: t('misc.all_units') },
    ...units.map(u => ({ value: u, label: unitShort(u), selected: u === unitFilter }))],
    { onchange: e => { unitFilter = e.target.value; render(); }, style: { width: 'auto' } });

  const sortSel = select([
    { value: 'due', label: t('ledger.sort.due') },
    { value: 'amount', label: t('ledger.sort.amount') },
    { value: 'recent', label: t('ledger.sort.recent') },
    { value: 'person', label: t('ledger.sort.person') }
  ], { onchange: e => { sort = e.target.value; render(); }, style: { width: 'auto' } });

  const closedToggle = el('button', { class: 'chip' + (showClosed ? ' on' : ''),
    onclick: () => { showClosed = !showClosed; closedToggle.classList.toggle('on', showClosed); render(); } },
    [icon('fa-box-archive'), el('span', { text: t('ledger.closed') })]);

  wrap.append(
    el('div', { class: 'row between' }, [
      el('h1', { text: t('nav.ledger') }),
      el('button', { class: 'btn btn-primary', onclick: () => F.openQuickAdd() },
        [icon('fa-plus'), el('span', { text: t('action.add_short') })])
    ]),
    el('section', { class: 'card' }, [
      el('div', { class: 'stack' }, [
        searchInput,
        el('div', { 'data-tour': 'ledger-dir' }, [dirChips]),
        el('div', { class: 'row tight ledger-tools', 'data-tour': 'ledger-tools' }, [unitSel, sortSel, closedToggle])
      ])
    ]),
    el('section', { class: 'card flush', 'data-tour': 'ledger-list' }, [listBox]),
    disclaimer('legal')
  );
  render();
  return wrap;
}

/* ======================================================================
   PEOPLE
   ====================================================================== */
export function renderPeople(params) {
  const id = params.get('id');
  if (id) return renderPersonDetail(id);
  const people = S.peopleSummary();
  const wrap = el('div', { class: 'stack fade-in' }, [
    el('div', { class: 'row between' }, [
      el('h1', { text: t('nav.people') }),
      el('button', { class: 'btn btn-primary', type: 'button', 'data-tour': 'people-new', onclick: () => F.openCounterparty() },
        [icon('fa-user-plus'), el('span', { text: t('people.new') })])
    ]),
    el('p', { class: 'notice', text: t('views.counterparties_are_people_never') }),
    people.length
      ? el('section', { class: 'card flush', 'data-tour': 'people-list' }, [
          el('ul', { class: 'listy' }, people.map((p, idx) => el('li', {}, [
            el('button', { class: 'item-row', onclick: () => go('#/people?id=' + p.cp.id) }, [
              avatar(p.cp.alias, idx),
              el('span', { class: 'item-main' }, [
                el('b', { text: p.cp.alias }),
                el('small', { text: (p.cp.relationship_label || t('people.kind.' + p.cp.kind)) + ' · ' +
                  t('count.commitments', { count: p.open }) })
              ]),
              el('span', { class: 'item-end row tight' }, Object.entries(p.balances).slice(0, 2).map(([u, v]) =>
                el('span', { class: 'badge ' + (v >= 0 ? 'badge-owed' : 'badge-owe') }, [amountEl(Math.abs(v), u, { calmHide: true })])))
            ])
          ])))
        ])
      : el('section', { class: 'card' }, [emptyState('fa-users', t('people.none'), '')])
  ]);
  return wrap;
}

function renderPersonDetail(id) {
  const cp = S.cpOf(id);
  if (!cp) return el('div', { class: 'card' }, [emptyState('fa-user-slash', t('people.none'), '')]);
  const items = S.visibleCommitments().filter(c => c.counterparty_id === id);
  const open = items.filter(c => S.OPEN_STATUSES.includes(c.status));
  const balances = {};
  open.forEach(c => {
    balances[c.unit_code] = (balances[c.unit_code] || 0) + (c.direction === 'I_OWE' ? -1 : 1) * S.remainingMinor(c);
  });

  return el('div', { class: 'stack fade-in' }, [
    el('button', { class: 'btn btn-sm btn-ghost', type: 'button', style: { alignSelf: 'flex-start' }, onclick: () => go('#/people') },
      [icon(document.documentElement.dir === 'rtl' ? 'fa-arrow-right' : 'fa-arrow-left'), el('span', { text: t('action.back') })]),
    el('section', { class: 'card' }, [
      el('div', { class: 'row' }, [
        avatar(cp.alias, 2, 'lg'),
        el('div', { style: { flex: '1' } }, [
          el('h1', { text: cp.alias, style: { margin: '0' } }),
          el('p', { class: 'card-sub', text: (cp.relationship_label || t('people.kind.' + cp.kind)) })
        ]),
        el('button', { class: 'btn btn-sm', text: t('action.edit'), onclick: () => F.openCounterparty(id) })
      ]),
      el('div', { class: 'row tight' }, Object.entries(balances).map(([u, v]) =>
        el('span', { class: 'badge ' + (v >= 0 ? 'badge-owed' : 'badge-owe') }, [
          el('span', { text: (v >= 0 ? t('dir.owed_to_me') : t('dir.i_owe')) + ' ' }),
          amountEl(Math.abs(v), u, { calmHide: true })
        ]))),
      cp.relationship_health ? el('div', { class: 'row tight' }, [
        el('small', { text: t('people.health') + ':' }),
        el('div', { class: 'stars' }, [1,2,3,4,5].map(n =>
          el('span', { class: n <= cp.relationship_health ? 'on' : '',
            style: { color: n <= cp.relationship_health ? '#f59e0b' : 'var(--text-3)' } }, [icon('fa-star')])))
      ]) : null,
      el('div', { class: 'row tight' }, [
        el('button', { class: 'btn btn-sm btn-primary', onclick: () => F.openQuickAdd({ counterparty_name: cp.alias }) },
          [icon('fa-plus'), el('span', { text: t('action.add_short') })]),
        open.length ? el('button', { class: 'btn btn-sm', text: t('people.settle_all'),
          onclick: () => F.openSettlement(open[0].id) }) : null
      ])
    ]),
    el('section', { class: 'card flush' }, [
      items.length
        ? el('ul', { class: 'listy' }, items.map(c => commitmentRow(c, F.openDetail)))
        : emptyState('fa-feather-pointed', t('ledger.empty'), '')
    ]),
    disclaimer('legal')
  ]);
}
