<?php
declare(strict_types=1);
namespace Dyon;

/** §9 — 8-digit e-mailed code that completes a sign-in on a new device, after a long absence, or on a first sign-in.
    Flow: callback.php proves the identity with the provider, then (unless the device is trusted) calls begin(); verify.php finishes.
    Stored: HMAC(code) only. 10-minute life, 5 wrong tries per code, resend limited, a trusted-device cookie skips it for `login_code_days`. */
final class LoginCode
{
    public const TTL = 600;
    public const MAX_ATTEMPTS = 5;
    public const PENDING = 'dyon_pending';

    public static function enabled(): bool { return (bool)Config::get('login_code', true); }
    public static function days(): int { return max(1, (int)Config::get('login_code_days', 30)); }
    public static function tdName(): string { return Config::get('cookie_secure', true) ? '__Host-dyon_td' : 'dyon_td'; }

    /** Does this sign-in need a code? False when disabled, when the account has no e-mail to send to, or when the device is trusted and recent. */
    public static function required(int $uid, ?string $deviceToken = null): bool
    {
        if (!self::enabled()) return false;
        $u = Db::system()->one('SELECT email FROM users WHERE id = ? AND deleted_at IS NULL', [$uid]);
        if (!$u || Subscribers::normaliseEmail((string)$u['email']) === null) return false;
        return !self::trusted($uid, $deviceToken ?? (string)($_COOKIE[self::tdName()] ?? ''));
    }

    public static function trusted(int $uid, string $token, ?int $now = null): bool
    {
        if ($token === '' || strlen($token) > 128) return false;
        $now ??= time();
        $row = Db::system()->one('SELECT id, last_used_at FROM trusted_devices WHERE token_hmac = ? AND user_id = ?', [Crypto::hmac($token, 'td'), $uid]);
        if (!$row || (int)$row['last_used_at'] < $now - self::days() * 86400) return false;
        Db::system()->exec('UPDATE trusted_devices SET last_used_at = ? WHERE id = ?', [$now, $row['id']]);
        return true;
    }

    /** Marks this browser as trusted; returns the cookie value. */
    public static function trust(int $uid, ?int $now = null): string
    {
        $now ??= time(); $tok = Crypto::randomToken(32); $db = Db::system();
        $db->exec('INSERT INTO trusted_devices(user_id, token_hmac, created_at, last_used_at) VALUES(?,?,?,?)', [$uid, Crypto::hmac($tok, 'td'), $now, $now]);
        $db->exec('DELETE FROM trusted_devices WHERE user_id = ? AND id NOT IN (SELECT id FROM trusted_devices WHERE user_id = ? ORDER BY last_used_at DESC LIMIT 20)', [$uid, $uid]);
        return $tok;
    }

    public static function generate(): string { return str_pad((string)random_int(0, 99999999), 8, '0', STR_PAD_LEFT); }
    private static function mac(int $uid, string $code): string { return Crypto::hmac($uid . ':' . $code, 'login-code'); }

    /** Creates + queues a fresh code (older unused codes die). Returns the plain code only so tests can use it; never log it. */
    public static function issue(int $uid, ?int $now = null): string
    {
        $now ??= time(); $db = Db::system(); $code = self::generate();
        $db->exec('UPDATE login_codes SET used_at = ? WHERE user_id = ? AND used_at IS NULL', [$now, $uid]);
        $db->exec('INSERT INTO login_codes(user_id, code_hmac, created_at, expires_at) VALUES(?,?,?,?)', [$uid, self::mac($uid, $code), $now, $now + self::TTL]);
        $db->exec('DELETE FROM login_codes WHERE created_at < ?', [$now - 86400]);
        Mailer::toUser($uid, 'login_code', ['code' => $code, 'minutes' => intdiv(self::TTL, 60)]);
        return $code;
    }

    /** @return 'ok'|'bad'|'expired'|'locked' */
    public static function check(int $uid, string $input, ?int $now = null): string
    {
        $now ??= time(); $db = Db::system();
        $row = $db->one('SELECT * FROM login_codes WHERE user_id = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1', [$uid]);
        if (!$row) return 'expired';
        if ((int)$row['expires_at'] < $now) return 'expired';
        if ((int)$row['attempts'] >= self::MAX_ATTEMPTS) return 'locked';
        $input = preg_replace('/[\s-]+/', '', $input) ?? '';
        $db->exec('UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?', [$row['id']]);
        if (!preg_match('/^\d{8}$/', $input) || !Crypto::constEq((string)$row['code_hmac'], self::mac($uid, $input))) {
            return (int)$row['attempts'] + 1 >= self::MAX_ATTEMPTS ? 'locked' : 'bad';
        }
        $db->exec('UPDATE login_codes SET used_at = ? WHERE id = ?', [$now, $row['id']]);
        return 'ok';
    }

    public static function attemptsLeft(int $uid): int
    {
        $a = Db::system()->val('SELECT attempts FROM login_codes WHERE user_id = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1', [$uid]);
        return max(0, self::MAX_ATTEMPTS - (int)($a ?? 0));
    }

    /* ---- the pending (identity proven, code not yet entered) cookie ---- */
    public static function setPending(int $uid, string $return): void { Session::setCookie(self::PENDING, Crypto::sign(['uid' => $uid, 'ret' => $return], self::TTL, 'pending'), time() + self::TTL); }
    public static function pending(): ?array
    {
        $p = Crypto::verify((string)($_COOKIE[self::PENDING] ?? ''), 'pending');
        return $p && isset($p['uid']) ? ['uid' => (int)$p['uid'], 'ret' => (string)($p['ret'] ?? '/')] : null;
    }
    public static function clearPending(): void { Session::setCookie(self::PENDING, '', time() - 3600); unset($_COOKIE[self::PENDING]); }
}
