<?php
require __DIR__ . '/_g.php';
use Dyon\{Http, Sync};
Http::method('GET');
$u = sync_user(); $uid = (int)$u['id'];
if (!Sync::meta($uid)) Http::error(404, 'not_set_up', 'Sync is not set up');
Sync::activeDevice($uid, $_GET['device'] ?? null);
Http::json(Sync::pull($uid, (int)($_GET['since'] ?? 0), (int)($_GET['limit'] ?? 500)));
