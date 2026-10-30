# DYON — ديون · The Commitments Ledger

DYON turns every commitment — money, an item, an hour, a promise or a trust — from a
hidden weight into a written, honoured and released one. Bilingual (English / Arabic,
full RTL), offline-first PWA, no interest ever, no shaming ever.

Canonical specification: [`docs/dyon-source-of-truth.md`](docs/dyon-source-of-truth.md).

---

## Run it

It is a static site with no build step.

```bash
python3 -m http.server 8080        # then open http://localhost:8080/
```

| Page | Purpose |
|---|---|
| `index.html` | The app |
| `preview-demo.html` | The app with a seeded demo ledger |
| `preview-rtl.html` | Demo ledger in Arabic, RTL, Hijri dates, Islamic mode |
| `preview-guide.html` | Opens straight into the guide |
| `tests.html` | Unit tests: money maths, validation, lifecycle, red lines, audit chain, auth, guide content |
| `route-check.html` | Renders every route (incl. every guide chapter and the glossary) in EN, AR+RTL and empty states |
| `flow-check.html` | Opens every form, submits invalid input, asserts nothing saved and a message was shown; checks the auth gate and dependent fields |

Current results: **84 unit · 123 route · 31 flow — all passing.**

---

## Accounts: local first, social sign-in only when needed

DYON works in two stages.

| Stage | What works | Storage | Sign-in |
|---|---|---|---|
| **1 · on this device** (default) | Adding, editing, payments, release, plans, calm mode, the vault, reports, **export and delete** | IndexedDB in this browser | Never |
| **2 · linked** | Anything that reaches **another person**: share for confirmation, reminders, thank-you messages, witnesses, settlement (ṣulḥ), transfer (ḥawālah) | Still IndexedDB. Records are **not** uploaded | Google, Apple or Microsoft |

- **Social only.** There is no email and password form.
- When a signed-out user taps a gated action, DYON explains why, offers the providers, and
  then **returns to the action they started** (the intent survives the provider redirect).
- RL-09: export and delete are never gated.
- The account card sits at the top of Settings. The header person icon opens sign-in, or
  shows that you are already linked.

### Configure providers

Edit `js/auth-config.js` and paste each provider's **public client ID**. No secrets go
there; the file ships to the browser. Register the page URL as the redirect URI, without
the hash, e.g. `https://your-domain.example/`.

| Provider | Where |
|---|---|
| Google | Cloud Console → Credentials → OAuth client ID → *Web application* |
| Apple | Developer → Identifiers → *Services ID* with Sign in with Apple (web) |
| Microsoft | Entra → App registrations → *Single-page application*, ID tokens enabled |

The flow is OpenID Connect `response_type=id_token` with `state` and `nonce`. The client
checks the nonce, audience and expiry.

When no client ID is set, `allowPreview: true` makes sign-in create a clearly labelled
**preview** identity, so you can test the gated flows. Set it to `false` in production.

> **Honest limit.** A static site has no server to verify token signatures. The linked
> identity labels your own records; it is **not** an authorisation boundary. Real
> multi-party sync will need a backend that verifies the `id_token`.

---

## Request QR codes (DYON logo in the middle)

Every request that goes to another person can be shown as a QR code with the DYON mark in
the centre:

| Request | Where the **QR code** button is |
|---|---|
| Confirm this record | Share sheet; also *QR code* in every record's Actions |
| Payment reminder | Reminder sheet (blocked if the message fails the kindness lint or the cap is reached) |
| Respite (inẓār) request | Request-respite sheet (after its form validates) |
| Settlement (ṣulḥ) proposal | Settlement sheet (after its form validates) |
| Witness invitation | Add-witness sheet |
| Thank-you | Thank-you sheet |

How it works:

- **Encoding.** Each code is a link, `…/#/r?d=<base64url JSON>`. It carries only this one
  request: kind, sender name, direction, unit, amount, description and dates. Never ids,
  notes or other debts (R-D11). Nothing is uploaded.
- **Rendering.** Error-correction level **H** (≈30 %). The logo square covers about 4 % of
  the symbol, snapped to whole modules and away from the finder patterns. It is drawn
  natively on a canvas, so it works offline. The library is the MIT
  `qrcode-generator`, vendored at `js/vendor/`, in UTF-8 mode so Arabic encodes correctly.
- **Scanning.** It opens a read-only request card. *Add to my ledger* opens the normal
  Quick Add form, prefilled and direction-mirrored, so the scanner checks every field
  before anything is saved. Scanned data is schema-checked, clamped and rendered as text
  only.
- **Actions.** *Save image* (PNG), *Share* (Web Share with the image file where
  supported) and *Copy link*.
- **Account.** Showing a QR is a stage-2 feature: it reaches another person, so it asks
  for a linked social account first and then resumes.

Generated codes were verified to decode with ZXing and OpenCV at several scales.

---

## Beginner guide, glossary and coach marks

- **Guide** (`#/guide`): 13 bilingual chapters. Every chapter has Previous / Next cards, a
  progress bar and an index. Chapters you have read get a tick.
- **A–Z glossary** (`#/guide?p=glossary`): built automatically from every term defined in
  the chapters, so it cannot drift out of date. Searchable (diacritic-insensitive). Every
  entry links back to its chapter.
- **Coach-mark tours** with Previous / Next / Skip, step dots, and ← → / Esc on a keyboard.
  There is one tour per screen: Overview, Ledger, People and Settings. Steps whose anchor
  isn't visible at the current screen size are skipped automatically. On phones the
  bubble docks to the bottom (or the top, when the target is low) so it never runs off
  the screen.
- **Where they are wired in:**
  - The **? help button** in the header opens a context sheet: what this screen is for,
    *Tour this screen*, the matching chapter, the glossary and the full guide.
  - The sidebar's *Guide & help* item, and the phone *More* sheet, which also has a quick
    *Take the tour* chip.
  - **Onboarding**: a guide/glossary card on the first step, and a *What next?* card at
    the end (tour, guide, account chapter).
  - A dismissible "New here?" banner on the Overview, plus cards in Settings and About.
  - Keyboard: `?` opens the guide, `N` adds a commitment, `C` toggles calm mode, `/` searches.

---

## Mobile and UX fixes in this release

- **No horizontal scroll:**
  - The header no longer overflows. On phones, Theme / Inbox / New move into the bottom
    bar and the More sheet.
  - The net-position table becomes labelled stacked rows.
  - List rows wrap.
  - The calendar uses `minmax(0,1fr)` columns and shows dots instead of names.
  - These were checked at 320 px and 360 px, in EN and AR, on every route.
- **No jump to the top:** a save re-renders the view *in place*. Only a real navigation
  scrolls to the top.
- **"More" no longer bounces:** it is a sheet, not a route that called `history.back()`
  when it closed.
- **One-shot routes** (`#/tour`, `#/add`, `#/more`) rewrite themselves to `#/`, so a later
  save can't re-open a sheet or restart the tour.
- **Sheets:**
  - They close on navigation, lock background scroll, respect safe areas and `100dvh`,
    and return focus to the button that opened them.
  - On touch devices they don't auto-focus an input, so the keyboard doesn't cover the
    form before you've read it.
- **No reloads:** *Delete everything* re-routes to onboarding instead of `location.reload()`.
- **Onboarding** keeps your step across re-renders, and has Previous as well as Next.
- **Tour:**
  - The highlighted element is no longer blurred or double-dimmed.
  - The ring is clamped to the viewport.
  - Same-route re-renders re-anchor it.
- **Other:**
  - `[hidden]` now beats any `display` rule.
  - Tap targets are ≥ 38 px.
  - All in-app buttons are `type="button"`.

### Form order and dependent fields

Quick Add is now numbered: **1 Who & which way → 2 What → 3 When → 4 Who sees it →
More details**. Fields appear only when an earlier answer needs them:

| Field | Shown when |
|---|---|
| Amount, *It's approximate* | Unit isn't *Promise* (otherwise the description becomes required) |
| Due-date picker | A dated due option is chosen (*In a week*, *In a month*, *Pick a date*) |
| Installments | There is an amount **and** a real due date |
| Gold reference | The unit is gold or silver |
| Witness names | Privacy is *Shared + witnesses* (then at least one name is required) |
| Counterparty kind | Editable for a new person; locked to the saved kind for a known one |
| Save button | Reads *Save* when private, *Save & share* when shared |
| Due date `min` | Follows the *Date incurred* field |

Elsewhere:

- **Edit:** unit comes before amount, and the amount is hidden for promises.
- **Settlement:** the FX-rate field only appears when the unit changes.
- **Settings:**
  - The *Spiritual ledger* switch only appears under Islamic mode, and turning Islamic
    mode off turns the spiritual ledger off too.
  - The second calendar can't equal the first.
  - The Islamic tone is offered only in Islamic mode.
  - Quiet hours must have a start and end that differ.

---

## Project structure

```
index.html, sw.js, manifest.webmanifest
css/style.css            design system, RTL, mobile hardening
js/app.js                shell: header, rail, mobile bar, More sheet, router, boot
js/auth.js               staged social sign-in, gate, redirect handling, account card
js/auth-config.js        provider client IDs (public), preview switch
js/qr.js                 request QR codes with centre logo, #/r scanned-request view
js/vendor/qrcode-generator.js   MIT QR encoder (vendored, ES module, UTF-8)
js/store.js / db.js      IndexedDB state, append-only hash-chained audit log
js/flows.js              every sheet/form (Quick Add, payment, release, ṣulḥ, …)
js/views.js / views2.js  screens
js/guide.js              guide, glossary, help sheet, coach-mark engine
js/guide-content.js      chapters, per-screen tours, screen help (EN + AR)
js/validate.js           plain-language validation
js/i18n.js / units.js    locales, digits, calendars, integer money
js/tests.js, route-check.js, flow-check.js   harnesses
```
