-- §7 mail: delivery bookkeeping on the queue. Tokens are never stored: they are derived (HMAC) from the subscriber row + a random salt.
ALTER TABLE email_queue ADD COLUMN sent_at INTEGER;
ALTER TABLE email_queue ADD COLUMN last_error TEXT;
CREATE INDEX idx_email_queue_to ON email_queue(to_email, template, created_at);
CREATE INDEX idx_subscribers_confirmed ON subscribers(status, confirmed_at);
