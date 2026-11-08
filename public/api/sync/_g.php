<?php
declare(strict_types=1);
/* Shared guard for sync endpoints: session + per-user rate limit. Never routed (underscore). */
require dirname(__DIR__) . '/_boot.php';
use Dyon\{Http, RateLimit, Sync};

function sync_user(int $limit = 120): array {
    $u = Sync::auth();
    $r = RateLimit::hit('sync:' . basename($_SERVER['SCRIPT_NAME'] ?? 'x', '.php') . ':' . $u['id'], $limit, 60);
    if (!$r['ok']) Http::error(429, 'rate_limited', 'Too many requests', ['Retry-After' => (string)$r['retry_after']]);
    return $u;
}
