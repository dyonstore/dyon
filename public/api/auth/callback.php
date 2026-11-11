<?php
require dirname(__DIR__) . '/_boot.php';
use Dyon\{Http, Auth, AuthException, RateLimit, Session, Db, LoginCode};
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
    $dest = Auth::safeReturn($return) === '/' ? '/#/settings' : Auth::safeReturn($return);
    if (LoginCode::required($uid)) {                // §9: new device / long absence / first sign-in → e-mailed 8-digit code; no session yet
        Session::destroy();                          // never leave an older session of another account alive
        LoginCode::issue($uid);
        try { \Dyon\Mailer::run(5); } catch (\Throwable) { /* stays queued; the worker retries */ }
        LoginCode::setPending($uid, $dest);
        Http::redirect('/verify');
    }
    Session::start($uid, $ua);   // fresh token: login always rotates
    if (!$seen) \Dyon\Mailer::toUser($uid, 'signin_new_device', ['when' => gmdate('Y-m-d H:i') . ' UTC']);
    Http::redirect($dest);
} catch (AuthException $e) {
    Http::redirect('/?auth_error=' . rawurlencode($e->errorCode) . '#/settings');
}
