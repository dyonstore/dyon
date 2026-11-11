<?php
declare(strict_types=1);
/* §11 — /c/<id> (+ /ar, /fr): public page that anyone can open from the QR code. Read-only; no cookies needed; no login. */
require dirname(__DIR__) . '/app/bootstrap.php';

use Dyon\{Site, I18n, Http, Certificate, RateLimit};

$full = urldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
[$l, $path] = Site::split($full);
$t = static fn(string $k, array $v = []) => I18n::t($k, $v, $l);
$e = static fn(string $s) => Site::e($s);
Http::securityHeaders();
header('Cache-Control: no-store'); header('Referrer-Policy: no-referrer'); header('X-Robots-Tag: noindex'); header('Content-Language: ' . $l);
if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET', 'HEAD'], true)) Http::error(405, 'method_not_allowed', 'Method not allowed');
RateLimit::guard('cert-view', 120, 600);

$page = static function (string $title, string $body, int $status = 200) use ($l, $path): never {
    http_response_code($status); header('Content-Type: text/html; charset=utf-8');
    echo Site::page(['locale' => $l, 'path' => $path, 'title' => $title . ' — DYON', 'body' => $body, 'noindex' => true, 'alternates' => false]);
    exit;
};
$id = preg_match('#^/c/([A-Za-z0-9_-]{10,40})/?$#', $path, $m) ? $m[1] : '';
$c = $id !== '' ? Certificate::find($id) : null;
if (!$c) $page($t('cert.pub_unknown_title'), '<h1>' . $e($t('cert.pub_unknown_title')) . '</h1><p class="msg">' . $e($t('cert.pub_unknown_body')) . '</p>', 404);
if ($c['revoked_at'] !== null) $page($t('cert.pub_revoked_title'), '<h1>' . $e($t('cert.pub_revoked_title')) . '</h1><p class="msg">' . $e($t('cert.pub_revoked_body')) . '</p>', 410);

$pct = Certificate::percent((int)$c['done'], (int)$c['total']);
$name = $c['name'] !== '' ? $c['name'] : $t('cert.pub_anonymous');
$provider = ['google' => 'Google', 'microsoft' => 'Microsoft', 'apple' => 'Apple'][$c['provider']] ?? $c['provider'];
$date = static fn(int $ts) => gmdate('Y-m-d', $ts);
$body = '<div class="cert" data-pct="' . $pct . '">'
    . '<p class="cert-badge">' . $e($t('cert.pub_badge')) . '</p>'
    . '<h1>' . $e($t('cert.pub_title')) . '</h1>'
    . '<p class="cert-name" dir="auto">' . $e($name) . '</p>'
    . '<p class="cert-pct" dir="ltr" aria-label="' . $e($t('cert.pub_pct_label', ['pct' => $pct])) . '">' . $pct . '<span>%</span></p>'
    . '<p class="cert-line">' . $e($t('cert.pub_line', ['done' => (int)$c['done'], 'total' => (int)$c['total']])) . '</p>'
    . '<dl class="cert-meta"><div><dt>' . $e($t('cert.pub_issued')) . '</dt><dd dir="ltr">' . $e($date((int)$c['issued_at'])) . '</dd></div>'
    . '<div><dt>' . $e($t('cert.pub_updated')) . '</dt><dd dir="ltr">' . $e($date((int)$c['updated_at'])) . '</dd></div>'
    . '<div><dt>' . $e($t('cert.pub_account')) . '</dt><dd>' . $e($t('cert.pub_account_v', ['provider' => $provider])) . '</dd></div></dl>'
    . '<p class="msg">' . $e($t('cert.pub_how')) . '</p>'
    . '<p class="muted">' . $e($t('cert.pub_limits')) . '</p></div>';
$page($t('cert.pub_title'), $body);
