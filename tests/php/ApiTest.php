<?php
/* §4.4 headers + §4.5 geo/ping over real HTTP against php -S with the router. */
[$base] = dev_server(['APP_ENV' => 'dev', 'DYON_COOKIE_SECURE' => '0', 'DYON_SECRET_KEY' => base64_encode(str_repeat('k', 32)), 'DYON_DATA_DIR' => tmpdir()]);

test('geo.php returns only {country} from CF-IPCountry, cacheable privately for 1h', function () use ($base) {
    [$s, $h, $b] = http($base, '/api/geo.php', 'GET', ['CF-IPCountry' => 'TN']);
    eq($s, 200); eq(json_decode($b, true), ['country' => 'TN']);
    eq($h['cache-control'], 'private, max-age=3600');
});
test('geo.php returns {country:null} when unknown, never echoes an IP', function () use ($base) {
    [, , $b] = http($base, '/api/geo.php'); eq(json_decode($b, true), ['country' => null]);
    ok(!preg_match('/\d+\.\d+\.\d+\.\d+/', $b));
    [, , $b2] = http($base, '/api/geo.php', 'GET', ['CF-IPCountry' => 'XX']); eq(json_decode($b2, true), ['country' => null]);
});
test('geo.php refuses non-GET', fn() => eq(http($base, '/api/geo.php', 'POST')[0], 405));
test('ping.php answers GET and HEAD (no body on HEAD)', function () use ($base) {
    [$s, , $b] = http($base, '/api/ping.php'); eq($s, 200); $j = json_decode($b, true); ok($j['ok'] === true && abs($j['t'] - time()) < 5);
    [$s2, , $b2] = http($base, '/api/ping.php', 'HEAD'); eq($s2, 200); eq($b2, '');
    eq(http($base, '/api/ping.php', 'POST')[0], 405);
});
test('API responses carry the full security header set and no-store', function () use ($base) {
    [, $h] = http($base, '/api/ping.php');
    ok(str_contains($h['content-security-policy'], "default-src 'self'")); ok(str_contains($h['content-security-policy'], "frame-ancestors 'none'"));
    ok(str_contains($h['content-security-policy'], "object-src 'none'")); ok(str_contains($h['content-security-policy'], "form-action 'self'"));
    eq($h['x-content-type-options'], 'nosniff'); eq($h['referrer-policy'], 'strict-origin-when-cross-origin');
    eq($h['permissions-policy'], 'camera=(self), geolocation=(), microphone=()'); ok(str_contains($h['cache-control'], 'no-store'));
    ok(!isset($h['strict-transport-security']), 'HSTS only on HTTPS in prod');
});
test('private includes (_boot.php) and stray php are not web-callable', function () use ($base) {
    eq(http($base, '/api/_boot.php')[0], 404); eq(http($base, '/_x.php')[0], 404);
});
test('errors use the {error:{code,message}} shape', function () use ($base) {
    [$s, , $b] = http($base, '/api/geo.php', 'DELETE'); eq($s, 405); $j = json_decode($b, true); eq($j['error']['code'], 'method_not_allowed');
});
test('deploy configs carry the same CSP/headers as PHP', function () {
    $csp = "default-src 'self'; img-src 'self' data: blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";
    ok(str_contains(file_get_contents(DYON_ROOT . '/deploy/nginx.conf.example'), $csp), 'nginx CSP');
    ok(str_contains(file_get_contents(DYON_ROOT . '/app/Http.php'), $csp), 'php CSP');
    $ht = file_get_contents(DYON_ROOT . '/public/.htaccess'); ok(str_contains($ht, 'X-Content-Type-Options') && str_contains($ht, 'Permissions-Policy'));
});
