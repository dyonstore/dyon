<?php
require dirname(__DIR__) . '/_boot.php';
use Dyon\{Http, Auth, AuthException, RateLimit, Session};
Http::method('GET');
RateLimit::guard('auth-start', 20, 60);
$provider = (string)($_GET['provider'] ?? '');
try {
    [$url, $cookie] = Auth::begin($provider, $_GET['return'] ?? '/');
} catch (AuthException $e) {
    Http::redirect('/?auth_error=' . rawurlencode($e->errorCode) . '#/settings');
}
/* SameSite=None is required for Apple's cross-site form_post callback; the cookie is signed, short-lived and single-purpose. */
Session::setCookie(Auth::COOKIE, $cookie, time() + Auth::STATE_TTL, true, $provider === 'apple' ? 'None' : 'Lax');
Http::redirect($url);
