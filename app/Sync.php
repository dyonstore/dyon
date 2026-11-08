<?php
declare(strict_types=1);
namespace Dyon;

/** §6 encrypted-sync storage. Blobs are opaque: this class never decrypts, parses or logs them.
 *  One SQLite file per user: data/users/{HMAC(user id)}.sqlite (0600). */
final class Sync
{
    public const MAX_BLOB = 1_500_000;          // per record, bytes (a push body is capped at 2 MB)
    public const MAX_BATCH = 200;
    public const KDF_MIN = 600000;
    private const SCHEMA = 'CREATE TABLE IF NOT EXISTS records (
          table_name TEXT NOT NULL, record_id TEXT NOT NULL, rev INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0,
          blob TEXT NOT NULL, updated_at INTEGER NOT NULL, device_id INTEGER, PRIMARY KEY (table_name, record_id));
        CREATE TABLE IF NOT EXISTS changes (seq INTEGER PRIMARY KEY AUTOINCREMENT, table_name TEXT NOT NULL, record_id TEXT NOT NULL, rev INTEGER NOT NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_changes_rec ON changes(table_name, record_id);';

    public static function path(int $uid): string
    {
        return rtrim((string)Config::get('data_dir'), '/') . '/users/' . Crypto::hmac((string)$uid, 'userdb') . '.sqlite';
    }
    public static function userDb(int $uid): Db
    {
        $db = Db::open(self::path($uid));
        $db->pdo->exec(self::SCHEMA);
        return $db;
    }
    public static function quota(): int { return (int)(Config::get('sync.quota_bytes', 50 * 1024 * 1024)); }

    /** Session user or a 401. */
    public static function auth(): array
    {
        $s = Session::current();
        if (!$s) Http::error(401, 'unauthorized', 'Sign in first');
        return $s['user'];
    }

    public static function meta(int $uid): ?array { return Db::system()->one('SELECT * FROM sync_meta WHERE user_id = ?', [$uid]); }

    private static function b64Field(mixed $v, int $max, string $name): string
    {
        if (!is_string($v) || $v === '' || strlen($v) > $max || !preg_match('/^[A-Za-z0-9_-]+$/', $v)) throw new \InvalidArgumentException("bad $name");
        return $v;
    }
    /** @return array{salt:string,kdf_iter:int,wrapped_key:string,wrapped_key_recovery:?string,key_check:?string} */
    public static function validateMeta(array $in, bool $rewrap): array
    {
        $iter = $in['kdf_iter'] ?? null;
        if (!is_int($iter) || $iter < self::KDF_MIN || $iter > 20_000_000) throw new \InvalidArgumentException('bad kdf_iter');
        $o = ['salt' => self::b64Field($in['salt'] ?? null, 64, 'salt'), 'kdf_iter' => $iter, 'wrapped_key' => self::b64Field($in['wrapped_key'] ?? null, 200, 'wrapped_key')];
        if (!$rewrap) {
            $o['wrapped_key_recovery'] = self::b64Field($in['wrapped_key_recovery'] ?? null, 200, 'wrapped_key_recovery');
            $o['key_check'] = self::b64Field($in['key_check'] ?? null, 200, 'key_check');
        }
        return $o;
    }

    /** Stores the key envelope. Returns false if sync was already set up (and not a rewrap). */
    public static function setup(int $uid, array $in, bool $rewrap = false): bool
    {
        $m = self::validateMeta($in, $rewrap);
        $db = Db::system(); $now = time();
        $have = self::meta($uid);
        if ($rewrap) {
            if (!$have) return false;
            $db->exec('UPDATE sync_meta SET salt=?, kdf_iter=?, wrapped_key=?, updated_at=? WHERE user_id=?', [$m['salt'], $m['kdf_iter'], $m['wrapped_key'], $now, $uid]);
            return true;
        }
        if ($have) return false;
        $db->exec('INSERT INTO sync_meta (user_id, salt, kdf_iter, wrapped_key, wrapped_key_recovery, key_check, rev, bytes, updated_at) VALUES (?,?,?,?,?,?,0,0,?)',
            [$uid, $m['salt'], $m['kdf_iter'], $m['wrapped_key'], $m['wrapped_key_recovery'], $m['key_check'], $now]);
        return true;
    }

    /* ---- devices ---- */
    public static function registerDevice(int $uid, string $label): int
    {
        $label = mb_substr(trim($label), 0, 60);
        if ((int)Db::system()->val('SELECT COUNT(*) FROM devices WHERE user_id=? AND revoked_at IS NULL', [$uid]) >= 20) throw new \RuntimeException('too_many_devices');
        $now = time();
        Db::system()->exec('INSERT INTO devices (user_id, label, created_at, last_seen_at) VALUES (?,?,?,?)', [$uid, $label, $now, $now]);
        return Db::system()->lastId();
    }
    public static function devices(int $uid): array
    {
        return Db::system()->all('SELECT id, label, created_at, last_seen_at, revoked_at FROM devices WHERE user_id=? ORDER BY created_at', [$uid]);
    }
    /** Returns the device id when it belongs to the user and is active; else a 403. */
    public static function activeDevice(int $uid, mixed $id): int
    {
        $row = is_numeric($id) ? Db::system()->one('SELECT id, revoked_at FROM devices WHERE id=? AND user_id=?', [(int)$id, $uid]) : null;
        if (!$row) Http::error(403, 'unknown_device', 'This device is not registered for sync');
        if ($row['revoked_at'] !== null) Http::error(403, 'device_revoked', 'This device was removed from sync');
        Db::system()->exec('UPDATE devices SET last_seen_at=? WHERE id=? AND COALESCE(last_seen_at,0) < ?', [time(), $row['id'], time() - 30]);
        return (int)$row['id'];
    }
    public static function renameDevice(int $uid, int $id, string $label): bool
    { return Db::system()->exec('UPDATE devices SET label=? WHERE id=? AND user_id=?', [mb_substr(trim($label), 0, 60), $id, $uid]) > 0; }
    public static function revokeDevice(int $uid, int $id): bool
    { return Db::system()->exec('UPDATE devices SET revoked_at=? WHERE id=? AND user_id=? AND revoked_at IS NULL', [time(), $id, $uid]) > 0; }

    /* ---- records ---- */
    /** @return array{changes:list<array>,next:int,more:bool} */
    public static function pull(int $uid, int $since, int $limit): array
    {
        $limit = max(1, min(500, $limit));
        $rows = self::userDb($uid)->all('SELECT c.seq, c.table_name t, c.record_id id, r.rev, r.deleted, r.blob FROM changes c
            JOIN records r ON r.table_name = c.table_name AND r.record_id = c.record_id WHERE c.seq > ? ORDER BY c.seq LIMIT ?', [max(0, $since), $limit + 1]);
        $more = count($rows) > $limit; if ($more) array_pop($rows);
        $out = []; $next = $since;
        foreach ($rows as $r) { $out[] = ['seq' => (int)$r['seq'], 'table' => $r['t'], 'id' => $r['id'], 'rev' => (int)$r['rev'], 'deleted' => (bool)$r['deleted'], 'blob' => $r['blob']]; $next = (int)$r['seq']; }
        return ['changes' => $out, 'next' => $next, 'more' => $more];
    }

    /** @return array{accepted:list<array>,conflicts:list<array>,head:int,bytes:int}  Throws RuntimeException('quota') / InvalidArgumentException. */
    public static function push(int $uid, int $deviceId, array $changes): array
    {
        if (count($changes) > self::MAX_BATCH) throw new \InvalidArgumentException('too many changes');
        foreach ($changes as $c) {
            if (!is_array($c) || !is_string($c['table'] ?? null) || !preg_match('/^[A-Za-z]{1,32}$/', $c['table'])
                || !is_string($c['id'] ?? null) || !preg_match('/^[A-Za-z0-9_.:-]{1,80}$/', $c['id'])
                || !is_int($c['base_rev'] ?? null) || $c['base_rev'] < 0 || !is_int($c['rev'] ?? null) || $c['rev'] !== $c['base_rev'] + 1
                || !is_string($c['blob'] ?? null) || strlen($c['blob']) > self::MAX_BLOB) throw new \InvalidArgumentException('bad change');
        }
        $db = self::userDb($uid); $quota = self::quota();
        return $db->tx(function (Db $db) use ($uid, $deviceId, $changes, $quota) {
            $used = (int)$db->val('SELECT COALESCE(SUM(LENGTH(blob)),0) FROM records');
            $acc = []; $conf = []; $now = time();
            foreach ($changes as $c) {
                $cur = $db->one('SELECT rev, blob, deleted FROM records WHERE table_name=? AND record_id=?', [$c['table'], $c['id']]);
                $curRev = $cur ? (int)$cur['rev'] : 0;
                if ($cur && $curRev === $c['rev'] && $cur['blob'] === $c['blob']) { $acc[] = ['table' => $c['table'], 'id' => $c['id'], 'rev' => $c['rev'], 'seq' => (int)$db->val('SELECT seq FROM changes WHERE table_name=? AND record_id=?', [$c['table'], $c['id']])]; continue; } // retry after a lost response
                if ($curRev !== $c['base_rev']) { $conf[] = ['table' => $c['table'], 'id' => $c['id'], 'rev' => $curRev, 'deleted' => (bool)$cur['deleted'], 'blob' => $cur['blob']]; continue; }
                $used += strlen($c['blob']) - ($cur ? strlen($cur['blob']) : 0);
                if ($used > $quota) throw new \RuntimeException('quota');
                $db->exec('INSERT INTO records (table_name, record_id, rev, deleted, blob, updated_at, device_id) VALUES (?,?,?,?,?,?,?)
                           ON CONFLICT(table_name, record_id) DO UPDATE SET rev=excluded.rev, deleted=excluded.deleted, blob=excluded.blob, updated_at=excluded.updated_at, device_id=excluded.device_id',
                    [$c['table'], $c['id'], $c['rev'], empty($c['deleted']) ? 0 : 1, $c['blob'], $now, $deviceId]);
                $db->exec('DELETE FROM changes WHERE table_name=? AND record_id=?', [$c['table'], $c['id']]);
                $db->exec('INSERT INTO changes (table_name, record_id, rev) VALUES (?,?,?)', [$c['table'], $c['id'], $c['rev']]);
                $acc[] = ['table' => $c['table'], 'id' => $c['id'], 'rev' => $c['rev'], 'seq' => $db->lastId()];
            }
            $head = (int)$db->val('SELECT COALESCE(MAX(seq),0) FROM changes');
            Db::system()->exec('UPDATE sync_meta SET rev=?, bytes=?, updated_at=? WHERE user_id=?', [$head, $used, $now, $uid]);
            return ['accepted' => $acc, 'conflicts' => $conf, 'head' => $head, 'bytes' => $used];
        });
    }

    /** Deletes the synced copy (file + key envelope + devices). Local data on devices is untouched. */
    public static function wipe(int $uid): void
    {
        $f = self::path($uid);
        Db::forget($f);
        foreach ([$f, $f . '-wal', $f . '-shm'] as $x) { if (is_file($x)) { @file_put_contents($x, ''); @unlink($x); } }
        $db = Db::system();
        $db->exec('DELETE FROM sync_meta WHERE user_id=?', [$uid]);
        $db->exec('DELETE FROM devices WHERE user_id=?', [$uid]);
    }
}
