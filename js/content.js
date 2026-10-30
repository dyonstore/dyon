/* DYON — reviewed content repository (R-I01): every Islamic item carries its
   source and a grading note. Nothing here is a fatwa (§10.1.2).
   Also: tone templates (§7.8), insight copy (W-20) and the NL parser (§7.5). */

import { t, getLocale } from './i18n.js';

/* ---------- Qur'anic & prophetic content (§3.1, §3.2) ---------- */
export const AYAT = [
  { id: '2:282', theme: 'writing', ar: '﴿يَا أَيُّهَا الَّذِينَ آمَنُوا إِذَا تَدَايَنتُم بِدَيْنٍ إِلَىٰ أَجَلٍ مُّسَمًّى فَاكْتُبُوهُ﴾',
    en: '"O you who believe, when you contract a debt for a fixed term, write it down."', src: 'Qur\'an 2:282' },
  { id: '2:280', theme: 'respite', ar: '﴿وَإِن كَانَ ذُو عُسْرَةٍ فَنَظِرَةٌ إِلَىٰ مَيْسَرَةٍ ۚ وَأَن تَصَدَّقُوا خَيْرٌ لَّكُمْ﴾',
    en: '"If the debtor is in hardship, grant respite until ease; and to remit it as charity is better for you."', src: 'Qur\'an 2:280' },
  { id: '2:283', theme: 'trust', ar: '﴿فَلْيُؤَدِّ الَّذِي اؤْتُمِنَ أَمَانَتَهُ وَلْيَتَّقِ اللَّهَ رَبَّهُ﴾',
    en: '"Let the trusted one render the trust, and let him fear God his Lord."', src: 'Qur\'an 2:283' },
  { id: '4:58', theme: 'trust', ar: '﴿إِنَّ اللَّهَ يَأْمُرُكُمْ أَن تُؤَدُّوا الْأَمَانَاتِ إِلَىٰ أَهْلِهَا﴾',
    en: '"God commands you to render trusts to their owners."', src: 'Qur\'an 4:58' },
  { id: '17:34', theme: 'promise', ar: '﴿وَأَوْفُوا بِالْعَهْدِ ۖ إِنَّ الْعَهْدَ كَانَ مَسْئُولًا﴾',
    en: '"Fulfil the covenant; the covenant will be asked about."', src: 'Qur\'an 17:34' },
  { id: '5:1', theme: 'contract', ar: '﴿يَا أَيُّهَا الَّذِينَ آمَنُوا أَوْفُوا بِالْعُقُودِ﴾',
    en: '"O you who believe, fulfil your contracts."', src: 'Qur\'an 5:1' },
  { id: '61:2', theme: 'integrity', ar: '﴿لِمَ تَقُولُونَ مَا لَا تَفْعَلُونَ﴾',
    en: '"Why do you say what you do not do?"', src: 'Qur\'an 61:2–3' },
  { id: '23:8', theme: 'trust', ar: '﴿وَالَّذِينَ هُمْ لِأَمَانَاتِهِمْ وَعَهْدِهِمْ رَاعُونَ﴾',
    en: '"Those who are watchful over their trusts and covenants."', src: 'Qur\'an 23:8' },
  { id: '2:275', theme: 'riba', ar: '﴿وَأَحَلَّ اللَّهُ الْبَيْعَ وَحَرَّمَ الرِّبَا﴾',
    en: '"God has permitted trade and forbidden riba."', src: 'Qur\'an 2:275–279' },
  { id: '4:11', theme: 'estate', ar: '﴿مِن بَعْدِ وَصِيَّةٍ يُوصِي بِهَا أَوْ دَيْنٍ﴾',
    en: 'Inheritance is distributed "after any bequest or debt".', src: 'Qur\'an 4:11–12' },
  { id: '94:5', theme: 'calm', ar: '﴿فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ الْعُسْرِ يُسْرًا﴾',
    en: '"Indeed, with hardship comes ease. Indeed, with hardship comes ease."', src: 'Qur\'an 94:5–6' },
  { id: '4:128', theme: 'settlement', ar: '﴿وَالصُّلْحُ خَيْرٌ﴾',
    en: '"Settlement is better."', src: 'Qur\'an 4:128' }
];

export const HADITH = [
  { id: 'h-intention', theme: 'intention', ar: '«من أخذ أموال الناس يريد أداءها أدّى الله عنه»',
    en: '"Whoever takes people\'s wealth intending to repay it, God will repay on his behalf."',
    src: 'Ṣaḥīḥ al-Bukhārī 2387', grading: 'ṣaḥīḥ (as commonly cited)' },
  { id: 'h-excellence', theme: 'fulfilment', ar: '«إنّ خيارَكم أحسنُكم قضاءً»',
    en: '"The best of you are the best in repaying."',
    src: 'Bukhārī 2305; Muslim 1600', grading: 'ṣaḥīḥ (as commonly cited)' },
  { id: 'h-respite', theme: 'respite', ar: '«من سرّه أن يُنجيه الله من كُرَب يوم القيامة فليُنفِّس عن مُعسرٍ أو يضع عنه»',
    en: '"Whoever would be pleased for God to save him from the distress of the Day of Resurrection, let him relieve one in hardship or remit for him."',
    src: 'Ṣaḥīḥ Muslim 1563', grading: 'ṣaḥīḥ (as commonly cited)' },
  { id: 'h-ease', theme: 'respite', ar: '«ومن يسّر على مُعسرٍ يسّر الله عليه في الدنيا والآخرة»',
    en: '"Whoever eases things for one in difficulty, God will ease things for him in this world and the next."',
    src: 'Ṣaḥīḥ Muslim 2699', grading: 'ṣaḥīḥ (as commonly cited)' },
  { id: 'h-suspended', theme: 'weight', ar: '«نَفْسُ المؤمنِ مُعلَّقةٌ بدَيْنِه حتى يُقضى عنه»',
    en: '"The soul of the believer is suspended by his debt until it is paid on his behalf."',
    src: 'Tirmidhī 1078–1079; Ibn Mājah 2413', grading: 'graded variously; verify (D-002)' },
  { id: 'h-wages', theme: 'wages', ar: '«أعطوا الأجير أجره قبل أن يجفّ عرقه»',
    en: '"Give the worker his wage before his sweat dries."',
    src: 'Ibn Mājah 2443', grading: 'acceptable through supporting chains, per many' },
  { id: 'h-matl', theme: 'delay', ar: '«مَطْلُ الغنيِّ ظُلمٌ»',
    en: '"Procrastination of the wealthy is injustice." (Shown only in your own reflection, never in a message to someone else.)',
    src: 'Bukhārī 2287; Muslim 1564', grading: 'ṣaḥīḥ (as commonly cited)', self_only: true },
  { id: 'h-burden', theme: 'weight', ar: '«وأعوذ بك من ضَلَعِ الدَّيْنِ وغَلَبَةِ الرِّجالِ»',
    en: '"…and I seek refuge in You from the burden of debt and being overpowered by men."',
    src: 'Ṣaḥīḥ al-Bukhārī 6369', grading: 'ṣaḥīḥ', note: 'C-001: the wording «غَلَبَةِ الدَّيْن» appears in other collections, e.g. al-Nasāʾī.' }
];

export const DUAS = [
  { id: 'd-sufficiency', ar: '«اللهم اكفني بحلالك عن حرامك، وأغنني بفضلك عمّن سواك»',
    en: '"O God, suffice me with what You have made lawful against what You have forbidden, and enrich me by Your bounty from all besides You."',
    src: 'Jāmiʿ al-Tirmidhī 3563', grading: 'ḥasan per many' },
  { id: 'd-refuge', ar: '«اللهم إني أعوذ بك من المأثم والمغرم»',
    en: '"O God, I seek refuge in You from sin and from debt."',
    src: 'Bukhārī 832; Muslim 589', grading: 'ṣaḥīḥ' },
  { id: 'd-burden', ar: '«اللهم إني أعوذ بك من الهمّ والحزن، وضَلَعِ الدَّيْنِ وغَلَبَةِ الرِّجال»',
    en: '"O God, I seek refuge in You from anxiety and grief, from the burden of debt and being overpowered by men."',
    src: 'Ṣaḥīḥ al-Bukhārī 6369', grading: 'ṣaḥīḥ' }
];

/* §3.3 — the ethic in one cycle, used in the Islamic corner */
export const ETHIC_CYCLE = [
  { k: 'kitabah', ar: 'اكتبه', en: 'Write it', note: '2:282' },
  { k: 'shahadah', ar: 'أشهِد عليه', en: 'Witness it', note: '2:282–283' },
  { k: 'niyyah', ar: 'انوِ الأداء', en: 'Intend to repay', note: 'Bukhārī 2387' },
  { k: 'husn', ar: 'أحسن القضاء', en: 'Repay with excellence', note: 'Bukhārī 2305' },
  { k: 'inzar', ar: 'اطلب الإنظار عند العجز', en: 'Ask for respite if unable', note: '2:280' },
  { k: 'matl', ar: 'لا تماطل عند القدرة', en: "Don't delay if able", note: 'Muslim 1564' },
  { k: 'ibra', ar: 'أبرئ إن استطعت', en: 'Forgive if you can', note: '2:280; Muslim 1563' },
  { k: 'sulh', ar: 'اصطلحوا عند الخلاف', en: 'Settle when you disagree', note: '4:128' },
  { k: 'riba', ar: 'لا تزد عليه', en: 'Never increase it', note: '2:275–279' },
  { k: 'wasiyyah', ar: 'استعدّ للرحيل', en: 'Prepare for death', note: '4:11–12' }
];

export function ayahFor(theme) {
  const list = AYAT.filter(a => a.theme === theme);
  return list.length ? list[0] : null;
}
export function duaOfDay() {
  const i = Math.floor(Date.now() / 864e5) % DUAS.length;
  return DUAS[i];
}
export function reflectionHadith() {
  const i = Math.floor(Date.now() / 864e5) % HADITH.length;
  return HADITH[i];
}
export function renderSource(obj) {
  const g = obj.grading ? ` · ${obj.grading}` : '';
  return `${obj.src}${g}`;
}

/* ---------- Tone engine templates (§7.8) ----------
   Every template is an ICU message in /locales (tpl.*), so the whole sentence
   is translated as a unit (R-G01). The user always edits and sends it. */
export function reminderTemplate(tone, ctx) {
  const key = ['gentle', 'neutral', 'formal', 'islamic'].includes(tone) ? tone : 'gentle';
  return t('tpl.remind.' + key, { name: ctx.name, amount: ctx.amount, date: ctx.date });
}
/* R-D26: when the debtor has declared hardship, reminders become respite-oriented. */
export function hardshipTemplate(ctx) { return t('tpl.hardship', ctx); }
/* S-20: "Ask for me" templates — framed as the app's routine, still sent by the user */
export function askForMeTemplate(ctx) { return t('tpl.ask_for_me', ctx); }
export function thanksTemplate(ctx) { return t('tpl.thanks', ctx); }
export function releaseTemplate(ctx) { return t('tpl.release', ctx); }
export function respiteRequestTemplate(ctx) { return t('tpl.respite_request', ctx); }

/* ---------- Insight copy (W-20) ---------- */
/* Insight sentences live in /locales as insight.<id> ICU plural messages. */
export const INSIGHT_IDS = ['no_due', 'approximate', 'unshared', 'no_evidence', 'stale', 'no_plan', 'no_executor'];
export function insightText(ins) {
  if (!INSIGHT_IDS.includes(ins.id)) return '';
  return t('insight.' + ins.id, ins);
}

/* ---------- Brain-dump prompts (S-19) ---------- */
export const DUMP_CATEGORIES = [
  { key: 'family', icon: 'fa-people-roof', i18n: 'onboarding.cat.family', type: 'T-01', dir: 'I_OWE' },
  { key: 'friends', icon: 'fa-handshake-angle', i18n: 'onboarding.cat.friends', type: 'T-01', dir: 'I_OWE' },
  { key: 'work', icon: 'fa-briefcase', i18n: 'onboarding.cat.work', type: 'T-03', dir: 'OWED_TO_ME' },
  { key: 'shops', icon: 'fa-store', i18n: 'onboarding.cat.shops', type: 'T-02', dir: 'I_OWE' },
  { key: 'items', icon: 'fa-screwdriver-wrench', i18n: 'onboarding.cat.items', type: 'T-04', dir: 'I_OWE' },
  { key: 'favours', icon: 'fa-hourglass-half', i18n: 'onboarding.cat.favours', type: 'T-06', dir: 'OWED_TO_ME' },
  { key: 'promises', icon: 'fa-comment-dots', i18n: 'onboarding.cat.promises', type: 'T-07', dir: 'I_OWE' },
  { key: 'trusts', icon: 'fa-box-archive', i18n: 'onboarding.cat.trusts', type: 'T-08', dir: 'I_OWE' },
  { key: 'moral', icon: 'fa-heart-crack', i18n: 'onboarding.cat.moral', type: 'T-09', dir: 'I_OWE' },
  { key: 'spiritual', icon: 'fa-mosque', i18n: 'onboarding.cat.spiritual', type: 'T-10', dir: 'I_OWE', islamicOnly: true }
];

/* ---------- Natural-language parser (§7.5) ----------
   A convenience, never an authority: every parsed field is presented for
   confirmation before anything is saved. */
const CUR_WORDS = [
  [/\briyals?\b|ريال/i, ['SAR', 'QAR', 'OMR', 'YER', 'IRR']],
  [/\bdirhams?\b|درهم/i, ['AED', 'MAD']],
  [/\bdinars?\b|دينار/i, ['KWD', 'BHD', 'JOD', 'IQD', 'DZD', 'TND']],
  [/\beuros?\b|€|يورو/i, ['EUR']],
  [/\bdollars?\b|\$|دولار/i, ['USD']],
  [/\bpounds?\b|£|جنيه/i, ['EGP', 'GBP', 'SDG']],
  [/\bliras?\b|ليرة/i, ['TRY', 'SYP', 'LBP']],
  [/\brupees?\b|روبية/i, ['PKR', 'INR']],
  [/\bringgit\b/i, ['MYR']],
  [/\brupiah\b/i, ['IDR']],
  [/\btaka\b/i, ['BDT']]
];

function arabicToLatinDigits(s) {
  return s.replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c))
          .replace(/[۰-۹]/g, c => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c));
}

export function parseNaturalLanguage(input, defaults = {}) {
  const raw = (input || '').trim();
  const s = arabicToLatinDigits(raw);
  const res = {
    direction: defaults.direction || 'I_OWE',
    counterparty_name: '',
    amount: null,
    unit_candidates: [],
    unit_code: null,
    type: 'T-01',
    due_on: null,
    due_mode: 'none',
    recurrence: null,
    description: raw,
    confidence: []
  };

  /* direction */
  if (/\b(lent|loaned|gave|owes me|owe me)\b/i.test(s) || /أقرضت|أعطيت|لي عند|سلّفت/.test(s)) {
    res.direction = 'OWED_TO_ME';
  }
  if (/\b(borrowed|took|i owe|owe)\b/i.test(s) || /أخذت|استلفت|اقترضت|عليّ/.test(s)) {
    res.direction = 'I_OWE';
  }

  /* amount */
  const num = s.match(/(\d[\d,.\s]*)/);
  if (num) res.amount = num[1].replace(/[,\s]/g, '');

  /* unit */
  for (const [re, codes] of CUR_WORDS) {
    if (re.test(s)) {
      res.unit_candidates = codes;
      res.unit_code = codes[0];
      if (codes.length > 1) res.confidence.push('unit_ambiguous');
      break;
    }
  }
  if (/\bhours?\b|ساعة|ساعات/i.test(s)) { res.unit_code = 'HOUR'; res.type = 'T-05'; }
  if (/\bdays?\b|يوم|أيام/i.test(s) && /fast|صيام|صوم/i.test(s)) { res.unit_code = 'FASTDAY'; res.type = 'T-10'; }

  /* type hints */
  if (/\bpromis|وعدت|أعد\b/i.test(s)) { res.type = 'T-07'; res.unit_code = res.unit_code || 'PROMISE'; }
  if (/\bholding\b|أمانة|محتفظ/i.test(s)) { res.type = 'T-08'; res.unit_code = res.unit_code || 'ITEM'; }
  if (/\bborrowed (the|a|his|her|my)?\s*(book|drill|car|laptop|tool)/i.test(s) || /استعرت/.test(s)) {
    res.type = 'T-04'; res.unit_code = res.unit_code || 'ITEM';
  }
  if (/\bapolog|اعتذار|مظلمة/i.test(s)) { res.type = 'T-09'; res.unit_code = 'PROMISE'; }
  if (/\binvoice|wage|salary|أجر|راتب|فاتورة/i.test(s)) { res.type = /invoice|فاتورة/i.test(s) ? 'T-02' : 'T-03'; }

  /* counterparty */
  let m = s.match(/\bfrom\s+([A-Z][\w'’-]*(?:\s+[A-Z][\w'’-]*)?)/);
  if (!m) m = s.match(/\b(?:lent|owe|paid|promised|told)\s+([A-Z][\w'’-]*(?:\s+[A-Z][\w'’-]*)?)/);
  if (!m) m = s.match(/\b(?:my|his|her)\s+(mother|father|brother|sister|cousin|neighbour|neighbor|friend|uncle|aunt|colleague|partner)\b/i);
  if (m) res.counterparty_name = m[1];
  const mar = s.match(/\bمن\s+([\u0600-\u06FF]+)/) || s.match(/\bوعدت\s+([\u0600-\u06FF]+)/)
    || s.match(/\bل\s?([\u0600-\u06FF]{3,})\s+عند/);
  if (!res.counterparty_name && mar) res.counterparty_name = mar[1];
  if (/أمي|والدتي/.test(s)) res.counterparty_name = 'أمي';
  if (/أبي|والدي/.test(s)) res.counterparty_name = 'أبي';

  /* dates */
  const today = new Date();
  const iso = d => d.toISOString().slice(0, 10);
  if (/\bin a week\b|بعد أسبوع/i.test(s)) {
    const d = new Date(today); d.setDate(d.getDate() + 7); res.due_on = iso(d); res.due_mode = 'date';
  } else if (/\bin a month\b|\bnext month\b|بعد شهر/i.test(s)) {
    const d = new Date(today); d.setMonth(d.getMonth() + 1); res.due_on = iso(d); res.due_mode = 'date';
  } else if (/\bwhen able\b|عند الميسرة|عند التيسير/i.test(s)) {
    res.due_mode = 'when_able';
  } else if (/\bon return\b|عند العودة|لما يرجع/i.test(s)) {
    res.due_mode = 'on_return';
  } else {
    const dm = s.match(/\bon\s+(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i);
    if (dm) {
      const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
      const mo = months.indexOf(dm[2].toLowerCase());
      let d = new Date(today.getFullYear(), mo, +dm[1], 12);
      if (d < today) d = new Date(today.getFullYear() + 1, mo, +dm[1], 12);
      res.due_on = iso(d); res.due_mode = 'date';
      res.confidence.push('year_assumed');
    }
    const dIso = s.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (dIso) { res.due_on = dIso[1]; res.due_mode = 'date'; }
  }

  /* recurrence */
  const rec = s.match(/\bevery\s+(day|week|month|friday|monday|sunday)\b/i) || s.match(/كل\s+(يوم|أسبوع|شهر|جمعة)/);
  if (rec) {
    res.due_mode = 'recurring';
    res.recurrence = rec[1].toLowerCase();
    res.type = 'T-07';
    res.unit_code = res.unit_code || 'PROMISE';
    res.confidence.push('start_date_needed');
  }

  return res;
}

/* Wellbeing resources (§7.10) — sourced and dated, never presented as therapy */
export const WELLBEING = {
  note_en: 'DYON is not therapy or legal advice. Helplines vary by country and change over time — please verify a current local list.',
  note_ar: 'التطبيق ليس علاجًا نفسيًا ولا استشارة قانونية. خطوط الدعم تختلف بين الدول وتتغير، فتحقق من قائمة محلية محدثة.',
  links: [
    { label_en: 'Find a local helpline (findahelpline.com)', label_ar: 'ابحث عن خط دعم محلي', url: 'https://findahelpline.com' },
    { label_en: 'International Association for Suicide Prevention — crisis centres', label_ar: 'الرابطة الدولية لمنع الانتحار — مراكز الأزمات', url: 'https://www.iasp.info/crisis-centres-helplines/' },
    { label_en: 'WHO — mental health', label_ar: 'منظمة الصحة العالمية — الصحة النفسية', url: 'https://www.who.int/health-topics/mental-health' }
  ],
  checked: '2026-10-10'
};
