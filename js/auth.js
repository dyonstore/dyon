/* DYON — staged, social-only sign-in.

   Stage 1 (default): everything lives in IndexedDB on this device. No account,
   no server, no sign-in prompt. A private ledger never needs one.

   Stage 2: the moment a feature involves ANOTHER PERSON — sharing a record for
   confirmation, sending a reminder, inviting a witness, proposing a ṣulḥ or a
   ḥawālah — DYON asks the user to link a social account (Google, Apple or
   Microsoft). The other side deserves to know who is writing to them, and a
   shared record needs an author who cannot be trivially impersonated.

   There are no passwords and no email/password form, by design.

   Flow: OpenID Connect implicit flow (response_type=id_token) with `state` and
   `nonce`, returning to this page's URL. The id_token's claims are read in the
   browser to identify the user. A static app cannot verify a token signature
   against a server it does not have, so the session is an identity HINT for
   the user's own records, not an authorisation boundary — that is stated in
   the UI and the README. */

import { t, tr } from './i18n.js';
import * as S from './store.js';
import { AUTH_CONFIG } from './auth-config.js';
import { el, icon, sheet, closeSheet, toast } from './ui.js';


export const PROVIDERS = {
  google: {
    label: 'Google', icon: 'fa-brands fa-google',
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    extra: { scope: 'openid email profile', response_mode: 'fragment', prompt: 'select_account' }
  },
  apple: {
    label: 'Apple', icon: 'fa-brands fa-apple',
    authorize: 'https://appleid.apple.com/auth/authorize',
    // Apple only returns id_token in the fragment when no scope is requested.
    extra: { response_mode: 'fragment' }
  },
  microsoft: {
    label: 'Microsoft', icon: 'fa-brands fa-microsoft',
    authorize: (cfg) => `https://login.microsoftonline.com/${cfg.tenant || 'common'}/oauth2/v2.0/authorize`,
    extra: { scope: 'openid email profile', response_mode: 'fragment', prompt: 'select_account' }
  }
};

/* Features that leave the device or involve someone else. Everything not in
   this list (adding, editing, paying, exporting, deleting, calm mode, the
   guide…) always works without an account. RL-09: export is never gated. */
export const GATED = {
  share: { en: 'Sharing a record for the other person to confirm', ar: 'مشاركة سجل ليؤكده الطرف الآخر' },
  remind: { en: 'Sending a reminder to someone', ar: 'إرسال تذكير لشخص' },
  witness: { en: 'Inviting a witness', ar: 'دعوة شاهد' },
  settlement: { en: 'Proposing a settlement (ṣulḥ) to the other party', ar: 'اقتراح صلح على الطرف الآخر' },
  transfer: { en: 'Transferring a debt to a third person (ḥawālah)', ar: 'تحويل دين إلى طرف ثالث (حوالة)' },
  thanks: { en: 'Sending a thank-you message', ar: 'إرسال رسالة شكر' },
  qr: { en: 'Showing a request as a QR code for someone to scan', ar: 'عرض طلب كرمز QR ليمسحه شخص آخر' }
};

const PENDING_KEY = 'dyon.auth.pending';
const resumers = new Map();

/* ---------------- session ---------------- */
export function session() {
  const a = S.state.settings.account;
  if (!a || !a.sub) return null;
  if (a.expires_at && Date.now() > a.expires_at) return null;
  return a;
}
export function isSignedIn() { return !!session(); }
export function providerConfigured(id) {
  const p = AUTH_CONFIG.providers[id];
  return !!(p && p.clientId);
}
export function anyProviderConfigured() {
  return Object.keys(PROVIDERS).some(providerConfigured);
}

export async function signOut() {
  await S.saveSettings({ account: null });
  toast(t('auth.signed_out_ledger_stays'), 'good');
}

/* ---------------- gate ---------------- */
/* Flows register how to resume after the provider redirects back. */
export function registerResume(feature, fn) { resumers.set(feature, fn); }

/* Run `action` now if signed in; otherwise explain why and offer sign-in.
   `payload` must be JSON-serialisable so the intent survives the redirect. */
export function requireAuth(feature, payload, action) {
  if (isSignedIn()) { action(); return true; }
  openSignIn({ feature, payload, onDone: action });
  return false;
}

/* ---------------- sign-in sheet ---------------- */
export function openSignIn({ feature, payload, onDone } = {}) {
  const why = feature && GATED[feature];
  const configured = anyProviderConfigured();

  /* Production shows only providers that are actually configured; preview
     (localhost) shows all three, clearly badged. */
  const visible = Object.entries(PROVIDERS).filter(([id]) => providerConfigured(id) || AUTH_CONFIG.allowPreview);
  const buttons = visible.map(([id, p]) => {
    const ready = providerConfigured(id) && !AUTH_CONFIG.previewOnly;
    const usable = ready || AUTH_CONFIG.allowPreview;
    return el('button', {
      type: 'button',
      class: 'btn btn-block social-btn social-' + id,
      disabled: !usable,
      'data-provider': id,
      onclick: () => {
        if (ready) startRedirect(id, feature, payload);
        else previewSignIn(id, onDone);
      }
    }, [
      icon(p.icon),
      el('span', { text: t('auth.continue_with', { provider: p.label }) }),
      !ready ? el('span', { class: 'badge', text: AUTH_CONFIG.allowPreview ? t('auth.preview') : t('auth.not_set_up') }) : null
    ]);
  });

  sheet({
    title: t('app.link_account'),
    body: el('div', { class: 'stack' }, [
      why ? el('div', { class: 'notice', style: { color: 'var(--text)' } }, [
        el('b', { text: t('auth.why_now') }), ' ',
        el('span', { text: t('auth.gate_reason', { feature: tr(why) }) })
      ]) : null,
      el('p', { text: t('auth.private_ledger_keeps_working') }),
      el('div', { class: 'stack', style: { gap: '8px' } }, buttons),
      !configured && AUTH_CONFIG.allowPreview ? el('p', { class: 'hint', text: t('auth.no_provider_configured_on') }) : null,
      el('ul', { class: 'listy auth-promises' }, [
        t('auth.no_passwords_social_sign'),
        t('auth.dyon_reads_name_email'),
        t('auth.records_are_not_uploaded'),
        t('auth.export_delete_never_need')
      ].map(x => el('li', {}, [el('div', { class: 'item-row', style: { cursor: 'default' } }, [
        icon('fa-shield-halved'), el('span', { class: 'item-main', text: x })
      ])])))
    ]),
    footer: [
      el('button', { class: 'btn', text: t('auth.not_now'), onclick: () => closeSheet() })
    ]
  });
}

function randomToken(n = 16) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
}

function redirectUri() {
  return location.origin + location.pathname;
}

function startRedirect(providerId, feature, payload) {
  const p = PROVIDERS[providerId];
  const cfg = AUTH_CONFIG.providers[providerId];
  const state = randomToken();
  const nonce = randomToken();
  const pending = {
    provider: providerId, state, nonce, feature: feature || null, payload: payload ?? null,
    return_hash: location.hash || '#/', at: Date.now()
  };
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending)); } catch {}
  const params = new URLSearchParams(Object.assign({
    client_id: cfg.clientId,
    redirect_uri: redirectUri(),
    response_type: 'id_token',
    state, nonce
  }, p.extra));
  const base = typeof p.authorize === 'function' ? p.authorize(cfg) : p.authorize;
  location.assign(base + '?' + params.toString());
}

/* Preview: a clearly-labelled local identity, so the gated flows can be
   exercised before a provider is registered. Still social-shaped: the user
   picks a provider, never types a password. */
function previewSignIn(providerId, onDone) {
  const p = PROVIDERS[providerId];
  const now = Date.now();
  const name = S.state.settings.display_name || t('auth.preview_user');
  establish({
    provider: providerId, sub: 'preview-' + providerId, email: '', name,
    picture: '', preview: true, linked_at: now
  }).then(() => {
    closeSheet(true);
    toast(t('auth.linked_with_preview', { label: p.label }), 'good');
    if (onDone) setTimeout(onDone, 120);
  });
}

async function establish(acc) {
  const days = AUTH_CONFIG.sessionDays || 30;
  await S.saveSettings({ account: Object.assign({ expires_at: Date.now() + days * 864e5 }, acc) });
}

/* ---------------- redirect return ---------------- */
export function decodeJwt(token) {
  const part = String(token || '').split('.')[1];
  if (!part) throw new Error('malformed token');
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64 + '==='.slice((b64.length + 3) % 4);
  const json = decodeURIComponent(Array.from(atob(pad), c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
  return JSON.parse(json);
}

/* Validate claims we CAN check client-side. Returns an error string or null. */
export function checkClaims(claims, pending, cfg, now = Date.now()) {
  if (!claims || !claims.sub) return 'missing subject';
  if (claims.nonce !== pending.nonce) return 'nonce mismatch';
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (cfg && cfg.clientId && !aud.includes(cfg.clientId)) return 'audience mismatch';
  if (claims.exp && claims.exp * 1000 < now - 60000) return 'token expired';
  return null;
}

/* Must run BEFORE the hash router, because the provider returns
   `#id_token=…&state=…`, which is not a DYON route. */
export async function handleRedirect() {
  const h = location.hash.replace(/^#/, '');
  if (!/(^|&)(id_token|error)=/.test(h)) return null;
  const params = new URLSearchParams(h);
  let pending = null;
  try { pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null'); } catch {}
  sessionStorage.removeItem(PENDING_KEY);
  const back = (pending && pending.return_hash) || '#/';
  history.replaceState(null, '', location.pathname + location.search + back);

  if (params.get('error')) {
    setTimeout(() => toast(t('auth.sign_in_was_cancelled'), 'warn'), 600);
    return { ok: false };
  }
  if (!pending || params.get('state') !== pending.state) {
    setTimeout(() => toast(t('auth.sign_in_could_not'), 'warn'), 600);
    return { ok: false };
  }
  try {
    const claims = decodeJwt(params.get('id_token'));
    const problem = checkClaims(claims, pending, AUTH_CONFIG.providers[pending.provider]);
    if (problem) throw new Error(problem);
    await establish({
      provider: pending.provider, sub: String(claims.sub),
      email: claims.email || '', name: claims.name || claims.given_name || claims.email || PROVIDERS[pending.provider].label,
      picture: claims.picture || '', preview: false, linked_at: Date.now()
    });
    setTimeout(() => toast(t('auth.account_linked'), 'good'), 500);
    if (pending.feature && resumers.has(pending.feature)) {
      setTimeout(() => resumers.get(pending.feature)(pending.payload), 700);
    }
    return { ok: true };
  } catch (e) {
    setTimeout(() => toast(t('auth.sign_in_failed', { reason: e.message }), 'warn'), 600);
    return { ok: false };
  }
}

/* ---------------- account card (Settings / More) ---------------- */
export function accountCard() {
  const a = session();
  if (!a) {
    return el('section', { class: 'card', id: 'account-card' }, [
      el('h3', {}, [icon('fa-user-shield'), el('span', { text: ' ' + t('auth.account') })]),
      el('p', { class: 'card-sub', text: t('auth.not_linked_everything_write') }),
      el('div', { class: 'row tight' }, [
        el('span', { class: 'badge' }, [icon('fa-database'), el('span', { text: t('auth.stage_1_on_device') })])
      ]),
      el('div', { style: { height: '10px' } }),
      el('button', { class: 'btn btn-primary', onclick: () => openSignIn() },
        [icon('fa-right-to-bracket'), el('span', { text: t('app.link_account') })])
    ]);
  }
  const p = PROVIDERS[a.provider] || { label: a.provider, icon: 'fa-user' };
  return el('section', { class: 'card', id: 'account-card' }, [
    el('h3', {}, [icon('fa-user-shield'), el('span', { text: ' ' + t('auth.account') })]),
    el('div', { class: 'row' }, [
      el('span', { class: 'avatar k2', 'aria-hidden': 'true', text: (a.name || '?').trim().slice(0, 1) }),
      el('div', { class: 'item-main' }, [
        el('b', { text: a.name || p.label }),
        el('small', { text: t('auth.account_line', { email: a.email || '', hasEmail: a.email ? 'yes' : 'no', provider: p.label, preview: a.preview ? 'yes' : 'no' }) })
      ])
    ]),
    el('div', { class: 'row tight', style: { marginTop: '10px' } }, [
      el('span', { class: 'badge badge-good' }, [icon('fa-link'), el('span', { text: t('auth.stage_2_linked') })]),
      a.preview ? el('span', { class: 'badge badge-needs', text: t('auth.not_verified') }) : null
    ]),
    el('p', { class: 'hint', text: t('auth.unlocked_sharing_reminders_witnesses') }),
    el('button', { class: 'btn btn-sm', onclick: () => signOut() },
      [icon('fa-right-from-bracket'), el('span', { text: t('auth.sign_out') })])
  ]);
}
