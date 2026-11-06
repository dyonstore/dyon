<?php
require dirname(__DIR__) . '/_boot.php';
use Dyon\{Http, Auth, AuthException, RateLimit, Session};
$m = Http::method('GET', 'POST');                 // Apple uses POST (form_post); others GET
RateLimit::guard('auth-callback', 30, 60);
$cookie = (string)($_COOKIE[Auth::COOKIE] ?? '');
$params = $m === 'POST' ? $_POST : $_GET;
/* The state cookie is single-use. */
Session::setCookie(Auth::COOKIE, '', time() - 3600);
try {
    [$uid, , $return] = Auth::complete($params, $cookie);
    Session::start($uid, $_SERVER['HTTP_USER_AGENT'] ?? null);   // fresh token: login always rotates
    Http::redirect(Auth::safeReturn($return) === '/' ? '/#/settings' : Auth::safeReturn($return));
} catch (AuthException $e) {
    Http::redirect('/?auth_error=' . rawurlencode($e->errorCode) . '#/settings');
}
