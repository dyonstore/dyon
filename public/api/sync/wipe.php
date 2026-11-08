<?php
require __DIR__ . '/_g.php';
use Dyon\{Http, Sync, Db};
dyon_post_guard();
$u = sync_user(10); $uid = (int)$u['id'];
$in = Http::jsonBody(1024);
if (($in['confirm'] ?? '') !== 'delete') Http::error(400, 'confirm_required', 'Confirmation is required');
Sync::wipe($uid);
Http::json(['ok' => true]);
