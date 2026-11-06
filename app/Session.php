<?php
declare(strict_types=1);
namespace Dyon;

/** Cookie __Host-dyon_sess = random token; DB stores only hmac(token). 30-day sliding expiry, rotated on login. */
final class Session
{
    public const TTL = 30 * 86400;
    private static ?array $cache = null;

    public static function cookieName(): string { return Config::get('cookie_secure', true) ? '__Host-dyon_sess' : 'dyon_sess'; }

    public static function setCookie(string $name, string $value, int $expires, bool $httpOnly = true, string $sameSite = 'Lax'): void
    {
        $secure = (bool)Config::get('cookie_secure', true);
        if (PHP_SAPI === 'cli') { $_COOKIE[$name] = $value; $GLOBALS['__cookies'][$name] = [$value, $expires, $httpOnly]; return; }
        setcookie($name, $value, ['expires' => $expires, 'path' => '/', 'secure' => $secure, 'httponly' => $httpOnly, 'samesite' => $sameSite]);
    }

    /** Creates a session for $userId and sets the cookie. Always a fresh token (rotation). Returns the token. */
    public static function start(int $userId, ?string $ua = null): string
    {
        $db = Db::system();
        $old = $_COOKIE[self::cookieName()] ?? '';
        if ($old !== '') $db->exec('DELETE FROM sessions WHERE token_hmac = ?', [Crypto::hmac($old, 'session')]);
        $token = Crypto::randomToken(32);
        $now = time();
        $db->exec('INSERT INTO sessions(user_id, token_hmac, created_at, expires_at, ua_hash) VALUES(?,?,?,?,?)',
            [$userId, Crypto::hmac($token, 'session'), $now, $now + self::TTL, $ua === null ? null : substr(hash('sha256', $ua), 0, 16)]);
        self::setCookie(self::cookieName(), $token, $now + self::TTL);
        self::$cache = null;
        return $token;
    }

    /** @return array{session_id:int,user:array}|null — slides expiry when more than a day old. */
    public static function current(?string $token = null): ?array
    {
        if ($token === null && self::$cache !== null) return self::$cache ?: null;
        $token ??= $_COOKIE[self::cookieName()] ?? '';
        if ($token === '' || strlen($token) > 128) return null;
        $db = Db::system();
        $row = $db->one('SELECT s.id sid, s.expires_at, s.created_at, u.* FROM sessions s JOIN users u ON u.id = s.user_id
                         WHERE s.token_hmac = ? AND s.expires_at > ? AND u.deleted_at IS NULL', [Crypto::hmac($token, 'session'), time()]);
        if (!$row) return null;
        $now = time();
        if ($row['expires_at'] - $now < self::TTL - 86400) {
            $db->exec('UPDATE sessions SET expires_at = ? WHERE id = ?', [$now + self::TTL, $row['sid']]);
            self::setCookie(self::cookieName(), $token, $now + self::TTL);
        }
        $db->exec('UPDATE users SET last_seen_at = ? WHERE id = ? AND COALESCE(last_seen_at,0) < ?', [$now, $row['id'], $now - 600]);
        $sid = (int)$row['sid']; unset($row['sid'], $row['expires_at']);
        $out = ['session_id' => $sid, 'user' => $row];
        if (func_num_args() === 0) self::$cache = $out;
        return $out;
    }

    public static function destroy(): void
    {
        $token = $_COOKIE[self::cookieName()] ?? '';
        if ($token !== '') Db::system()->exec('DELETE FROM sessions WHERE token_hmac = ?', [Crypto::hmac($token, 'session')]);
        self::setCookie(self::cookieName(), '', time() - 3600);
        unset($_COOKIE[self::cookieName()]);
        self::$cache = null;
    }

    public static function purgeExpired(): int { return Db::system()->exec('DELETE FROM sessions WHERE expires_at < ?', [time()]); }
}
