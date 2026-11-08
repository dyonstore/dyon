<?php
declare(strict_types=1);
/* §6.5 — /storage, /ar/storage, /fr/storage. Server-rendered; every factual claim carries its source link.
   Front controller: included by public/router.php (dev), rewritten by .htaccess / nginx (prod). */
require dirname(__DIR__) . '/app/bootstrap.php';

use Dyon\{Site, I18n, Http};

[$l] = Site::split(urldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/'));
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if (!preg_match('#^(/(ar|fr))?/storage/?$#', $path)) Site::notFound($l);

const SRC = [
    'quota'   => ['storage.src_mdn_quota',    'https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria'],
    'persist' => ['storage.src_mdn_persist',  'https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist'],
    'itp'     => ['storage.src_webkit_itp',   'https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/'],
    'policy'  => ['storage.src_webkit_policy', 'https://webkit.org/blog/14403/updates-to-storage-policy/'],
];
$t = static fn(string $k, array $v = []) => I18n::t($k, $v, $l);
$e = static fn(string $s) => Site::e($s);
/** A "Source: …" line; each link is the real URL, opens in the same tab, and is plain text for screen readers. */
$cite = static function (array $ids) use ($t, $e): string {
    $links = [];
    foreach ($ids as $id) { [$k, $u] = SRC[$id]; $links[] = '<a href="' . $e($u) . '" rel="noopener" hreflang="en">' . $e($t($k)) . '</a>'; }
    $line = $e($t('storage.source', ['links' => '@@L@@']));
    return '<p class="src">' . str_replace('@@L@@', implode(' · ', $links), $line) . '</p>';
};

$body  = '<h1>' . $e($t('storage.title')) . '</h1><p class="lead">' . $e($t('storage.lead')) . '</p>';
$body .= '<h2>' . $e($t('storage.h_where')) . '</h2><p>' . $e($t('storage.p_where')) . '</p>' . $cite(['quota']);
$body .= '<p>' . $e($t('storage.p_where2')) . '</p>' . $cite(['quota']);
$body .= '<h2>' . $e($t('storage.h_evict')) . '</h2><p>' . $e($t('storage.p_evict1')) . '</p>' . $cite(['quota', 'policy']);
$body .= '<p>' . $e($t('storage.p_evict2')) . '</p>' . $cite(['itp', 'quota']);
$body .= '<h2>' . $e($t('storage.h_persist')) . '</h2><p>' . $e($t('storage.p_persist')) . '</p>' . $cite(['persist', 'quota']);
$body .= '<p>' . $e($t('storage.p_persist2')) . '</p>' . $cite(['quota', 'policy']);
$body .= '<h2>' . $e($t('storage.h_do')) . '</h2><ul>';
foreach (['do1', 'do2', 'do3', 'do4'] as $k) $body .= '<li>' . $e($t('storage.' . $k)) . '</li>';
$body .= '</ul>';
/* Live panel: hidden until storage.js has asked THIS browser; copy comes from data-* so no inline script is needed (CSP). */
$d = ['st-persistent' => 'storage.st_persistent', 'st-best-effort' => 'storage.st_best_effort', 'st-unsupported' => 'storage.st_unsupported',
      'used' => 'storage.used', 'used-only' => 'storage.used_only', 'keep-granted' => 'storage.keep_granted', 'keep-declined' => 'storage.keep_declined', 'keep-error' => 'storage.keep_error'];
$attrs = ''; foreach ($d as $a => $k) $attrs .= ' data-' . $a . '="' . $e($t($k)) . '"';
$body .= '<section class="panel" id="live" hidden' . $attrs . ' aria-labelledby="live-h"><h2 id="live-h">' . $e($t('storage.h_live')) . '</h2>'
       . '<p role="status" id="live-status"></p><p id="live-used"></p>'
       . '<div class="row"><button type="button" class="btn btn-primary" id="live-keep" hidden>' . $e($t('storage.keep')) . '</button></div>'
       . '<p role="status" id="live-msg" class="good"></p><p class="src">' . $e($t('storage.live_note')) . '</p></section>';
$body .= '<h2>' . $e($t('storage.h_src')) . '</h2><ul>';
foreach (SRC as [$k, $u]) $body .= '<li><a href="' . $e($u) . '" rel="noopener" hreflang="en">' . $e($t($k)) . '</a></li>';
$body .= '</ul>';

Http::securityHeaders();
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: public, max-age=300');
header('Content-Language: ' . $l);
echo Site::page(['locale' => $l, 'path' => '/storage', 'title' => $t('storage.title') . ' — DYON', 'desc' => $t('storage.desc'), 'body' => $body, 'scripts' => ['/js/storage-page.js']]);
