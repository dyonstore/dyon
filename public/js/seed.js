/* DYON — demo ledger (the founder persona F-1: many debts, many people, 3 units). */

import * as S from './store.js';
import { toMinor } from './units.js';

const d = (offset) => {
  const x = new Date();
  x.setDate(x.getDate() + offset);
  return x.toISOString().slice(0, 10);
};

export async function seedDemo() {
  const people = [
    { alias: 'Ahmad',   kind: 'person', relationship_label: 'cousin', relationship_health: 4 },
    { alias: 'Sara',    kind: 'person', relationship_label: 'friend', relationship_health: 5 },
    { alias: 'Khalid',  kind: 'person', relationship_label: 'neighbour', relationship_health: 3 },
    { alias: 'Umm Yusuf', kind: 'person', relationship_label: 'mother', relationship_health: 5 },
    { alias: 'Al-Baraka Grocery', kind: 'institution', relationship_label: 'corner shop' },
    { alias: 'Nour',    kind: 'person', relationship_label: 'client', relationship_health: 4 },
    { alias: 'Ibrahim', kind: 'person', relationship_label: 'brother', relationship_health: 5 }
  ];
  const cps = {};
  for (const p of people) cps[p.alias] = await S.upsertCounterparty(p);

  const mk = async (o) => S.createCommitment(o);

  const c1 = await mk({ type: 'T-01', direction: 'I_OWE', counterparty_id: cps['Ahmad'].id,
    unit_code: 'SAR', amount_minor: toMinor('2000', 'SAR'), description: 'Borrowed for the car repair',
    incurred_on: d(-95), due_on: d(12), due_mode: 'date', visibility: 'shared', status: 'active', tone: 'gentle' });

  const c2 = await mk({ type: 'T-01', direction: 'OWED_TO_ME', counterparty_id: cps['Sara'].id,
    unit_code: 'EUR', amount_minor: toMinor('200', 'EUR'), description: 'Lent for the flight home',
    incurred_on: d(-40), due_on: d(5), due_mode: 'date', visibility: 'shared', status: 'proposed' });

  const c3 = await mk({ type: 'T-02', direction: 'I_OWE', counterparty_id: cps['Al-Baraka Grocery'].id,
    unit_code: 'MAD', amount_minor: toMinor('340', 'MAD'), description: 'Shop tab',
    incurred_on: d(-21), due_mode: 'when_able', visibility: 'private', status: 'active', approximate: true });

  const c4 = await mk({ type: 'T-04', direction: 'I_OWE', counterparty_id: cps['Khalid'].id,
    unit_code: 'ITEM', amount_minor: toMinor('1', 'ITEM'), description: "Khalid's drill",
    incurred_on: d(-60), due_mode: 'on_return', visibility: 'private', status: 'active' });

  const c5 = await mk({ type: 'T-07', direction: 'I_OWE', counterparty_id: cps['Umm Yusuf'].id,
    unit_code: 'PROMISE', amount_minor: 0, description: 'Visit every Friday',
    incurred_on: d(-120), due_mode: 'recurring', recurrence: 'friday', visibility: 'private', status: 'active', streak: 6 });

  const c6 = await mk({ type: 'T-05', direction: 'I_OWE', counterparty_id: cps['Nour'].id,
    unit_code: 'HOUR', amount_minor: toMinor('12', 'HOUR'), description: 'Finish the website build',
    incurred_on: d(-30), due_on: d(-3), due_mode: 'date', visibility: 'shared', status: 'active' });

  const c7 = await mk({ type: 'T-08', direction: 'I_OWE', counterparty_id: cps['Ibrahim'].id,
    unit_code: 'SAR', amount_minor: toMinor('5000', 'SAR'), description: "Holding my brother's savings (amānah)",
    incurred_on: d(-200), due_mode: 'on_return', visibility: 'private', status: 'active' });

  const c8 = await mk({ type: 'T-06', direction: 'OWED_TO_ME', counterparty_id: cps['Sara'].id,
    unit_code: 'HOUR', amount_minor: toMinor('8', 'HOUR'), description: 'She covered my shift twice',
    incurred_on: d(-75), due_mode: 'none', visibility: 'private', status: 'active' });

  const c9 = await mk({ type: 'T-09', direction: 'I_OWE', counterparty_id: cps['Khalid'].id,
    unit_code: 'PROMISE', amount_minor: 0, description: 'I owe Khalid an apology',
    incurred_on: d(-14), due_mode: 'none', visibility: 'private', status: 'active' });

  const c10 = await mk({ type: 'T-03', direction: 'OWED_TO_ME', counterparty_id: cps['Nour'].id,
    unit_code: 'EGP', amount_minor: toMinor('4500', 'EGP'), description: 'Invoice for the logo work',
    incurred_on: d(-50), due_on: d(-10), due_mode: 'date', visibility: 'shared', status: 'active' });

  const c11 = await mk({ type: 'T-01', direction: 'I_OWE', counterparty_id: cps['Sara'].id,
    unit_code: 'SAR', amount_minor: toMinor('450', 'SAR'), description: 'Small loan, groceries week',
    incurred_on: d(-10), due_on: d(20), due_mode: 'date', visibility: 'private', status: 'active' });

  const c12 = await mk({ type: 'T-01', direction: 'I_OWE', counterparty_id: cps['Ahmad'].id,
    unit_code: 'SAR', amount_minor: toMinor('800', 'SAR'), description: 'Older loan, fully repaid',
    incurred_on: d(-300), due_on: d(-200), due_mode: 'date', visibility: 'shared', status: 'active' });

  /* history: a partial payment, a fulfilment, a release, a respite, a dispute */
  await S.recordFulfilment(c1.id, toMinor('500', 'SAR'), { on: d(-20), method_note: 'bank transfer' });
  await S.recordFulfilment(c12.id, toMinor('800', 'SAR'), { on: d(-180), method_note: 'cash' });
  await S.setInstallments(c1.id, 3, d(12), 30);

  const resp = await S.requestRespite(c6.id, d(25), 'Client work slipped; I need three more weeks.');
  await S.addPromiseToPay(c3.id, toMinor('340', 'MAD'), d(-2));

  const c13 = await mk({ type: 'T-01', direction: 'OWED_TO_ME', counterparty_id: cps['Khalid'].id,
    unit_code: 'SAR', amount_minor: toMinor('300', 'SAR'), description: 'Lent in Ramadan',
    incurred_on: d(-150), due_mode: 'when_able', visibility: 'shared', status: 'active' });
  await S.releaseCommitment(c13.id, 'full', null, 'As ṣadaqah, seeking reward.');

  const c14 = await mk({ type: 'T-01', direction: 'OWED_TO_ME', counterparty_id: cps['Ahmad'].id,
    unit_code: 'SAR', amount_minor: toMinor('1200', 'SAR'), description: 'Amount we remember differently',
    incurred_on: d(-220), due_mode: 'none', visibility: 'shared', status: 'active' });
  await S.openDispute(c14.id, 'I recall 1,200; he recalls 900. We need to compare notes calmly.');

  await S.addWitness(c1.id, 'Yusuf', 'terms');
  await S.addCheckin(2);
  await S.addCheckin(3);
  await S.addCheckin(3);
  await S.addCheckin(4);

  await S.savePlan({ strategy: 'snowball', capacity: { SAR: toMinor('600', 'SAR') } });
  await S.saveSettings({ onboarded: true, display_name: 'Maher', base_currency: 'SAR', last_unit: 'SAR' });
}
