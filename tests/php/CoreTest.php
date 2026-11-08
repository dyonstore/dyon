<?php
use Dyon\{Config, Db, Crypto, Session, Csrf, RateLimit, Geo, I18n};

$dir = tmpdir();
Config::set(['data_dir' => $dir, 'cookie_secure' => false, 'secret_key' => base64_encode(random_bytes(32))]);
Db::reset();

/* ---- Db / schema ---- */
test('migrate twice is a no-op; user_version = latest', function () {
    $db = Db::system();
    eq($db->version(), Db::latestVersion());
    ok($db->version() >= 2);
    eq($db->migrate(), 0);
});
test('Db pragmas: WAL, foreign_keys, busy_timeout', function () {
    $db = Db::system();
    eq(strtolower((string)$db->val('PRAGMA journal_mode')), 'wal');
    eq((int)$db->val('PRAGMA foreign_keys'), 1);
    eq((int)$db->val('PRAGMA busy_timeout'), 5000);
});
test('all spec tables exist', function () {
    $have = array_column(Db::system()->all("SELECT name FROM sqlite_master WHERE type='table'"), 'name');
    foreach (['users','sessions','devices','sync_meta','subscribers','email_queue','email_log','contact_messages','posts','post_i18n',
              'events','tags','post_tags','media','settings','country_defaults','audit_log','rate_limits'] as $t) ok(in_array($t, $have, true), "missing $t");
});
test('FK cascade on user delete', function () {
    $db = Db::system();
    $db->exec("INSERT INTO users(provider, sub_hash, created_at) VALUES('google','h1',1)"); $uid = $db->lastId();
    $db->exec("INSERT INTO sessions(user_id, token_hmac, created_at, expires_at) VALUES(?,?,1,9999999999)", [$uid, 'x1']);
    $db->exec("INSERT INTO devices(user_id, label, created_at) VALUES(?, 'phone', 1)", [$uid]);
    $db->exec("INSERT INTO sync_meta(user_id) VALUES(?)", [$uid]);
    $db->exec("DELETE FROM users WHERE id = ?", [$uid]);
    eq((int)$db->val('SELECT COUNT(*) FROM sessions WHERE user_id = ?', [$uid]), 0);
    eq((int)$db->val('SELECT COUNT(*) FROM devices WHERE user_id = ?', [$uid]), 0);
    eq((int)$db->val('SELECT COUNT(*) FROM sync_meta WHERE user_id = ?', [$uid]), 0);
});
test('FKs reject orphans; post type CHECK', function () {
    $db = Db::system();
    throws(fn() => $db->exec("INSERT INTO sessions(user_id, token_hmac, created_at, expires_at) VALUES(999,'o',1,2)"));
    throws(fn() => $db->exec("INSERT INTO posts(type, slug) VALUES('essay','x')"));
});
test('tx rolls back on exception, nested tx joins', function () {
    $db = Db::system();
    throws(fn() => $db->tx(function ($d) { $d->exec("INSERT INTO settings(key,value) VALUES('a','1')"); throw new Exception('boom'); }), 'boom');
    eq($db->val("SELECT COUNT(*) FROM settings WHERE key='a'"), 0);
    $db->tx(fn($d) => $d->tx(fn($d2) => $d2->exec("INSERT INTO settings(key,value) VALUES('b','1')")));
    eq((int)$db->val("SELECT COUNT(*) FROM settings WHERE key='b'"), 1);
});
test('migrate() applies later migrations in order inside a transaction and rolls back a failing one', function () {
    $md = tmpdir(); file_put_contents("$md/001_a.sql", 'CREATE TABLE a(x);'); file_put_contents("$md/002_b.sql", 'CREATE TABLE b(x);');
    $db = Db::open(tmpdir() . '/m.sqlite');
    eq($db->migrate($md), 2); eq($db->version(), 2);
    file_put_contents("$md/003_bad.sql", 'CREATE TABLE c(x); CREATE TABLE c(x);');
    throws(fn() => $db->migrate($md), 'migration 3');
    eq($db->version(), 2);
    eq((int)$db->val("SELECT COUNT(*) FROM sqlite_master WHERE name='c'"), 0);
});

/* ---- Crypto ---- */
test('randomToken is base64url and unique', function () {
    $a = Crypto::randomToken(); $b = Crypto::randomToken();
    ok(preg_match('/^[A-Za-z0-9_-]{43}$/', $a) === 1); ok($a !== $b);
});
test('hmac is deterministic, domain-separated, key-dependent', function () {
    eq(Crypto::hmac('v', 'p'), Crypto::hmac('v', 'p'));
    ok(Crypto::hmac('v', 'p') !== Crypto::hmac('v', 'q'));
    $x = Crypto::hmac('v', 'p'); Crypto::useKey(random_bytes(32)); ok($x !== Crypto::hmac('v', 'p')); Crypto::useKey(null);
});
test('constEq', fn() => ok(Crypto::constEq('a', 'a') && !Crypto::constEq('a', 'b')));
test('sign/verify: tamper, wrong purpose and expiry fail', function () {
    $t = Crypto::sign(['n' => 1], 60, 'oauth');
    eq(Crypto::verify($t, 'oauth')['n'], 1);
    eq(Crypto::verify($t, 'other'), null);
    eq(Crypto::verify($t . 'x', 'oauth'), null);
    eq(Crypto::verify(Crypto::sign(['n' => 1], -5, 'oauth'), 'oauth'), null);
});
test('missing secret_key is a hard error, not a weak default', function () {
    $saved = Config::get('secret_key'); Config::set(['secret_key' => '']);
    throws(fn() => Crypto::hmac('x'), 'secret_key'); Config::set(['secret_key' => $saved]);
});
test('subHash never contains the raw sub', fn() => ok(strpos(Crypto::subHash('google', '1234567890'), '1234567890') === false && strlen(Crypto::subHash('google', 'x')) === 64));

/* ---- Session ---- */
$mkuser = function (string $sub = 's1') {
    $db = Db::system(); $db->exec("INSERT INTO users(provider, sub_hash, email, created_at) VALUES('google',?, 'a@b.c', ?)", [Crypto::subHash('google', $sub), time()]);
    return $db->lastId();
};
test('Session: DB stores hmac(token), never the token; current() resolves; destroy() removes', function () use ($mkuser) {
    $uid = $mkuser('sess1'); $_COOKIE = [];
    $tok = Session::start($uid, 'UA');
    eq(Db::system()->val('SELECT COUNT(*) FROM sessions WHERE token_hmac = ?', [$tok]), 0, 'raw token stored!');
    eq((int)Db::system()->val('SELECT COUNT(*) FROM sessions WHERE token_hmac = ?', [Crypto::hmac($tok, 'session')]), 1);
    eq(Session::current($tok)['user']['id'], $uid);
    eq(Session::current('nope'), null);
    $_COOKIE[Session::cookieName()] = $tok; Session::destroy();
    eq(Session::current($tok), null);
});
test('Session: rotates on login (old token invalid), 30-day expiry', function () use ($mkuser) {
    $uid = $mkuser('sess2'); $_COOKIE = [];
    $a = Session::start($uid); $_COOKIE[Session::cookieName()] = $a;
    $b = Session::start($uid);
    ok($a !== $b); eq(Session::current($a), null); ok(Session::current($b) !== null);
    $exp = (int)Db::system()->val('SELECT expires_at FROM sessions WHERE token_hmac = ?', [Crypto::hmac($b, 'session')]);
    ok(abs($exp - (time() + 30 * 86400)) < 5);
});
test('Session: expired and soft-deleted-user sessions are rejected; sliding refresh', function () use ($mkuser) {
    $uid = $mkuser('sess3'); $_COOKIE = []; $tok = Session::start($uid); $h = Crypto::hmac($tok, 'session');
    Db::system()->exec('UPDATE sessions SET expires_at = ? WHERE token_hmac = ?', [time() + 5 * 86400, $h]);
    ok(Session::current($tok) !== null);
    ok((int)Db::system()->val('SELECT expires_at FROM sessions WHERE token_hmac = ?', [$h]) > time() + 29 * 86400, 'did not slide');
    Db::system()->exec('UPDATE sessions SET expires_at = ? WHERE token_hmac = ?', [time() - 1, $h]);
    eq(Session::current($tok), null);
    $tok2 = Session::start($uid); Db::system()->exec('UPDATE users SET deleted_at = 1 WHERE id = ?', [$uid]);
    eq(Session::current($tok2), null);
});
test('Session cookie is __Host- prefixed when secure', function () {
    Config::set(['cookie_secure' => true]); eq(Session::cookieName(), '__Host-dyon_sess'); eq(Csrf::cookieName(), '__Host-dyon_csrf');
    Config::set(['cookie_secure' => false]);
});

/* ---- Csrf ---- */
$post = fn(array $s = [], array $c = [], array $p = []) => Csrf::check(['REQUEST_METHOD' => 'POST', 'HTTP_HOST' => 'dyon.test'] + $s, $c, $p, 'dyon.test');
test('Csrf: GET/HEAD pass, POST without token fails', function () use ($post) {
    ok(Csrf::check(['REQUEST_METHOD' => 'GET'], [], [])); ok(Csrf::check(['REQUEST_METHOD' => 'HEAD'], [], []));
    ok(!$post());
});
test('Csrf: header or form token must equal cookie', function () use ($post) {
    $c = [Csrf::cookieName() => str_repeat('a', 32)];
    ok($post(['HTTP_X_CSRF_TOKEN' => str_repeat('a', 32)], $c));
    ok($post([], $c, ['_csrf' => str_repeat('a', 32)]));
    ok(!$post(['HTTP_X_CSRF_TOKEN' => str_repeat('b', 32)], $c));
    ok(!$post(['HTTP_X_CSRF_TOKEN' => 'x'], []));
});
test('Csrf: cross-site Origin / Sec-Fetch-Site / null Origin rejected', function () use ($post) {
    $c = [Csrf::cookieName() => str_repeat('a', 32)]; $h = ['HTTP_X_CSRF_TOKEN' => str_repeat('a', 32)];
    ok($post($h + ['HTTP_ORIGIN' => 'https://dyon.test'], $c));
    ok(!$post($h + ['HTTP_ORIGIN' => 'https://evil.test'], $c));
    ok(!$post($h + ['HTTP_ORIGIN' => 'null'], $c));
    ok(!$post($h + ['HTTP_SEC_FETCH_SITE' => 'cross-site'], $c));
    ok(!$post($h + ['HTTP_SEC_FETCH_SITE' => 'same-site'], $c));
    ok($post($h + ['HTTP_SEC_FETCH_SITE' => 'same-origin'], $c));
});

/* ---- RateLimit ---- */
test('RateLimit: allows up to limit, then blocks with Retry-After; new window resets', function () {
    $now = 1_700_000_000;
    for ($i = 1; $i <= 3; $i++) ok(RateLimit::hit('t:1', 3, 60, $now)['ok'], "hit $i");
    $r = RateLimit::hit('t:1', 3, 60, $now); ok(!$r['ok']); ok($r['retry_after'] >= 1 && $r['retry_after'] <= 60);
    ok(RateLimit::hit('t:2', 3, 60, $now)['ok'], 'buckets independent');
    ok(RateLimit::hit('t:1', 3, 60, $now + 61)['ok'], 'window reset');
});
test('RateLimit stores only an hmac of the bucket (no raw IP)', function () {
    RateLimit::hit('login:203.0.113.9', 5, 60);
    $all = json_encode(Db::system()->all('SELECT * FROM rate_limits'));
    ok(strpos($all, '203.0.113.9') === false);
});

/* ---- Geo ---- */
test('Geo: CDN header only; rejects junk, XX and T1; never needs IP', function () {
    eq(Geo::country(['HTTP_CF_IPCOUNTRY' => 'tn']), 'TN');
    eq(Geo::country(['HTTP_CF_IPCOUNTRY' => 'XX']), null);
    eq(Geo::country(['HTTP_CF_IPCOUNTRY' => 'T1']), null);
    eq(Geo::country(['HTTP_CF_IPCOUNTRY' => 'Tunisia']), null);
    eq(Geo::country([]), null);
});

/* ---- I18n (same fixtures as js/i18n) ---- */
test('I18n: interpolation, select, # and escapes', function () {
    eq(I18n::format('Hello {name}', ['name' => 'Sam']), 'Hello Sam');
    eq(I18n::format('{g, select, f {She} other {They}} ok', ['g' => 'f']), 'She ok');
    eq(I18n::format('{g, select, f {She} other {They}} ok', ['g' => 'z']), 'They ok');
    eq(I18n::format("it''s {n}", ['n' => 2]), "it's 2");
    eq(I18n::format('{missing}', []), '{missing}');
});
test('I18n: plural en/fr/ar categories', function () {
    $m = '{count, plural, =0 {none} one {# item} other {# items}}';
    eq(I18n::format($m, ['count' => 0], 'en'), 'none'); eq(I18n::format($m, ['count' => 1], 'en'), '1 item'); eq(I18n::format($m, ['count' => 5], 'en'), '5 items');
    eq(I18n::pluralCat('fr', 0), 'one'); eq(I18n::pluralCat('fr', 1), 'one'); eq(I18n::pluralCat('fr', 2), 'other');
    foreach ([0 => 'zero', 1 => 'one', 2 => 'two', 3 => 'few', 10 => 'few', 11 => 'many', 99 => 'many', 100 => 'other', 102 => 'other'] as $n => $cat) eq(I18n::pluralCat('ar', $n), $cat, "ar $n");
});
test('I18n: loads real locale files for all three languages, falls back to en then key', function () {
    foreach (['en', 'ar', 'fr'] as $l) ok(count(I18n::load($l)) > 700, "$l loaded");
    eq(I18n::t('app.name', [], 'en'), 'DYON'); ok(I18n::t('app.name', [], 'ar') !== 'app.name'); eq(I18n::t('no.such.key', [], 'fr'), 'no.such.key');
    eq(I18n::dir('ar'), 'rtl'); eq(I18n::dir('fr'), 'ltr');
});
test('I18n::detect: path prefix beats Accept-Language', function () {
    eq(I18n::detect('/ar/blog', 'fr'), 'ar'); eq(I18n::detect('/blog', 'fr-CA,fr;q=0.9,en;q=0.5'), 'fr');
    eq(I18n::detect('/', 'de,es'), 'en');
});
