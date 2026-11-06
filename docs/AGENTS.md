# AGENTS.md — fast-start guide for AI agents working on DYON

> **Purpose.** Save tokens and wall-clock time. Read this *before* `docs/TASKS.md`.
> `docs/TASKS.md` is the **task board** (what to build, in order, with acceptance
> criteria). This file is the **operating manual** (how the repo is wired, what to
> install, which files to read for each kind of change, and the traps that waste
> tokens). `docs/dyon-source-of-truth.md` is the **product spec** and wins on any
> product conflict.

---

## 0. TL;DR — the first five minutes

```bash
# 1. Environment (fresh sandbox has node + python but NOT php and NOT browsers)
php -v            || sudo apt-get update -qq && sudo apt-get install -y -qq \
                     php-cli php-sqlite3 php-mbstring php-curl php-gd php-xml
node -v           # expect v22+
npm ci || npm install
npx playwright install chromium            # browser binary
sudo npx playwright install-deps chromium  # system libs (libatk etc.) — REQUIRED

# 2. Serve the app (static today; PHP after §4 lands)
setsid -f python3 -m http.server 8080 --bind 0.0.0.0 > /tmp/httpd.log 2>&1 < /dev/null
#   after §4:  php -S 0.0.0.0:8080 -t public public/router.php   (npm run serve)

# 3. The four gates — run these before and after every change
node scripts/i18n-check.mjs        # 769 keys × 3 locales, concatenation, FR typography
node scripts/run-harness.mjs       # unit(102) + route(123) + flow(31) — needs the server up
node scripts/e2e.mjs               # Playwright, 17 scenarios, ~50s
php scripts/build-sw.php --check    # service-worker hash (after changing any CORE file)
#   after §4:  php tests/php/run.php  (npm run test:php)
```

**If a gate is red, fix it before moving on.** The harness/e2e need the HTTP
server running on :8080. If `run-harness.mjs` prints `(absent, skipped)` the
server is down — restart it.

---

## 1. What to install, and the gotchas

| Need | Install | Gotcha that wastes tokens |
|---|---|---|
| PHP 8.4 (+ pdo_sqlite, sodium, mbstring, openssl, curl, gd) | `apt-get install php-cli php-sqlite3 php-mbstring php-curl php-gd php-xml` | **Not preinstalled.** TASKS.md used to claim it was. Don't start §4+ before this. |
| Node 22 + deps | `npm install` (acorn, acorn-walk, playwright) | `node_modules/` is **git-ignored** — never `git add` it (a previous run committed 197 files by accident). |
| Chromium | `npx playwright install chromium` **and** `sudo npx playwright install-deps chromium` | Without the **deps** step the browser fails with `libatk-1.0.so.0: cannot open shared object file`. |
| Composer (PHPMailer only, §7) | `curl -sS https://getcomposer.org/installer \| php -- --install-dir=.tools` | `composer.json` **must** set `"config":{"vendor-dir":"vendor-php"}` — `/vendor` is already self-hosted fonts/icons. `.tools/` and `vendor-php/` are git-ignored. |
| LLM proxy for translations | **not available** | Write ar/fr **by hand**. See §4 below. |

---

## 2. Repo map — which file to open for which change

Web root is the **repo root today**; it becomes **`public/`** after task T-4.1.

### Client (static PWA, ES modules, no build step)
| File | LOC | What lives here — open it when… |
|---|---:|---|
| `js/app.js` | ~520 | Boot sequence, theme, router (`parseHash`/`render`), shortcuts, PIN gate, SW registration, `firstRunLocale`. **Change boot/locale/routing here.** |
| `js/store.js` | ~970 | IndexedDB state, `settings`, commitments CRUD, export/import, audit chain. **Change data model / RL-09 export here.** |
| `js/db.js` | ~200 | Low-level IndexedDB wrapper + `logEvent` (serialised audit writes; call `resetAuditTail()` after import/wipe). |
| `js/i18n.js` | ~260 | `t()`, `LOCALES`, `PLANNED_LOCALES`, ICU subset (plural/select/#), `detectLocale`, digits/calendar, `tr()`. **Never call `t()` at module top level.** |
| `js/units.js` | ~225 | `CURRENCIES` (ISO 4217 minor units, R-G03), `toMinor`/`fromMinor`/`inputValue`. **Add a currency here (e.g. LYD d:3, XOF d:0).** |
| `js/flows.js` | ~1500 | Quick-add, release/undo, hawālah, ṣulḥ, reminders — the commitment lifecycle UI. |
| `js/views.js` / `js/views2.js` | ~870 / ~1216 | Screen renderers. `renderOnboarding` and `renderSettings` are in **views2.js** (§3 adds the Region card + onboarding suggestion here). |
| `js/guide.js` / `js/guide-content.js` | ~590 / ~2141 | Tour engine + trilingual guide content (`{en,ar,fr}` per field). |
| `js/ui.js` | ~400 | `el()`, `icon()`, `toast()`, `sheet()`, `input()`, `registerShortcut()`, focus helpers. **Reuse these — don't hand-roll DOM.** |
| `js/aside.js` / `js/lang-aside.js` | | Reusable slide-in dialog (focus trap, Esc, scrim, inline-end anchoring, RTL). **§5 account aside must reuse `aside.js`.** |
| `js/auth.js` / `js/auth-config.js` | ~290 | Client sign-in (preview + provider redirect). `allowPreview` only on localhost. |
| `js/validate.js` | ~225 | `VAL.MSG.*`, `decimalsOf`, amount parsing guards. |
| `css/style.css` | | All tokens + components. Colour rule: `--owe` indigo, `--owed` sky, `--needs` amber. **No red for "I owe".** Styles for `acct-photo`, `sync-dot`, `net-chip` already exist (for §5/§6). |
| `index.html` | | App shell, CSP meta, `#boot-screen` loader. |
| `sw.js` | | Service worker. `CORE` list + `VERSION` (hash). Regenerate with `php scripts/build-sw.php` after adding any cached file. |

### Tests & tooling
| File | Open it when… |
|---|---|
| `js/tests.js` + `tests.html` | Unit tests (money maths, red-line guards, SW/CSP, boot order). Add a `checkAsync('name', async()=>…)`. |
| `js/route-check.js` + `route-check.html` | Every route renders without throwing. |
| `js/flow-check.js` + `flow-check.html` | End-to-end-ish flows in a real DOM. Sets `window.DYON_AUTH_PREVIEW_ONLY=true` so sign-in never redirects. |
| `scripts/e2e.mjs` | Playwright phone (375×812) + overflow matrix (360/768/1280 × light/dark × en/ar/fr). |
| `scripts/i18n-check.mjs` | The i18n gate. Fails on missing keys, placeholder mismatch, locale ternaries, `t()+'text'`, FR typography. |
| `scripts/i18n-add.mjs` | **The only correct way to add strings** (see §4). |
| `scripts/build-sw.php` | Rewrites `sw.js` `VERSION` from a hash of CORE. `--check` in CI. |
| `scripts/build-icons.py` | Rebuilds the Font Awesome woff2 **subset** from the `fa-…` classes actually used. Run after adding a new icon. |

### Server (created in §4 onward — expected layout)
```
public/            web root (index.html, api/*.php, admin/*.php, blog.php, router.php)
app/               PHP classes, namespace Dyon\  (Db, Crypto, Session, Csrf, RateLimit, Auth, Mailer, I18n, Seo, Geo, Http)
migrations/        NNN_*.sql, applied by PRAGMA user_version
config/            config.example.php (committed) + config.php/config.local.php (git-ignored, secrets)
data/              system.sqlite, users/*.sqlite, avatars/, mail-out/, backups/  (git-ignored, 0700)
templates/         email/*.{locale}.php  +  site/*.php
cron/              send-mail.php, migrate.php, backup.php
tests/php/         run.php (plain runner, no PHPUnit dep)
deploy/            nginx.conf.example
```

---

## 3. Non-negotiable rules (full list in TASKS.md §A / spec)

1. **Local-first** — works with no account, no network. Stage 1 never needs sign-in.
2. **RL-09** — export and delete are **never** gated by login/sync/payment.
3. **Calm** — no interest/late-fee/penalty/shaming wording; no red for "I owe"; amber only for "needs response".
4. **R-G01** — no string concatenation in user-visible sentences; ICU messages only, all locales.
5. **R-D10** — never message a third party on the user's behalf without an explicit per-message action. Server must never email "the other party" unless that user started it.
6. **E2E** — the server must never read ledger content. Browser-only WebCrypto. PHP `sodium` is for **server secrets only** (token HMACs), never user data.
7. **RTL + matrix** — every new screen tested in en/ar/fr, light/dark, at 360/768/1280.
8. **No third-party calls from the browser** — fonts/icons self-hosted in `/vendor`, CSP `default-src 'self'`. No CDN/analytics/tracking/CAPTCHA.
9. **Tests for every new rule; existing tests stay green.**

---

## 4. i18n workflow — do it this way or the gate fails

- **Never** edit `locales/fr.json` by hand (typography is applied by a script).
- To add keys, write a small JSON file of **trilingual** entries, then run the adder:
  ```jsonc
  // myfeature.json
  { "region.title": { "en": "Region", "ar": "المنطقة", "fr": "Région" } }
  ```
  ```bash
  node scripts/i18n-add.mjs myfeature.json   # writes en/ar + FR source, rebuilds locales/fr.json
  node scripts/i18n-check.mjs                 # must be 0 errors
  ```
- French typography: narrow no-break space (U+202F) before `; : ! ? »` and after `«`.
  The script does it; don't type the spaces yourself.
- ICU only. Plural/select with `#`. Numbers/dates via `Intl` with the user's digit pref.
- `t()` is usable only after `ensureLocale()` resolved. Harnesses do
  `await __ensure('ar'); await __ensure('fr')` at import. **No `t()` at top level.**

---

## 5. Money, audit, and other traps that cost tokens

- **Money** is always integer **minor units + unit code** (R-M01). Parse with
  `toMinor()` / `normalizeDecimal()` (handles `1 500,50`, `1.250,00`, `1,250.00`,
  Arabic-Indic digits). Prefill inputs with `inputValue()`. **Never** parse amounts ad hoc.
- Minor digits come from `CURRENCIES` in `units.js` (R-G03). Adding a currency =
  add it there, not in a feature.
- **Audit writes** are serialised in `db.logEvent`; after import/wipe call
  `db.resetAuditTail()` or the hash chain check fails.
- **Harness "absent, skipped"** = the :8080 server is down. Restart it.
- **`git add` scope** — stage files explicitly. Do **not** `git add -A` blindly;
  `node_modules/`, `/data/`, `vendor-php/`, `.tools/` are git-ignored for a reason.
- **SW** — after adding any file to the app shell or `locales/`, add it to `CORE`
  in `sw.js` and run `php scripts/build-sw.php`, or the offline test fails.
- **Playwright flow-check hang** — if a configured Google client ID is present,
  set `window.DYON_AUTH_PREVIEW_ONLY=true` (harness pages already do).

---

## 6. Using smart tools to save time/tokens

These agent tools do heavy work cheaply — prefer them over manual grinding:

- **`web_search` / `crawler`** — verify every external claim/link *before* citing it
  (§6.5 storage page and §8 posts require HTTP-200-checked sources; MDN/WebKit for
  eviction claims; quran.com for verses). Cite the exact URL you verified.
- **`image_search`** (CC-filtered) for blog cover photos; **`image_generation`** for
  original diagrams/illustrations when search is irrelevant. Never hot-link stock
  providers. Cover images need WebP/AVIF sizes at 1200×630 for OG (§8).
- **`audio_*` / `video_*`** — only if a task explicitly needs media; otherwise skip.
- **Batch independent tool calls** in one turn (e.g. several `web_search` link
  checks, or reading several files at once) instead of sequentially.
- **Read before edit** — open the function you're changing; don't regenerate whole
  files. Use `Grep`/`Glob` to find the 3 lines that matter.

---

## 7. Commit / PR discipline

- Branch: **`genspark_ai_developer`**; PR **#1** → `main`
  (https://github.com/dyonstore/dyon/pull/1).
- One commit per section, **in the TASKS.md order**: bugs → i18n → country →
  server/auth → account aside → sync → storage → email → blog → admin.
- Each commit: code + tests + CHANGELOG entry + TASKS.md status/log update.
- **Push after every commit** (sessions get interrupted).
- All four gates green before you push.

## 8. Current status (keep in sync with TASKS.md §C / §E)

- ✅ §1 bugs · ✅ §2 i18n (786 keys) · ✅ §3 country · ✅ §4.1 layout (web root `public/`)
- ✅ §4 server (classes, schema, auth, hardening, geo/ping) · ▶ §5 account aside — **next**; then §6 sync, §6.5 storage, §7 email, §8 blog, §10 admin
- One command for all gates: `npm run check` (server must be up: `setsid -f php -S 127.0.0.1:8080 -t public public/router.php`).
- PHP tests: `php tests/php/run.php [filter]` — `tests/php/lib.php` has `test/eq/ok/throws/tmpdir/dev_server/http`.
- Pitfall: never `pkill` + restart in one shell command; harness pages live in `public/dev/` (404 in prod).
- Pitfall: PHP `+` on arrays keeps the LEFT value — use `array_merge` for header defaults. Files starting `_` in `public/` are never web-callable. Set `secret_key` (config or `DYON_SECRET_KEY`) before using sessions.
