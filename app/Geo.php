<?php
declare(strict_types=1);
namespace Dyon;

/** Country hint only. NEVER logs or stores the IP. Order: CDN header -> optional GeoLite2 mmdb (if a reader is installed) -> null. */
final class Geo
{
    public static function country(?array $server = null): ?string
    {
        $server ??= $_SERVER;
        $hdr = 'HTTP_' . strtoupper(str_replace('-', '_', (string)Config::get('country_header', 'CF-IPCountry')));
        $v = strtoupper(trim((string)($server[$hdr] ?? '')));
        if (preg_match('/^[A-Z]{2}$/', $v) && !in_array($v, ['XX', 'T1'], true)) return $v;

        $db = (string)Config::get('geoip_db', '');
        if ($db !== '' && is_file($db) && class_exists('\\MaxMind\\Db\\Reader')) {
            try {
                $r = new \MaxMind\Db\Reader($db);
                $rec = $r->get(Http::clientIp()); $r->close();
                $c = strtoupper((string)($rec['country']['iso_code'] ?? ''));
                if (preg_match('/^[A-Z]{2}$/', $c)) return $c;
            } catch (\Throwable) { /* fall through */ }
        }
        return null;
    }
}
