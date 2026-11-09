<?php
require dirname(__DIR__) . '/_boot.php';
use Dyon\{Http, Auth, AuthException, RateLimit, Session, Db};
$m = Http::method('GET', 'POST');                 // Apple uses POST (form_post); others GET
RateLimit::guard('auth-callback', 30, 60);
$cookie = (string)($_COOKIE[Auth::COOKIE] ?? '');
$params = $m === 'POST' ? $_POST : $_GET;
/* The state cookie is single-use. */
Session::setCookie(Auth::COOKIE, '', time() - 3600);
try {
    [$uid, $new, $return] = Auth::complete($params, $cookie);
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? null;
    $seen = $new || ($ua !== null && Db::system()->one('SELECT 1 FROM sessions WHERE user_id = ? AND ua_hash = ?', [$uid, substr(hash('sha256', $ua), 0, 16)]));
    Session::start($uid, $ua);   // fresh token: login always rotates
    if (!$seen) \Dyon\Mailer::toUser($uid, 'signin_new_device', ['when' => gmdate('Y-m-d H:i') . ' UTC']);
    Http::redirect(Auth::safeReturn($return) === '/' ? '/#/settings' : Auth::safeReturn($return));
} catch (AuthException $e) {
    Http::redirect('/?auth_error=' . rawurlencode($e->errorCode) . '#/settings');
}
