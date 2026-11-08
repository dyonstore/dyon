<?php
require __DIR__ . '/_boot.php';
use Dyon\{Http, Session, Avatar, RateLimit};
Http::method('GET');
$s = Session::current();
if (!$s) Http::error(401, 'unauthorized', 'Sign in first');
RateLimit::guard('avatar', 60, 60);
$img = Avatar::get((int)$s['user']['id'], $s['user']['avatar_url'] ?? null);
if ($img === null) Http::error(404, 'no_avatar', 'No picture', ['Cache-Control' => 'private, max-age=300']);
Http::securityHeaders();
header('Content-Type: ' . Avatar::mime());
header('Cache-Control: private, max-age=86400');
header('Content-Length: ' . strlen($img));
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'HEAD') echo $img;
