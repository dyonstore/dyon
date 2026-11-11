<?php
/* DYON dev router for `php -S 0.0.0.0:8080 -t public public/router.php`.
   Mirrors the production Apache/Nginx rewrite + deny rules so the same code
   paths run in dev. Production uses public/.htaccess (Apache) or
   deploy/nginx.conf.example (Nginx); this file is ONLY used by php -S.

   Security note: php -S already refuses to serve files above the docroot, so
   /app, /config, /data (siblings of /public) are unreachable here. We still
   deny dotfiles and *.sqlite* defensively, and 404 /dev/* unless APP_ENV=dev. */

$uri  = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
$root = __DIR__;                                   // the public/ web root
$path = realpath($root . $uri);

/* ---- hard denies (defense in depth) ---- */
$deny = function (int $code = 404) {
    http_response_code($code);
    header('Content-Type: text/plain; charset=utf-8');
    echo $code === 403 ? "Forbidden\n" : "Not found\n";
    exit;
};
if (preg_match('#/\.(?!well-known)#', $uri)) $deny(404);            // dotfiles
if (preg_match('#\.(sqlite|sqlite-wal|sqlite-shm|ini|log)$#i', $uri)) $deny(404);
if (preg_match('#(^|/)router\.php$#i', $uri)) $deny(404);
if (preg_match('#(^|/)_[^/]*$#', $uri)) $deny(404);                   // _boot.php and other private includes           // never serve the router itself
// Any traversal or sibling-dir access that php -S may have normalised.
if (strpos($_SERVER['REQUEST_URI'] ?? '', '..') !== false) $deny(404);
if (preg_match('#^/(app|config|data|migrations|templates|cron|tests|vendor-php)(/|$)#', $uri)) $deny(404);

/* ---- dev-only harness pages ---- */
if (strpos($uri, '/dev/') === 0 && (getenv('APP_ENV') ?: 'dev') !== 'dev') $deny(404);

/* Missing files: anything under /dev/ or /api/, or with a file extension, is a real 404
   (never the SPA shell, which would serve HTML as a JS module or JSON). */
if ($uri !== '/' && (!($path && strpos($path, $root) === 0 && is_file($path)))
    && (preg_match('#^/(dev|api)/#', $uri) || preg_match('#\.[a-z0-9]{1,6}$#i', $uri))
    && !preg_match('#^/(sitemap(-pages|-posts)?\.xml|robots\.txt|(ar/|fr/)?(feed|atom)\.xml)$#', $uri)) $deny(404);

/* ---- server-rendered routes (front controllers, added in later tasks) ---- */
$front = [
    '#^/api/#'                                   => 'api',       // handled as real files below
    '#^/(blog|news|events)(/|$)#'                => 'blog.php',
    '#^/(ar|fr)/(blog|news|events)(/|$)#'        => 'blog.php',
    '#^/(ar/|fr/)?verify(/|$)#'                  => 'verify.php',
    '#^/(ar/|fr/)?c/[^/]+/?$#'                   => 'certificate.php',
    '#^/storage(/|$)#'                           => 'storage.php',
    '#^/(ar|fr)/storage(/|$)#'                   => 'storage.php',
    '#^/(ar/|fr/)?(unsubscribe|subscribe)(/|$)#' => 'unsubscribe.php',
    '#^/(sitemap(-pages|-posts)?\.xml|robots\.txt|(ar/|fr/)?(feed|atom)\.xml)$#' => 'seo.php',
];

/* Real static files inside public/ are served verbatim (let php -S do it). */
if ($uri !== '/' && $path && strpos($path, $root) === 0 && is_file($path)) {
    if (substr($path, -4) === '.php') {            // only /api, /admin PHP may execute
        if (!preg_match('#^/(api|admin|router)#', $uri)) $deny(404);
        return false;                              // let php -S run the script
    }
    return false;                                  // static asset — serve as-is
}

/* Front-controller routes whose target exists get included. */
foreach ($front as $re => $target) {
    if (preg_match($re, $uri)) {
        if ($target === 'api' || $target === 'admin') return false;   // real file or 404
        $file = $root . '/' . $target;
        if (is_file($file)) { require $file; exit; }
        $deny(404);
    }
}

/* Everything else goes through the gate: the admin area at its configurable path, else the app shell. */
require $root . '/gate.php';
