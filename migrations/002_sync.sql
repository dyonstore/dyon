-- §6 encrypted sync: the recovery-phrase-wrapped data key lives next to the passphrase-wrapped one. Both are opaque to the server.
ALTER TABLE sync_meta ADD COLUMN wrapped_key_recovery TEXT;
