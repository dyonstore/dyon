/* One-shot gate runner: `npm run check`. Prints one summary line per gate; exit 1 if any fails.
   Needs the dev server on :8080 (npm run serve). Skip slow gates with  CHECK_SKIP=e2e,harness  */
import { spawnSync } from 'node:child_process';
const skip = new Set((process.env.CHECK_SKIP || '').split(',').filter(Boolean));
const gates = [
  ['php unit', 'php', ['tests/php/run.php'], 120, /php: .*/],
  ['harness', 'node', ['scripts/run-harness.mjs'], 240, null],
  ['i18n', 'node', ['scripts/i18n-check.mjs'], 60, /i18n-check: .*/],
  ['e2e', 'node', ['scripts/e2e.mjs'], 400, /e2e: .*/],
  ['sw hash', 'php', ['scripts/build-sw.php', '--check'], 30, /sw\.js .*/],
];
let bad = 0;
for (const [name, cmd, args, tmo, re] of gates) {
  const key = name.split(' ')[0];
  if (skip.has(key)) { console.log(`- ${name.padEnd(9)} skipped`); continue; }
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: tmo * 1000 });
  const out = (r.stdout || '') + (r.stderr || '');
  let line;
  if (name === 'harness') {
    const rows = [...out.matchAll(/^(✓|✗) (dev\/[\w-]+\.html): (\d+) passed · (\d+) failed/gm)];
    line = rows.map(m => `${m[2].replace('dev/', '').replace('.html', '')} ${m[3]}/${+m[3] + +m[4]}`).join(' · ') || out.trim().split('\n').pop();
  } else {
    line = (out.match(re) || [out.trim().split('\n').pop()])[0];
  }
  const ok = r.status === 0;
  if (!ok) bad++;
  console.log(`${ok ? '✓' : '✗'} ${name.padEnd(9)} ${line}`);
}
process.exit(bad ? 1 : 0);
