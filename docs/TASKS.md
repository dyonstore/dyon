# DYON v2.0 — task board for humans and AI agents

> **Read this first.** This file is the single hand-off document for the v2.0 work
> (dyon.store: multilingual, country-aware, PHP + SQLite backend, E2E sync, email, blog,
> admin). Every task has a **status**, a **self-contained prompt** you can paste to an agent,
> the **files** involved and **acceptance criteria**. Update the status line and the
> "Log" section every time you finish a step, in the same commit as the code.
>
> Canonical product spec: [`docs/dyon-source-of-truth.md`](dyon-source-of-truth.md) — it wins
> on any conflict. Changelog: [`CHANGELOG.md`](../CHANGELOG.md).

Status legend: ✅ done · 🟡 partial / in progress · ⬜ to do · ⛔ blocked (reason given)

---

## A. Non-negotiable rules (apply to every task)

1. **Local-first.** Everything works with no account and no network. Stage 1 never needs sign-in.
2. **RL-09.** Export and delete are never gated by login, sync or payment.
3. **RL-01 / calm.** No interest, late fees, penalties or shaming wording anywhere. No red for
   "I owe"; amber (`--needs`) only for "needs response". `--owe` is indigo, `--owed` sky.
4. **R-G01.** No string concatenation in user-visible sentences — ICU messages only, in all
   locales. `npm run i18n:check` enforces it (fails on `t() + 'text'`, locale ternaries,
   missing keys, placeholder mismatch, French typography).
5. **R-D10.** DYON never messages a third party on the user's behalf without an explicit,
   per-message user action. Server email to "the other party" is forbidden unless that user
   started it, per message.
6. **E2E.** The server must never be able to read ledger content. Encryption happens only in the
   browser (WebCrypto). PHP `sodium` is for server secrets (token HMACs) only.
7. **RTL + matrix.** Full RTL for Arabic; every new screen is tested in en, ar and fr, light and
   dark, at 360, 768 and 1280 px (`scripts/e2e.mjs`).
8. **No third-party calls from the browser.** Fonts/icons are self-hosted in `/vendor`; CSP is
   `default-src 'self'`. Don't add CDNs, analytics, tracking pixels or third-party CAPTCHAs.
9. **Tests for every new rule.** Existing tests must keep passing.

## B. How to work in this repo

| Item | Value |
|---|---|
| Repo / branch | `kaddoussimaher0-ui/dyon`, work on `genspark_ai_developer`; PR **#1** → `main` |
| Commits | One commit (or a WIP series) **per section, in order**: bugs → i18n → country → server/auth → user aside → sync → storage page → email → blog → admin. Each with tests, README update and a CHANGELOG entry. Push after every commit (sessions get interrupted). |
| Static preview | `python3 -m http.server 8080 --bind 0.0.0.0` from the web root (today: repo root; after §4: `public/`) |
| PHP preview (after §4) | `php -S 0.0.0.0:8080 -t public public/router.php` (`npm run serve`) — PHP 8.4 with pdo_sqlite, sodium, mbstring, openssl, curl is installed in the sandbox |
| Unit + route + flow tests | `node scripts/run-harness.mjs` (headless Chromium runs `tests.html`, `route-check.html`, `flow-check.html`) |
| E2E | `node scripts/e2e.mjs` (Playwright; 375×812 phone scenarios + overflow matrix) |
| i18n gate | `node scripts/i18n-check.mjs` |
| Add trilingual keys | write `{ "key": { "en": "…", "ar": "…", "fr": "…" } }` to a file, then `node scripts/i18n-add.mjs file.json` (writes en/ar locale files, French source `scripts/out/fr-9.json`, rebuilds `locales/fr.json` with typography) |
| French sources | Hand-written in `scripts/out/fr-*.json` (UI) and `scripts/out/guide-fr-*.json` (guide). Build: `npm run i18n:build`. **Never** edit `locales/fr.json` by hand (typography is applied by `scripts/fr-typography.mjs`). |
| Icons | Font Awesome subset: add `fa-…` usage anywhere, then `python3 scripts/build-icons.py` |
| Service worker | After changing any CORE file: `php scripts/build-sw.php` (`--check` in CI) |
| Composer (PHPMailer only) | `php .tools/composer.phar` (download with `curl -sS https://getcomposer.org/installer \| php -- --install-dir=.tools`; `.tools/` is git-ignored). **`/vendor` is taken by self-hosted fonts/icons** — `composer.json` must set `"config": {"vendor-dir": "vendor-php"}` (git-ignored, outside the web root). |
| LLM proxy | **Not available** on this plan — write translations by hand. |
| Line endings | LF only (`.gitattributes`). Files are UTF-8. |

Known gotchas:
- Harness pages set `window.DYON_AUTH_PREVIEW_ONLY = true` so a configured Google client ID never
  redirects during tests (that redirect used to hang `flow-check.html`).
- `t()` is only usable after `ensureLocale()` resolved (app boot awaits it; harnesses `await
  __ensure('ar'); await __ensure('fr')` at import). Never call `t()` at module top level.
- Amount inputs: prefill with `inputValue()` and parse with `toMinor()` / `normalizeDecimal()`
  (accepts `1 500,50`, `1.250,00`, `1,250.00`, Arabic-Indic digits). Never parse amounts ad hoc.
- Audit log writes are serialised in `db.logEvent`; after import/wipe call `db.resetAuditTail()`.

---

## C. Task board

### §1 · Fix the existing bugs — ✅ done (commit `fed6dcb`, follow-ups in `c51d0b2`)

| # | Task | Status |
|---|---|---|
| 1.1 | Tour vs onboarding: refuse overview tour while `!onboarded` (toast "Finish setup first…"), onboarding tour, await `dyon:rendered`, end on route change, ≤1 silent drop + "This part isn't on screen yet" | ✅ `js/guide.js` (`startTour`, `planSteps`, `waitForRender`) |
| 1.2 | Mobile tour: bar `inert` + below scrim, bubble z 310, docked above bar, dock side decided once per step, re-place on `scrollend` (400 ms fallback) | ✅ `js/guide.js`, `css/style.css` |
| 1.3 | `greet.with_name` ICU message | ✅ |
| 1.4 | `document.title` from i18n; discreet keeps "Notes" | ✅ |
| 1.5 | `allowPreview` only on localhost; hide unconfigured providers | ✅ `js/auth-config.js`, `js/auth.js` |
| 1.6 | `tourDone()` false on storage error, memory fallback | ✅ |
| 1.7 | Self-host fonts + FA subset in `/vendor`, in SW CORE, no CDN, CSP | ✅ (CSP as `<meta>`; the **HTTP header** version is part of §4) |
| 1.8 | SW VERSION = hash of CORE (`scripts/build-sw.php`), "A new version is ready — Reload" | ✅ |
| 1.9 | Guide/tour progress in IndexedDB settings (+ one-time migration) | ✅ |
| 1.10 | Playwright at 375×812: onboarding → guide → tour; tour + bottom bar; RTL tour; **French tour** | ✅ `scripts/e2e.mjs` (French tour added in T-1.10b) |

**T-1.10b · ✅ done** (`French tour (375×812)` scenario + en/ar/fr in the overflow matrix). *Prompt was:* *In `scripts/e2e.mjs` add a scenario "French tour (375×812)": boot with
`locale: 'fr'`, start the overview tour, assert the bubble shows "Suivant", `document.documentElement.lang === 'fr'`,
`dir === 'ltr'`, the step counter advances with ArrowRight, the bubble stays above `#mobile-bar`, and no
horizontal overflow. Also add an overflow pass in `fr` to the 360/768/1280 × light/dark matrix. Run
`node scripts/e2e.mjs`; all scenarios must pass.*

### §2 · Languages en/ar/fr — ✅ done (commit `c51d0b2`; SW + e2e follow-ups after it) — T-2.6 lands with §7/§8

Done: locale JSON files (`locales/{en,ar,fr}.json`, 769 keys), ICU plural/select/#, fallback → en,
all wording ternaries moved to keys, guide-content `{en, ar, fr}` (326 fields), hand-written French
with typography, `scripts/i18n-check.mjs`, first-run detection (`detectLocale`, `firstRunLocale` in
`js/app.js`), language aside (`js/aside.js`, `js/lang-aside.js`, key **L**), header `fa-language` button.

Remaining:

**T-2.1b · ✅ done** — locales + `aside.js`/`lang-aside.js` in CORE; unit test walks the `app.js` import graph; e2e "works offline in en, ar and fr". *Prompt was:* Add `./locales/en.json`, `./locales/ar.json`,
`./locales/fr.json` (and `./js/aside.js`, `./js/lang-aside.js`, and any new JS module) to `CORE` in
`sw.js`, run `php scripts/build-sw.php`, and add a unit test in `js/tests.js` that fetches `sw.js` and
asserts every `js/*.js` imported by `js/app.js` (transitively) and every `locales/*.json` is listed in
CORE. Acceptance: test passes; app works offline in all three languages (Playwright: load once, go
offline via `context.setOffline(true)`, reload, switch language).

**T-2.5b · ✅ done** — 4 scenarios (en/ar × 375/1280). *Prompt was:* In `scripts/e2e.mjs` add scenarios at 375×812 and
1280×800, in en and ar: press **L** → `#aside-lang` visible with `role=dialog aria-modal=true`;
`#lang-toggle[aria-expanded=true]`; panel is anchored to the inline-end (right edge in LTR, left in
RTL); typing "fran" filters to Français; Tab cycles inside; Esc closes and focus returns to
`#lang-toggle`; `location.hash` and `history.length` unchanged; choosing Français re-renders with
`lang=fr` and sets `settings.locale_chosen = true`; a reload with `?lang=en` does **not** switch back
(never auto-switch after choice).

**T-2.6 · ⬜ hreflang-ready PHP pages** — done as part of §7/§8 (server pages render
`<html lang dir>` from the same locale files via `app/I18n.php`).

### §3 · Country detection and defaults — 🟡 in progress (nothing committed yet)

**Prompt (complete, self-contained):**

1. Create `scripts/build-countries.py` that writes **`data/countries.json`** (canonical; seeds SQLite
   `country_defaults` in §4) and **`assets/countries.json`** (client copy, add to SW CORE), plus
   **`js/tz-country.js`** (`export const TZ_COUNTRY = {...}`) generated from
   `/usr/share/zoneinfo/zone.tab` (+ link names from `tzdata.zi`).
   Per country: `code, locales[], currency, minor_units, digits (latn|arab), calendar_primary,
   calendar_secondary, week_start (mon|sat|sun), first_day, date_format, number_format{decimal,group},
   suggest_islamic_mode (suggestion only — never auto-on), zakat_note, legal_variant,
   resources{emergency[], debt_advice[]}, checked_at`.
   Seed at least: TN DZ MA LY EG SA AE QA KW JO LB FR BE CH CA DE IT GB US TR ID MY PK SN NG.
   Week start / date pattern / separators / default digits were read from CLDR (ICU 77) on
   2026-10-29: TN mon latn dd/mm/yyyy `,` `.` · DZ sat latn · MA mon latn · LY sat latn · EG sat arab
   `.` `,` · SA sun arab (secondary islamic-umalqura) · AE mon latn · QA/KW/JO sat arab · LB mon arab
   `,` `.` · FR/BE mon `,` U+202F · CH mon dd.mm.yyyy `.` `’` · CA sun yyyy-mm-dd · DE mon dd.mm.yyyy
   `,` `.` · IT mon · GB mon · US sun mm/dd/yyyy · TR mon dd.mm.yyyy · ID sun · MY mon · PK sun ·
   SN mon (XOF, 0 minor units) · NG mon. Currencies: LYD (3) and XOF (0) must be added to
   `CURRENCIES` in `js/units.js` (ISO 4217 minor units, R-G03).
   Resource links **must be checked (HTTP 200) before listing**; checked on 2026-10-29:
   `https://findahelpline.com/countries/<cc>` (emergency, all), BE `https://www.mediationdedettes.be`,
   CH `https://www.dettes.ch`, DE `https://www.meine-schulden.de` and
   `https://www.verbraucherzentrale.de/wissen/geld-versicherungen/kredit-schulden-insolvenz`,
   GB `https://www.stepchange.org` and `https://www.citizensadvice.org.uk/debt-and-money/`,
   US `https://www.nfcc.org/` and `https://www.consumerfinance.gov/consumer-tools/debt-collection/`.
   (Banque de France, MoneyHelper and canada.ca returned 403/timeouts to the checker — leave out
   rather than guess.)
2. `js/country.js`: `detectCountry()` in order (a) `GET /api/geo.php` → `{country:'TN'}` (skip silently
   on 404/offline; this is same-origin, never third-party), (b)
   `Intl.DateTimeFormat().resolvedOptions().timeZone` → `TZ_COUNTRY`, (c) region subtag of
   `navigator.language` (`fr-TN` → TN). Returns `{country, source}`. `countryDefaults(cc)` loads
   `assets/countries.json`. `applyCountry(cc, {apply})` saves `settings.country` and, only when the
   user said yes, `base_currency`, `digits`, `calendar_secondary`, `week_start`, and the locale **only
   if `!locale_chosen`**. Never turns on Islamic mode — it may only show the suggestion text.
   Feed `countryDefaults(cc).locales` into `firstRunLocale()` as the country step of §2.4.
3. Onboarding (`renderOnboarding` step 0 in `js/views2.js`): a card "It looks like you're in {country}
   — use {country} defaults?" with **[Yes]** **[Choose]** (Choose opens a searchable country picker
   using `Intl.DisplayNames` for names in the UI language). Country names come from
   `Intl.DisplayNames`, never concatenated.
4. Settings → new "Region" card (`id="region-card"`): country picker; changing it shows a
   confirm sheet "Re-apply {country} defaults? (currency, digits, calendar, week start)" — offered, not
   forced; "Keep my settings" leaves everything as is.
5. i18n keys in en/ar/fr via `scripts/i18n-add.mjs` (e.g. `region.title`, `region.suggest`,
   `region.yes`, `region.choose`, `region.reapply`, `region.keep`, `region.islamic_hint`).
6. Tests: unit (TZ map has Africa/Tunis→TN, Europe/Paris→FR; region subtag; detection order with
   mocked fetch/timezone; `applyCountry` never sets `islamic_mode`; never overrides a chosen locale);
   e2e (onboarding shows the suggestion with timezone `Africa/Tunis` via Playwright `timezoneId`;
   Yes applies TND; Settings→Region change offers but does not force).
7. Update CHANGELOG (§3) and README; mark this task ✅ here.

Acceptance: all harnesses + e2e + i18n-check green; no network request leaves the origin.


### §4 · PHP + SQLite server, auth, security — ⬜ to do

**T-4.1 · ⬜ Layout and router.** *Prompt:* Restructure so the **web root is `/public`**: move
`index.html`, `privacy.html`, `sw.js`, `manifest*`, `css/`, `js/`, `locales/`, `vendor/` (fonts/icons),
`assets/`, `images/`, icons into `public/` (`git mv`, keep history). Test harness pages
(`tests.html`, `route-check.html`, `flow-check.html`, `preview-*.html`) move to `public/dev/` and are
**denied in production** (served only when `APP_ENV=dev`). Create `/app` (PHP classes, PSR-4
namespace `Dyon\`, autoloaded by a tiny `app/bootstrap.php` — no framework), `/data` (SQLite files,
git-ignored, `0700`), `/config` (`config.php` reads env / `config.local.php`, git-ignored; ship
`config.example.php`), `/cron`, `/migrations`, `/templates` (email + SSR), `/tests/php`.
`public/router.php` is used by `php -S` for dev and mirrors the production rewrite rules. Update
`scripts/run-harness.mjs`, `scripts/e2e.mjs`, `scripts/build-sw.php`, `package.json` (`serve`:
`php -S 0.0.0.0:8080 -t public public/router.php`). Acceptance: all existing harnesses + e2e pass when
served by `php -S`; `GET /app/…`, `/data/…`, `/config/…`, `/.git/…`, `/vendor-php/…` are 404.

**T-4.2 · ⬜ Core classes.** *Prompt:* In `/app` implement, each with a PHP test in `tests/php/`
(plain PHP runner `tests/php/run.php`, no PHPUnit dependency; `npm run test:php`):
- `Db` — PDO SQLite singleton per file; on open: `PRAGMA journal_mode=WAL; foreign_keys=ON;
  busy_timeout=5000; synchronous=NORMAL`; `migrate()` applies `/migrations/NNN_*.sql` in order using
  `PRAGMA user_version`, each in a transaction; helpers `one()`, `all()`, `exec()`, `tx(callable)`.
- `Crypto` — `randomToken(32)` (base64url), `hmac($value)` using `sodium_crypto_auth` with the
  server key from config (store only HMACs of session/unsubscribe/recovery tokens), `constEq()`.
- `Session` — cookie `__Host-dyon_sess` (`Secure; HttpOnly; SameSite=Lax; Path=/`, no Domain),
  value = random token, DB stores `hmac(token)`, 30-day sliding expiry, rotate on login, `destroy()`.
- `Csrf` — double-submit: cookie `__Host-dyon_csrf` (not HttpOnly) + header `X-CSRF-Token` or form
  field `_csrf`; required for every non-GET `/api` and `/admin` request; also check `Origin`/`Sec-Fetch-Site`.
- `RateLimit` — fixed-window counters in `rate_limits(bucket, window_start, count)` keyed by
  `hmac(ip)` / user id; `hit($bucket, $limit, $windowSec)` returns bool + `Retry-After`.
- `Auth` — OAuth 2.0 / OIDC **PKCE** (S256) for Google (and Microsoft later): `/api/auth/start.php`
  stores `state`, `nonce`, `code_verifier` in a short-lived signed cookie; `/api/auth/callback.php`
  exchanges code (curl), **verifies the ID token signature against the provider JWKS** (cache JWKS
  in `settings` for 6 h, RS256 via `openssl_verify`), checks `iss`, `aud`, `exp`, `nonce`,
  `email_verified`; upserts `users` by `(provider, sub)`; creates session; redirects to `/#/settings`.
  `/api/auth/me.php` → `{signed_in, name, email, avatar:'/api/avatar.php', created}`;
  `/api/auth/logout.php` (POST + CSRF).
- `Mailer` (stub in §4, real in §7), `I18n` (loads `public/locales/*.json`, same ICU subset as
  `js/i18n.js` for plural/select — port carefully and test with the same fixtures), `Seo` (§8),
  `Geo` (`country()` from `CF-IPCountry` header, else optional GeoLite2 `.mmdb` if present, else
  null — **never** logs or stores the IP).
- `Http` helpers: JSON responses with `Cache-Control: no-store`, error shape `{error:{code,message}}`.

**T-4.3 · ⬜ Schema.** *Prompt:* `migrations/001_init.sql` for `data/system.sqlite` with tables
`users(id, provider, sub, email, name, avatar_url, locale, country, created_at, last_seen_at,
deleted_at)`, `sessions(id, user_id, token_hmac UNIQUE, created_at, expires_at, ua_hash)`,
`devices(id, user_id, label, created_at, last_seen_at, revoked_at)`, `sync_meta(user_id PK,
salt, kdf_iter, wrapped_key, key_check, rev, bytes, updated_at)`, `subscribers(id, email UNIQUE,
locale, country, streams JSON, status, confirm_hmac, unsub_hmac, created_at, confirmed_at)`,
`email_queue(id, to_email, template, locale, vars JSON, stream, status, attempts, next_try_at,
created_at)`, `email_log(id, queue_id, status, smtp_id, error, at)`, `contact_messages`,
`posts(id, type CHECK(type IN('blog','news','event')), slug, status, published_at, updated_at,
author, cover_media_id)`, `post_i18n(post_id, locale, title, summary, body_html, seo_title,
seo_desc, PRIMARY KEY(post_id, locale))`, `events(post_id PK, starts_at, ends_at, tz, place,
online_url)`, `tags`, `post_tags`, `media(id, path, mime, w, h, alt_i18n JSON, sha256)`,
`settings(key PK, value)`, `country_defaults(cc PK, json)`, `audit_log(id, actor, action, target,
meta JSON, at)`, `rate_limits`. Indexes on all FKs and lookup columns. Test: migrate twice is a
no-op; FK cascade on user delete; `user_version` = 1.

**T-4.4 · ⬜ Hardening.** *Prompt:* `public/.htaccess` and `deploy/nginx.conf.example`: deny
dotfiles, `*.sqlite*`, `*.php` outside `/api`, `/admin`, `router.php`, `index.php`; rewrite
`/blog|/news|/events|/storage|/unsubscribe|/{ar,fr}/…` to their PHP front controllers. Send headers
from PHP **and** server config: `Content-Security-Policy` (`default-src 'self'; img-src 'self' data:
blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`),
`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (prod only),
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy: camera=(self), geolocation=(), microphone=()`. Test with curl in
`tests/php/headers.sh`.

**T-4.5 · ⬜ `/api/geo.php` + `/api/ping.php`.** `geo.php` returns only `{"country":"TN"}` or
`{"country":null}`, `Cache-Control: private, max-age=3600`. `ping.php` returns `{ok:true, t}` (HEAD
allowed) for the §6 heartbeat. **Then wire §3's `detectCountry()` (a) step to it.**

Acceptance §4: `npm run test:php` green; existing JS suites green under `php -S`; README "Running
the server" section; CHANGELOG §4.

### §5 · Account aside — ⬜ to do

**T-5.1 · ⬜ Prompt:** Using `js/aside.js` (same focus trap / Esc / scrim as the language aside),
create `js/account-aside.js`, opened by the header avatar button (`#acct-btn`,
`aria-controls="aside-acct"`) and shortcut **U**. Signed out: explains Stage 1 (no account needed),
buttons "Sign in with Google" (only if configured) and "Export my data" (RL-09, always available).
Signed in: photo via `/api/avatar.php` (server proxy that fetches the provider picture once,
re-encodes to 96×96 WebP/PNG with GD, caches in `/data/avatars/{user_id}`, `Cache-Control:
private, max-age=86400`; never hot-link Google from the browser — CSP), initials fallback
(`.acct-fallback`) on error; name, email, "Member since"; stats (people, open items) from local DB;
sync status dot `.sync-dot` with states **synced / pending / offline** (green/amber-neutral/grey —
never red) + `aria-label`; links: Sync settings, Devices, Export, Sign out (POST + CSRF). Keys in
en/ar/fr (`acct.*`). E2E: U opens, Esc closes, focus returns, RTL anchoring, 360px no overflow,
avatar fallback when `/api/avatar.php` 404s. Styles already exist in `css/style.css` (`acct-photo`,
`acct-fallback`, `sync-dot`, `acct-stats`).

### §6 · End-to-end encrypted sync — ⬜ to do

**T-6.1 · ⬜ Client crypto (`js/sync-crypto.js`).** *Prompt:* WebCrypto only. On "Turn on sync":
generate a random 256-bit **data key** (AES-GCM, extractable only for wrapping). Derive a
**wrapping key** from the user's sync passphrase with PBKDF2-SHA-256, **≥ 600 000 iterations**,
16-byte random salt. Wrap the data key with AES-KW (or AES-GCM). Also generate a **recovery phrase**
(24 words from a bundled word list, 256-bit entropy, checksum) that independently wraps the data key;
show it once, ask the user to re-type 3 words. Upload only `{salt, kdf_iter, wrapped_key,
wrapped_key_recovery, key_check}` (`key_check` = AES-GCM of a constant, to detect a wrong
passphrase without revealing anything). Each record is encrypted as `{v:1, iv(12B), ct}` with
AAD = `userId|table|recordId|rev`. Never send plaintext names, amounts, notes or dates. Tests:
round-trip, wrong passphrase → `key_check` fails, recovery phrase unwraps, tampered AAD fails,
iteration floor enforced on unwrap (refuse < 600 000).

**T-6.2 · ⬜ Server storage + API.** *Prompt:* Per-user SQLite `data/users/{user_id}.sqlite` (created on
first push, `0600`) with `records(table_name, record_id, rev, deleted, blob, updated_at,
device_id, PRIMARY KEY(table_name, record_id))` and `changes(seq INTEGER PK, table_name,
record_id, rev)`. Endpoints (session + CSRF, rate-limited, max body 2 MB, total quota per user
configurable, default 50 MB):
`POST /api/sync/setup.php` (store `sync_meta`), `GET /api/sync/meta.php`,
`GET /api/sync/pull.php?since=SEQ&limit=500` → `{changes:[{seq,table,id,rev,deleted,blob}],
next, more}`, `POST /api/sync/push.php` `{device_id, changes:[{table,id,base_rev,rev,deleted,blob}]}` →
accepts when `base_rev` matches, otherwise returns that item in `conflicts` with the server copy,
`GET/POST /api/sync/devices.php` (list, rename, revoke), `POST /api/sync/wipe.php` (delete the
per-user file and `sync_meta`; requires re-typing a confirmation word). The server treats blobs as
opaque bytes. PHP tests for each endpoint incl. conflict, quota, revoked device → 403.

**T-6.3 · ⬜ Client sync engine (`js/sync.js`).** *Prompt:* Outbox table in IndexedDB fed by
`store.js` writes (record id, table, rev++). Sync loop: push outbox → pull since last seq → decrypt
→ apply. Conflicts: if both sides changed the same record, keep **both** versions — the newer is
applied, the other goes into a "Needs a look" list (`#/sync/conflicts`) where the user picks; never
silently drop money data; audit-log every applied remote change (`sync.apply`). Triggers: after
local write (debounced 3 s), on `online`, on visibility, every 5 min. Heartbeat `HEAD /api/ping.php`
drives the header **net chip** (`.net-chip`: Online / Offline / Syncing…) and the `.sync-dot`.
Settings → "Sync" card: turn on (passphrase + recovery), status, last synced (relative), devices,
"Turn off sync on this device", "Delete synced copy from server" (wipe). Local data is never deleted
by turning sync off. E2E with two browser contexts: A creates a person + debt, B (same user,
passphrase) pulls and sees it; offline edit on both → conflict appears; server DB file contains no
plaintext name (grep the sqlite file). Keys in en/ar/fr.

### §6.5 · `/storage` page — ⬜ to do

**T-6.5 · ⬜ Prompt:** SSR page `/storage` (+ `/ar/storage`, `/fr/storage`) explaining where data
lives and why exporting matters: IndexedDB is "best-effort" storage that browsers may evict under
storage pressure; `navigator.storage.persist()` asks for persistent storage; Safari/WebKit may
delete script-writable storage after 7 days without user interaction for sites not added to the home
screen. **Every claim must cite its source with a link**, use only these (verify they still load):
MDN "Storage quotas and eviction criteria"
`https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria`,
MDN `StorageManager.persist()` `https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist`,
WebKit "Full Third-Party Cookie Blocking and More" (7-day cap)
`https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/`, WebKit "Updates to
Storage Policy" `https://webkit.org/blog/14403/updates-to-storage-policy/`. In-app: Settings shows
`navigator.storage.estimate()` and a "Keep my data on this device" button calling `persist()` with the
result explained calmly. Linked from Settings and from the export reminder. No fear wording.

### §7 · Email (PHPMailer, SMTP) — ⬜ to do

**T-7.1 · ⬜ Mailer + queue.** *Prompt:* `composer.json` with only `phpmailer/phpmailer` (vendor-dir
`vendor-php`). `app/Mailer.php` sends via SMTP from `dyon@dyon.store` (host/port/user/pass from
config; TLS required), sets `List-Unsubscribe: <https://dyon.store/unsubscribe?t=…>,
<mailto:unsubscribe@dyon.store?subject=…>` **and** `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
(RFC 8058) on every non-transactional stream, `Message-ID` on dyon.store, multipart text + HTML.
Everything goes through `email_queue`; `cron/send-mail.php` (every minute, lock file, batch 50,
exponential backoff, 5 attempts, writes `email_log`). Dev transport `file` writes `.eml` to
`data/mail-out/` so tests never hit SMTP.

**T-7.2 · ⬜ Streams + subscription.** Streams: `account` (transactional: sign-in notice, sync
enabled, device added, data wiped — not unsubscribable but minimal), `product` (release notes),
`blog`, `events`. `/api/subscribe.php` (double opt-in, rate-limited, honeypot field, no third-party
CAPTCHA) → confirm email; `/unsubscribe` page: GET shows a one-button form (never unsubscribes on
GET, because link scanners), POST (and RFC 8058 one-click POST) unsubscribes from that stream or all;
preference centre per stream. Tokens stored as HMACs only.

**T-7.3 · ⬜ Templates.** 13 templates × en/ar/fr in `/templates/email/{name}.{locale}.php` (or one
template + I18n keys; ICU via `app/I18n.php`): `subscribe_confirm`, `subscribe_welcome`,
`unsubscribe_done`, `signin_new_device`, `sync_enabled`, `sync_device_added`, `sync_wiped`,
`account_deleted`, `export_reminder`, `contact_received`, `contact_reply`, `digest_blog`,
`event_reminder`. RTL `dir="rtl"` for ar, inline CSS, no remote images, no tracking pixels, no click
redirects. **No template ever addresses a debtor/creditor third party** (R-D10). Contact form
`/api/contact.php` stores `contact_messages` and queues `contact_received`. Tests: render each
template in each locale (no missing keys, no `{placeholders}` left), headers present, unsubscribe
POST works, GET does not unsubscribe.

### §8 · Blog / news / events + SEO — ⬜ to do

**T-8.1 · ⬜ SSR.** *Prompt:* `public/blog.php` (front controller for `/blog`, `/news`, `/events`,
with `/ar/…` and `/fr/…` prefixes; English unprefixed): list pages (paginated 12), tag pages, post
pages, event pages (upcoming/past). Templates in `/templates/site/` share header/footer with the app
look (same CSS tokens), `<html lang dir>`, no JS required to read. `app/Seo.php`: `<title>`, meta
description, canonical, `hreflang` alternates for each existing translation + `x-default`, Open
Graph + Twitter card, JSON-LD (`Organization`, `WebSite`, `BlogPosting`/`NewsArticle` with
`datePublished/dateModified/inLanguage`, `Event` with `startDate`, `eventAttendanceMode`,
`location`, `BreadcrumbList`). `/sitemap.xml` (index) → `sitemap-pages.xml`, `sitemap-posts.xml`
with `xhtml:link` alternates; `/robots.txt` (disallow `/api`, `/admin`); `/feed.xml` (RSS 2.0) and
`/atom.xml` per locale. HTTP caching with `ETag`/`Last-Modified`. Tests: validate XML well-formed,
JSON-LD parses, hreflang reciprocity, 404 for drafts.

**T-8.2 · ⬜ Launch content (11 posts).** Write in en, ar and fr (hand-written, plain, calm):
1. Introducing DYON (what it is, local-first, no account needed) 2. Why DYON never charges interest
or late fees 3. Writing debts down — the Qur'anic guidance in 2:282 (quote the verse with a
reputable translation link, e.g. quran.com/2/282; **informational, not a fatwa**, recommend
asking a qualified scholar) 4. Giving more time to someone in hardship (2:280) 5. How to ask for
your money back kindly 6. How to talk about money with family 7. Your data stays on your device
(link `/storage`) 8. Exporting and backing up 9. Using DYON in Arabic and French 10. Settling with a
QR code in person 11. Roadmap / news: v2.0 release. Each post: sources section with links, no
medical/legal/religious rulings, no shaming language. Seed via `migrations/002_seed_posts.sql` or
`cron/seed-posts.php` reading `content/posts/*.md`.

### §9 · Delivery hygiene — 🟡 ongoing

- **T-9.1 · 🟡 Commits in order with tests** (§1, §2 done; client follow-ups done).
- **T-9.2 · ⬜ README v2.0**: what DYON is, local-first + E2E explanation, run (static + PHP),
  tests, i18n workflow, adding a language (`es, tr, de, id, ur` are in `PLANNED_LOCALES`: add
  `locales/xx.json`, register in `LOCALES`, run i18n-check), architecture diagram (text).
- **T-9.3 · 🟡 CHANGELOG** per section (§1, §2 written).
- **T-9.4 · ⬜ `docs/DEPLOY.md`**: PHP ≥ 8.2 check (`php -m` must list pdo_sqlite, sodium,
  mbstring, openssl, curl, gd); `/data` owned by the PHP user, `0700`, outside web root; `composer
  install --no-dev -o`; `php cron/migrate.php`; crontab (`* * * * * php cron/send-mail.php`,
  `17 3 * * * php cron/backup.php` → `sqlite3 .backup` with WAL-safe online backup, 14 daily + 8
  weekly, copied off-host, **user sync files are already encrypted**); DNS: SPF
  `v=spf1 include:<smtp-provider> -all`, DKIM key from the SMTP provider, DMARC
  `v=DMARC1; p=quarantine; rua=mailto:dmarc@dyon.store`; HTTPS (Let's Encrypt), HSTS after verifying
  HTTPS on all subdomains; CSP header; Google OAuth client (authorised redirect
  `https://dyon.store/api/auth/callback.php`); admin allowlist + TOTP enrolment; rollback steps.

### §10 · Admin — ⬜ to do

**T-10.1 · ⬜ Prompt:** `/admin` (PHP SSR, no SPA). Access: signed-in user whose email is in
`config['admin_emails']` **and** a valid TOTP (RFC 6238, 30 s, ±1 step, secret encrypted with the
server key, enrolment shows an `otpauth://` QR rendered locally, 10 single-use backup codes stored as
hashes); re-ask TOTP every 12 h; every admin action written to `audit_log`. Screens: dashboard
(counts only — users, subscribers per stream, queue depth, failures; **never ledger data**, which
the server cannot read anyway), posts CRUD per locale with preview + publish/schedule, events,
media upload (re-encode images with GD, strip EXIF, alt text per locale), subscribers (search,
export CSV, unsubscribe), email queue/log (retry), contact messages (reply → queues
`contact_reply`), settings, country defaults editor (`country_defaults` overrides
`assets/countries.json`). CSRF on every form, rate-limited login, `X-Robots-Tag: noindex`. Tests:
non-allowlisted → 404 (not 403), missing TOTP → TOTP page, wrong code rate-limited, audit rows written.

---

## D. Suggested order for the next agent

1. ~~T-2.1b → T-1.10b → T-2.5b~~ ✅
2. §3 country ← **next**
3. §4 (T-4.1 restructure first, alone in one commit, then 4.2–4.5)
4. §5 → §6 → §6.5 → §7 → §8 → §10 → T-9.2/T-9.4 → final PR description update

## E. Log (newest first — append one line per finished step)

| Date | Commit | What |
|---|---|---|
| 2026-10-30 | _this commit_ | T-2.1b SW caches locales + import-graph test + offline e2e; T-1.10b French tour e2e; T-2.5b language-aside e2e; overflow matrix in en/ar/fr (harness 100/123/31, e2e 17/17) |
| 2026-10-30 | `ac42f56` | docs: TASKS.md hand-off board created |
| 2026-10-30 | `c51d0b2` | §2 i18n: locale files, ICU, French UI+guide, i18n-check, detection, language aside; amount prefill + audit race fixes |
| 2026-10-30 | `e8964de` | WIP §2 French UI + guide, typography |
| 2026-10-30 | `019cd1b` | WIP §2 locale JSON, ICU formatter, codemod, i18n-check |
| 2026-10-30 | `fed6dcb` | §1 bug fixes 1.1–1.9 + Playwright e2e |
| 2026-10-30 | `320b098` | chore: LF line endings, package.json, harness runner |
