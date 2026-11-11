<?php
/* §9 e-mailed 8-digit sign-in code. */
use Dyon\{Config, Db, Auth, LoginCode, Mailer};

$lcdir = tmpdir(); Config::set(['data_dir' => $lcdir, 'cookie_secure' => false, 'secret_key' => base64_encode(str_repeat('l', 32)), 'mail_transport' => 'file', 'login_code' => true]);
Db::reset();
[$lu] = Auth::upsertUser('google', 'lc-1', 'lc1@example.org', 'Maher T', null);

test('login code: required for an unknown device, not when disabled or without an e-mail', function () use ($lu) {
    ok(LoginCode::required($lu, ''));
    Config::set(['login_code' => false]); ok(!LoginCode::required($lu, '')); Config::set(['login_code' => true]);
    [$nomail] = Auth::upsertUser('google', 'lc-2', null, 'No Mail', null); ok(!LoginCode::required($nomail, ''));
});
test('login code: 8 digits, stored only as HMAC, right code works once', function () use ($lu) {
    $c = LoginCode::issue($lu); ok(preg_match('/^\d{8}$/', $c) === 1);
    $row = Db::system()->one('SELECT * FROM login_codes WHERE user_id = ? ORDER BY id DESC', [$lu]); ok($row['code_hmac'] !== $c && !str_contains(json_encode($row), $c));
    eq(LoginCode::check($lu, substr($c, 0, 4) . ' ' . substr($c, 4)), 'ok');
    eq(LoginCode::check($lu, $c), 'expired');      // single use
});
test('login code: wrong tries lock the code; a new code replaces the old one; expiry is 10 minutes', function () use ($lu) {
    $c = LoginCode::issue($lu); $bad = $c === '00000000' ? '11111111' : '00000000';
    for ($i = 0; $i < 4; $i++) eq(LoginCode::check($lu, $bad), 'bad');
    eq(LoginCode::check($lu, $bad), 'locked'); eq(LoginCode::check($lu, $c), 'locked');
    $c2 = LoginCode::issue($lu); eq(LoginCode::check($lu, $c2, time() + 601), 'expired');
    $c3 = LoginCode::issue($lu); eq(LoginCode::check($lu, $c3), 'ok');
});
test('login code: trusted device skips the code until login_code_days pass', function () use ($lu) {
    $tok = LoginCode::trust($lu); ok(!LoginCode::required($lu, $tok));
    ok(!LoginCode::trusted($lu, $tok, time() + 31 * 86400)); ok(!LoginCode::trusted($lu + 99, $tok));
});
test('login code: the e-mail carries the code, a static subject (no code in it), in all 3 locales', function () use ($lu) {
    foreach (['en', 'ar', 'fr'] as $l) {
        $r = Mailer::render('login_code', $l, ['code' => '12345678', 'minutes' => 10]);
        ok(str_contains($r['text'], '12345678') && !str_contains($r['subject'], '12345678'), $l);
    }
});
