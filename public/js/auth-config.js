/* DYON — social sign-in configuration.
   DYON is local-first: nothing here is needed to keep a private ledger.
   An account is only asked for when a feature involves another person or
   leaves this device (see GATED in auth.js).

   To enable a real provider, register a web / SPA application with it and
   paste the public client ID below. The redirect URI to register is the
   page URL itself, e.g. https://your-domain.example/  (no hash).

   No client secret ever belongs in this file — it ships to the browser. */

const HOST = typeof location !== 'undefined' ? location.hostname : '';
export const IS_LOCAL = HOST === 'localhost' || HOST === '127.0.0.1' || HOST === '[::1]' || HOST.endsWith('.localhost');

export const AUTH_CONFIG = {
  providers: {
    google: {
      // https://console.cloud.google.com/apis/credentials → OAuth client ID → Web application
      clientId: '868888221866-u07rkac706ss4cmdgtnekq6cbd372f8t.apps.googleusercontent.com'
    },
    apple: {
      // https://developer.apple.com → Identifiers → Services ID (Sign in with Apple, web)
      clientId: ''
    },
    microsoft: {
      // https://entra.microsoft.com → App registrations → SPA, enable ID tokens
      clientId: '',
      tenant: 'common'
    }
  },

  /* Preview mode lets you try the gated flows before any provider is
     configured. The session it creates is clearly labelled "preview" and is
     never treated as a verified identity. It is ONLY available on localhost;
     on dyon.store (or any other host) it is always off. */
  allowPreview: IS_LOCAL,

  /* Test harnesses set window.DYON_AUTH_PREVIEW_ONLY so a configured provider
     never triggers a real redirect during automated checks (localhost only). */
  previewOnly: IS_LOCAL && typeof window !== 'undefined' && !!window.DYON_AUTH_PREVIEW_ONLY,

  /* Linked sessions are re-confirmed after this many days. */
  sessionDays: 30
};
