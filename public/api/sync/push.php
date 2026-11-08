<?php
require __DIR__ . '/_g.php';
use Dyon\{Http, Sync};
dyon_post_guard();
$u = sync_user(); $uid = (int)$u['id'];
if (!Sync::meta($uid)) Http::error(404, 'not_set_up', 'Sync is not set up');
$in = Http::jsonBody(2 * 1024 * 1024);
$dev = Sync::activeDevice($uid, $in['device_id'] ?? null);
if (!is_array($in['changes'] ?? null)) Http::error(400, 'bad_request', 'changes is required');
try { Http::json(Sync::push($uid, $dev, $in['changes'])); }
catch (InvalidArgumentException $e) { Http::error(400, 'bad_request', 'Invalid change'); }
catch (RuntimeException $e) { if ($e->getMessage() === 'quota') Http::error(413, 'quota_exceeded', 'Your synced copy is full'); throw $e; }
