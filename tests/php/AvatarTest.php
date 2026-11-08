<?php
use Dyon\{Config, Db, Crypto, Session, Avatar};

$dir = tmpdir(); $key = base64_encode(str_repeat('k', 32));
Config::set(['data_dir' => $dir, 'cookie_secure' => false, 'secret_key' => $key]);
Db::reset();

$png = function (int $w = 200, int $h = 120): string {
    $im = imagecreatetruecolor($w, $h); imagefill($im, 0, 0, imagecolorallocate($im, 200, 40, 90));
    ob_start(); imagepng($im); $b = (string)ob_get_clean(); imagedestroy($im); return $b;
};
$mkuser = function (string $url = 'https://lh3.example.com/p.png') {
    $db = Db::system(); $db->exec("INSERT INTO users(provider, sub_hash, avatar_url, created_at) VALUES('google', ?, ?, ?)", [bin2hex(random_bytes(8)), $url, time()]);
    return $db->lastId();
};
Avatar::$resolve = fn($h) => ['93.184.216.34'];
$fetches = 0;
Avatar::$http = function ($url, $ip) use (&$fetches, $png) { $fetches++; return ['status' => 200, 'body' => $png()]; };

test('safeTarget accepts https on a public IP only', function () {
    ok(Avatar::safeTarget('https://lh3.example.com/p.png') === ['93.184.216.34']);
});
test('safeTarget refuses http, credentials, odd ports, junk hosts', function () {
    foreach (['http://lh3.example.com/p.png', 'https://u:p@lh3.example.com/p.png', 'https://lh3.example.com:8443/p.png', 'ftp://x/y', 'file:///etc/passwd',
              'https:///nohost', 'javascript:alert(1)', 'https://exa mple.com/x', ''] as $u) eq(Avatar::safeTarget($u), [], $u);
});
test('safeTarget refuses private, loopback, link-local and metadata addresses (SSRF)', function () {
    foreach (['https://127.0.0.1/a', 'https://10.0.0.5/a', 'https://192.168.1.1/a', 'https://172.16.0.9/a', 'https://169.254.169.254/latest/meta-data',
              'https://[::1]/a', 'https://0.0.0.0/a', 'https://100.64.0.1/a', 'https://100.127.255.254/a', 'https://198.18.0.1/a', 'https://224.0.0.1/a',
              'https://[fd00::1]/a', 'https://[fe80::1]/a', 'https://[::ffff:127.0.0.1]/a', 'https://[::ffff:10.0.0.1]/a'] as $u) eq(Avatar::safeTarget($u), [], $u);
});
test('safeTarget refuses a hostname that RESOLVES to a private IP (DNS rebinding / split horizon)', function () {
    $old = Avatar::$resolve; Avatar::$resolve = fn($h) => ['93.184.216.34', '10.1.2.3'];
    eq(Avatar::safeTarget('https://evil.example.com/p'), []);
    Avatar::$resolve = fn($h) => []; eq(Avatar::safeTarget('https://nx.example.com/p'), []); Avatar::$resolve = $old;
});
test('isPublicIp: real public addresses pass, special ranges do not', function () {
    foreach (['8.8.8.8', '93.184.216.34', '1.1.1.1', '2606:4700:4700::1111'] as $ip) ok(Avatar::isPublicIp($ip), $ip);
    foreach (['100.64.0.0', '127.0.0.1', '255.255.255.255', '192.0.2.5', 'garbage', ''] as $ip) ok(!Avatar::isPublicIp($ip), $ip);
});
test('reencode makes a square 96x96 image from any aspect ratio', function () use ($png) {
    foreach ([[200, 120], [120, 200], [500, 500], [40, 40]] as [$w, $h]) {
        $out = Avatar::reencode($png($w, $h)); ok($out !== null, "$w x $h"); $i = getimagesizefromstring($out); eq([$i[0], $i[1]], [96, 96]);
    }
});
test('reencode rejects non-images, SVG, truncated data, oversize bytes and giant dimensions', function () use ($png) {
    eq(Avatar::reencode(''), null); eq(Avatar::reencode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), null);
    eq(Avatar::reencode('<?php echo 1;'), null); eq(Avatar::reencode(substr($png(), 0, 40)), null);
    eq(Avatar::reencode(str_repeat('a', Avatar::MAX_BYTES + 1)), null);
    $big = imagecreatetruecolor(4100, 4); ob_start(); imagepng($big, null, 9); $b = (string)ob_get_clean(); eq(Avatar::reencode($b), null, 'dimension cap');
});
test('reencode output is a clean image (no original bytes/metadata carried over)', function () {
    $im = imagecreatetruecolor(10, 10); ob_start(); imagejpeg($im); $j = (string)ob_get_clean();
    $j = substr($j, 0, 2) . "\xFF\xFE\x00\x0aSECRETEXIF" . substr($j, 2);           // inject a COM segment
    $out = Avatar::reencode($j); ok($out !== null && strpos($out, 'SECRETEXIF') === false);
});
test('get(): fetches once, caches on disk (0600), serves from cache with no second fetch', function () use ($mkuser, &$fetches) {
    $uid = $mkuser(); $fetches = 0;
    $a = Avatar::get($uid, 'https://lh3.example.com/p.png'); ok($a !== null); eq($fetches, 1);
    $b = Avatar::get($uid, 'https://lh3.example.com/p.png'); eq($b, $a); eq($fetches, 1, 'refetched');
    ok(is_file(Avatar::path($uid))); eq(fileperms(Avatar::path($uid)) & 0777, 0600);
});
test('get(): failures are negatively cached so a dead URL is not hammered', function () use ($mkuser, &$fetches) {
    $uid = $mkuser(); $fetches = 0; $old = Avatar::$http;
    Avatar::$http = function () use (&$fetches) { $fetches++; return ['status' => 404, 'body' => '']; };
    eq(Avatar::get($uid, 'https://lh3.example.com/gone.png'), null); eq(Avatar::get($uid, 'https://lh3.example.com/gone.png'), null);
    eq($fetches, 1); Avatar::$http = $old;
});
test('get(): HTML or oversize body from the provider is rejected, nothing cached', function () use ($mkuser) {
    $uid = $mkuser(); $old = Avatar::$http;
    Avatar::$http = fn() => ['status' => 200, 'body' => '<html>nope</html>']; eq(Avatar::get($uid, 'https://lh3.example.com/x'), null);
    ok(!is_file(Avatar::path($uid))); Avatar::$http = $old;
});
test('get(): an SSRF target never reaches the HTTP client', function () use ($mkuser, &$fetches) {
    $uid = $mkuser('https://169.254.169.254/x'); $fetches = 0;
    eq(Avatar::get($uid, 'https://169.254.169.254/x'), null); eq($fetches, 0);
});
test('get(): a stale cached picture is still served when the refresh fails', function () use ($mkuser, $png) {
    $uid = $mkuser(); Avatar::get($uid, 'https://lh3.example.com/p.png'); touch(Avatar::path($uid), time() - 30 * 86400);
    $old = Avatar::$http; Avatar::$http = fn() => ['status' => 500, 'body' => '']; ok(Avatar::get($uid, 'https://lh3.example.com/p.png') !== null); Avatar::$http = $old;
});
test('invalidate() removes cached picture and negative marker', function () use ($mkuser) {
    $uid = $mkuser(); Avatar::get($uid, 'https://lh3.example.com/p.png'); Avatar::invalidate($uid); ok(!is_file(Avatar::path($uid)));
});

/* ---- HTTP layer: real php -S sharing the same data dir and secret key ---- */
[$base] = dev_server(['APP_ENV' => 'dev', 'DYON_COOKIE_SECURE' => '0', 'DYON_SECRET_KEY' => $key, 'DYON_DATA_DIR' => $dir]);
$login = function (int $uid): string { $_COOKIE = []; return Session::start($uid, 'UA'); };
test('/api/avatar.php requires a session (401) and is never cacheable publicly', function () use ($base) {
    [$s, $h] = http($base, '/api/avatar.php'); eq($s, 401); ok(!str_contains($h['cache-control'] ?? '', 'public'));
});
test('/api/avatar.php serves the cached image: private, 1 day, correct type, nosniff', function () use ($base, $mkuser, $login) {
    $uid = $mkuser(); Avatar::get($uid, 'https://lh3.example.com/p.png'); $tok = $login($uid);
    [$s, $h, $b] = http($base, '/api/avatar.php', 'GET', ['Cookie' => "dyon_sess=$tok"]);
    eq($s, 200); eq($h['cache-control'], 'private, max-age=86400'); eq($h['content-type'], Avatar::mime()); eq($h['x-content-type-options'], 'nosniff');
    $i = getimagesizefromstring($b); eq([$i[0], $i[1]], [96, 96]);
});
test('/api/avatar.php is 404 (not 500) when the provider picture cannot be had', function () use ($base, $mkuser, $login) {
    $uid = $mkuser('https://127.0.0.1/p.png'); $tok = $login($uid);
    [$s, , $b] = http($base, '/api/avatar.php', 'GET', ['Cookie' => "dyon_sess=$tok"]); eq($s, 404); eq(json_decode($b, true)['error']['code'], 'no_avatar');
});
test('/api/auth/me.php for a signed-in user returns name, avatar path and a csrf token that matches the cookie', function () use ($base, $mkuser, $login) {
    $uid = $mkuser(); Db::system()->exec("UPDATE users SET name='Sam', email='s@x.org' WHERE id=?", [$uid]); $tok = $login($uid);
    [$s, $h, $b] = http($base, '/api/auth/me.php', 'GET', ['Cookie' => "dyon_sess=$tok"]); $j = json_decode($b, true);
    eq($j['signed_in'], true); eq($j['name'], 'Sam'); eq($j['avatar'], '/api/avatar.php'); ok(strlen($j['csrf']) >= 32);
    ok(!isset($j['sub_hash']) && !str_contains($b, 'sub_hash'), 'leaks identity hash');
    [, , $b2] = http($base, '/api/auth/me.php', 'GET', ['Cookie' => "dyon_sess=$tok; dyon_csrf={$j['csrf']}"]); eq(json_decode($b2, true)['csrf'], $j['csrf']);
});
test('logout via POST with the csrf from me.php really ends the session', function () use ($base, $mkuser, $login) {
    $uid = $mkuser(); $tok = $login($uid);
    [, , $b] = http($base, '/api/auth/me.php', 'GET', ['Cookie' => "dyon_sess=$tok"]); $c = json_decode($b, true)['csrf'];
    [$s] = http($base, '/api/auth/logout.php', 'POST', ['Cookie' => "dyon_sess=$tok; dyon_csrf=$c", 'X-CSRF-Token' => $c]); eq($s, 200);
    eq(json_decode(http($base, '/api/auth/me.php', 'GET', ['Cookie' => "dyon_sess=$tok"])[2], true)['signed_in'], false);
});
