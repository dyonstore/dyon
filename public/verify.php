<?php
declare(strict_types=1);
/* §9 — /verify (+ /ar, /fr): the 8-digit e-mailed code that finishes a sign-in. Reached only after the provider proved who you are
   (callback.php set a signed, 10-minute "pending" cookie). No session exists until the code is right. GET never changes anything. */
require dirname(__DIR__) . '/app/bootstrap.php';

use Dyon\{Site, I18n, Http, Csrf, RateLimit, Session, LoginCode, Mailer, Db};

$full = urldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
[$l, $path] = Site::split($full);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$t = static fn(string $k, array $v = []) => I18n::t($k, $v, $l);
$e = static fn(string $s) => Site::e($s);
Http::securityHeaders();
header('Cache-Control: no-store'); header('Referrer-Policy: same-origin'); header('X-Robots-Tag: noindex'); header('Content-Language: ' . $l);

$page = static function (string $body, int $status = 200) use ($l, $t, $e): never {
    http_response_code($status); header('Content-Type: text/html; charset=utf-8');
    echo Site::page(['locale' => $l, 'path' => '/verify', 'title' => $t('verify.title') . ' — DYON', 'body' => $body, 'noindex' => true, 'alternates' => false]);
    exit;
};
if ($method !== 'GET' && $method !== 'HEAD' && $method !== 'POST') Http::error(405, 'method_not_allowed', 'Method not allowed');

$p = LoginCode::pending();
if (!$p) {
    $page('<h1>' . $e($t('verify.expired_title')) . '</h1><p class="msg">' . $e($t('verify.expired_body')) . '</p><p><a class="btn btn-primary" href="/#/settings">' . $e($t('storage.open_app')) . '</a></p>', 410);
}
$uid = $p['uid'];
$u = Db::system()->one('SELECT email FROM users WHERE id = ? AND deleted_at IS NULL', [$uid]);
$mask = static function (string $m): string { [$a, $d] = array_pad(explode('@', $m, 2), 2, ''); return mb_substr($a, 0, 1) . '•••@' . $d; };
$err = ''; $info = '';

if ($method === 'POST') {
    if (!Csrf::sameOrigin()) Http::error(403, 'csrf', 'Cross-site request refused');
    RateLimit::guard('verify', 30, 600);
    if (($_POST['do'] ?? '') === 'resend') {
        $r = RateLimit::hit('verify-resend:' . $uid, 3, 600);
        if (!$r['ok']) $err = $t('verify.too_many');
        else { LoginCode::issue($uid); try { Mailer::run(5); } catch (Throwable) {} LoginCode::setPending($uid, $p['ret']); $info = $t('verify.resent'); }
    } else {
        $res = LoginCode::check($uid, (string)($_POST['code'] ?? ''));
        if ($res === 'ok') {
            LoginCode::clearPending();
            Session::start($uid, $_SERVER['HTTP_USER_AGENT'] ?? null);
            if (!empty($_POST['trust'])) {
                $tok = LoginCode::trust($uid);
                Session::setCookie(LoginCode::tdName(), $tok, time() + LoginCode::days() * 86400);
            }
            Http::redirect(\Dyon\Auth::safeReturn($p['ret']) === '/' ? '/#/settings' : \Dyon\Auth::safeReturn($p['ret']));
        }
        $err = match ($res) { 'locked' => $t('verify.locked'), 'expired' => $t('verify.code_expired'), default => $t('verify.wrong', ['left' => LoginCode::attemptsLeft($uid)]) };
    }
}

$form = '<h1>' . $e($t('verify.title')) . '</h1>'
    . '<p class="lead">' . $e($t('verify.lead', ['email' => $mask((string)($u['email'] ?? ''))])) . '</p>'
    . ($err !== '' ? '<p class="msg err" role="alert">' . $e($err) . '</p>' : '')
    . ($info !== '' ? '<p class="msg" role="status">' . $e($info) . '</p>' : '')
    . '<form class="form" method="post" action="' . $e(Site::localePath($l, '/verify')) . '">'
    . '<div><label for="code">' . $e($t('verify.code_label')) . '</label>'
    . '<input id="code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 \-]{8,12}" maxlength="12" required autofocus dir="ltr" class="code-input"></div>'
    . '<label class="opt"><input type="checkbox" name="trust" value="1" checked><div><b>' . $e($t('verify.trust', ['days' => LoginCode::days()])) . '</b><span>' . $e($t('verify.trust_d')) . '</span></div></label>'
    . '<div class="actions"><button class="btn btn-primary" type="submit">' . $e($t('verify.submit')) . '</button></div></form>'
    . '<form class="form" method="post" action="' . $e(Site::localePath($l, '/verify')) . '"><input type="hidden" name="do" value="resend">'
    . '<div class="actions"><button class="btn" type="submit">' . $e($t('verify.resend')) . '</button></div></form>'
    . '<p class="muted">' . $e($t('verify.note')) . '</p>';
$page($form, $err !== '' ? 400 : 200);
