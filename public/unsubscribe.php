<?php
declare(strict_types=1);
/* §7 — /subscribe, /subscribe/confirm, /unsubscribe (+ /ar, /fr). One front controller.
   GET never changes anything (link scanners follow every link); only a POST does. The token is the credential, so RFC 8058 one-click POSTs
   from mail providers work without cookies or an Origin header. Tokens are derived (HMAC), never stored. */
require dirname(__DIR__) . '/app/bootstrap.php';

use Dyon\{Site, I18n, Http, Csrf, RateLimit, Subscribers, Config};

$full = urldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
[$l, $path] = Site::split($full);
$path = rtrim($path, '/') ?: '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$t = static fn(string $k, array $v = []) => I18n::t($k, $v, $l);
$e = static fn(string $s) => Site::e($s);

Http::securityHeaders();
header('Cache-Control: no-store'); header('Referrer-Policy: same-origin');   // never no-referrer: Chromium then sends "Origin: null" on form posts header('X-Robots-Tag: noindex'); header('Content-Language: ' . $l);

$page = static function (string $title, string $body, int $status = 200) use ($l, $path, $e): never {
    http_response_code($status); header('Content-Type: text/html; charset=utf-8');
    echo Site::page(['locale' => $l, 'path' => $path, 'title' => $title . ' — DYON', 'body' => $body, 'noindex' => true]);
    exit;
};
$link = static fn(string $p) => Site::localePath($l, $p);
$tok = static function (): string { $x = $_POST['t'] ?? $_GET['t'] ?? ''; return is_string($x) && strlen($x) < 120 ? $x : ''; };
$notice = static fn(string $title, string $msg, bool $again = false) => '<h1>' . $e($title) . '</h1><p class="msg">' . $e($msg) . '</p>'
    . ($again ? '<p><a class="btn btn-primary" href="' . $e($link('/subscribe')) . '">' . $e(I18n::t('sub.start_again', [], $GLOBALS['l'])) . '</a></p>' : '');
$streamsHtml = static function (array $on) use ($t, $e): string {
    $h = '<fieldset class="form" style="border:0;padding:0;margin:0"><legend>' . $e($t('sub.streams')) . '</legend>';
    $h = str_replace(' style="border:0;padding:0;margin:0"', '', $h);
    foreach (Subscribers::STREAMS as $s) {
        $h .= '<label class="opt"><input type="checkbox" name="streams[]" value="' . $s . '"' . (in_array($s, $on, true) ? ' checked' : '') . '><div><b>' . $e($t("sub.stream_$s")) . '</b><span>' . $e($t("sub.stream_{$s}_d")) . '</span></div></label>';
    }
    return $h . '</fieldset>';
};

if ($path === '/subscribe') {
    if ($method === 'POST') {
        if (!Csrf::sameOrigin()) Http::error(403, 'csrf', 'Cross-site request refused');
        RateLimit::guard('subscribe', 10, 3600);
        $r = Subscribers::submit($_POST, $l);
        if ($r === 'invalid') $err = $t('sub.invalid');
        else $page($t('sub.sent_title'), $notice($t('sub.sent_title'), $t('sub.sent_body')));
    } elseif ($method !== 'GET' && $method !== 'HEAD') Http::error(405, 'method_not_allowed', 'Method not allowed');
    $form = '<h1>' . $e($t('sub.title')) . '</h1>' . (!empty($err) ? '<p class="msg err" role="alert">' . $e($err) . '</p>' : '') . '<p class="lead">' . $e($t('sub.lead')) . '</p>'
        . '<form class="form" method="post" action="' . $e($link('/subscribe')) . '"><div><label for="em">' . $e($t('sub.email')) . '</label>'
        . '<input id="em" name="email" type="email" inputmode="email" autocomplete="email" required maxlength="254"></div>'
        . $streamsHtml(['product', 'blog'])
        . '<div class="hp" aria-hidden="true"><label>' . $e($t('sub.hp')) . '<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>'
        . '<div class="actions"><button class="btn btn-primary" type="submit">' . $e($t('sub.submit')) . '</button></div></form>';
    $page($t('sub.title'), $form, !empty($err) ? 400 : 200);
}

if ($path === '/subscribe/confirm') {
    $token = $tok();
    if ($method === 'POST') {
        $row = Subscribers::confirm($token);
        if (!$row) $page($t('sub.bad_title'), $notice($t('sub.bad_title'), $t('sub.bad_body'), true), 410);
        $page($t('sub.confirmed_title'), $notice($t('sub.confirmed_title'), $t('sub.confirmed_body')));
    }
    $row = Subscribers::verify('confirm', $token);
    if (!$row || !in_array($row['status'], ['pending', 'active'], true)) $page($t('sub.bad_title'), $notice($t('sub.bad_title'), $t('sub.bad_body'), true), 410);
    $page($t('sub.confirm_title'), '<h1>' . $e($t('sub.confirm_title')) . '</h1><p class="lead">' . $e($t('sub.confirm_body')) . '</p>'
        . '<form class="form" method="post" action="' . $e($link('/subscribe/confirm')) . '"><input type="hidden" name="t" value="' . $e($token) . '">'
        . '<div class="actions"><button class="btn btn-primary" type="submit">' . $e($t('sub.confirm_btn')) . '</button></div></form>');
}

if ($path === '/unsubscribe') {
    $token = $tok(); $row = Subscribers::verify('unsub', $token);
    if ($method === 'POST') {
        RateLimit::guard('unsubscribe', 60, 3600);
        if (!$row) { if (isset($_POST['List-Unsubscribe'])) Http::error(400, 'bad_token', 'Invalid token'); $page($t('sub.bad_title'), $notice($t('sub.bad_title'), $t('sub.bad_body'), true), 410); }
        $oneClick = ($_POST['List-Unsubscribe'] ?? '') === 'One-Click';          // RFC 8058: no cookies, no origin, token only
        if ($oneClick || ($_POST['do'] ?? '') === 'all') {
            Subscribers::unsubscribeAll((int)$row['id'], true);
            if ($oneClick) { http_response_code(200); header('Content-Type: text/plain; charset=utf-8'); echo "OK\n"; exit; }
            $page($t('unsub.done_title'), $notice($t('unsub.done_title'), $t('unsub.done_body'), true));
        }
        if (!Csrf::sameOrigin()) Http::error(403, 'csrf', 'Cross-site request refused');
        Subscribers::setStreams((int)$row['id'], is_array($_POST['streams'] ?? null) ? $_POST['streams'] : []);
        $fresh = Subscribers::find((int)$row['id']);
        if ($fresh['status'] !== 'active') $page($t('unsub.done_title'), $notice($t('unsub.done_title'), $t('unsub.done_body'), true));
        $row = $fresh; $saved = true;
    } elseif ($method !== 'GET' && $method !== 'HEAD') Http::error(405, 'method_not_allowed', 'Method not allowed');
    if (!$row) $page($t('sub.bad_title'), $notice($t('sub.bad_title'), $t('sub.bad_body'), true), 410);
    if ($row['status'] !== 'active') $page($t('unsub.title'), $notice($t('unsub.title'), $t('unsub.inactive'), true));
    $on = json_decode((string)$row['streams'], true) ?: [];
    $body = '<h1>' . $e($t('unsub.title')) . '</h1>' . (!empty($saved) ? '<p class="msg" role="status">' . $e($t('unsub.saved')) . '</p>' : '') . '<p class="lead">' . $e($t('unsub.lead')) . '</p>'
        . '<form class="form" method="post" action="' . $e($link('/unsubscribe')) . '"><input type="hidden" name="t" value="' . $e($token) . '">' . $streamsHtml($on)
        . '<div class="actions"><button class="btn btn-primary" type="submit" name="do" value="save">' . $e($t('unsub.save')) . '</button>'
        . '<button class="btn" type="submit" name="do" value="all">' . $e($t('unsub.all')) . '</button></div></form>';
    $page($t('unsub.title'), $body);
}
Site::notFound($l);
