# Changelog

All notable changes to DYON. Dates are UTC. The canonical spec is
`docs/dyon-source-of-truth.md`; red-line IDs (RL-xx) and rule IDs (R-xx) refer to it.

## [2.0.0] — unreleased

### 6.5 · Storage page
- **`/storage`, `/ar/storage`, `/fr/storage`** (server-rendered): where data lives, when browsers may evict it, what `navigator.storage.persist()` does, what to do. Every claim cites MDN or WebKit with a link. A live panel (read in the browser, nothing sent) shows usage and a calm "Keep my data on this device" button; Settings has the same card.

### 6 · End-to-end encrypted sync
- **Optional, zero-knowledge.** Turn on in Settings → Sync: passphrase (≥12) + 24-word recovery phrase (BIP-39). A random AES-GCM data key is wrapped
  twice (PBKDF2-SHA-256 ≥600 000 it. and recovery key); every record is encrypted on-device (AAD = user|table|id|rev). The server stores opaque blobs
  in a per-user 0600 SQLite file named by HMAC, with quota, revision conflicts, device list/revoke and a confirmed "delete server copy".
- **Engine.** Own IndexedDB, 3-way merge; amount/date/direction/type/status clashes go to **Needs a look** with the other value one tap away.
  Spiritual notes, audit log and settings never leave the device. Offline-first with heartbeat + backoff; "Delete all data" turns sync off (RL-09).

### 5 · Account aside
- **Account panel (5.1).** Header avatar button `#acct-btn` and shortcut **U** open an aside (reuses `aside.js`). Signed out: explains Stage 1,
  sign-in buttons only for configured providers, and **Export my data** (RL-09, never gated). Signed in: same-origin 32/56 px picture with an
  initial-on-gradient fallback, name, email, member-since, local stats (hidden in Calm mode), a sync dot (green/amber/grey, never red),
  Sync settings · Devices · Export · Sign out (POST + CSRF). `/api/avatar.php` proxies the provider picture once (https only, public IPs
  pinned, 1 MB / 4000 px caps, re-encoded 96×96 WebP, cached, `private, max-age=86400`). Inbox count badges are announced with an ICU label.

### 4 · Server (in progress)
- **Layout (4.1).** Web root is `public/`; `app/` (PSR-4 `Dyon\\`, `bootstrap.php`, `Config`), `config/`,
  `data/`, `cron/`, `migrations/`, `templates/`, `tests/php/`. `public/router.php` (dev) and
  `public/.htaccess` (Apache) deny private paths; harness pages live in `public/dev/` and 404 in production.
  `npm run check` runs every gate.
- **Core classes + schema (4.2–4.3).** `Db`, `Crypto`, `Session` (`__Host-dyon_sess`, hmac-only storage, 30-day sliding, rotated on login),
  `Csrf`, `RateLimit`, `Geo`, `I18n`, `Http`, `Auth` (OIDC code + PKCE; ID-token RS256 against cached JWKS; iss/aud/exp/nonce;
  Apple `form_post`). `migrations/001_init.sql`. Only `sha256(provider:sub)` is stored; unverified emails are discarded.
- **Hardening + endpoints (4.4–4.5).** CSP + security headers from PHP, Apache and Nginx (`deploy/nginx.conf.example`);
  `/api/geo.php` (`{country}` only), `/api/ping.php` (HEAD ok), `/api/auth/*`.

### 1 · Bug fixes
- **Tour vs onboarding (1.1).** `startTour()` refuses the Overview tour while
  `settings.onboarded` is false and shows "Finish setup first, then take the tour";
  the setup screen gets its own three-step tour. The tour now awaits the router's
  `dyon:rendered` CustomEvent instead of a 320 ms timer, ends itself when the route
  leaves its page, and drops at most one missing step silently — any other missing
  anchor shows "This part isn't on screen yet" with Skip.
- **Mobile tour layout (1.2).** While touring, `.mobile-bar` is `inert` and below the
  scrim; `.tour-bubble` is z-index 310 and docks at
  `calc(var(--mbar-h,64px) + 10px + env(safe-area-inset-bottom))`. The dock side is
  decided once per step after scrolling settles (`scrollend`, 400 ms fallback).
- **Greeting (1.3)** uses the ICU message `greet.with_name` (no concatenation, R-G01).
- **Title (1.4)** comes from i18n; discreet mode keeps "Notes".
- **auth-config (1.5)**: preview sign-in only on localhost; unconfigured providers are
  hidden in production. Harness pages can force preview so tests never redirect.
- **tourDone() (1.6)** returns false on storage errors and keeps state in memory.
- **Self-hosted assets (1.7)**: Inter, Noto Sans Arabic and Noto Kufi Arabic variable
  woff2 subsets and a 110-icon Font Awesome subset (11 KB, `scripts/build-icons.py`)
  in `/vendor`. No Google Fonts or CDN calls remain. CSP meta added.
- **Service worker (1.8)**: `VERSION` is a hash of the CORE files
  (`php scripts/build-sw.php`, `--check` for CI); a new version waits and the app shows
  "A new version is ready — Reload".
- **Progress storage (1.9)**: guide chapters read and tour completion moved from
  localStorage into the IndexedDB settings row (export/import carry it); legacy keys
  are migrated once.
- **Tests (1.10)**: `scripts/e2e.mjs` (Playwright) — onboarding → guide → tour, tour +
  bottom bar, route change, missing targets, RTL tour, overflow at 360/768/1280 in
  light and dark. `scripts/run-harness.mjs` runs the in-browser harnesses headless.
  The flow check hung before because preview sign-in redirected to Google; fixed.
- **Boot loader vs PIN gate.** The first-paint loader (`#boot-screen`, z-index 500)
  was only removed *after* `pinGate()`. When a PIN was set, the loader covered the
  PIN overlay (z-index 400), the prompt could never be typed, `pinGate()` never
  resolved and a reload was stuck on the loader forever. The loader is now hidden by
  an idempotent `hideBootScreen()` **before** the PIN gate (and still on success and
  on startup error). Unit test asserts the removal precedes `await pinGate()`.
- **`mobile-web-app-capable` meta.** Added the standard
  `<meta name="mobile-web-app-capable" content="yes">` next to the Apple-prefixed one
  in `index.html` and `privacy.html`, silencing the console deprecation warning
  "`apple-mobile-web-app-capable` is deprecated. Please include
  `mobile-web-app-capable`". Unit test asserts the standard tag is present.

### 2 · Languages: en, ar, fr (+ ready for es, tr, de, id, ur)
- `js/i18n.js` rewritten: `LOCALES = { en, ar, fr }` (+ `PLANNED_LOCALES` es/tr/de/id/ur, listed but
  disabled until native review, RL-12). Strings live in `/locales/{code}.json`, lazy-loaded, fallback
  chain requested → en. ICU subset with nested `plural` / `select` and `#`; plural categories from
  `Intl.PluralRules` per locale; numbers/dates via `Intl` with the user's digit preference on top.
- Every inline `isAR() ? … : …`, `L(en, ar)` and `getLocale() === 'ar'` wording ternary moved into keys
  (codemod kept at `scripts/codemod-i18n.mjs`); every sentence built by concatenation rewritten as one
  ICU message (R-G01). Tone templates, insights and the share message are ICU messages too.
- `guide-content.js` is `{ en, ar, fr }` for every field (326 fields).
- French written by hand (not machine-translated), with the canonical vocabulary ("Je dois / On me doit",
  "Libérer (annulable 24 h)", "Délai de grâce", "Transfert (ḥawālah)", "Règlement amiable (ṣulḥ)").
  French typography (U+202F before ; : ! ? » and after «) is applied by `scripts/fr-typography.mjs`;
  sources live in `scripts/out/fr-*.json` / `guide-fr-*.json`, built by `npm run i18n:build`.
- `scripts/i18n-check.mjs` (CI): missing keys per locale, placeholder parity (recursive ICU parser),
  unbalanced braces, locale ternaries, `t()` concatenated with text, French typography, guide fields.
- Detection on first run: saved setting → `?lang=` → `navigator.languages` → country default → en; never
  auto-switches after the user chose (`locale_chosen`).
- Language aside (`js/aside.js`, `js/lang-aside.js`): header `fa-language` button or **L**; slides from
  the inline-end side (start in RTL), search, native + English names, current tick, "Detected: … (from
  your browser)", opt-in "also use this language's digits/calendar defaults". Esc/scrim close, focus
  trapped and returned, never touches the route or history.
- Fixed: amount fields prefilled with grouping ("1,500.00") were rejected by their own validator (the
  settlement QR could not be shown in a fresh session). One shared parser `normalizeDecimal()` (handles
  `1 500,50`, `1.250,00`, `1,250.00`, Arabic-Indic digits) and `inputValue()` for prefills.
- Fixed: concurrent audit writes could fork the hash chain (R-M02); writes are now serialised and the
  verifier walks links instead of timestamps.
- **Offline in every language.** `locales/*.json`, `js/aside.js` and `js/lang-aside.js`
  are in the service-worker CORE. A unit test walks the `app.js` import graph and fails
  if any module or locale file is missing from CORE.
- **E2E coverage:** French tour (375×812), language aside in en/ar at 375 and 1280
  (dialog semantics, inline-end anchoring, search, focus trap, Esc returns focus, no
  route/history change, explicit choice survives `?lang=`), offline reload with
  language switching, and the overflow matrix now runs in en, ar and fr.
- **Hand-off board:** `docs/TASKS.md` lists every v2.0 task with its status and a
  self-contained prompt for other agents.

### 3 · Country detection and country-based defaults
- `scripts/build-countries.py` generates `data/countries.json` (canonical; seeds the
  SQLite `country_defaults` table in §4), `assets/countries.json` (client copy, in the
  service-worker CORE) and `js/tz-country.js` (IANA timezone → ISO-3166 map from the
  system tz database, 418 zones). 25 seed countries (TN DZ MA LY EG SA AE QA KW JO LB
  FR BE CH CA DE IT GB US TR ID MY PK SN NG) with locales, currency + ISO 4217 minor
  units, digits, primary/secondary calendar, week start, date & number format,
  `suggest_islamic_mode` (suggestion only), a zakat note, a legal-disclaimer variant
  and **HTTP-200-checked** emergency/debt-advice resource links (checked 2026-10-29;
  links that returned 403/timeout to the checker were left out rather than guessed).
- Currencies **LYD** (3 minor units) and **XOF** (0) added to `CURRENCIES` in
  `js/units.js` (R-G03).
- `js/country.js`: `detectCountry()` in order — (a) same-origin `GET /api/geo.php`
  → `{country}` (skipped silently on 404/offline; never third-party), (b)
  `Intl.DateTimeFormat().resolvedOptions().timeZone` → `TZ_COUNTRY`, (c) region subtag
  of `navigator.language` (`fr-TN` → TN). `applyCountry(cc, {apply})` records the
  country and, **only when the user said yes**, re-applies currency/digits/calendar/
  week start — and the locale **only if the user hasn't chosen one** (`locale_chosen`).
  It **never** turns on Islamic mode (suggestion text only, §3.2). The detected
  country's locales feed `firstRunLocale()` as the §2.4 country step.
- Onboarding (step 0) shows a calm suggestion card "It looks like you're in {country}
  — use {country} defaults?" with **[Yes]** / **[Choose]** (a searchable picker using
  `Intl.DisplayNames` for country names — never concatenated).
- Settings → new **Region** card (`#region-card`): country picker; changing it offers
  (never forces) "Re-apply {country} defaults?" with "Keep my settings"; an
  Islamic-calendar hint appears for countries where it's common, as a suggestion only.
- Tests: 11 unit checks (TZ map, region subtag, detection order with mocked
  fetch/timezone/language, `applyCountry` never sets `islamic_mode`, never overrides a
  chosen locale, `apply:false` records only the country, all 25 seeds present with
  correct minor units) and 3 e2e scenarios (onboarding suggests TN via Playwright
  `timezoneId: 'Africa/Tunis'`; Yes applies TND without Islamic mode; Settings→Region
  offers but "Keep my settings" changes nothing). No request leaves the origin.
