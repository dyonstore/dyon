<?php
declare(strict_types=1);
namespace Dyon;

/** OAuth 2.0 / OIDC authorization-code + PKCE (S256) for Google, Microsoft and Apple (form_post).
 *  The ID token's RS256 signature is verified against the provider JWKS (cached 6 h) and iss/aud/exp/nonce are checked.
 *  Only sha256(provider:sub) is stored as the identity; an email is kept only when the provider says it is verified. */
final class Auth
{
    public const JWKS_TTL = 6 * 3600;
    public const STATE_TTL = 600;
    public const COOKIE = 'dyon_oauth';

    /** @var callable|null fn(string $method, string $url, array $opts{form?:array,headers?:array}): array{status:int,body:string} */
    public static $http = null;

    public static function providers(): array
    {
        $tenant = (string)Config::get('oauth.microsoft.tenant', 'common');
        return [
            'google' => [
                'authorize' => 'https://accounts.google.com/o/oauth2/v2/auth', 'token' => 'https://oauth2.googleapis.com/token',
                'jwks' => 'https://www.googleapis.com/oauth2/v3/certs', 'iss' => ['https://accounts.google.com', 'accounts.google.com'],
                'scope' => 'openid email profile', 'extra' => [], 'form_post' => false,
            ],
            'microsoft' => [
                'authorize' => "https://login.microsoftonline.com/$tenant/oauth2/v2.0/authorize",
                'token' => "https://login.microsoftonline.com/$tenant/oauth2/v2.0/token",
                'jwks' => "https://login.microsoftonline.com/$tenant/discovery/v2.0/keys",
                'iss' => '#^https://login\.microsoftonline\.com/[0-9a-f-]{36}/v2\.0$#', // tenant id is part of iss when tenant=common
                'scope' => 'openid email profile', 'extra' => ['response_mode' => 'query'], 'form_post' => false,
            ],
            'apple' => [
                'authorize' => 'https://appleid.apple.com/auth/authorize', 'token' => 'https://appleid.apple.com/auth/token',
                'jwks' => 'https://appleid.apple.com/auth/keys', 'iss' => ['https://appleid.apple.com'],
                'scope' => 'name email', 'extra' => ['response_mode' => 'form_post'], 'form_post' => true,
            ],
        ];
    }

    public static function configured(string $provider): bool
    {
        if (!isset(self::providers()[$provider])) return false;
        $c = (array)Config::get("oauth.$provider", []);
        if (($c['client_id'] ?? '') === '') return false;
        return $provider === 'apple' ? (($c['team_id'] ?? '') !== '' && ($c['key_id'] ?? '') !== '' && ($c['private_key'] ?? '') !== '')
                                     : (($c['client_secret'] ?? '') !== '');
    }

    public static function redirectUri(): string { return rtrim((string)Config::get('base_url'), '/') . '/api/auth/callback.php'; }

    /** Only same-site relative targets ("/", "/#/settings", "/ar/blog"); anything else becomes "/". */
    public static function safeReturn(?string $r): string
    {
        $r = (string)$r;
        if ($r === '' || $r[0] !== '/' || str_starts_with($r, '//') || str_contains($r, '\\') || preg_match('/[\x00-\x1f]/', $r) || strlen($r) > 300) return '/';
        return $r;
    }

    public static function pkceChallenge(string $verifier): string { return Crypto::b64u(hash('sha256', $verifier, true)); }

    /** Step 1. Returns [authorizeUrl, cookieValue]. The caller sets the cookie (SameSite=None for form_post providers). */
    public static function begin(string $provider, ?string $return = null): array
    {
        if (!self::configured($provider)) throw new AuthException('provider_not_configured');
        $p = self::providers()[$provider];
        $state = Crypto::randomToken(24); $nonce = Crypto::randomToken(24); $verifier = Crypto::randomToken(48);
        $cookie = Crypto::sign(['p' => $provider, 's' => $state, 'n' => $nonce, 'v' => $verifier, 'r' => self::safeReturn($return)], self::STATE_TTL, 'oauth');
        $q = http_build_query([
            'client_id' => Config::get("oauth.$provider.client_id"), 'redirect_uri' => self::redirectUri(), 'response_type' => 'code',
            'scope' => $p['scope'], 'state' => $state, 'nonce' => $nonce,
            'code_challenge' => self::pkceChallenge($verifier), 'code_challenge_method' => 'S256',
        ] + $p['extra'], '', '&', PHP_QUERY_RFC3986);
        return [$p['authorize'] . '?' . $q, $cookie];
    }

    /** Step 2. $params = GET (or POST for Apple); $cookie = raw state cookie. Returns [userId, isNew, returnPath]. */
    public static function complete(array $params, string $cookie): array
    {
        $st = Crypto::verify($cookie, 'oauth');
        if (!$st) throw new AuthException('state_expired');
        $provider = (string)$st['p'];
        if (!self::configured($provider)) throw new AuthException('provider_not_configured');
        if (isset($params['error'])) throw new AuthException('provider_denied');
        if (!isset($params['state']) || !is_string($params['state']) || !Crypto::constEq((string)$st['s'], $params['state'])) throw new AuthException('state_mismatch');
        $code = $params['code'] ?? '';
        if (!is_string($code) || $code === '' || strlen($code) > 2048) throw new AuthException('no_code');

        $tok = self::exchange($provider, $code, (string)$st['v']);
        $claims = self::verifyIdToken($provider, (string)($tok['id_token'] ?? ''), (string)$st['n']);

        $name = $claims['name'] ?? null;
        if (isset($params['user']) && is_string($params['user'])) { // Apple sends the name once, on first consent
            $u = json_decode($params['user'], true);
            if (is_array($u['name'] ?? null)) $name = trim(($u['name']['firstName'] ?? '') . ' ' . ($u['name']['lastName'] ?? '')) ?: $name;
        }
        [$uid, $new] = self::upsertUser($provider, (string)$claims['sub'], self::verifiedEmail($claims), $name, $claims['picture'] ?? null);
        return [$uid, $new, (string)$st['r']];
    }

    private static function verifiedEmail(array $c): ?string
    {
        $e = $c['email'] ?? null;
        if (!is_string($e) || !filter_var($e, FILTER_VALIDATE_EMAIL)) return null;
        $v = $c['email_verified'] ?? null;
        if ($v === true || $v === 'true') return strtolower($e);
        return null; // unverified or unknown: never stored, never mailed (R-D10)
    }

    public static function upsertUser(string $provider, string $sub, ?string $email, ?string $name, ?string $avatar): array
    {
        $db = Db::system(); $h = Crypto::subHash($provider, $sub); $now = time();
        $avatar = is_string($avatar) && str_starts_with($avatar, 'https://') && strlen($avatar) < 600 ? $avatar : null;
        return $db->tx(function (Db $db) use ($provider, $h, $email, $name, $avatar, $now) {
            $u = $db->one('SELECT id, deleted_at, avatar_url FROM users WHERE provider = ? AND sub_hash = ?', [$provider, $h]);
            if ($u) {
                if ($avatar !== null && $avatar !== $u['avatar_url']) Avatar::invalidate((int)$u['id']);   // picture changed: refetch once
                $db->exec('UPDATE users SET email = COALESCE(?, email), name = COALESCE(?, name), avatar_url = COALESCE(?, avatar_url),
                           last_seen_at = ?, deleted_at = NULL WHERE id = ?', [$email, $name, $avatar, $now, $u['id']]);
                return [(int)$u['id'], false];
            }
            $db->exec('INSERT INTO users(provider, sub_hash, email, name, avatar_url, created_at, last_seen_at) VALUES(?,?,?,?,?,?,?)',
                [$provider, $h, $email, $name, $avatar, $now, $now]);
            return [$db->lastId(), true];
        });
    }

    /* ---------- token endpoint ---------- */
    private static function exchange(string $provider, string $code, string $verifier): array
    {
        $p = self::providers()[$provider];
        $form = ['grant_type' => 'authorization_code', 'code' => $code, 'redirect_uri' => self::redirectUri(),
                 'client_id' => Config::get("oauth.$provider.client_id"), 'code_verifier' => $verifier,
                 'client_secret' => $provider === 'apple' ? self::appleClientSecret() : Config::get("oauth.$provider.client_secret")];
        $r = self::http('POST', $p['token'], ['form' => $form]);
        $j = json_decode($r['body'], true);
        if ($r['status'] !== 200 || !is_array($j) || empty($j['id_token'])) throw new AuthException('token_exchange_failed');
        return $j;
    }

    public static function appleClientSecret(?int $now = null): string
    {
        $now ??= time(); $c = (array)Config::get('oauth.apple');
        $h = Crypto::b64u(json_encode(['alg' => 'ES256', 'kid' => $c['key_id'], 'typ' => 'JWT']));
        $b = Crypto::b64u(json_encode(['iss' => $c['team_id'], 'iat' => $now, 'exp' => $now + 3600, 'aud' => 'https://appleid.apple.com', 'sub' => $c['client_id']]));
        $key = openssl_pkey_get_private((string)$c['private_key']);
        if (!$key || !openssl_sign("$h.$b", $der, $key, OPENSSL_ALGO_SHA256)) throw new AuthException('apple_key_invalid');
        return "$h.$b." . Crypto::b64u(self::ecdsaDerToRaw($der, 32));
    }

    /** ASN.1 DER ECDSA signature -> fixed-width R||S (JWS ES256). */
    public static function ecdsaDerToRaw(string $der, int $size): string
    {
        $o = 2; if (ord($der[1]) & 0x80) $o += ord($der[1]) & 0x7f;
        $out = '';
        for ($i = 0; $i < 2; $i++) {
            $len = ord($der[$o + 1]); $int = substr($der, $o + 2, $len); $o += 2 + $len;
            $out .= str_pad(ltrim($int, "\0"), $size, "\0", STR_PAD_LEFT);
        }
        return $out;
    }

    /* ---------- ID token verification ---------- */
    public static function verifyIdToken(string $provider, string $jwt, string $nonce, ?int $now = null): array
    {
        if (!isset(self::providers()[$provider])) throw new AuthException('bad_provider');
        $now ??= time();
        $parts = explode('.', $jwt);
        if (count($parts) !== 3 || strlen($jwt) > 8192) throw new AuthException('bad_token');
        $header = json_decode((string)Crypto::unb64u($parts[0]), true); $claims = json_decode((string)Crypto::unb64u($parts[1]), true);
        $sig = Crypto::unb64u($parts[2]);
        if (!is_array($header) || !is_array($claims) || $sig === false) throw new AuthException('bad_token');
        if (($header['alg'] ?? '') !== 'RS256') throw new AuthException('bad_alg');   // rejects none / HS256 / ES256 confusion
        $kid = (string)($header['kid'] ?? '');
        $jwk = self::findKey($provider, $kid, $now);
        if (!$jwk) throw new AuthException('unknown_key');
        $ok = openssl_verify("$parts[0].$parts[1]", $sig, self::jwkToPem($jwk), OPENSSL_ALGO_SHA256);
        if ($ok !== 1) throw new AuthException('bad_signature');

        $p = self::providers()[$provider];
        $iss = (string)($claims['iss'] ?? '');
        $issOk = is_array($p['iss']) ? in_array($iss, $p['iss'], true) : preg_match($p['iss'], $iss) === 1;
        if (!$issOk) throw new AuthException('bad_iss');
        $aud = $claims['aud'] ?? null; $cid = (string)Config::get("oauth.$provider.client_id");
        if (!($aud === $cid || (is_array($aud) && in_array($cid, $aud, true)))) throw new AuthException('bad_aud');
        if (!isset($claims['exp']) || (int)$claims['exp'] < $now - 60) throw new AuthException('expired');
        if (isset($claims['nbf']) && (int)$claims['nbf'] > $now + 60) throw new AuthException('not_yet_valid');
        if (!isset($claims['nonce']) || !is_string($claims['nonce']) || !Crypto::constEq($nonce, $claims['nonce'])) throw new AuthException('bad_nonce');
        if (!isset($claims['sub']) || !is_string($claims['sub']) || $claims['sub'] === '') throw new AuthException('no_sub');
        return $claims;
    }

    private static function findKey(string $provider, string $kid, int $now): ?array
    {
        $db = Db::system(); $key = "jwks:$provider";
        $cached = json_decode((string)$db->val('SELECT value FROM settings WHERE key = ?', [$key]), true) ?: ['at' => 0, 'keys' => []];
        $fresh = $now - (int)$cached['at'] < self::JWKS_TTL;
        foreach ([0, 1] as $attempt) {
            if ($fresh) foreach ($cached['keys'] as $k) if (($k['kid'] ?? '') === $kid && ($k['kty'] ?? '') === 'RSA') return $k;
            // refetch when stale, or once when the kid is unknown (key rotation) — at most every 5 minutes
            if ($attempt === 1 || ($fresh && $now - (int)$cached['at'] < 300)) return null;
            $r = self::http('GET', self::providers()[$provider]['jwks'], []);
            $j = json_decode($r['body'], true);
            if ($r['status'] !== 200 || !is_array($j['keys'] ?? null)) { if (!$fresh && $cached['keys']) $fresh = true; else return null; continue; }
            $cached = ['at' => $now, 'keys' => $j['keys']];
            $db->exec('INSERT INTO settings(key, value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [$key, json_encode($cached)]);
            $fresh = true;
        }
        return null;
    }

    public static function jwkToPem(array $jwk): string
    {
        $n = Crypto::unb64u((string)($jwk['n'] ?? '')); $e = Crypto::unb64u((string)($jwk['e'] ?? ''));
        if ($n === false || $e === false || $n === '' || $e === '') throw new AuthException('bad_jwk');
        $len = static function (int $l): string { if ($l < 128) return chr($l); $b = ltrim(pack('N', $l), "\0"); return chr(0x80 | strlen($b)) . $b; };
        $int = static function (string $b) use ($len): string { $b = ltrim($b, "\0"); if ($b === '' || ord($b[0]) > 127) $b = "\0" . $b; return "\x02" . $len(strlen($b)) . $b; };
        $inner = $int($n) . $int($e);
        $seq = "\x30" . $len(strlen($inner)) . $inner;
        $alg = "\x30\x0d\x06\x09\x2a\x86\x48\x86\xf7\x0d\x01\x01\x01\x05\x00";
        $bit = "\x03" . $len(strlen($seq) + 1) . "\x00" . $seq;
        $spki = "\x30" . $len(strlen($alg . $bit)) . $alg . $bit;
        return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($spki), 64, "\n") . "-----END PUBLIC KEY-----\n";
    }

    private static function http(string $method, string $url, array $o): array
    {
        if (self::$http) return (self::$http)($method, $url, $o);
        if (!str_starts_with($url, 'https://')) throw new AuthException('insecure_url');
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_CONNECTTIMEOUT => 4, CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS, CURLOPT_HTTPHEADER => ['Accept: application/json'] + ($o['headers'] ?? [])]);
        if ($method === 'POST') { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($o['form'] ?? [])); }
        $body = curl_exec($ch); $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
        return ['status' => $status, 'body' => is_string($body) ? $body : ''];
    }
}
