# Changelog

All notable changes to DYON. Dates are UTC. The canonical spec is
`docs/dyon-source-of-truth.md`; red-line IDs (RL-xx) and rule IDs (R-xx) refer to it.

## [2.0.0] — unreleased

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
