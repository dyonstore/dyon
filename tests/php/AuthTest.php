<?php
use Dyon\{Config, Db, Crypto, Auth, AuthException, Session};

Config::set(['data_dir' => tmpdir(), 'cookie_secure' => false, 'base_url' => 'https://dyon.test', 'secret_key' => base64_encode(random_bytes(32)),
  'oauth' => ['google' => ['client_id' => 'cid-123', 'client_secret' => 'sec'], 'microsoft' => ['client_id' => '', 'client_secret' => '', 'tenant' => 'common'],
              'apple' => ['client_id' => '', 'team_id' => '', 'key_id' => '', 'private_key' => '']]]);
Db::reset();

/* An RSA key pair standing in for Google's signing key. */
$rsa = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
$det = openssl_pkey_get_details($rsa);
$jwk = ['kty' => 'RSA', 'kid' => 'k1', 'alg' => 'RS256', 'use' => 'sig', 'n' => Crypto::b64u($det['rsa']['n']), 'e' => Crypto::b64u($det['rsa']['e'])];
$jwtFor = function (array $claims, array $hdr = [], $key = null) use ($rsa) {
    $h = Crypto::b64u(json_encode($hdr + ['alg' => 'RS256', 'kid' => 'k1', 'typ' => 'JWT'])); $b = Crypto::b64u(json_encode($claims));
    openssl_sign("$h.$b", $sig, $key ?? $rsa, OPENSSL_ALGO_SHA256);
    return "$h.$b." . Crypto::b64u($sig);
};
$good = fn(array $o = []) => $o + ['iss' => 'https://accounts.google.com', 'aud' => 'cid-123', 'exp' => time() + 300, 'sub' => '1098', 'nonce' => 'N0NCE',
    'email' => 'Sam@Example.com', 'email_verified' => true, 'name' => 'Sam', 'picture' => 'https://lh3.example/p.jpg'];
$calls = ['jwks' => 0, 'token' => 0];
Auth::$http = function (string $m, string $url, array $o) use (&$calls, $jwk) {
    if (str_contains($url, 'certs')) { $calls['jwks']++; return ['status' => 200, 'body' => json_encode(['keys' => [$jwk]])]; }
    $calls['token']++; return ['status' => 200, 'body' => json_encode(['id_token' => $GLOBALS['__idtoken'] ?? ''])];
};
$expectErr = function (callable $fn, string $code) { try { $fn(); } catch (AuthException $e) { eq($e->errorCode, $code); return; } throw new Exception("expected $code"); };

test('JWK -> PEM produces a key openssl accepts (and matches the original)', function () use ($jwk, $det) {
    $pem = Auth::jwkToPem($jwk); $k = openssl_pkey_get_public($pem); ok($k !== false);
    eq(trim(openssl_pkey_get_details($k)['key']), trim(Auth::jwkToPem($jwk)));
    eq(openssl_pkey_get_details($k)['rsa']['n'], $det['rsa']['n']);
});
test('valid ID token verifies (signature, iss, aud, exp, nonce)', function () use ($jwtFor, $good) {
    $c = Auth::verifyIdToken('google', $jwtFor($good()), 'N0NCE'); eq($c['sub'], '1098');
});
test('JWKS is cached: a second verification does not refetch', function () use ($jwtFor, $good, &$calls) {
    $before = $calls['jwks']; Auth::verifyIdToken('google', $jwtFor($good()), 'N0NCE'); eq($calls['jwks'], $before);
    ok($calls['jwks'] === 1, 'fetched once overall');
});
test('rejects bad signature (token signed by another key)', function () use ($jwtFor, $good, $expectErr) {
    $other = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
    $expectErr(fn() => Auth::verifyIdToken('google', $jwtFor($good(), [], $other), 'N0NCE'), 'bad_signature');
});
test('rejects tampered payload', function () use ($jwtFor, $good, $expectErr) {
    [$h, $b, $s] = explode('.', $jwtFor($good())); $evil = Crypto::b64u(json_encode($good(['sub' => 'attacker'])));
    $expectErr(fn() => Auth::verifyIdToken('google', "$h.$evil.$s", 'N0NCE'), 'bad_signature');
});
test('rejects alg none, HS256 and unknown kid', function () use ($jwtFor, $good, $expectErr) {
    $h = Crypto::b64u(json_encode(['alg' => 'none', 'kid' => 'k1'])); $b = Crypto::b64u(json_encode($good()));
    $expectErr(fn() => Auth::verifyIdToken('google', "$h.$b.", 'N0NCE'), 'bad_alg');
    $expectErr(fn() => Auth::verifyIdToken('google', $jwtFor($good(), ['alg' => 'HS256']), 'N0NCE'), 'bad_alg');
    $expectErr(fn() => Auth::verifyIdToken('google', $jwtFor($good(), ['kid' => 'zzz']), 'N0NCE'), 'unknown_key');
});
test('rejects wrong iss, aud, expired, wrong nonce, missing sub', function () use ($jwtFor, $good, $expectErr) {
    $expectErr(fn() => Auth::verifyIdToken('google', $jwtFor($good(['iss' => 'https://evil.example'])), 'N0NCE'), 'bad_iss');
    $expectErr(fn() => Auth::verifyIdToken('google', $jwtFor($good(['aud' => 'someone-else'])), 'N0NCE'), 'bad_aud');
    $expectErr(fn() => Auth::verifyIdToken('google', $jwtFor($good(['exp' => time() - 3600])), 'N0NCE'), 'expired');
    $expectErr(fn() => Auth::verifyIdToken('google', $jwtFor($good()), 'OTHER'), 'bad_nonce');
    $expectErr(fn() => Auth::verifyIdToken('google', $jwtFor(array_diff_key($good(), ['nonce' => 1])), 'N0NCE'), 'bad_nonce');
    $expectErr(fn() => Auth::verifyIdToken('google', $jwtFor(array_diff_key($good(), ['sub' => 1])), 'N0NCE'), 'no_sub');
    $expectErr(fn() => Auth::verifyIdToken('google', 'a.b', 'N0NCE'), 'bad_token');
});
test('aud may be an array containing our client id', function () use ($jwtFor, $good) {
    eq(Auth::verifyIdToken('google', $jwtFor($good(['aud' => ['x', 'cid-123']])), 'N0NCE')['sub'], '1098');
});
test('begin(): PKCE S256 challenge, state+nonce, signed cookie, safe return', function () {
    [$url, $cookie] = Auth::begin('google', '/#/settings');
    parse_str(parse_url($url, PHP_URL_QUERY), $q);
    eq($q['response_type'], 'code'); eq($q['code_challenge_method'], 'S256'); eq($q['client_id'], 'cid-123');
    eq($q['redirect_uri'], 'https://dyon.test/api/auth/callback.php');
    $st = Crypto::verify($cookie, 'oauth'); eq($st['s'], $q['state']); eq($st['n'], $q['nonce']);
    eq(Auth::pkceChallenge($st['v']), $q['code_challenge']);
    ok(strpos($url, $st['v']) === false, 'verifier leaked into the URL');
});
test('begin(): unconfigured provider refused', function () use ($expectErr) {
    $expectErr(fn() => Auth::begin('apple'), 'provider_not_configured'); $expectErr(fn() => Auth::begin('nope'), 'provider_not_configured');
});
test('safeReturn blocks open redirects', function () {
    foreach (['//evil.com', 'https://evil.com', '/\\evil.com', "/a\r\nSet-Cookie: x", 'javascript:alert(1)', '', 'evil'] as $bad) eq(Auth::safeReturn($bad), '/', $bad);
    eq(Auth::safeReturn('/#/settings'), '/#/settings'); eq(Auth::safeReturn('/ar/blog'), '/ar/blog');
});
test('complete(): full happy path creates a user storing ONLY sha256(provider:sub)', function () use ($jwtFor, $good) {
    [$url, $cookie] = Auth::begin('google', '/#/settings'); parse_str(parse_url($url, PHP_URL_QUERY), $q);
    $GLOBALS['__idtoken'] = $jwtFor($good(['nonce' => $q['nonce']]));
    [$uid, $new, $ret] = Auth::complete(['state' => $q['state'], 'code' => 'abc'], $cookie);
    ok($new); eq($ret, '/#/settings');
    $u = Db::system()->one('SELECT * FROM users WHERE id = ?', [$uid]);
    eq($u['sub_hash'], hash('sha256', 'google:1098')); eq($u['email'], 'sam@example.com'); eq($u['name'], 'Sam');
    ok(strpos(json_encode($u), '"1098"') === false, 'raw sub stored');
    [$uid2, $new2] = Auth::complete(['state' => $q['state'], 'code' => 'abc'], $cookie);
    eq($uid2, $uid); ok(!$new2);
});
test('complete(): state mismatch, missing code, provider error and expired state are refused', function () use ($expectErr) {
    [, $cookie] = Auth::begin('google');
    $expectErr(fn() => Auth::complete(['state' => 'wrong', 'code' => 'x'], $cookie), 'state_mismatch');
    $st = Crypto::verify($cookie, 'oauth');
    $expectErr(fn() => Auth::complete(['state' => $st['s']], $cookie), 'no_code');
    $expectErr(fn() => Auth::complete(['state' => $st['s'], 'error' => 'access_denied'], $cookie), 'provider_denied');
    $expectErr(fn() => Auth::complete(['state' => $st['s'], 'code' => 'x'], 'garbage'), 'state_expired');
    $expectErr(fn() => Auth::complete(['state' => $st['s'], 'code' => 'x'], Crypto::sign(['p' => 'google', 's' => 'a'], -1, 'oauth')), 'state_expired');
});
test('unverified email is never stored', function () use ($jwtFor, $good) {
    [$url, $cookie] = Auth::begin('google'); parse_str(parse_url($url, PHP_URL_QUERY), $q);
    $GLOBALS['__idtoken'] = $jwtFor($good(['sub' => 'u2', 'nonce' => $q['nonce'], 'email_verified' => false]));
    [$uid] = Auth::complete(['state' => $q['state'], 'code' => 'c'], $cookie);
    eq(Db::system()->val('SELECT email FROM users WHERE id = ?', [$uid]), null);
});
test('a failed token exchange is an error, not a login', function () use ($expectErr) {
    $old = Auth::$http; Auth::$http = fn() => ['status' => 400, 'body' => '{"error":"invalid_grant"}'];
    [$url, $cookie] = Auth::begin('google'); parse_str(parse_url($url, PHP_URL_QUERY), $q);
    $expectErr(fn() => Auth::complete(['state' => $q['state'], 'code' => 'c'], $cookie), 'token_exchange_failed'); Auth::$http = $old;
});
test('ES256 DER -> raw R||S conversion is 64 bytes', function () {
    $k = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
    for ($i = 0; $i < 20; $i++) { openssl_sign("m$i", $der, $k, OPENSSL_ALGO_SHA256); eq(strlen(Auth::ecdsaDerToRaw($der, 32)), 64); }
});
test('Apple client secret is a valid ES256 JWT', function () {
    $k = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]); openssl_pkey_export($k, $pem);
    Config::set(['oauth' => ['apple' => ['client_id' => 'svc.id', 'team_id' => 'TEAM', 'key_id' => 'KID', 'private_key' => $pem]]]);
    $jwt = Auth::appleClientSecret(1_700_000_000); [$h, $b, $s] = explode('.', $jwt);
    eq(json_decode(Crypto::unb64u($h), true)['kid'], 'KID'); eq(json_decode(Crypto::unb64u($b), true)['sub'], 'svc.id');
    // verify with the public key: raw R||S -> DER
    $raw = Crypto::unb64u($s); eq(strlen($raw), 64);
    $der = function (string $x) { $x = ltrim($x, "\0"); if (ord($x[0]) > 127) $x = "\0" . $x; return "\x02" . chr(strlen($x)) . $x; };
    $r = $der(substr($raw, 0, 32)) . $der(substr($raw, 32)); $sig = "\x30" . chr(strlen($r)) . $r;
    eq(openssl_verify("$h.$b", $sig, openssl_pkey_get_details($k)['key'], OPENSSL_ALGO_SHA256), 1);
    ok(Auth::configured('apple'));
});

/* ---- HTTP layer ---- */
[$base] = dev_server(['APP_ENV' => 'dev', 'DYON_COOKIE_SECURE' => '0', 'DYON_SECRET_KEY' => base64_encode(str_repeat('k', 32)), 'DYON_DATA_DIR' => tmpdir()]);
test('GET /api/auth/me.php signed out: JSON, no-store, issues a CSRF cookie', function () use ($base) {
    [$s, $h, $b] = http($base, '/api/auth/me.php'); eq($s, 200); eq(json_decode($b, true)['signed_in'], false);
    ok(str_contains($h['cache-control'] ?? '', 'no-store')); ok(isset($h['set-cookie']) && str_contains($h['set-cookie'], 'dyon_csrf'));
});
test('POST /api/auth/logout.php without CSRF is 403', function () use ($base) {
    [$s, , $b] = http($base, '/api/auth/logout.php', 'POST'); eq($s, 403); eq(json_decode($b, true)['error']['code'], 'csrf');
});
test('POST logout with matching double-submit token succeeds; cross-site Origin refused', function () use ($base) {
    $t = str_repeat('t', 32);
    [$s] = http($base, '/api/auth/logout.php', 'POST', ['Cookie' => "dyon_csrf=$t", 'X-CSRF-Token' => $t]); eq($s, 200);
    [$s2] = http($base, '/api/auth/logout.php', 'POST', ['Cookie' => "dyon_csrf=$t", 'X-CSRF-Token' => $t, 'Origin' => 'https://evil.test']); eq($s2, 403);
});
test('GET on logout is 405', function () use ($base) { eq(http($base, '/api/auth/logout.php')[0], 405); });
test('/api/auth/start.php with an unconfigured provider redirects to the app with an error code', function () use ($base) {
    [$s, $h] = http($base, '/api/auth/start.php?provider=google'); eq($s, 302); ok(str_contains($h['location'], 'auth_error=provider_not_configured'));
});
test('/api/auth/callback.php without a state cookie never creates a session', function () use ($base) {
    [$s, $h] = http($base, '/api/auth/callback.php?code=x&state=y'); eq($s, 302); ok(str_contains($h['location'], 'auth_error=state_expired'));
});
