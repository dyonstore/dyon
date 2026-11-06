<?php
declare(strict_types=1);
namespace Dyon;

/** Fixed-window counters in system.sqlite rate_limits, keyed by hmac(ip) or user id. */
final class RateLimit
{
    /** @return array{ok:bool,retry_after:int,remaining:int} */
    public static function hit(string $bucket, int $limit, int $windowSec, ?int $now = null): array
    {
        $now ??= time();
        $ws = intdiv($now, $windowSec) * $windowSec;
        $key = Crypto::hmac($bucket, 'rl');
        $db = Db::system();
        $count = $db->tx(function (Db $db) use ($key, $ws) {
            $db->exec('INSERT INTO rate_limits(bucket, window_start, count) VALUES(?,?,1)
                       ON CONFLICT(bucket, window_start) DO UPDATE SET count = count + 1', [$key, $ws]);
            return (int)$db->val('SELECT count FROM rate_limits WHERE bucket = ? AND window_start = ?', [$key, $ws]);
        });
        if (mt_rand(1, 50) === 1) $db->exec('DELETE FROM rate_limits WHERE window_start < ?', [$now - 86400]);
        $ok = $count <= $limit;
        return ['ok' => $ok, 'retry_after' => $ok ? 0 : max(1, $ws + $windowSec - $now), 'remaining' => max(0, $limit - $count)];
    }

    /** Convenience: per-IP bucket; sends 429 + Retry-After and exits when exceeded. */
    public static function guard(string $name, int $limit, int $windowSec): void
    {
        $r = self::hit($name . ':' . Http::clientIp(), $limit, $windowSec);
        if (!$r['ok']) Http::error(429, 'rate_limited', 'Too many requests', ['Retry-After' => (string)$r['retry_after']]);
    }
}
