<?php
/* §4.1 — the dev router must never expose private files or fall back to the app shell for them. */
[$base] = dev_server(['APP_ENV' => 'dev']);
$forbidden = ['/router.php', '/public/router.php', '/app/bootstrap.php', '/../app/bootstrap.php', '/%2e%2e/app/bootstrap.php',
  '/..%2fapp/bootstrap.php', '/config/config.example.php', '/data/countries.json', '/migrations/001_init.sql', '/templates/x',
  '/cron/x', '/tests/php/run.php', '/vendor-php/autoload.php', '/.git/config', '/.htaccess', '/data/system.sqlite',
  '/x.sqlite', '/x.log', '/app/', '/APP/bootstrap.php', '/nonexistent.php', '/api/nope.php', '/dev/nope.html'];
foreach ($forbidden as $p) {
    test("deny $p", function () use ($base, $p) {
        [$s, , $b] = http($base, $p);
        ok(in_array($s, [403, 404], true), "status $s");
        ok(stripos($b, '<html') === false, 'served the app shell');
    });
}
test('app shell and assets are served', function () use ($base) {
    eq(http($base, '/')[0], 200); eq(http($base, '/sw.js')[0], 200); eq(http($base, '/js/app.js')[0], 200);
    eq(http($base, '/locales/ar.json')[0], 200); eq(http($base, '/assets/countries.json')[0], 200);
});
test('SPA deep link falls back to the shell', fn() => eq(http($base, '/some/deep/link')[0], 200));
test('/dev harness is served in dev', fn() => eq(http($base, '/dev/tests.html')[0], 200));
[$prod] = dev_server(['APP_ENV' => 'prod']);
test('/dev harness is 404 in production', fn() => eq(http($prod, '/dev/tests.html')[0], 404));
