-- §9 e-mailed sign-in code (8 digits). Only HMACs are stored: neither the code nor the device token can be read back.
CREATE TABLE login_codes (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hmac   TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  used_at     INTEGER
);
CREATE INDEX idx_login_codes_user ON login_codes(user_id, created_at);

CREATE TABLE trusted_devices (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hmac   TEXT NOT NULL UNIQUE,
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL
);
CREATE INDEX idx_trusted_user ON trusted_devices(user_id);
