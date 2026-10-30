/* One-off codemod (kept for the record): turns inline locale ternaries
   `isAR() ? 'ar' : 'en'`, `AR ? … : …`, `getLocale() === 'ar' ? … : …` and
   `L('en', 'ar')` into t('<file>.<slug>', {vars}) calls, collecting the
   strings into scripts/out/extracted.json. Complex cases are reported. */
import fs from 'fs';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

const FILES = process.argv.slice(2);
const extracted = {};               // key -> { en, ar }
const byPair = new Map();           // en\0ar -> key
const report = [];

const slug = (s) => s.replace(/\$\{[^}]*\}|\{[^}]*\}/g, ' ').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(w => !['the','a','an','to','of','and','is','it','this','your','you'].includes(w)).slice(0, 4).join('_') || 'text';

function isLocaleTest(n, src) {
  const s = src.slice(n.start, n.end).replace(/\s/g, '');
  return s === 'isAR()' || s === 'AR' || s === "getLocale()==='ar'";
}
const isStr = n => n.type === 'Literal' && typeof n.value === 'string';
const isTpl = n => n.type === 'TemplateLiteral';
const looksTechnical = (a, b) => /^[\x21-\x7e]+$/.test(a) && /^[\x21-\x7e]+$/.test(b) && !/[a-z]{3,}\s/.test(a);

function varName(code, used) {
  let m = code.match(/([A-Za-z_]\w*)\s*\)*\s*$/) || code.match(/([A-Za-z_]\w*)/);
  let base = (m ? m[1] : 'v');
  base = { alias: 'name', length: 'count', label: 'label', n: 'n' }[base] || base;
  if (/formatNumber\(|\.length|count/i.test(code) && base !== 'name') base = base === 'length' ? 'count' : base;
  let name = base, i = 2;
  while (used.has(name) && used.get(name) !== code) name = base + i++;
  used.set(name, code);
  return name;
}

function tplToIcu(node, src, used, vars) {
  let out = '';
  node.quasis.forEach((q, i) => {
    out += q.value.cooked;
    if (i < node.expressions.length) {
      const e = node.expressions[i];
      const code = src.slice(e.start, e.end);
      if (/`[^`]*[A-Za-z\u0600-\u06FF]{2,}/.test(code) || /\?\s*'[^']*[A-Za-z\u0600-\u06FF]{2,}/.test(code)) throw new Error('nested text in expression: ' + code.slice(0, 60));
      const name = varName(code, used);
      vars[name] = code;
      out += '{' + name + '}';
    }
  });
  return out;
}

function extract(file, enNode, arNode, src) {
  const used = new Map(), vars = {};
  const text = (n) => isStr(n) ? n.value : tplToIcu(n, src, used, vars);
  const en = text(enNode), ar = text(arNode);
  if (/[{}]/.test((isStr(enNode) ? en : '') + (isStr(arNode) ? ar : ''))) throw new Error('literal brace');
  const pairKey = en + '\0' + ar;
  let key = byPair.get(pairKey);
  if (!key) {
    const prefix = file.replace(/^.*\//, '').replace(/\.js$/, '');
    let base = prefix + '.' + slug(en), k = base, i = 2;
    while (extracted[k]) k = base + '_' + i++;
    key = k; extracted[key] = { en, ar }; byPair.set(pairKey, key);
  }
  const v = Object.entries(vars);
  return v.length ? `t('${key}', { ${v.map(([n, c]) => n === c ? n : `${n}: ${c}`).join(', ')} })` : `t('${key}')`;
}

for (const file of FILES) {
  const src = fs.readFileSync(file, 'utf8');
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
  const edits = [];
  walk.full(ast, (n) => {
    try {
      if (n.type === 'ConditionalExpression' && isLocaleTest(n.test, src)) {
        const ar = n.consequent, en = n.alternate;
        if ((isStr(ar) || isTpl(ar)) && (isStr(en) || isTpl(en))) {
          if (isStr(ar) && isStr(en) && looksTechnical(ar.value, en.value)) { report.push(`${file}:${src.slice(0, n.start).split('\n').length} technical: ${src.slice(n.start, n.end).slice(0, 80)}`); return; }
          edits.push([n.start, n.end, extract(file, en, ar, src)]);
        } else report.push(`${file}:${src.slice(0, n.start).split('\n').length} non-literal: ${src.slice(n.start, n.end).slice(0, 100).replace(/\n/g, ' ')}`);
      }
      if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'L' && n.arguments.length === 2) {
        const [en, ar] = n.arguments;
        if ((isStr(en) || isTpl(en)) && (isStr(ar) || isTpl(ar))) edits.push([n.start, n.end, extract(file, en, ar, src)]);
        else report.push(`${file}:${src.slice(0, n.start).split('\n').length} L non-literal: ${src.slice(n.start, n.end).slice(0, 100)}`);
      }
    } catch (e) { report.push(`${file}:${src.slice(0, n.start).split('\n').length} ${e.message}`); }
  });
  // apply innermost-safe: drop edits contained in other edits
  edits.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const top = [];
  for (const e of edits) { if (top.length && e[0] < top[top.length - 1][1]) continue; top.push(e); }
  let out = src;
  for (const [s, e, r] of top.reverse()) out = out.slice(0, s) + r + out.slice(e);
  fs.writeFileSync(file, out);
}
fs.mkdirSync('scripts/out', { recursive: true });
const prev = fs.existsSync('scripts/out/extracted.json') ? JSON.parse(fs.readFileSync('scripts/out/extracted.json', 'utf8')) : {};
fs.writeFileSync('scripts/out/extracted.json', JSON.stringify({ ...prev, ...extracted }, null, 1));
console.log(Object.keys(extracted).length + ' keys extracted');
console.log(report.join('\n'));
