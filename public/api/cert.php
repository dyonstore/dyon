<?php
/* §11 — the signed-in account's own certificate. GET = current; POST {action:'issue', total, done, name} | {action:'revoke'}.
   The body is three numbers and a name: the ledger never travels. */
require __DIR__ . '/_boot.php';
use Dyon\{Http, Session, Csrf, Certificate, RateLimit};
$m = Http::method('GET', 'POST');
$s = Session::current();
if (!$s) Http::error(401, 'unauthorized', 'Sign in first');
$uid = (int)$s['user']['id'];
$r = RateLimit::hit('cert:' . $uid, 30, 3600);
if (!$r['ok']) Http::error(429, 'rate_limited', 'Too many requests', ['Retry-After' => (string)$r['retry_after']]);
if ($m === 'GET') Http::json(['certificate' => Certificate::mineJson(Certificate::mine($uid))]);
Csrf::enforce();
$in = Http::jsonBody(2048);
switch ($in['action'] ?? '') {
    case 'issue':
        foreach (['total', 'done'] as $k) if (!isset($in[$k]) || !is_int($in[$k])) Http::error(400, 'bad_counts', 'Counts must be whole numbers');
        try { $c = Certificate::issue($uid, $in['total'], $in['done'], is_string($in['name'] ?? null) ? $in['name'] : ''); }
        catch (InvalidArgumentException $e) { Http::error(400, $e->getMessage(), 'Invalid certificate numbers'); }
        Http::json(['certificate' => Certificate::mineJson($c)]);
    case 'revoke':
        Http::json(['revoked' => Certificate::revoke($uid)]);
}
Http::error(400, 'bad_request', 'Unknown action');
