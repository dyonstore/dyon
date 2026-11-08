-- DYON system.sqlite — v1. Aggregates/accounts/content only. NEVER ledger content (E2E: the server can't read it).
CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  provider      TEXT NOT NULL,
  sub_hash      TEXT NOT NULL,                 -- sha256(provider + ':' + sub); the raw sub is never stored
  email         TEXT,
  name          TEXT,
  avatar_url    TEXT,
  locale        TEXT,
  country       TEXT,
  created_at    INTEGER NOT NULL,
  last_seen_at  INTEGER,
  deleted_at    INTEGER,
  UNIQUE(provider, sub_hash)
);
CREATE INDEX idx_users_email ON users(email);

CREATE TABLE sessions (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hmac  TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  ua_hash     TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

CREATE TABLE devices (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label        TEXT,
  created_at   INTEGER NOT NULL,
  last_seen_at INTEGER,
  revoked_at   INTEGER
);
CREATE INDEX idx_devices_user ON devices(user_id);

CREATE TABLE sync_meta (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  salt        TEXT,
  kdf_iter    INTEGER,
  wrapped_key TEXT,
  key_check   TEXT,
  rev         INTEGER NOT NULL DEFAULT 0,
  bytes       INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER
);

CREATE TABLE subscribers (
  id           INTEGER PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  locale       TEXT NOT NULL DEFAULT 'en',
  country      TEXT,
  streams      TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(streams)),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','active','unsubscribed','bounced')),
  confirm_hmac TEXT,
  unsub_hmac   TEXT,
  created_at   INTEGER NOT NULL,
  confirmed_at INTEGER
);
CREATE INDEX idx_subscribers_status ON subscribers(status);

CREATE TABLE email_queue (
  id          INTEGER PRIMARY KEY,
  to_email    TEXT NOT NULL,
  template    TEXT NOT NULL,
  locale      TEXT NOT NULL DEFAULT 'en',
  vars        TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(vars)),
  stream      TEXT NOT NULL CHECK(stream IN('contact','account','newsletter','notify')),
  status      TEXT NOT NULL DEFAULT 'queued' CHECK(status IN('queued','sending','sent','failed','cancelled')),
  attempts    INTEGER NOT NULL DEFAULT 0,
  next_try_at INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_email_queue_due ON email_queue(status, next_try_at);

CREATE TABLE email_log (
  id        INTEGER PRIMARY KEY,
  queue_id  INTEGER REFERENCES email_queue(id) ON DELETE SET NULL,
  status    TEXT NOT NULL,
  smtp_id   TEXT,
  error     TEXT,
  at        INTEGER NOT NULL
);
CREATE INDEX idx_email_log_queue ON email_log(queue_id);

CREATE TABLE contact_messages (
  id         INTEGER PRIMARY KEY,
  name       TEXT,
  email      TEXT NOT NULL,
  topic      TEXT,
  message    TEXT NOT NULL,
  locale     TEXT,
  created_at INTEGER NOT NULL,
  handled_at INTEGER
);

CREATE TABLE media (
  id       INTEGER PRIMARY KEY,
  path     TEXT NOT NULL,
  mime     TEXT NOT NULL,
  w        INTEGER,
  h        INTEGER,
  alt_i18n TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(alt_i18n)),
  sha256   TEXT
);
CREATE UNIQUE INDEX idx_media_sha ON media(sha256);

CREATE TABLE posts (
  id             INTEGER PRIMARY KEY,
  type           TEXT NOT NULL CHECK(type IN('blog','news','event')),
  slug           TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','published','archived')),
  published_at   INTEGER,
  updated_at     INTEGER,
  author         TEXT,
  cover_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
  UNIQUE(type, slug)
);
CREATE INDEX idx_posts_list ON posts(type, status, published_at);
CREATE INDEX idx_posts_cover ON posts(cover_media_id);

CREATE TABLE post_i18n (
  post_id   INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  locale    TEXT NOT NULL CHECK(locale IN('en','ar','fr')),
  title     TEXT NOT NULL,
  summary   TEXT,
  body_html TEXT,
  seo_title TEXT,
  seo_desc  TEXT,
  slug      TEXT,                              -- optional per-locale slug
  PRIMARY KEY(post_id, locale)
);

CREATE TABLE events (
  post_id    INTEGER PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  starts_at  INTEGER NOT NULL,
  ends_at    INTEGER,
  tz         TEXT,
  place      TEXT,
  online_url TEXT
);

CREATE TABLE tags (
  id   INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_i18n TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(name_i18n))
);
CREATE TABLE post_tags (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY(post_id, tag_id)
);
CREATE INDEX idx_post_tags_tag ON post_tags(tag_id);

CREATE TABLE slug_redirects (
  id       INTEGER PRIMARY KEY,
  type     TEXT NOT NULL,
  locale   TEXT NOT NULL,
  old_slug TEXT NOT NULL,
  post_id  INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  UNIQUE(type, locale, old_slug)
);
CREATE INDEX idx_slug_redirects_post ON slug_redirects(post_id);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE country_defaults (
  cc   TEXT PRIMARY KEY,
  json TEXT NOT NULL CHECK(json_valid(json))
);

CREATE TABLE audit_log (
  id     INTEGER PRIMARY KEY,
  actor  TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  meta   TEXT CHECK(meta IS NULL OR json_valid(meta)),
  at     INTEGER NOT NULL
);
CREATE INDEX idx_audit_at ON audit_log(at);

CREATE TABLE rate_limits (
  bucket       TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(bucket, window_start)
);
CREATE INDEX idx_rate_window ON rate_limits(window_start);

PRAGMA user_version = 1;
