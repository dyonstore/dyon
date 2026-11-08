<?php
/* §6.5 — /storage is server-rendered, trilingual, cites its sources, and obeys the CSP (no inline script/style). */
[$base] = dev_server(['APP_ENV' => 'dev']);
$SRC = ['https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria',
        'https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist',
        'https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/',
        'https://webkit.org/blog/14403/updates-to-storage-policy/'];
foreach (['en' => ['/storage', 'ltr'], 'ar' => ['/ar/storage', 'rtl'], 'fr' => ['/fr/storage', 'ltr']] as $l => [$p, $dir]) {
    test("storage page $l: 200, lang/dir, canonical, hreflang x3, title", function () use ($base, $l, $p, $dir) {
        [$s, $h, $b] = http($base, $p);
        eq($s, 200); ok(str_contains($h['content-type'] ?? '', 'text/html'));
        ok(str_contains($b, "<html lang=\"$l\" dir=\"$dir\">"), 'lang/dir');
        ok(str_contains($b, '<link rel="canonical" href="https://dyon.store' . $p . '">'), 'canonical');
        foreach (['en', 'ar', 'fr', 'x-default'] as $x) ok(str_contains($b, 'hreflang="' . $x . '"'), "hreflang $x");
        ok(preg_match('#<h1>[^<]+</h1>#u', $b) === 1, 'h1');
    });
    test("storage page $l: every source is linked and every claim paragraph is followed by a citation", function () use ($base, $p, $SRC) {
        $b = http($base, $p)[2];
        foreach ($SRC as $u) ok(str_contains($b, 'href="' . $u . '"'), "missing $u");
        $paras = preg_match_all('#<h2>[^<]*</h2><p>#u', $b); ok($paras >= 3);
        ok(substr_count($b, 'class="src"') >= 7, 'citations: ' . substr_count($b, 'class="src"'));
    });
    test("storage page $l: no inline script/style/handlers (CSP), no third-party loads, no fear wording", function () use ($base, $p) {
        $b = http($base, $p)[2];
        ok(!preg_match('#<script(?![^>]*\bsrc=)#i', $b), 'inline script');
        ok(!preg_match('#<style|\sstyle=|\son[a-z]+=#i', $b), 'inline style/handler');
        preg_match_all('#(?:src|href)="(https?://[^"]+)"#', $b, $m);
        foreach ($m[1] as $u) ok(preg_match('#^https://(developer\.mozilla\.org|webkit\.org|dyon\.store)/#', $u) === 1, "unexpected external $u"); // only <a href> citations; never src
        ok(!preg_match('#<(script|img|link|iframe)[^>]+(src|href)="https?://(?!dyon\.store)#i', $b), 'third-party resource loaded');
        ok(!preg_match('/\b(warning|danger|urgent|lose everything|permanently lost)\b/i', $b), 'fear wording');
    });
}
test('storage page: CSP + nosniff headers, same-origin script only', function () use ($base) {
    [, $h, $b] = http($base, '/storage');
    ok(str_contains($h['content-security-policy'] ?? '', "default-src 'self'"), 'csp'); eq($h['x-content-type-options'] ?? '', 'nosniff');
    ok(str_contains($b, '<script type="module" src="/js/storage-page.js">'));
});
test('storage page: unknown sub-path is a 404 page that is not indexed; /storage/ works', function () use ($base) {
    [$s, , $b] = http($base, '/storage/x'); eq($s, 404); ok(str_contains($b, 'noindex'));
    eq(http($base, '/storage/')[0], 200); eq(http($base, '/fr/storage/')[0], 200);
});
test('storage page: all storage.* keys exist in en/ar/fr', function () {
    foreach (['en', 'ar', 'fr'] as $l) { $d = json_decode(file_get_contents(DYON_PUBLIC . "/locales/$l.json"), true); foreach (['storage.title', 'storage.keep', 'storage.p_evict2', 'storage.src_mdn_quota'] as $k) ok(!empty($d[$k]), "$l $k"); }
});
