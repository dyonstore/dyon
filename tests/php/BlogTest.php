<?php
/* §8 blog / news / events: seed, listing rules, SSR pages in 3 locales, SEO (JSON-LD, hreflang, sitemaps, feeds), 404/301/405 rules, sanitizer. */
use Dyon\{Config, Db, Posts, I18n};

$bdir = tmpdir();
Config::set(['data_dir' => $bdir, 'cookie_secure' => false, 'secret_key' => base64_encode(str_repeat('b', 32)), 'base_url' => 'https://dyon.store']);
Db::reset();
$seed1 = Posts::seed(); $seed2 = Posts::seed();
$now = time(); $L3 = ['en', 'ar', 'fr'];
$mk = fn(string $t) => ['title' => $t, 'summary' => "Sum $t", 'body_html' => "<p>Body $t</p>"];
Posts::save(['type' => 'blog', 'slug' => 't-draft', 'status' => 'draft', 'published_at' => $now - 100, 'i18n' => ['en' => $mk('Draft')]]);
Posts::save(['type' => 'blog', 'slug' => 't-future', 'status' => 'published', 'published_at' => $now + 86400, 'i18n' => ['en' => $mk('Future')]]);
Posts::save(['type' => 'blog', 'slug' => 't-en-only', 'status' => 'published', 'published_at' => $now - 100, 'tags' => ['product'], 'i18n' => ['en' => $mk('English only')]]);
Posts::save(['type' => 'blog', 'slug' => 't-renamed', 'status' => 'published', 'published_at' => $now - 100, 'i18n' => ['en' => $mk('Old') + ['slug' => 't-old']]]);
Posts::save(['type' => 'blog', 'slug' => 't-renamed', 'status' => 'published', 'published_at' => $now - 100, 'i18n' => ['en' => $mk('New') + ['slug' => 't-new']]]);
Posts::save(['type' => 'event', 'slug' => 'ev-next', 'status' => 'published', 'published_at' => $now - 100, 'i18n' => array_fill_keys($L3, $mk('Next event')), 'event' => ['starts_at' => $now + 86400 * 5, 'ends_at' => $now + 86400 * 5 + 3600, 'tz' => 'Africa/Tunis', 'place' => 'Tunis', 'online_url' => null]]);
Posts::save(['type' => 'event', 'slug' => 'ev-old', 'status' => 'published', 'published_at' => $now - 86400 * 40, 'i18n' => array_fill_keys($L3, $mk('Old event')), 'event' => ['starts_at' => $now - 86400 * 30, 'ends_at' => $now - 86400 * 30 + 3600, 'tz' => 'UTC', 'place' => 'Paris', 'online_url' => null]]);
for ($i = 1; $i <= 13; $i++) Posts::save(['type' => 'news', 'slug' => "n-$i", 'status' => 'published', 'published_at' => $now - 1000 - $i, 'tags' => ['values'], 'i18n' => array_fill_keys($L3, $mk("News $i"))]);
Db::system()->pdo->exec('PRAGMA wal_checkpoint(PASSIVE)');
[$bb] = dev_server(['APP_ENV' => 'dev', 'DYON_COOKIE_SECURE' => '0', 'DYON_SECRET_KEY' => base64_encode(str_repeat('b', 32)), 'DYON_DATA_DIR' => $bdir, 'DYON_BASE_URL' => 'https://dyon.store']);
function bg(string $p, string $m = 'GET'): array { global $bb; return http($bb, $p, $m); }
function pre(string $l): string { return $l === 'en' ? '' : "/$l"; }

test('blog: seed loads the manifest once and is idempotent', function () use ($seed1, $seed2) {
    ok($seed1['created'] === $seed1['posts'] && $seed1['posts'] >= 11); eq($seed2['created'], 0);
});
test('blog: listing hides drafts, future posts and posts without that translation', function () use ($now) {
    $en = array_column(Posts::listing('blog', 'en', 1)['items'], 'slug'); $ar = array_column(Posts::listing('blog', 'ar', 1)['items'], 'slug');
    ok(!in_array('t-draft', $en) && !in_array('t-future', $en) && in_array('t-en-only', $en)); ok(!in_array('t-en-only', $ar));
    eq(Posts::find('blog', 't-draft', 'en'), null); eq(Posts::find('blog', 't-future', 'en'), null); ok(Posts::find('blog', 't-future', 'en', $now + 2 * 86400) !== null);
});
test('blog: 12 per page, pages computed, out-of-range page clamps in the model', function () {
    $r = Posts::listing('news', 'en', 1); eq(count($r['items']), 12); eq($r['pages'], 2); eq($r['total'] >= 13, true);
    $r2 = Posts::listing('news', 'en', 2); eq(count($r2['items']), $r['total'] - 12); eq(Posts::listing('news', 'en', 99)['page'], 2);
});
test('blog: events split into upcoming and past', function () {
    $up = array_column(Posts::listing('event', 'en', 1, null, 'upcoming')['items'], 'slug'); $pa = array_column(Posts::listing('event', 'en', 1, null, 'past')['items'], 'slug');
    eq($up, ['ev-next']); eq($pa, ['ev-old']);
});
test('blog: slug rename keeps the old URL (301) and reserved/bad slugs are refused', function () {
    eq(Posts::redirectFor('blog', 't-old', 'en'), '/blog/t-new'); eq(Posts::find('blog', 't-new', 'en')['title'], 'New');
    throws(fn() => Posts::save(['type' => 'blog', 'slug' => 'page', 'i18n' => []]), 'bad post'); throws(fn() => Posts::save(['type' => 'blog', 'slug' => 'Bad Slug', 'i18n' => []]), 'bad post');
    throws(fn() => Posts::save(['type' => 'nope', 'slug' => 'ok', 'i18n' => []]), 'bad post');
});
test('blog: sanitizer drops scripts, handlers, javascript: links and iframes; keeps safe markup', function () {
    $h = Posts::sanitize('<p onclick="x()">a <a href="javascript:alert(1)">b</a> <a href="https://e.org">c</a></p><script>alert(1)</script><iframe src="//e"></iframe><img src=x onerror=y><strong>d</strong>');
    ok(!preg_match('/<script|onclick|javascript:|<iframe|onerror/i', $h), $h); ok(str_contains($h, '<strong>d</strong>') && str_contains($h, 'https://e.org'));
});

test('blog pages: list, tag, post and event pages render in en/ar/fr with the right lang/dir and a canonical', function () use ($L3) {
    foreach ($L3 as $l) {
        $dir = $l === 'ar' ? 'rtl' : 'ltr';
        foreach (['/blog', '/news', '/events', '/events/archive', '/blog/tag/product', '/news/page/2', '/events/ev-next', '/news/n-1'] as $p) {
            [$s, $h, $b] = bg(pre($l) . $p); eq($s, 200, "$l $p");
            ok(str_contains($b, "lang=\"$l\"") && str_contains($b, "dir=\"$dir\""), "$l $p lang/dir");
            ok(str_contains($b, 'rel="canonical"'), "$l $p canonical"); ok(!preg_match('/\b(blog|news|events|site|mail)\.[a-z_]+\b/', strip_tags($b)), "$l $p missing key");
            ok(str_contains($b, '<h1'), "$l $p h1");
        }
    }
});
test('blog pages: 404 for drafts, future, untranslated, unknown tag, page 99 and junk; 301 for old slug and /page/1; 405 for POST', function () {
    foreach (['/blog/t-draft', '/blog/t-future', '/ar/blog/t-en-only', '/fr/blog/t-en-only', '/blog/tag/nope', '/news/page/99', '/news/page/0', '/blog/a/b', '/events/archive/page/9'] as $p) eq(bg($p)[0], 404, $p);
    [$s, $h] = bg('/blog/t-old'); eq($s, 301); eq($h['location'] ?? '', '/blog/t-new');
    [$s, $h] = bg('/news/page/1'); eq($s, 301); eq($h['location'] ?? '', '/news');
    eq(bg('/blog', 'POST')[0], 405);
    eq(bg('/blog/t-en-only')[0], 200);
});
test('blog pages: pagination links, prev/next, tag filter and upcoming/archive content', function () {
    $b = bg('/news')[2]; ok(str_contains($b, '/news/page/2') && str_contains($b, 'rel="next"') && !str_contains($b, 'rel="prev"'));
    $b2 = bg('/news/page/2')[2]; ok(str_contains($b2, 'rel="prev"') && !str_contains($b2, 'rel="next"'));
    $t = bg('/blog/tag/product')[2]; ok(str_contains($t, 'English only') && !str_contains($t, 'Old</') );
    ok(str_contains(bg('/events')[2], 'Next event') && !str_contains(bg('/events')[2], 'Old event')); ok(str_contains(bg('/events/archive')[2], 'Old event'));
});
test('blog SEO: JSON-LD parses; articles/events typed; hreflang reciprocal across all translations; x-default', function () use ($L3) {
    $ld = function (string $b): array { preg_match_all('#<script type="application/ld\+json"[^>]*>(.*?)</script>#s', $b, $m); $o = []; foreach ($m[1] as $j) { $d = json_decode($j, true, 32); ok(is_array($d), 'ld json'); $o[] = $d; } return $o; };
    $types = function (array $blocks): array { $t = []; foreach ($blocks as $d) foreach (($d['@graph'] ?? [$d]) as $n) $t[] = $n['@type'] ?? ''; return $t; };
    $a = $types($ld(bg('/news/n-1')[2])); ok(in_array('NewsArticle', $a) || in_array('BlogPosting', $a) || in_array('Article', $a), json_encode($a)); ok(in_array('BreadcrumbList', $a));
    ok(in_array('Event', $types($ld(bg('/events/ev-next')[2]))));
    $href = function (string $b): array { preg_match_all('#<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"#', $b, $m); return array_combine($m[1], $m[2]); };
    $maps = []; foreach ($L3 as $l) { $maps[$l] = $href(bg(pre($l) . '/news/n-2')[2]); ok(isset($maps[$l]['x-default']), "$l x-default"); foreach ($L3 as $c) ok(isset($maps[$l][$c]), "{$l}-to-{$c}"); }
    foreach ($L3 as $l) foreach ($L3 as $c) eq($maps[$l][$c], $maps[$c][$c], "reciprocal $l/$c");
    eq(array_keys($href(bg('/blog/t-en-only')[2])) === ['en', 'x-default'] || array_keys($href(bg('/blog/t-en-only')[2])) === ['en'], true);
});
test('blog SEO: sitemaps and feeds are well-formed XML, list only live content, drafts/future never appear', function () use ($L3) {
    foreach (['/sitemap.xml', '/sitemap-pages.xml', '/sitemap-posts.xml'] as $p) { [$s, $h, $b] = bg($p); eq($s, 200, $p); ok(simplexml_load_string($b) !== false, "$p xml"); ok(str_contains($h['content-type'] ?? '', 'xml')); }
    $sm = bg('/sitemap-posts.xml')[2]; ok(str_contains($sm, '/blog/introducing-dyon') && str_contains($sm, 'hreflang="ar"') && !str_contains($sm, 't-draft') && !str_contains($sm, 't-future') && str_contains($sm, '/news/page/2'));
    foreach ($L3 as $l) foreach (['/feed.xml', '/atom.xml'] as $f) {
        [$s, $h, $b] = bg(pre($l) . $f); eq($s, 200, "$l$f"); $x = simplexml_load_string($b); ok($x !== false, "$l$f xml"); ok(str_contains($b, $l === 'en' ? 'en' : $l)); ok(!str_contains($b, 't-draft') && !str_contains($b, 'Future'));
    }
    $rob = bg('/robots.txt')[2]; ok(str_contains($rob, 'Sitemap: https://dyon.store/sitemap.xml') && str_contains($rob, 'Disallow: /admin/'));
    eq(bg('/sitemap.xml', 'POST')[0], 405);
});
test('blog SEO: conditional GET returns 304 with the ETag', function () {
    [$s, $h] = bg('/blog'); $et = $h['etag'] ?? ''; ok($et !== '', 'etag'); [$s2] = http($GLOBALS['bb'], '/blog', 'GET', ['If-None-Match' => $et]); eq($s2, 304);
});
