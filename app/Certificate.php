<?php
declare(strict_types=1);
namespace Dyon;

/** §11 — certificate of kept commitments, checked by the server.
    What the server vouches for: a signed-in account (identity proven by its provider, e-mail verified by the sign-in code) published these
    counts on this date, and has not withdrawn them. What it does NOT vouch for: the ledger itself (the server never reads it). One active
    certificate per account with a stable public id, so a printed QR keeps working when the numbers are refreshed. */
final class Certificate
{
    public const MAX_TOTAL = 100000;

    /** Share of entries settled (fulfilled or released), rounded DOWN so 100% always means all of them. */
    public static function percent(int $done, int $total): int { return $total <= 0 ? 0 : (int)floor(100 * $done / $total); }

    public static function cleanName(string $n): string
    {
        $n = trim(preg_replace('/[\p{Cc}\p{Cf}]+/u', ' ', $n) ?? '');
        $n = trim(preg_replace('/\s+/u', ' ', $n) ?? '');
        return mb_substr($n, 0, 60);
    }

    public static function url(string $publicId): string { return Mailer::base() . '/c/' . $publicId; }

    /** @return array<string,mixed>|null the account's active certificate */
    public static function mine(int $uid): ?array
    {
        return Db::system()->one('SELECT * FROM certificates WHERE user_id = ? AND revoked_at IS NULL ORDER BY id DESC LIMIT 1', [$uid]);
    }

    public static function find(string $publicId): ?array
    {
        if (!preg_match('/^[A-Za-z0-9_-]{10,40}$/', $publicId)) return null;
        return Db::system()->one('SELECT c.*, u.provider FROM certificates c JOIN users u ON u.id = c.user_id WHERE c.public_id = ? AND u.deleted_at IS NULL', [$publicId]);
    }

    /** Creates the certificate or refreshes its numbers (same public id). Throws InvalidArgumentException('bad_counts'|'no_entries'). */
    public static function issue(int $uid, int $total, int $done, string $name, ?int $now = null): array
    {
        if ($total < 0 || $done < 0 || $done > $total || $total > self::MAX_TOTAL) throw new \InvalidArgumentException('bad_counts');
        if ($total < 1) throw new \InvalidArgumentException('no_entries');
        $now ??= time(); $db = Db::system(); $name = self::cleanName($name);
        $row = self::mine($uid);
        if ($row) {
            $db->exec('UPDATE certificates SET name = ?, total = ?, done = ?, updated_at = ? WHERE id = ?', [$name, $total, $done, $now, $row['id']]);
        } else {
            $db->exec('INSERT INTO certificates(user_id, public_id, name, total, done, issued_at, updated_at) VALUES(?,?,?,?,?,?,?)',
                [$uid, Crypto::randomToken(12), $name, $total, $done, $now, $now]);
        }
        return self::mine($uid);
    }

    public static function revoke(int $uid, ?int $now = null): bool
    {
        return Db::system()->exec('UPDATE certificates SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', [$now ?? time(), $uid]) > 0;
    }

    /** What the owner's client sees. */
    public static function mineJson(?array $r): ?array
    {
        if (!$r) return null;
        return ['id' => $r['public_id'], 'url' => self::url($r['public_id']), 'name' => $r['name'], 'total' => (int)$r['total'], 'done' => (int)$r['done'],
                'percent' => self::percent((int)$r['done'], (int)$r['total']), 'issued' => (int)$r['issued_at'], 'updated' => (int)$r['updated_at']];
    }
}
