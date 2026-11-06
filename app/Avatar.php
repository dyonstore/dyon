<?php
declare(strict_types=1);
namespace Dyon;

/** Same-origin avatar proxy. The browser never talks to Google/Microsoft (CSP img-src 'self').
 *  Fetches the provider picture once, re-encodes it to 96×96 WebP (PNG if GD has no WebP) with GD and caches it in
 *  data/avatars/{user_id}.{webp|png}. Hardened against SSRF: https only, no credentials/odd ports, every resolved IP must be public
 *  and is pinned for the request (no DNS rebinding), no redirects, 1 MB cap, 4000 px cap. */
final class Avatar
{
    public const MAX_BYTES = 1048576;
    public const MAX_DIM = 4000;
    public const SIZE = 96;
    public const FRESH_SECS = 7 * 86400;
    public const NEG_SECS = 3600;

    /** @var callable|null fn(string $host): string[]  (tests) */
    public static $resolve = null;
    /** @var callable|null fn(string $url, string $ip): array{status:int,body:string}  (tests) */
    public static $http = null;

    public static function dir(): string { return rtrim((string)Config::get('data_dir'), '/') . '/avatars'; }
    public static function ext(): string { return function_exists('imagewebp') ? 'webp' : 'png'; }
    public static function mime(): string { return self::ext() === 'webp' ? 'image/webp' : 'image/png'; }
    public static function path(int $uid): string { return self::dir() . '/' . $uid . '.' . self::ext(); }
    private static function negPath(int $uid): string { return self::dir() . '/' . $uid . '.none'; }

    public static function invalidate(int $uid): void
    {
        foreach (['webp', 'png', 'none'] as $e) @unlink(self::dir() . '/' . $uid . '.' . $e);
    }

    /** @return string[] public IPs for $host, or [] when the URL must not be fetched. */
    public static function safeTarget(string $url): array
    {
        $p = parse_url($url);
        if (!$p || ($p['scheme'] ?? '') !== 'https' || empty($p['host']) || isset($p['user']) || isset($p['pass'])) return [];
        if (isset($p['port']) && (int)$p['port'] !== 443) return [];
        $host = strtolower(trim($p['host'], '[]'));
        if (!preg_match('/^[a-z0-9.-]+$/', $host) && !filter_var($host, FILTER_VALIDATE_IP)) return [];
        $ips = filter_var($host, FILTER_VALIDATE_IP)
            ? [$host]
            : (self::$resolve ? (self::$resolve)($host) : (gethostbynamel($host) ?: []));
        if (!$ips) return [];
        foreach ($ips as $ip) if (!self::isPublicIp((string)$ip)) return [];
        return array_values($ips);
    }

    /** PHP's NO_PRIV/NO_RES flags miss some special-purpose ranges (e.g. 100.64.0.0/10 CGNAT), so list them too. */
    public static function isPublicIp(string $ip): bool
    {
        if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) return false;
        $bin = @inet_pton($ip);
        if ($bin === false) return false;
        if (strlen($bin) === 16) {                                   // IPv6: unwrap v4-mapped, block ULA/link-local/multicast/6to4/teredo/doc
            if (substr($bin, 0, 12) === "\0\0\0\0\0\0\0\0\0\0\xff\xff") return self::isPublicIp(inet_ntop(substr($bin, 12)));
            $h = ord($bin[0]); $h2 = ord($bin[1]);
            if (($h & 0xfe) === 0xfc || ($h === 0xfe && ($h2 & 0xc0) === 0x80) || $h === 0xff) return false;
            if ($h === 0x20 && ($h2 === 0x02 || ($h2 === 0x01 && ord($bin[2]) === 0x00 && ord($bin[3]) === 0x00) || ($h2 === 0x01 && ord($bin[2]) === 0x0d && ord($bin[3]) === 0xb8))) return false;
            return true;
        }
        $n = ip2long($ip);
        foreach ([['100.64.0.0', 10], ['192.0.0.0', 24], ['192.0.2.0', 24], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]] as [$net, $bits]) {
            $mask = -1 << (32 - $bits);
            if (($n & $mask) === (ip2long($net) & $mask)) return false;
        }
        return true;
    }

    private static function download(string $url, string $ip): ?string
    {
        if (self::$http) {
            $r = (self::$http)($url, $ip);
            return ($r['status'] === 200 && strlen($r['body']) <= self::MAX_BYTES) ? $r['body'] : null;
        }
        $host = parse_url($url, PHP_URL_HOST);
        $body = ''; $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_FOLLOWLOCATION => false, CURLOPT_PROTOCOLS => CURLPROTO_HTTPS, CURLOPT_TIMEOUT => 6, CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_RESOLVE => ["$host:443:$ip"], CURLOPT_HTTPHEADER => ['Accept: image/*'], CURLOPT_USERAGENT => 'DYON-avatar/1',
            CURLOPT_WRITEFUNCTION => static function ($c, $d) use (&$body) {
                $body .= $d; return strlen($body) > Avatar::MAX_BYTES ? 0 : strlen($d);     // abort over the cap
            },
        ]);
        $ok = curl_exec($ch); $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
        return ($ok !== false && $status === 200 && $body !== '') ? $body : null;
    }

    /** Validates and re-encodes arbitrary image bytes to a square 96×96 image. Null when not a usable image. */
    public static function reencode(string $bytes): ?string
    {
        if ($bytes === '' || strlen($bytes) > self::MAX_BYTES) return null;
        $info = @getimagesizefromstring($bytes);
        if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP, IMAGETYPE_GIF], true)) return null;
        [$w, $h] = $info;
        if ($w < 1 || $h < 1 || $w > self::MAX_DIM || $h > self::MAX_DIM) return null;
        $src = @imagecreatefromstring($bytes);
        if (!$src) return null;
        $side = min($w, $h);
        $dst = imagecreatetruecolor(self::SIZE, self::SIZE);
        imagealphablending($dst, false); imagesavealpha($dst, true);
        imagefill($dst, 0, 0, imagecolorallocatealpha($dst, 0, 0, 0, 127));
        imagecopyresampled($dst, $src, 0, 0, intdiv($w - $side, 2), intdiv($h - $side, 2), self::SIZE, self::SIZE, $side, $side);
        ob_start();
        self::ext() === 'webp' ? imagewebp($dst, null, 82) : imagepng($dst, null, 6);
        $out = (string)ob_get_clean();
        imagedestroy($src); imagedestroy($dst);
        return $out === '' ? null : $out;
    }

    /** Returns the cached avatar bytes for the user, fetching it once when missing/stale. Null = none available. */
    public static function get(int $uid, ?string $sourceUrl): ?string
    {
        $file = self::path($uid);
        if (is_file($file) && time() - filemtime($file) < self::FRESH_SECS) return (string)file_get_contents($file);
        $neg = self::negPath($uid);
        if (is_file($neg) && time() - filemtime($neg) < self::NEG_SECS) return null;
        if (!is_dir(self::dir())) mkdir(self::dir(), 0700, true);

        $img = null;
        if ($sourceUrl) {
            $ips = self::safeTarget($sourceUrl);
            if ($ips) { $raw = self::download($sourceUrl, $ips[0]); $img = $raw === null ? null : self::reencode($raw); }
        }
        if ($img === null) {                                // remember the failure so we do not hammer the provider
            @file_put_contents($neg, '1');
            return is_file($file) ? (string)file_get_contents($file) : null;   // stale beats nothing
        }
        $tmp = $file . '.' . bin2hex(random_bytes(4)) . '.tmp';
        file_put_contents($tmp, $img); @chmod($tmp, 0600); rename($tmp, $file); @unlink($neg);
        return $img;
    }
}
