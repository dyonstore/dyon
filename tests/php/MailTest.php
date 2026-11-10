<?php
/* §7 — email: 13 templates × 3 locales, headers, double opt-in, GET never changes state, one-click, queue/backoff/log, consent at send time. */
use Dyon\{Config, Db, Mailer, Subscribers, I18n, MailSkip};

$mdir = tmpdir(); $mkey = base64_encode(str_repeat('m', 32));
Config::set(['data_dir' => $mdir, 'cookie_secure' => false, 'secret_key' => $mkey, 'mail_transport' => 'file', 'base_url' => 'https://dyon.store']);
Db::reset();
[$mb] = dev_server(['APP_ENV' => 'dev', 'DYON_COOKIE_SECURE' => '0', 'DYON_SECRET_KEY' => $mkey, 'DYON_DATA_DIR' => $mdir, 'DYON_MAIL_TRANSPORT' => 'file', 'DYON_BASE_URL' => 'https://dyon.store']);
$mdb = fn() => Db::system();
function mm_sub(string $email, array $streams = ['blog'], string $loc = 'en'): array {
    Subscribers::subscribe($email, $loc, $streams);
    $row = Db::system()->one('SELECT * FROM subscribers WHERE email = ?', [$email]);
    Subscribers::confirm(Subscribers::token('confirm', $row));
    return Subscribers::find((int)$row['id']);
}
function mm_flush(): array { return Mailer::run(500); }
function mm_eml(): array { $f = glob(Config::get('data_dir') . '/mail-out/*.eml') ?: []; sort($f); return array_map('file_get_contents', $f); }
function mm_clear(): void { foreach (glob(Config::get('data_dir') . '/mail-out/*.eml') ?: [] as $f) unlink($f); Db::system()->pdo->exec('DELETE FROM email_queue'); }
function mm_unfold(string $eml): string { return preg_replace("/\r?\n[ \t]+/", ' ', $eml); }

$SUB = ['id' => 1, 'email' => 'a@b.org', 'confirm_hmac' => 'x', 'unsub_hmac' => 'y', 'status' => 'active', 'streams' => '["blog"]', 'locale' => 'en'];
$VARS = ['name' => 'Zainab', 'device' => 'Pixel 8', 'provider' => 'Google', 'when' => '2026-01-01 10:00 UTC', 'title' => 'Hello', 'summary' => 'A short summary', 'where' => 'Online',
    'reply' => 'Thanks', 'place' => 'Online', 'days' => 3, 'url' => 'https://dyon.store/blog/x'];

foreach (['en', 'ar', 'fr'] as $l) {
    test("mail $l: all 14 templates render with subject, text, html, no missing keys / leftover placeholders", function () use ($l, $SUB, $VARS) {
        eq(count(Mailer::TEMPLATES), 14);
        foreach (array_keys(Mailer::TEMPLATES) as $tpl) {
            $r = Mailer::render($tpl, $l, $VARS, $SUB);
            ok(trim($r['subject']) !== '' && !str_contains($r['subject'], 'mail.'), "$tpl subject");
            foreach (['text', 'html'] as $k) {
                ok(!preg_match('/\{[a-z_]+\}/', $r[$k]), "$tpl $k leftover placeholder");
                ok(!preg_match('/\b(mail|sub|unsub)\.[a-z_.]+\b/', strip_tags($r[$k])), "$tpl $k missing key");
            }
            ok(!preg_match('/\d+[.,]?\d*\s?(€|\$|EUR|USD|SAR|AED|MAD|DZD|ر\.س|د\.إ)/u', $r['subject']), "$tpl amount in subject");
            ok(!preg_match('#<img|<script|<link|url\(|http://#i', $r['html']), "$tpl remote asset / tracker");
            $dir = I18n::dir($l);
            ok(str_contains($r['html'], "dir=\"$dir\"") && str_contains($r['html'], "lang=\"$l\""), "$tpl dir/lang");
        }
    });
}
test('mail: subjects are static — identical whatever the variables (so never an amount)', function () use ($SUB) {
    foreach (array_keys(Mailer::TEMPLATES) as $tpl) foreach (['en', 'ar', 'fr'] as $l)
        eq(Mailer::render($tpl, $l, ['name' => 'A', 'summary' => '1,200 EUR'], $SUB)['subject'], Mailer::render($tpl, $l, ['name' => 'B', 'summary' => 'zz'], $SUB)['subject']);
});
test('mail: no template addresses a debtor/creditor (R-D10) and none uses interest/late-fee/shaming wording', function () use ($SUB, $VARS) {
    foreach (array_keys(Mailer::TEMPLATES) as $tpl) foreach (['en', 'ar', 'fr'] as $l) {
        $r = Mailer::render($tpl, $l, $VARS, $SUB); $all = $r['subject'] . $r['text'];
        ok(!preg_match('/\b(interest|late fee|overdue|defaulter|shame|debt collector|intérêt|pénalité|en retard de paiement)\b/iu', $all), "$tpl/$l wording");
        ok(!preg_match('/\b(your debtor|your creditor|votre débiteur|votre créancier)\b/iu', $all), "$tpl/$l third party");
    }
    foreach (Mailer::TEMPLATES as $name => $t) ok(!in_array($t['stream'], ['debtor', 'creditor'], true));
});
test('mail: bulk templates carry a manage link; account templates never carry marketing footer', function () use ($SUB, $VARS) {
    foreach (Mailer::TEMPLATES as $name => $t) {
        $r = Mailer::render($name, 'en', $VARS, $SUB);
        if ($t['bulk']) ok(str_contains($r['text'], '/unsubscribe?t='), "$name manage link");
        if ($t['stream'] === 'contact' || in_array($name, ['signin_new_device', 'login_code', 'sync_enabled', 'sync_device_added', 'sync_wiped'], true)) ok(!str_contains($r['text'], '/unsubscribe?t='), "$name has no marketing link");
    }
});

test('subscribe: double opt-in — pending until confirm; confirm mail queued; same outward result for a known address', function () use ($mdb) {
    mm_clear();
    eq(Subscribers::submit(['email' => 'New@Example.org ', 'streams' => ['blog', 'events']], 'fr'), 'ok');
    $r = $mdb()->one("SELECT * FROM subscribers WHERE email='new@example.org'");
    eq($r['status'], 'pending'); eq($r['locale'], 'fr'); eq(json_decode($r['streams'], true), ['blog', 'events']);
    eq((int)$mdb()->val("SELECT COUNT(*) FROM email_queue WHERE template='subscribe_confirm'"), 1);
    Subscribers::submit(['email' => 'new@example.org', 'streams' => ['blog']], 'fr');   // within 10 min: no second confirm mail
    eq((int)$mdb()->val("SELECT COUNT(*) FROM email_queue WHERE template='subscribe_confirm'"), 1);
    $tok = Subscribers::token('confirm', $mdb()->one("SELECT * FROM subscribers WHERE email='new@example.org'"));
    eq(Subscribers::token('confirm', $r), $tok, 'link mailed first still valid after a re-submit');
    ok(Subscribers::confirm($tok) !== null); eq(Subscribers::find((int)$r['id'])['status'], 'active');
    eq((int)$mdb()->val("SELECT COUNT(*) FROM email_queue WHERE template='subscribe_welcome'"), 1);
    eq(Subscribers::submit(['email' => 'new@example.org', 'streams' => ['blog']], 'en'), 'ok');          // already active: silent
});
test('subscribe: invalid email / no stream / honeypot / tampered token', function () use ($mdb) {
    eq(Subscribers::submit(['email' => 'nope', 'streams' => ['blog']], 'en'), 'invalid');
    eq(Subscribers::submit(['email' => 'x@y.org', 'streams' => []], 'en'), 'invalid');
    eq(Subscribers::submit(['email' => 'x@y.org', 'streams' => ['hack']], 'en'), 'invalid');
    eq(Subscribers::submit(['email' => 'bot@y.org', 'streams' => ['blog'], 'website' => 'http://spam'], 'en'), 'ok');
    eq($mdb()->one("SELECT 1 FROM subscribers WHERE email='bot@y.org'"), null);
    $s = mm_sub('tok@y.org'); $t = Subscribers::token('unsub', $s);
    ok(Subscribers::verify('unsub', $t) !== null); eq(Subscribers::verify('confirm', $t), null, 'purpose bound');
    eq(Subscribers::verify('unsub', substr($t, 0, -2) . 'xx'), null); eq(Subscribers::verify('unsub', '1.' . str_repeat('a', 30)), null); eq(Subscribers::verify('unsub', "../../etc"), null);
});
test('subscribe: per-address throttle is silent (3 / day)', function () use ($mdb) {
    for ($i = 0; $i < 6; $i++) { Db::system()->pdo->exec("DELETE FROM email_queue"); Subscribers::submit(['email' => 'thr@y.org', 'streams' => ['blog']], 'en'); }
    ok((int)$mdb()->val("SELECT COUNT(*) FROM email_queue WHERE to_email='thr@y.org'") <= 1);
});

test('worker: sends via file transport with required headers; writes email_log; marks sent', function () use ($mdb) {
    mm_clear(); $s = mm_sub('w@y.org', ['blog']); mm_clear();
    $id = Mailer::queue('w@y.org', 'digest_blog', 'ar', ['title' => 'T', 'summary' => 'S', 'url' => 'https://dyon.store/ar/blog/x']);
    $r = mm_flush(); eq($r['sent'], 1);
    $row = $mdb()->one('SELECT * FROM email_queue WHERE id=?', [$id]); eq($row['status'], 'sent'); ok($row['sent_at'] > 0);
    eq($mdb()->val("SELECT status FROM email_log WHERE queue_id=?", [$id]), 'sent');
    $e = mm_unfold(mm_eml()[0]);
    ok(preg_match('/^List-Unsubscribe: <https:\/\/dyon\.store\/unsubscribe\?t=\d+\.[\w-]+>, <mailto:unsubscribe@dyon\.store\?subject=unsubscribe%20\d+\.[\w-]+>/m', $e) === 1, 'List-Unsubscribe: ' . (preg_match('/^List-Unsubscribe:.*$/m', $e, $mm) ? $mm[0] : 'absent'));
    ok(str_contains($e, 'List-Unsubscribe-Post: List-Unsubscribe=One-Click'), 'one-click header');
    ok(str_contains($e, 'Content-Language: ar') && str_contains($e, 'Auto-Submitted: auto-generated') && str_contains($e, 'Precedence: bulk'));
    ok(preg_match('/^Message-ID: <[0-9a-f]+@dyon\.store>/mi', $e) === 1, 'message-id on from-domain');
    ok(preg_match('/^From: DYON <dyon@dyon\.store>/m', $e) === 1, 'from'); ok(!preg_match('/^X-Mailer:\s*\S/mi', $e));
    ok(str_contains($e, 'multipart/alternative'), 'text + html');
});
test('worker: transactional mail has no List-Unsubscribe', function () {
    mm_clear(); Mailer::queue('t@y.org', 'sync_enabled', 'en', ['name' => 'Z']); mm_flush();
    $e = mm_unfold(mm_eml()[0]); ok(!str_contains($e, 'List-Unsubscribe')); ok(str_contains($e, 'Auto-Submitted'));
});
test('worker: consent re-checked at send time — unsubscribing cancels queued digest (MailSkip → cancelled, nothing sent)', function () use ($mdb) {
    mm_clear(); $s = mm_sub('c@y.org', ['blog']); mm_clear();
    $a = Mailer::queue('c@y.org', 'digest_blog', 'en', ['title' => 'T']);
    Subscribers::unsubscribeAll((int)$s['id']);
    eq($mdb()->val('SELECT status FROM email_queue WHERE id=?', [$a]), 'cancelled');
    $b = Mailer::queue('c@y.org', 'digest_blog', 'en', ['title' => 'T']);                // queued after opt-out
    $r = mm_flush(); eq($r['skipped'], 1); eq($r['sent'], 0); eq(count(mm_eml()), 0);
    eq($mdb()->val('SELECT status FROM email_queue WHERE id=?', [$b]), 'cancelled');
    $s2 = mm_sub('d@y.org', ['product']); mm_clear();                                      // other stream only
    Mailer::queue('d@y.org', 'digest_blog', 'en', ['title' => 'T']); eq(mm_flush()['skipped'], 1);
});
test('worker: failure → exponential backoff 1,2,4,8 min, 5 attempts then failed; log rows; crashed "sending" is requeued', function () use ($mdb) {
    mm_clear(); $id = Mailer::queue('f@y.org', 'sync_enabled', 'en', []); $t0 = 1_800_000_000;
    $boom = function () { throw new RuntimeException('smtp down'); };
    eq([Mailer::backoff(1), Mailer::backoff(2), Mailer::backoff(3), Mailer::backoff(4), Mailer::backoff(30)], [60, 120, 240, 480, 86400]);
    $now = $t0; $db = $mdb(); $db->exec('UPDATE email_queue SET next_try_at=?', [$t0]);
    for ($n = 1; $n <= 5; $n++) {
        $r = Mailer::run(50, $now, $boom);
        eq($r[$n < 5 ? 'retry' : 'failed'], 1, "attempt $n");
        $row = $db->one('SELECT * FROM email_queue WHERE id=?', [$id]); eq((int)$row['attempts'], $n);
        if ($n < 5) { eq($row['status'], 'queued'); eq((int)$row['next_try_at'], $now + Mailer::backoff($n)); eq(Mailer::run(50, $now, $boom)['retry'], 0, 'not due yet'); $now = (int)$row['next_try_at']; }
    }
    eq($db->val('SELECT status FROM email_queue WHERE id=?', [$id]), 'failed'); eq($db->val('SELECT last_error FROM email_queue WHERE id=?', [$id]), 'smtp down');
    eq(Mailer::run(50, $now + 99999, $boom), ['sent' => 0, 'retry' => 0, 'failed' => 0, 'skipped' => 0]);
    eq((int)$db->val("SELECT COUNT(*) FROM email_log WHERE queue_id=?", [$id]), 5);
    $c = Mailer::queue('f@y.org', 'sync_enabled', 'en', []); $db->exec("UPDATE email_queue SET status='sending', next_try_at=? WHERE id=?", [$t0, $c]);
    eq(Mailer::run(50, $t0 + 601, fn() => '<ok>')['sent'], 1);
});
test('worker: batch limit respected', function () {
    mm_clear(); for ($i = 0; $i < 7; $i++) Mailer::queue("b$i@y.org", 'sync_wiped', 'en', []);
    eq(Mailer::run(3, null, fn() => '<x>')['sent'], 3); eq(Mailer::run(50, null, fn() => '<x>')['sent'], 4);
});
test('smtp transport refuses to send without TLS or host (never plaintext)', function () {
    mm_clear(); Config::set(['mail_transport' => 'smtp', 'smtp' => ['host' => 'mail.example.org', 'secure' => '', 'from' => 'dyon@dyon.store']]);
    try { $id = Mailer::queue('s@y.org', 'sync_wiped', 'en', []); $r = Mailer::run(5); eq($r['retry'], 1);
          ok(str_contains((string)Db::system()->val('SELECT last_error FROM email_queue WHERE id=?', [$id]), 'TLS')); }
    finally { Config::set(['mail_transport' => 'file']); }
});
test('toUser: only the account holder own address; silent without email; name is first name only', function () use ($mdb) {
    mm_clear();
    [$u1] = Dyon\Auth::upsertUser('google', 'mu1', 'mu1@x.org', 'Zainab Al Secret', null);
    [$u2] = Dyon\Auth::upsertUser('google', 'mu2', null, 'No Mail', null);
    ok(Mailer::toUser($u1, 'sync_enabled') > 0); eq(Mailer::toUser($u2, 'sync_enabled'), null);
    $row = $mdb()->one("SELECT * FROM email_queue"); eq($row['to_email'], 'mu1@x.org'); eq(json_decode($row['vars'], true)['name'], 'Zainab');
});

/* ---------- real HTTP pages ---------- */
function mm_get_tok(string $purpose, string $email): string { return Subscribers::token($purpose, Db::system()->one('SELECT * FROM subscribers WHERE email=?', [$email])); }
$ORI = ['Origin' => $mb, 'Content-Type' => 'application/x-www-form-urlencoded'];
foreach (['en' => ['', 'ltr'], 'ar' => ['/ar', 'rtl'], 'fr' => ['/fr', 'ltr']] as $l => [$pre, $dir]) {
    test("pages $l: /subscribe renders form, lang/dir, noindex, honeypot, CSP, no inline script/style", function () use ($mb, $l, $pre, $dir) {
        [$s, $h, $b] = http($mb, "$pre/subscribe"); eq($s, 200);
        ok(str_contains($b, "<html lang=\"$l\" dir=\"$dir\">")); ok(str_contains($b, 'noindex') || str_contains($h['x-robots-tag'] ?? '', 'noindex'));
        ok(str_contains($b, 'name="website"') && str_contains($b, 'name="email"') && str_contains($b, 'name="streams[]"'));
        ok(!preg_match('#<script|<style|\sstyle=|\son[a-z]+=#i', $b), 'inline code'); ok(str_contains($h['content-security-policy'] ?? '', "default-src 'self'"));
        ok(str_contains($b, "action=\"$pre/subscribe\""));
    });
}
test('pages: POST /subscribe (same-origin) → sent notice; cross-origin → 403; invalid → 400 with form', function () use ($mb, $ORI, $mdb) {
    $body = 'email=page%40y.org&streams%5B%5D=blog';
    [$s, , $b] = http($mb, '/fr/subscribe', 'POST', $ORI, $body); eq($s, 200);
    eq($mdb()->val("SELECT status FROM subscribers WHERE email='page@y.org'"), 'pending'); eq($mdb()->val("SELECT locale FROM subscribers WHERE email='page@y.org'"), 'fr');
    eq(http($mb, '/subscribe', 'POST', ['Origin' => 'https://evil.example', 'Content-Type' => 'application/x-www-form-urlencoded'], $body)[0], 403);
    [$s, , $b] = http($mb, '/subscribe', 'POST', $ORI, 'email=bad&streams%5B%5D=blog'); eq($s, 400); ok(str_contains($b, 'role="alert"') && str_contains($b, '<form'));
});
test('pages: confirm — GET shows a button and changes nothing; POST activates; bad token 410', function () use ($mb, $ORI, $mdb) {
    Subscribers::subscribe('conf@y.org', 'en', ['blog']); $t = mm_get_tok('confirm', 'conf@y.org');
    [$s, , $b] = http($mb, '/subscribe/confirm?t=' . rawurlencode($t)); eq($s, 200); ok(str_contains($b, '<form') && str_contains($b, 'method="post"'));
    eq($mdb()->val("SELECT status FROM subscribers WHERE email='conf@y.org'"), 'pending', 'GET must not confirm');
    [$s] = http($mb, '/subscribe/confirm', 'POST', $ORI, 't=' . rawurlencode($t)); eq($s, 200);
    eq($mdb()->val("SELECT status FROM subscribers WHERE email='conf@y.org'"), 'active');
    eq(http($mb, '/subscribe/confirm?t=1.' . str_repeat('a', 30))[0], 410); eq(http($mb, '/subscribe/confirm', 'POST', $ORI, 't=zzz')[0], 410);
});
test('pages: unsubscribe — GET shows the preference centre and changes nothing; POST save keeps chosen streams; POST all unsubscribes + confirmation mail', function () use ($mb, $ORI, $mdb) {
    mm_clear(); $s = mm_sub('u@y.org', ['blog', 'events']); $t = rawurlencode(mm_get_tok('unsub', 'u@y.org')); mm_clear();
    [$st, , $b] = http($mb, "/unsubscribe?t=$t"); eq($st, 200); ok(substr_count($b, 'type="checkbox"') === 3);
    eq($mdb()->val("SELECT status FROM subscribers WHERE email='u@y.org'"), 'active'); eq($mdb()->val("SELECT streams FROM subscribers WHERE email='u@y.org'"), '["blog","events"]');
    [$st] = http($mb, '/ar/unsubscribe', 'POST', $ORI, "t=$t&do=save&streams%5B%5D=events"); eq($st, 200);
    eq($mdb()->val("SELECT streams FROM subscribers WHERE email='u@y.org'"), '["events"]');
    [$st] = http($mb, '/unsubscribe', 'POST', $ORI, "t=$t&do=all"); eq($st, 200);
    eq($mdb()->val("SELECT status FROM subscribers WHERE email='u@y.org'"), 'unsubscribed'); eq((int)$mdb()->val("SELECT COUNT(*) FROM email_queue WHERE template='unsubscribe_done'"), 1);
    eq(http($mb, '/unsubscribe?t=1.' . str_repeat('b', 30))[0], 410);
});
test('pages: RFC 8058 one-click POST works with token only (no cookie, no Origin) and a bad token is 400', function () use ($mb, $mdb) {
    mm_sub('oc@y.org', ['blog']); $t = rawurlencode(mm_get_tok('unsub', 'oc@y.org'));
    [$st, , $b] = http($mb, "/unsubscribe?t=$t", 'POST', ['Content-Type' => 'application/x-www-form-urlencoded'], 'List-Unsubscribe=One-Click');
    eq($st, 200); eq($mdb()->val("SELECT status FROM subscribers WHERE email='oc@y.org'"), 'unsubscribed');
    eq(http($mb, '/unsubscribe?t=1.' . str_repeat('c', 30), 'POST', ['Content-Type' => 'application/x-www-form-urlencoded'], 'List-Unsubscribe=One-Click')[0], 400);
});
test('api/subscribe + api/contact: JSON, same-origin required, honeypot, validation, contact stored and acknowledged', function () use ($mb, $mdb) {
    $J = ['Origin' => $mb, 'Content-Type' => 'application/json'];
    [$s, , $b] = http($mb, '/api/subscribe.php', 'POST', $J, json_encode(['email' => 'api@y.org', 'streams' => ['product'], 'locale' => 'ar'])); eq($s, 200); eq(json_decode($b, true)['ok'], true);
    eq($mdb()->val("SELECT locale FROM subscribers WHERE email='api@y.org'"), 'ar');
    eq(http($mb, '/api/subscribe.php', 'POST', ['Content-Type' => 'application/json', 'Origin' => 'https://evil.example'], '{"email":"z@y.org","streams":["blog"]}')[0], 403);
    eq(http($mb, '/api/subscribe.php', 'POST', $J, '{"email":"bad","streams":["blog"]}')[0], 400);
    eq(http($mb, '/api/subscribe.php')[0], 405);
    $c = ['name' => 'Zainab Q', 'email' => 'ct@y.org', 'topic' => 'bug', 'message' => 'The export button does nothing here', 'locale' => 'fr'];
    [$s] = http($mb, '/api/contact.php', 'POST', $J, json_encode($c)); eq($s, 200);
    $row = $mdb()->one("SELECT * FROM contact_messages WHERE email='ct@y.org'"); eq($row['topic'], 'bug'); eq($row['locale'], 'fr');
    eq($mdb()->val("SELECT template FROM email_queue WHERE to_email='ct@y.org'"), 'contact_received');
    eq(http($mb, '/api/contact.php', 'POST', $J, json_encode(['email' => 'bad', 'message' => 'hello world'] ))[0], 400);
    eq(http($mb, '/api/contact.php', 'POST', $J, json_encode(['email' => 'q@y.org', 'message' => 'hi']))[0], 400);
    http($mb, '/api/contact.php', 'POST', $J, json_encode(['email' => 'bot@y.org', 'message' => 'spam spam spam', 'website' => 'x']));
    eq($mdb()->one("SELECT 1 FROM contact_messages WHERE email='bot@y.org'"), null);
});
test('cron/send-mail.php: CLI only; drains the queue under a lock', function () use ($mdir, $mkey, $mdb) {
    mm_clear(); Mailer::queue('cr@y.org', 'sync_wiped', 'en', []); $mdb()->pdo->exec('PRAGMA wal_checkpoint(PASSIVE)');
    $out = shell_exec(sprintf('DYON_DATA_DIR=%s DYON_SECRET_KEY=%s DYON_MAIL_TRANSPORT=file DYON_BASE_URL=https://dyon.store php %s 2>&1', escapeshellarg($mdir), escapeshellarg($mkey), escapeshellarg(DYON_ROOT . '/cron/send-mail.php')));
    ok(str_contains((string)$out, '"sent":1'), (string)$out); eq($mdb()->val("SELECT status FROM email_queue WHERE to_email='cr@y.org'"), 'sent');
    eq(http($GLOBALS['mb'], '/cron/send-mail.php')[0], 404);
});
test('router: /cron, /templates, /app are never served', function () use ($mb) {
    foreach (['/cron/send-mail.php', '/templates/email/layout.php', '/app/Mailer.php', '/vendor-php/autoload.php', '/composer.json'] as $p) ok(http($mb, $p)[0] === 404, $p);
});
