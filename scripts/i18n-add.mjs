/* Adds or updates trilingual keys in one step.
   Usage: node scripts/i18n-add.mjs keys.json   where keys.json is
   { "some.key": { "en": "…", "ar": "…", "fr": "…" }, … }
   en/ar go straight into locales/*.json; fr goes into the French source
   fragments (scripts/out/fr-9.json) and fr.json is rebuilt with typography. */
import fs from 'fs';
import { execFileSync } from 'child_process';
const add = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const rd = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {});
const en = rd('locales/en.json'), ar = rd('locales/ar.json'), frSrc = rd('scripts/out/fr-9.json');
for (const [k, v] of Object.entries(add)) {
  if (!v.en || !v.ar || !v.fr) throw new Error('key ' + k + ' needs en, ar and fr');
  en[k] = v.en; ar[k] = v.ar; frSrc[k] = v.fr;
}
const w = (p, o) => fs.writeFileSync(p, JSON.stringify(o, null, 1) + '\n');
w('locales/en.json', en); w('locales/ar.json', ar); w('scripts/out/fr-9.json', frSrc);
execFileSync('node', ['scripts/build-fr.mjs'], { stdio: 'inherit' });
console.log(`added/updated ${Object.keys(add).length} keys`);
