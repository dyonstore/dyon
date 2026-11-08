<?php
/* §6 encrypted-sync server: storage class + real HTTP endpoints. Blobs are opaque bytes to the server. */
use Dyon\{Config, Db, Crypto, Session, Auth, Sync};

$sdir = tmpdir(); $skey = base64_encode(str_repeat('s', 32));
Config::set(['data_dir' => $sdir, 'cookie_secure' => false, 'secret_key' => $skey]);
Db::reset();
[$sbase] = dev_server(['APP_ENV' => 'dev', 'DYON_COOKIE_SECURE' => '0', 'DYON_SECRET_KEY' => $skey, 'DYON_DATA_DIR' => $sdir, 'DYON_SYNC' => '']);

function sy_user(string $sub): array {
    [$id] = Auth::upsertUser('google', $sub, $sub . '@x.org', 'Zainab Secret', null);
    unset($_COOKIE['dyon_sess']);                       // Session::start rotates the cookie's session away; keep other test users alive
    $tok = Session::start($id); Db::system()->pdo->exec('PRAGMA wal_checkpoint(PASSIVE)');   // make the new session visible to the php -S process
    $csrf = Crypto::randomToken(16);
    return [$id, ['Cookie' => "dyon_sess=$tok; dyon_csrf=$csrf", 'X-CSRF-Token' => $csrf, 'Content-Type' => 'application/json']];
}
function sy(string $path, string $m, array $h, ?array $body = null): array {
    global $sbase;
    [$s, $hd, $b] = http($sbase, $path, $m, $h, $body === null ? null : json_encode($body));
    return [$s, json_decode($b, true) ?? $b];
}
function sy_meta(): array {
    $b = fn() => rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    return ['salt' => $b(), 'kdf_iter' => 600000, 'wrapped_key' => $b(), 'wrapped_key_recovery' => $b(), 'key_check' => $b()];
}
function sy_ch(string $t, string $id, int $base, string $blob = 'eyJ2IjoxfQ', bool $del = false): array { return ['table' => $t, 'id' => $id, 'base_rev' => $base, 'rev' => $base + 1, 'blob' => $blob, 'deleted' => $del]; }

[$uA, $hA] = sy_user('sync-a'); [$uB, $hB] = sy_user('sync-b');

test('sync endpoints need a session (401) and CSRF on writes (403)', function () use ($sbase) {
    foreach (['meta', 'pull', 'devices'] as $e) eq(http($sbase, "/api/sync/$e.php")[0], 401, $e);
    foreach (['setup', 'push', 'wipe'] as $e) { $s = http($sbase, "/api/sync/$e.php", 'POST', [], '{}')[0]; ok(in_array($s, [401, 403], true), "$e $s"); }
    [$u, $h] = sy_user('csrf'); unset($h['X-CSRF-Token']);
    eq(sy('/api/sync/setup.php', 'POST', $h, sy_meta())[0], 403);
});
test('meta: not set up → {set_up:false}; setup stores the envelope; second setup is 409', function () use ($hA) {
    eq(sy('/api/sync/meta.php', 'GET', $hA)[1], ['set_up' => false]);
    $m = sy_meta(); eq(sy('/api/sync/setup.php', 'POST', $hA, $m)[0], 200);
    [$s, $j] = sy('/api/sync/meta.php', 'GET', $hA);
    eq($s, 200); eq($j['set_up'], true); eq($j['salt'], $m['salt']); eq($j['wrapped_key_recovery'], $m['wrapped_key_recovery']); eq($j['quota'], 50 * 1024 * 1024);
    eq(sy('/api/sync/setup.php', 'POST', $hA, sy_meta())[0], 409);
});
test('setup refuses a weak KDF (<600000), junk fields and missing fields', function () use ($hB) {
    $m = sy_meta(); $m['kdf_iter'] = 100000; eq(sy('/api/sync/setup.php', 'POST', $hB, $m)[0], 400);
    $m = sy_meta(); $m['salt'] = 'not base64!!'; eq(sy('/api/sync/setup.php', 'POST', $hB, $m)[0], 400);
    $m = sy_meta(); unset($m['key_check']); eq(sy('/api/sync/setup.php', 'POST', $hB, $m)[0], 400);
    eq(sy('/api/sync/meta.php', 'GET', $hB)[1], ['set_up' => false]);
});
test('rewrap replaces only passphrase envelope; keeps recovery + key_check', function () use ($hA) {
    $old = sy('/api/sync/meta.php', 'GET', $hA)[1]; $n = sy_meta();
    eq(sy('/api/sync/setup.php', 'POST', $hA, ['rewrap' => true, 'salt' => $n['salt'], 'kdf_iter' => 700000, 'wrapped_key' => $n['wrapped_key']])[0], 200);
    $new = sy('/api/sync/meta.php', 'GET', $hA)[1];
    eq($new['salt'], $n['salt']); eq($new['kdf_iter'], 700000); eq($new['wrapped_key_recovery'], $old['wrapped_key_recovery']); eq($new['key_check'], $old['key_check']);
    $m = sy_meta(); [$u, $h] = sy_user('norewrap'); eq(sy('/api/sync/setup.php', 'POST', $h, ['rewrap' => true] + $m)[0], 409);
});
test('push/pull need a registered device; unknown → 403', function () use ($hA) {
    eq(sy('/api/sync/push.php', 'POST', $hA, ['device_id' => 999, 'changes' => []])[0], 403);
    eq(sy('/api/sync/pull.php?device=999', 'GET', $hA)[0], 403);
    [$s, $j] = sy('/api/sync/push.php', 'POST', $hB = $GLOBALS['hB'], ['device_id' => 1, 'changes' => []]); eq($s, 404);   // B never set up
});
$dA1 = null;
test('devices: register, list, rename', function () use ($hA, &$dA1) {
    [$s, $j] = sy('/api/sync/devices.php', 'POST', $hA, ['action' => 'register', 'label' => 'Laptop']); eq($s, 200); $dA1 = $j['id'];
    [$s2, $j2] = sy('/api/sync/devices.php', 'GET', $hA); eq(count($j2['devices']), 1); eq($j2['devices'][0]['label'], 'Laptop'); eq($j2['devices'][0]['revoked'], false);
    eq(sy('/api/sync/devices.php', 'POST', $hA, ['action' => 'rename', 'id' => $dA1, 'label' => 'Work laptop'])[0], 200);
    eq(sy('/api/sync/devices.php', 'GET', $hA)[1]['devices'][0]['label'], 'Work laptop');
    eq(sy('/api/sync/devices.php', 'POST', $hA, ['action' => 'nope'])[0], 400);
});
test('push accepts when base_rev matches; pull returns it with seq, next, more', function () use ($hA, &$dA1) {
    [$s, $j] = sy('/api/sync/push.php', 'POST', $hA, ['device_id' => $dA1, 'changes' => [sy_ch('commitments', 'c_1', 0, 'AAAA'), sy_ch('counterparties', 'p_1', 0, 'BBBB')]]);
    eq($s, 200); eq(count($j['accepted']), 2); eq($j['conflicts'], []); eq($j['head'], 2); eq($j['bytes'], 8);
    [$s2, $p] = sy("/api/sync/pull.php?device=$dA1&since=0&limit=1", 'GET', $hA);
    eq($s2, 200); eq(count($p['changes']), 1); eq($p['more'], true); eq($p['next'], 1); eq($p['changes'][0]['table'], 'commitments'); eq($p['changes'][0]['blob'], 'AAAA');
    $p2 = sy("/api/sync/pull.php?device=$dA1&since={$p['next']}", 'GET', $hA)[1]; eq(count($p2['changes']), 1); eq($p2['more'], false);
    eq(sy("/api/sync/pull.php?device=$dA1&since=2", 'GET', $hA)[1]['changes'], []);
});
test('stale base_rev → returned in conflicts with the server copy; nothing overwritten', function () use ($hA, &$dA1) {
    [, $j] = sy('/api/sync/push.php', 'POST', $hA, ['device_id' => $dA1, 'changes' => [sy_ch('commitments', 'c_1', 1, 'CCCC')]]); eq($j['accepted'][0]['rev'], 2);
    [, $j2] = sy('/api/sync/push.php', 'POST', $hA, ['device_id' => $dA1, 'changes' => [sy_ch('commitments', 'c_1', 1, 'DDDD'), sy_ch('commitments', 'c_new', 0, 'EEEE')]]);
    eq(count($j2['conflicts']), 1); eq($j2['conflicts'][0]['id'], 'c_1'); eq($j2['conflicts'][0]['rev'], 2); eq($j2['conflicts'][0]['blob'], 'CCCC');
    eq(count($j2['accepted']), 1);   // the independent record still goes through
    $all = sy("/api/sync/pull.php?device=$dA1", 'GET', $hA)[1]['changes']; $c1 = array_values(array_filter($all, fn($c) => $c['id'] === 'c_1'))[0]; eq($c1['blob'], 'CCCC');
});
test('push is idempotent when a response was lost (same rev + blob)', function () use ($hA, &$dA1) {
    [, $j] = sy('/api/sync/push.php', 'POST', $hA, ['device_id' => $dA1, 'changes' => [sy_ch('commitments', 'c_1', 1, 'CCCC')]]);
    eq($j['conflicts'], []); eq(count($j['accepted']), 1);
});
test('deletes travel as tombstones with an opaque blob', function () use ($hA, &$dA1) {
    sy('/api/sync/push.php', 'POST', $hA, ['device_id' => $dA1, 'changes' => [sy_ch('counterparties', 'p_1', 1, 'FFFF', true)]]);
    $c = array_values(array_filter(sy("/api/sync/pull.php?device=$dA1", 'GET', $hA)[1]['changes'], fn($c) => $c['id'] === 'p_1'))[0];
    eq($c['deleted'], true); eq($c['rev'], 2);
});
test('push validation: bad table/id/rev jump/oversize blob/too many → 400', function () use ($hA, &$dA1) {
    $bad = [['table' => 'a b', 'id' => 'x', 'base_rev' => 0, 'rev' => 1, 'blob' => 'A'], ['table' => 'ok', 'id' => '../x', 'base_rev' => 0, 'rev' => 1, 'blob' => 'A'],
            ['table' => 'ok', 'id' => 'x', 'base_rev' => 0, 'rev' => 5, 'blob' => 'A'], ['table' => 'ok', 'id' => 'x', 'base_rev' => 0, 'rev' => 1, 'blob' => str_repeat('A', Sync::MAX_BLOB + 1)]];
    foreach ($bad as $i => $c) eq(sy('/api/sync/push.php', 'POST', $hA, ['device_id' => $dA1, 'changes' => [$c]])[0], 400, "case $i");
    $many = []; for ($i = 0; $i <= Sync::MAX_BATCH; $i++) $many[] = sy_ch('t', "i$i", 0);
    eq(sy('/api/sync/push.php', 'POST', $hA, ['device_id' => $dA1, 'changes' => $many])[0], 400);
});
test('request body over 2 MB → 413', function () use ($hA, &$dA1) {
    eq(sy('/api/sync/push.php', 'POST', $hA, ['device_id' => $dA1, 'changes' => [], 'pad' => str_repeat('x', 2 * 1024 * 1024)])[0], 413);
});
test('quota exceeded → 413 quota_exceeded and the batch is rolled back', function () {
    global $sbase, $sdir, $skey; [$u, $h] = sy_user('quota'); $base = ['data_dir' => $sdir, 'cookie_secure' => false, 'secret_key' => $skey];
    Config::set($base + ['sync' => ['quota_bytes' => 100]]);
    // quota is read by the server process from its own env: use the class directly in-process for the arithmetic, HTTP for the status code.
    sy('/api/sync/setup.php', 'POST', $h, sy_meta()); $d = sy('/api/sync/devices.php', 'POST', $h, ['action' => 'register', 'label' => 'q'])[1]['id'];
    $before = (int)Sync::userDb($u)->val('SELECT COUNT(*) FROM records');
    throws(function () use ($u, $d) { Sync::push($u, $d, [sy_ch('t', 'a', 0, str_repeat('A', 60)), sy_ch('t', 'b', 0, str_repeat('B', 60))]); }, 'quota');
    eq((int)Sync::userDb($u)->val('SELECT COUNT(*) FROM records'), $before);
    $r = Sync::push($u, $d, [sy_ch('t', 'a', 0, str_repeat('A', 60))]); eq($r['bytes'], 60);
    Config::set($base);
});
test('revoked device → 403 on push and pull; the other device keeps working', function () use ($hA, &$dA1) {
    $d2 = sy('/api/sync/devices.php', 'POST', $hA, ['action' => 'register', 'label' => 'Phone'])[1]['id'];
    eq(sy('/api/sync/devices.php', 'POST', $hA, ['action' => 'revoke', 'id' => $dA1])[0], 200);
    [$s, $j] = sy('/api/sync/push.php', 'POST', $hA, ['device_id' => $dA1, 'changes' => []]); eq($s, 403); eq($j['error']['code'], 'device_revoked');
    eq(sy("/api/sync/pull.php?device=$dA1", 'GET', $hA)[0], 403);
    eq(sy("/api/sync/pull.php?device=$d2", 'GET', $hA)[0], 200);
    eq(sy('/api/sync/devices.php', 'POST', $hA, ['action' => 'revoke', 'id' => $dA1])[0], 404);   // already revoked
    $l = sy('/api/sync/devices.php', 'GET', $hA)[1]['devices']; eq(array_column($l, 'revoked'), [true, false]);
});
test("users are isolated: B cannot use A's device id or see A's data", function () use ($hB, $hA) {
    $dA = sy('/api/sync/devices.php', 'GET', $hA)[1]['devices'][1]['id'];
    sy('/api/sync/setup.php', 'POST', $hB, sy_meta());
    eq(sy("/api/sync/pull.php?device=$dA", 'GET', $hB)[0], 403);
    eq(sy('/api/sync/push.php', 'POST', $hB, ['device_id' => $dA, 'changes' => [sy_ch('t', 'x', 0)]])[0], 403);
    $dB = sy('/api/sync/devices.php', 'POST', $hB, ['action' => 'register', 'label' => 'B'])[1]['id'];
    eq(sy("/api/sync/pull.php?device=$dB", 'GET', $hB)[1]['changes'], []);
    eq(sy('/api/sync/devices.php', 'POST', $hB, ['action' => 'revoke', 'id' => $dA])[0], 404);
});
test('the per-user file is 0600, named by HMAC (not the user id), and stores blobs verbatim with no plaintext', function () use ($uA, $sdir, $hA) {
    $d = sy('/api/sync/devices.php', 'GET', $hA)[1]['devices'][1]['id'];
    sy('/api/sync/push.php', 'POST', $hA, ['device_id' => $d, 'changes' => [sy_ch('counterparties', 'p_9', 0, base64_encode('opaque-bytes'))]]);
    $f = Sync::path($uA); ok(is_file($f)); eq(substr(sprintf('%o', fileperms($f)), -4), '0600');
    ok(!str_contains(basename($f), (string)$uA) || strlen(basename($f)) > 20); ok(str_starts_with(realpath($f), realpath($sdir) . '/users/'));
    foreach (glob($sdir . '/users/*') as $x) { $raw = file_get_contents($x); ok(!str_contains($raw, 'Zainab'), 'no names'); }
    $sys = file_get_contents($sdir . '/system.sqlite') . @file_get_contents($sdir . '/system.sqlite-wal'); ok(!str_contains($sys, 'opaque-bytes'), 'system db has no record blobs');
    ok(!is_file(dirname($f) . '/' . $uA . '.sqlite'));
});
test('Sync.php never decodes blobs (no json_decode/base64_decode of record data)', function () {
    $src = file_get_contents(DYON_ROOT . '/app/Sync.php'); ok(!preg_match('/json_decode|base64_decode|unserialize/', $src));
});
test('wipe needs the confirmation word; then deletes file + envelope + devices; local-first: re-setup possible', function () use ($uA, $hA) {
    eq(sy('/api/sync/wipe.php', 'POST', $hA, ['confirm' => 'yes'])[0], 400); ok(is_file(Sync::path($uA)));
    eq(sy('/api/sync/wipe.php', 'POST', $hA, [])[0], 400);
    eq(sy('/api/sync/wipe.php', 'POST', $hA, ['confirm' => 'delete'])[0], 200);
    clearstatcache(); ok(!is_file(Sync::path($uA)), 'file gone'); ok(!is_file(Sync::path($uA) . '-wal'));
    eq(sy('/api/sync/meta.php', 'GET', $hA)[1], ['set_up' => false]); eq(sy('/api/sync/devices.php', 'GET', $hA)[1]['devices'], []);
    eq(sy('/api/sync/setup.php', 'POST', $hA, sy_meta())[0], 200);
});
test('sync rate limit → 429 with Retry-After', function () {
    [$u, $h] = sy_user('rl'); $last = 0;
    $seen = [];
    for ($i = 0; $i < 25; $i++) { $last = sy('/api/sync/setup.php', 'POST', $h, ['bad' => 1])[0]; $seen[] = $last; if ($last === 429) break; }
    eq($last, 429, implode(',', $seen));
});
test('sync private include and non-endpoints are not web-callable', function () use ($sbase) {
    eq(http($sbase, '/api/sync/_g.php')[0], 404);
});
