/* Assembles locales/fr.json from the French source fragments in
   scripts/out/fr-*.json (written by hand, see CHANGELOG) and applies French
   typography. Run after editing a fragment:  node scripts/build-fr.mjs */
import fs from 'fs';
import path from 'path';
import { frTypography } from './fr-typography.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const WEB = fs.existsSync(path.join(ROOT, 'public/locales')) ? path.join(ROOT, 'public') : ROOT;
const en = JSON.parse(fs.readFileSync(path.join(WEB, 'locales/en.json'), 'utf8'));
const dir = path.join(ROOT, 'scripts/out');
const src = {};
for (const f of fs.readdirSync(dir).filter(f => /^fr-\d+\.json$/.test(f)).sort())
  Object.assign(src, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
const out = {};
for (const k of Object.keys(en)) if (k in src) out[k] = frTypography(src[k]);
fs.writeFileSync(path.join(WEB, 'locales/fr.json'), JSON.stringify(out, null, 1) + '\n');
const missing = Object.keys(en).filter(k => !(k in out));
console.log(`fr.json: ${Object.keys(out).length}/${Object.keys(en).length}` + (missing.length ? ` — missing: ${missing.slice(0, 10).join(', ')}` : ''));
