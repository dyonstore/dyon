/* i18n gate for CI (v2.0 §2.2). Fails (exit 1) when:
   1. a key used in code is missing from en.json;
   2. any shipped locale (en, ar, fr) lacks a key that en.json has, or has a
      different set of {placeholders} / select-plural variables;
   3. ICU braces are unbalanced;
   4. code still branches on the locale for wording (isAR(), getLocale()==='ar' ? …);
   5. a user-visible sentence is built by concatenating t() with text
      (R-G01). Pure decoration (' · ', icons) is allowed via an allowlist of
      separator-only literals;
   6. French typography is missing a narrow no-break space before ; : ! ? »
      or after «  (checked on the final, typography-processed file);
   7. guide-content.js has a field without en/ar/fr.
   Usage: node scripts/i18n-check.mjs [--warn-unused] */
import fs from 'fs';
import path from 'path';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const WEB = fs.existsSync(path.join(ROOT, 'public/locales')) ? path.join(ROOT, 'public') : ROOT;
const LOCALES = ['en', 'ar', 'fr'];
const errors = [], warnings = [];
const load = (l) => JSON.parse(fs.readFileSync(path.join(WEB, 'locales', l + '.json'), 'utf8'));
const dict = Object.fromEntries(LOCALES.map(l => [l, load(l)]));

/* ---- message structure ---- */
/* Variable names used by an ICU message, via a small recursive parser:
   {x} → x; {x, plural|select, sel {body} …} → x plus the variables of each
   body. Returns null on unbalanced braces. */
export function vars(msg) {
  const out = new Set();
  function parse(str) {
    let i = 0;
    while (i < str.length) {
      if (str[i] === '}') throw new Error('unbalanced');
      if (str[i] !== '{') { i++; continue; }
      let depth = 0, j = i;
      for (; j < str.length; j++) {
        if (str[j] === '{') depth++;
        else if (str[j] === '}') { depth--; if (depth === 0) break; }
      }
      if (depth !== 0) throw new Error('unbalanced');
      const inner = str.slice(i + 1, j);
      const m = inner.match(/^\s*(\w+)\s*(?:,\s*(plural|select|selectordinal)\s*,([\s\S]*))?$/);
      if (m) {
        out.add(m[1]);
        if (m[3] !== undefined) {
          const body = m[3];
          let k = 0;
          while (k < body.length) {
            while (k < body.length && body[k] !== '{') k++;
            if (k >= body.length) break;
            let d = 0, e = k;
            for (; e < body.length; e++) {
              if (body[e] === '{') d++;
              else if (body[e] === '}') { d--; if (d === 0) break; }
            }
            if (d !== 0) throw new Error('unbalanced');
            parse(body.slice(k + 1, e));
            k = e + 1;
          }
        }
      }
      i = j + 1;
    }
  }
  try { parse(msg); } catch { return null; }
  return [...out].sort().join(',');
}

for (const [k, v] of Object.entries(dict.en)) {
  const ev = vars(v);
  if (ev === null) errors.push(`en: unbalanced braces in ${k}`);
  for (const l of LOCALES.slice(1)) {
    if (!(k in dict[l])) { errors.push(`${l}: missing key ${k}`); continue; }
    const lv = vars(dict[l][k]);
    if (lv === null) errors.push(`${l}: unbalanced braces in ${k}`);
    else if (lv !== ev) errors.push(`${l}: placeholders differ in ${k} (en: ${ev} / ${l}: ${lv})`);
  }
}
for (const l of LOCALES.slice(1)) for (const k of Object.keys(dict[l])) if (!(k in dict.en)) warnings.push(`${l}: extra key ${k}`);

/* ---- French typography (2.3): U+202F before ; : ! ? » and after « ---- */
const NNBSP = '\u202F';
for (const [k, v] of Object.entries(dict.fr)) {
  const plain = v.replace(/\{[^{}]*\}/g, 'X').replace(/https?:\/\/\S+/g, '').replace(/\d+:\d+/g, '0');
  if (/[^\u202F\u00A0\s][;!?»]/.test(plain.replace(/\?\s*$/, m => m)) || /[A-Za-zÀ-ÿ)»’][:](?=\s|$)/.test(plain) || /«[^\u202F\u00A0]/.test(plain))
    errors.push(`fr: typography (narrow no-break space) in ${k}: ${v.slice(0, 60)}`);
}

/* ---- code scan ---- */
const JS_DIR = path.join(WEB, 'js');
const files = fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js') && !/^(tests|route-check|flow-check|i18n-tests)\.js$/.test(f));
const used = new Set();
const SEPARATOR = /^[\s·•—–\-|/:,()…'"«»#%+*×]*$/u;
for (const f of files) {
  const src = fs.readFileSync(path.join(JS_DIR, f), 'utf8');
  let ast;
  try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true }); }
  catch (e) { errors.push(`${f}: parse error ${e.message}`); continue; }
  const line = (n) => n.loc.start.line;
  const isT = (n) => n && n.type === 'CallExpression' && n.callee.type === 'Identifier' && ['t', 'tr'].includes(n.callee.name);
  walk.full(ast, (n) => {
    if (isT(n) && n.callee.name === 't' && n.arguments[0]) {
      const a = n.arguments[0];
      if (a.type === 'Literal' && typeof a.value === 'string') used.add(a.value);
      else if (a.type === 'BinaryExpression' && a.left.type === 'Literal') used.add(a.left.value + '*');
      else if (a.type === 'TemplateLiteral') used.add(a.quasis[0].value.cooked + '*');
    }
    if (n.type === 'ConditionalExpression') {
      const test = src.slice(n.test.start, n.test.end).replace(/\s/g, '');
      if (/^(isAR\(\)|AR|getLocale\(\)===['"]ar['"])$/.test(test)) errors.push(`${f}:${line(n)} locale ternary — move wording into /locales`);
    }
    if (n.type === 'BinaryExpression' && n.operator === '+') {
      const sides = [n.left, n.right];
      if (sides.some(isT)) {
        for (const s of sides) {
          const lit = s.type === 'Literal' && typeof s.value === 'string' ? s.value
            : s.type === 'TemplateLiteral' ? s.quasis.map(q => q.value.cooked).join('') : null;
          if (lit !== null && !SEPARATOR.test(lit)) errors.push(`${f}:${line(n)} concatenates t() with text ${JSON.stringify(lit)} (R-G01)`);
          if (isT(s) && sides.every(isT)) errors.push(`${f}:${line(n)} concatenates two messages (R-G01)`);
        }
      }
    }
  });
}
for (const k of used) {
  if (k.endsWith('*')) { const p = k.slice(0, -1); if (!Object.keys(dict.en).some(x => x.startsWith(p))) errors.push(`code: no keys with prefix ${p}`); }
  else if (!(k in dict.en)) errors.push(`code: unknown key ${k}`);
}
if (process.argv.includes('--warn-unused')) {
  const prefixes = [...used].filter(k => k.endsWith('*')).map(k => k.slice(0, -1));
  for (const k of Object.keys(dict.en)) if (!used.has(k) && !prefixes.some(p => k.startsWith(p))) warnings.push(`unused key ${k}`);
}

/* ---- guide content: every field en/ar/fr ---- */
try {
  const gc = await import(path.join(JS_DIR, 'guide-content.js'));
  let missing = 0, sample = '';
  const visit = (o, where) => {
    if (!o || typeof o !== 'object') return;
    if (typeof o.en === 'string') { for (const l of LOCALES) if (typeof o[l] !== 'string' || !o[l].trim()) { missing++; sample = sample || `${where} lacks ${l}: ${o.en.slice(0, 40)}`; } return; }
    for (const [k, v] of Object.entries(o)) visit(v, where + '.' + k);
  };
  visit(gc.GUIDE, 'GUIDE'); visit(gc.TOURS, 'TOURS'); visit(gc.SCREEN_HELP, 'SCREEN_HELP');
  if (missing) errors.push(`guide-content: ${missing} fields missing a locale (e.g. ${sample})`);
} catch (e) { errors.push('guide-content: ' + e.message); }

warnings.forEach(w => console.log('warn  ' + w));
errors.forEach(e => console.log('ERROR ' + e));
console.log(`i18n-check: ${Object.keys(dict.en).length} keys × ${LOCALES.length} locales — ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
