<?php
require __DIR__ . '/_g.php';
use Dyon\{Http, Sync, Csrf};
$m = Http::method('GET', 'POST');
$u = sync_user(60); $uid = (int)$u['id'];
if ($m === 'GET') Http::json(['devices' => array_map(fn($d) => ['id' => (int)$d['id'], 'label' => $d['label'], 'created' => (int)$d['created_at'],
    'last_seen' => $d['last_seen_at'] === null ? null : (int)$d['last_seen_at'], 'revoked' => $d['revoked_at'] !== null], Sync::devices($uid))]);
Csrf::enforce();
$in = Http::jsonBody(4096);
switch ($in['action'] ?? '') {
    case 'register':
        if (!Sync::meta($uid)) Http::error(404, 'not_set_up', 'Sync is not set up');
        try { $did = Sync::registerDevice($uid, (string)($in['label'] ?? '')); \Dyon\Mailer::toUser($uid, 'sync_device_added', ['device' => mb_substr(trim((string)($in['label'] ?? '')), 0, 60)]); Http::json(['id' => $did]); }
        catch (RuntimeException $e) { Http::error(409, 'too_many_devices', 'Too many devices'); }
    case 'rename':
        if (!Sync::renameDevice($uid, (int)($in['id'] ?? 0), (string)($in['label'] ?? ''))) Http::error(404, 'not_found', 'No such device');
        Http::json(['ok' => true]);
    case 'revoke':
        if (!Sync::revokeDevice($uid, (int)($in['id'] ?? 0))) Http::error(404, 'not_found', 'No such device');
        Http::json(['ok' => true]);
}
Http::error(400, 'bad_request', 'Unknown action');
