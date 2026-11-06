<?php
declare(strict_types=1);
namespace Dyon;

/** Double-submit CSRF: cookie __Host-dyon_csrf (readable by JS) must equal header X-CSRF-Token or form field _csrf.
 *  Plus Origin / Sec-Fetch-Site checks. Required for every non-GET request to /api and /admin. */
final class Csrf
{
    public static function cookieName(): string { return Config::get('cookie_secure', true) ? '__Host-dyon_csrf' : 'dyon_csrf'; }

    /** Issues a token cookie if missing; returns the token (for embedding in forms). */
    public static function token(): string
    {
        $t = $_COOKIE[self::cookieName()] ?? '';
        if (!preg_match('/^[A-Za-z0-9_-]{32,64}$/', $t)) {
            $t = Crypto::randomToken(24);
            Session::setCookie(self::cookieName(), $t, 0, false);
            $_COOKIE[self::cookieName()] = $t;
        }
        return $t;
    }

    /** Pure check used by tests and enforce(). $server/$cookies/$post default to the superglobals. */
    public static function check(?array $server = null, ?array $cookies = null, ?array $post = null, ?string $host = null): bool
    {
        $server ??= $_SERVER; $cookies ??= $_COOKIE; $post ??= $_POST;
        $method = strtoupper($server['REQUEST_METHOD'] ?? 'GET');
        if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) return true;

        $sfs = $server['HTTP_SEC_FETCH_SITE'] ?? '';
        if ($sfs !== '' && !in_array($sfs, ['same-origin', 'none'], true)) return false;

        $origin = $server['HTTP_ORIGIN'] ?? '';
        if ($origin !== '' && $origin !== 'null') {
            $oh = parse_url($origin, PHP_URL_HOST); $op = parse_url($origin, PHP_URL_PORT);
            $h = $host ?? ($server['HTTP_HOST'] ?? '');
            $oHost = $op ? "$oh:$op" : (string)$oh;
            if (!hash_equals(strtolower($h), strtolower($oHost))) return false;
        } elseif ($origin === 'null') {
            return false;
        }

        $cookie = $cookies[self::cookieName()] ?? '';
        $sent = $server['HTTP_X_CSRF_TOKEN'] ?? ($post['_csrf'] ?? '');
        return $cookie !== '' && is_string($sent) && hash_equals($cookie, $sent);
    }

    public static function enforce(): void
    {
        if (!self::check()) Http::error(403, 'csrf', 'Invalid or missing CSRF token');
    }
}
