<?php
declare(strict_types=1);
/* Front gate for every request that is not a real file and not a named front controller (blog, storage, seo…).
   1. The admin area lives at /<DYON_ADMIN_PATH>/ (configurable in .env) — Apache/nginx cannot read .env, so PHP decides.
   2. Everything else is the PWA shell (public/index.html); the hash router takes over client-side. */
require dirname(__DIR__) . '/app/bootstrap.php';

$uri = urldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
$seg = explode('/', ltrim($uri, '/'), 2)[0];
if ($seg !== '' && $seg === Dyon\Config::adminPath()) {
    $rest = substr($uri, strlen($seg) + 1);
    $GLOBALS['DYON_ADMIN_BASE'] = '/' . $seg;
    $GLOBALS['DYON_ADMIN_REST'] = '/' . ltrim((string)$rest, '/');
    $entry = __DIR__ . '/admin/index.php';
    if (is_file($entry)) { require $entry; exit; }
    http_response_code(404); header('Content-Type: text/plain; charset=utf-8'); echo "Not found\n"; exit;
}
Dyon\Http::securityHeaders();
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
readfile(__DIR__ . '/index.html');
