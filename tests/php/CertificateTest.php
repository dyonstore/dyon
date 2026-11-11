<?php
/* §11 server-checked certificate: class rules, API (session + CSRF + validation), public page in 3 locales, withdrawal. */
use Dyon\{Config, Db, Auth, Session, Crypto, Certificate};

$cdir = tmpdir(); $ckey = base64_encode(str_repeat('c', 32));
Config::set(['data_dir' => $cdir, 'cookie_secure' => false, 'secret_key' => $ckey, 'base_url' => 'https://dyon.store']);
Db::reset();
[$cu] = Auth::upsertUser('google', 'cert-1', 'cert1@example.org', 'Maher T', null);
[$cv] = Auth::upsertUser('google', 'cert-2', 'cert2@example.org', 'Other', null);

test('certificate: percent rounds down, so 100% means every entry', function () {
    eq(Certificate::percent(7, 100), 7); eq(Certificate::percent(99, 100), 99); eq(Certificate::percent(199, 200), 99);
    eq(Certificate::percent(1, 3), 33); eq(Certificate::percent(3, 3), 100); eq(Certificate::percent(0, 0), 0);
});
test('certificate: issue validates counts, cleans the name, keeps ONE stable public id per account', function () use ($cu) {
    throws(fn() => Certificate::issue($cu, 5, 6, 'x'), 'bad_counts'); throws(fn() => Certificate::issue($cu, 5, -1, 'x'), 'bad_counts');
    throws(fn() => Certificate::issue($cu, 0, 0, 'x'), 'no_entries'); throws(fn() => Certificate::issue($cu, Certificate::MAX_TOTAL + 1, 1, 'x'), 'bad_counts');
    $a = Certificate::issue($cu, 100, 7, "  Maher\x00  \u{202E}Tounsi  ");
    eq($a['name'], 'Maher Tounsi'); eq((int)$a['done'], 7);
    $b = Certificate::issue($cu, 101, 8, 'Maher'); eq($b['public_id'], $a['public_id']); eq((int)$b['total'], 101);
    eq(Certificate::url($a['public_id']), 'https://dyon.store/c/' . $a['public_id']);
    eq(strlen(Certificate::cleanName(str_repeat('é', 200))), 120);   // 60 chars (2 bytes each)
});
test('certificate: the table holds counts and a name only — no ledger content columns', function () {
    $cols = array_column(Db::system()->all('PRAGMA table_info(certificates)'), 'name');
    eq($cols, ['id', 'user_id', 'public_id', 'name', 'total', 'done', 'issued_at', 'updated_at', 'revoked_at']);
});
test('certificate: find() rejects malformed ids; withdrawn certificates keep their row; a new one after withdrawal gets a new id', function () use ($cv) {
    eq(Certificate::find("x'; DROP TABLE users;--"), null); eq(Certificate::find('short'), null);
    $a = Certificate::issue($cv, 10, 1, 'V'); ok(Certificate::revoke($cv)); ok(!Certificate::revoke($cv));
    ok(Certificate::mine($cv) === null); ok(Certificate::find($a['public_id'])['revoked_at'] !== null);
    $b = Certificate::issue($cv, 10, 2, 'V'); ok($b['public_id'] !== $a['public_id']);
});

function ce_user(int $id): array {
    unset($_COOKIE['dyon_sess']); $tok = Session::start($id); Db::system()->pdo->exec('PRAGMA wal_checkpoint(PASSIVE)');
    $csrf = Crypto::randomToken(16);
    return ['Cookie' => "dyon_sess=$tok; dyon_csrf=$csrf", 'X-CSRF-Token' => $csrf, 'Content-Type' => 'application/json'];
}
[$cbase] = dev_server(['APP_ENV' => 'dev', 'DYON_COOKIE_SECURE' => '0', 'DYON_SECRET_KEY' => $ckey, 'DYON_DATA_DIR' => $cdir, 'DYON_BASE_URL' => 'https://dyon.store']);
$hU = ce_user($cu);
function ce(string $p, string $m, array $h, ?array $b = null): array { global $cbase; [$s, $hd, $r] = http($cbase, $p, $m, $h, $b === null ? null : json_encode($b)); return [$s, json_decode($r, true) ?? $r, $hd]; }

test('certificate API: needs a session (401) and CSRF on writes (403); validates counts (400)', function () use ($hU) {
    eq(ce('/api/cert.php', 'GET', [])[0], 401);
    $noCsrf = $hU; unset($noCsrf['X-CSRF-Token']); eq(ce('/api/cert.php', 'POST', $noCsrf, ['action' => 'issue', 'total' => 1, 'done' => 1])[0], 403);
    eq(ce('/api/cert.php', 'POST', $hU, ['action' => 'issue', 'total' => '5', 'done' => 1])[1]['error']['code'], 'bad_counts');
    eq(ce('/api/cert.php', 'POST', $hU, ['action' => 'issue', 'total' => 5, 'done' => 9])[1]['error']['code'], 'bad_counts');
    eq(ce('/api/cert.php', 'POST', $hU, ['action' => 'nope'])[0], 400);
});
test('certificate API: issue → GET shows it → public page in en/ar/fr shows % and counts, never anything else', function () use ($hU, $cbase) {
    [$s, $j] = ce('/api/cert.php', 'POST', $hU, ['action' => 'issue', 'total' => 100, 'done' => 7, 'name' => 'Maher <b>x</b>']); eq($s, 200);
    $c = $j['certificate']; eq($c['percent'], 7); ok(str_starts_with($c['url'], 'https://dyon.store/c/'));
    eq(ce('/api/cert.php', 'GET', $hU)[1]['certificate']['id'], $c['id']);
    foreach (['' => 'en', '/ar' => 'ar', '/fr' => 'fr'] as $pre => $l) {
        [$ps, $ph, $pb] = http($cbase, $pre . '/c/' . $c['id']); eq($ps, 200, $l);
        ok(str_contains($pb, 'data-pct="7"') && str_contains($pb, '7<span>%</span>'), "$l pct");
        ok(str_contains($pb, "lang=\"$l\""), "$l lang"); ok(str_contains($pb, '&lt;b&gt;x&lt;/b&gt;') && !str_contains($pb, '<b>x</b>'), "$l escaped name");
        ok(!str_contains($pb, 'cert1@example.org'), "$l no e-mail leaks"); ok(str_contains($ph['x-robots-tag'] ?? '', 'noindex'));
        ok(str_contains($ph['cache-control'] ?? '', 'no-store')); ok(!str_contains($pb, 'mail.') && !preg_match('/\bcert\.[a-z_]+\b/', strip_tags($pb)), "$l missing key");
    }
});
test('certificate public page: unknown id → 404, malformed → 404, POST → 405', function () use ($cbase) {
    eq(http($cbase, '/c/' . str_repeat('A', 16))[0], 404); eq(http($cbase, '/c/short')[0], 404);
    eq(http($cbase, '/c/' . str_repeat('A', 16), 'POST', [], '')[0], 405);
});
test('certificate API: withdraw → public page says 410; refresh keeps id; another account cannot touch it', function () use ($hU, $cbase, $cv) {
    $id = ce('/api/cert.php', 'GET', $hU)[1]['certificate']['id'];
    [, $j] = ce('/api/cert.php', 'POST', $hU, ['action' => 'issue', 'total' => 101, 'done' => 8, 'name' => 'M']); eq($j['certificate']['id'], $id); eq($j['certificate']['percent'], 7);
    $hV = ce_user($cv); eq(ce('/api/cert.php', 'GET', $hV)[1]['certificate']['id'] === $id, false);
    eq(ce('/api/cert.php', 'POST', $hU, ['action' => 'revoke'])[1]['revoked'], true);
    eq(http($cbase, '/c/' . $id)[0], 410); eq(http($cbase, '/fr/c/' . $id)[0], 410);
    eq(ce('/api/cert.php', 'GET', $hU)[1]['certificate'], null);
});
