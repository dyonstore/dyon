<?php
require __DIR__ . '/_g.php';
use Dyon\{Http, Sync};
Http::method('GET');
$u = sync_user(); $m = Sync::meta((int)$u['id']);
if (!$m) Http::json(['set_up' => false]);
Http::json(['set_up' => true, 'salt' => $m['salt'], 'kdf_iter' => (int)$m['kdf_iter'], 'wrapped_key' => $m['wrapped_key'],
            'wrapped_key_recovery' => $m['wrapped_key_recovery'], 'key_check' => $m['key_check'], 'head' => (int)$m['rev'],
            'bytes' => (int)$m['bytes'], 'quota' => Sync::quota(), 'user_id' => (int)$u['id']]);
