<?php
declare(strict_types=1);
namespace Dyon;

/** SERVER secrets only (session/CSRF/unsubscribe tokens, HMACs). Never used on user ledger data — that is browser-side WebCrypto. */
final class Crypto
{
    private static ?string $keyOverride = null;

    public static function b64u(string $bin): string { return rtrim(strtr(base64_encode($bin), '+/', '-_'), '='); }
    public static function unb64u(string $s): string|false { return base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4), true); }

    public static function randomToken(int $bytes = 32): string { return self::b64u(random_bytes($bytes)); }

    /** Test helper. */
    public static function useKey(?string $raw32): void { self::$keyOverride = $raw32; }

    private static function key(): string
    {
        if (self::$keyOverride !== null) return self::$keyOverride;
        $k = (string)Config::get('secret_key', '');
        $raw = $k === '' ? '' : (base64_decode($k, true) ?: '');
        if (strlen($raw) < SODIUM_CRYPTO_AUTH_KEYBYTES) {
            throw new \RuntimeException('secret_key missing: set config secret_key to base64 of 32+ random bytes');
        }
        return substr($raw, 0, SODIUM_CRYPTO_AUTH_KEYBYTES);
    }

    /** Keyed MAC (sodium_crypto_auth = HMAC-SHA-512/256), domain-separated by $purpose. Returns base64url. */
    public static function hmac(string $value, string $purpose = 'generic'): string
    {
        return self::b64u(sodium_crypto_auth($purpose . "\0" . $value, self::key()));
    }

    public static function constEq(string $a, string $b): bool { return hash_equals($a, $b); }

    /** sha256(provider:sub) hex — the only form in which an identity subject is stored. */
    public static function subHash(string $provider, string $sub): string { return hash('sha256', $provider . ':' . $sub); }

    /** Signed, expiring blob for short-lived cookies (OAuth state). Format: b64u(json).mac */
    public static function sign(array $payload, int $ttl, string $purpose): string
    {
        $payload['exp'] = time() + $ttl;
        $body = self::b64u(json_encode($payload, JSON_UNESCAPED_SLASHES));
        return $body . '.' . self::hmac($body, $purpose);
    }

    public static function verify(string $token, string $purpose): ?array
    {
        $p = explode('.', $token);
        if (count($p) !== 2 || !self::constEq(self::hmac($p[0], $purpose), $p[1])) return null;
        $j = self::unb64u($p[0]); $d = $j === false ? null : json_decode($j, true);
        return is_array($d) && ($d['exp'] ?? 0) >= time() ? $d : null;
    }
}
