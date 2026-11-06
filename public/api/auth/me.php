<?php
require dirname(__DIR__) . '/_boot.php';
use Dyon\{Http, Session, Csrf, Auth};
Http::method('GET');
Csrf::token();                                    // make sure the double-submit cookie exists for the next POST
$s = Session::current();
$providers = array_values(array_filter(['google', 'microsoft', 'apple'], [Auth::class, 'configured']));
$csrf = Csrf::token();                            // same value as the cookie; the client echoes it in X-CSRF-Token
if (!$s) Http::json(['signed_in' => false, 'providers' => $providers, 'csrf' => $csrf]);
$u = $s['user'];
Http::json(['signed_in' => true, 'name' => $u['name'], 'email' => $u['email'], 'provider' => $u['provider'],
            'avatar' => $u['avatar_url'] ? '/api/avatar.php' : null, 'created' => (int)$u['created_at'], 'providers' => $providers, 'csrf' => $csrf]);
