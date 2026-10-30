/* Regenerates js/guide-content.js with French added to every {en, ar}
   field, from scripts/out/guide-fr-*.json (keys are the paths printed by
   the dump: G.<chapter>…, T.<page>.<step>…, H.<screen>). Typography applied.
   Also applies small English/Arabic updates for v2.0 (three languages). */
import fs from 'fs';
import { frTypography } from './fr-typography.mjs';

const file = 'js/guide-content.js';
const src = fs.readFileSync(file, 'utf8');
const header = src.slice(0, src.indexOf('export const GUIDE'));
const m = await import('../' + file + '?t=' + Date.now());
const fr = {};
for (const f of fs.readdirSync('scripts/out').filter(f => /^guide-fr-\d+\.json$/.test(f)).sort())
  Object.assign(fr, JSON.parse(fs.readFileSync('scripts/out/' + f, 'utf8')));

const UPDATES = {
  'T..6.title': { en: 'Your language', ar: 'لغتك' },
  'T..6.body': { en: 'Switch language any time (press L). The whole layout mirrors for Arabic, and you can use Arabic-Indic digits and Hijri dates.',
                 ar: 'بدّل اللغة متى شئت (اضغط L). تنعكس الواجهة كاملة للعربية، ويمكنك استخدام الأرقام العربية والتاريخ الهجري.' },
  'G.12.blocks.0.items.1.v': { en: 'English, Arabic or French. Arabic mirrors the whole layout right-to-left.',
                               ar: 'العربية أو الإنجليزية أو الفرنسية. العربية تقلب الواجهة كلها من اليمين إلى اليسار.' }
};
const missing = [];
const clone = JSON.parse(JSON.stringify({ GUIDE: m.GUIDE, TOURS: m.TOURS, SCREEN_HELP: m.SCREEN_HELP }));
function visit(o, where) {
  if (!o || typeof o !== 'object') return;
  if (typeof o.en === 'string' && typeof o.ar === 'string') {
    if (UPDATES[where]) Object.assign(o, UPDATES[where]);
    const f = fr[where];
    if (!f) missing.push(where); else o.fr = frTypography(f);
    return;
  }
  for (const [k, v] of Object.entries(o)) visit(v, where + '.' + k);
}
visit(clone.GUIDE, 'G'); visit(clone.TOURS, 'T'); visit(clone.SCREEN_HELP, 'H');
if (missing.length) { console.error('missing fr:', missing.slice(0, 20)); process.exit(1); }

const js = (v) => JSON.stringify(v, null, 2).replace(/"([a-zA-Z_][\w]*)":/g, '$1:');
const out = header +
  'export const GUIDE = ' + js(clone.GUIDE) + ';\n\n' +
  '/* Coach-mark tours, one per screen. Each step: a CSS selector and a\n   trilingual title/body. */\n' +
  'export const TOURS = ' + js(clone.TOURS) + ';\n' +
  '/* Back-compat: the original single Overview tour. */\nexport const TOUR = TOURS[\'\'];\n\n' +
  '/* What each screen is for — shown by the ? button, with the chapter that\n   explains it in depth. */\n' +
  'export const SCREEN_HELP = ' + js(clone.SCREEN_HELP) + ';\n';
fs.writeFileSync(file, out);
console.log('guide-content.js regenerated with fr');
