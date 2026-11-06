<?php
declare(strict_types=1);
namespace Dyon;

final class Http
{
    /** Security headers sent from PHP (mirrors deploy/*.conf and public/.htaccess). */
    public static function securityHeaders(): void
    {
        if (headers_sent()) return;
        header("Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        header('Permissions-Policy: camera=(self), geolocation=(), microphone=()');
        if (!Config::isDev() && self::isHttps()) header('Strict-Transport-Security: max-age=63072000; includeSubDomains; preload');
    }

    public static function isHttps(): bool
    {
        return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https' && Config::get('trusted_proxy_header') !== '');
    }

    public static function json(mixed $data, int $status = 200, array $headers = []): never
    {
        self::securityHeaders();
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        foreach (array_merge(['Cache-Control' => 'no-store'], $headers) as $k => $v) header("$k: $v");
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'HEAD') echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function error(int $status, string $code, string $message, array $headers = []): never
    {
        self::json(['error' => ['code' => $code, 'message' => $message]], $status, $headers);
    }

    /** Only the listed methods are allowed; HEAD is accepted wherever GET is. */
    public static function method(string ...$allowed): string
    {
        $m = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        if (in_array('GET', $allowed, true) && !in_array('HEAD', $allowed, true)) $allowed[] = 'HEAD';
        if (!in_array($m, $allowed, true)) self::error(405, 'method_not_allowed', 'Method not allowed', ['Allow' => implode(', ', $allowed)]);
        return $m;
    }

    public static function redirect(string $to, int $status = 302): never
    {
        http_response_code($status); header('Location: ' . $to); header('Cache-Control: no-store'); exit;
    }

    /** Client IP for rate limiting ONLY — never logged or stored (only its HMAC is a bucket key). */
    public static function clientIp(): string
    {
        $h = (string)Config::get('trusted_proxy_header', '');
        if ($h !== '') {
            $v = $_SERVER['HTTP_' . strtoupper(str_replace('-', '_', $h))] ?? '';
            if ($v !== '' && filter_var(trim(explode(',', $v)[0]), FILTER_VALIDATE_IP)) return trim(explode(',', $v)[0]);
        }
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }

    public static function jsonBody(): array
    {
        $raw = file_get_contents('php://input', false, null, 0, 1048577);
        if ($raw === '' || $raw === false) return [];
        if (strlen($raw) > 1048576) self::error(413, 'too_large', 'Request body too large');
        $d = json_decode($raw, true);
        if (!is_array($d)) self::error(400, 'bad_json', 'Invalid JSON');
        return $d;
    }
}
