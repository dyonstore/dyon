<?php
require __DIR__ . '/_g.php';
use Dyon\{Http, Sync};
dyon_post_guard();
$u = sync_user(20); $uid = (int)$u['id'];
$in = Http::jsonBody(8192);
$rewrap = !empty($in['rewrap']);
try { $ok = Sync::setup($uid, $in, $rewrap); }
catch (InvalidArgumentException $e) { Http::error(400, 'bad_request', 'Invalid key envelope'); }
if (!$ok) Http::error(409, $rewrap ? 'not_set_up' : 'already_set_up', $rewrap ? 'Sync is not set up' : 'Sync is already set up for this account');
if (!$rewrap) \Dyon\Mailer::toUser($uid, 'sync_enabled');
Http::json(['ok' => true]);
