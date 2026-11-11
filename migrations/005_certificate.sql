-- §11 certificate: a server-checked statement "this signed-in account declares X of Y entries settled".
-- Only aggregate counts and a display name the holder chose are stored: never people, amounts or descriptions.
CREATE TABLE certificates (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_id   TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL DEFAULT '',
  total       INTEGER NOT NULL,
  done        INTEGER NOT NULL,
  issued_at   INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  revoked_at  INTEGER
);
CREATE INDEX idx_certificates_user ON certificates(user_id, revoked_at);
