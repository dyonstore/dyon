<?php
declare(strict_types=1);
/* §8 — /robots.txt, /sitemap.xml (index) → /sitemap-pages.xml, /sitemap-posts.xml (with xhtml:link alternates), /feed.xml (RSS 2.0) and /atom.xml per locale (/ar/…, /fr/…). */
require dirname(__DIR__) . '/app/bootstrap.php';

use Dyon\{Seo, Site, Posts, Db, I18n, Http};

Http::securityHeaders();
if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET', 'HEAD'], true)) Http::error(405, 'method_not_allowed', 'Method not allowed');
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
[$l, $file] = Site::split($uri);
$base = Seo::base(); $x = [Seo::class, 'x'];
$XML = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
$now = time();
$db = Db::system();
$live = "p.status = 'published' AND p.published_at <= $now";
$lastAll = (int)$db->val("SELECT COALESCE(MAX(COALESCE(p.updated_at, p.published_at)), 0) FROM posts p WHERE $live");
$iso = static fn(int $t) => gmdate('Y-m-d\TH:i:s\Z', $t);

if ($file === '/robots.txt') {
    Seo::respond("User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\nDisallow: /unsubscribe\nDisallow: /subscribe/confirm\n\nSitemap: $base/sitemap.xml\n", 0, 'text/plain; charset=utf-8');
}

if ($file === '/sitemap.xml') {
    $pagesMod = (int)filemtime(__FILE__);
    $body = $XML . '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        . '<sitemap><loc>' . $x("$base/sitemap-pages.xml") . '</loc><lastmod>' . $iso(max($pagesMod, $lastAll)) . '</lastmod></sitemap>'
        . '<sitemap><loc>' . $x("$base/sitemap-posts.xml") . '</loc>' . ($lastAll ? '<lastmod>' . $iso($lastAll) . '</lastmod>' : '') . '</sitemap></sitemapindex>';
    Seo::respond($body, max($pagesMod, $lastAll), 'application/xml; charset=utf-8');
}

$alt = static function (array $map) use ($base, $x): string {
    $o = '';
    foreach ($map as $code => $path) $o .= '<xhtml:link rel="alternate" hreflang="' . $code . '" href="' . $x($base . $path) . '"/>';
    return $o . ($map ? '<xhtml:link rel="alternate" hreflang="x-default" href="' . $x($base . ($map['en'] ?? reset($map))) . '"/>' : '');
};
$urlset = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">';

if ($file === '/sitemap-pages.xml') {
    $o = $XML . $urlset; $mod = (int)filemtime(__FILE__);
    foreach (['/', '/storage', '/blog', '/news', '/events', '/subscribe'] as $pg) {
        $map = []; foreach (I18n::LOCALES as $c) $map[$c] = Site::localePath($c, $pg === '/' ? ($c === 'en' ? '/' : '/') : $pg);
        if ($pg === '/') $map = ['en' => '/'];                                   // the app shell is one URL; its language is the visitor's choice
        foreach ($map as $c => $path) $o .= '<url><loc>' . $x($base . $path) . '</loc>' . ($pg === '/' ? '' : $alt($map)) . '</url>';
    }
    Seo::respond($o . '</urlset>', $mod, 'application/xml; charset=utf-8');
}

if ($file === '/sitemap-posts.xml') {
    $o = $XML . $urlset;
    $rows = $db->all("SELECT p.id, p.type, p.slug, COALESCE(p.updated_at, p.published_at) AS m FROM posts p WHERE $live AND EXISTS (SELECT 1 FROM post_i18n i WHERE i.post_id = p.id) ORDER BY p.published_at DESC, p.id DESC");
    foreach ($rows as $p) {
        $map = Posts::alternates($p);
        foreach ($map as $c => $path) $o .= '<url><loc>' . $x($base . $path) . '</loc><lastmod>' . $iso((int)$p['m']) . '</lastmod>' . $alt($map) . '</url>';
    }
    foreach (['blog', 'news', 'events'] as $sec) foreach (I18n::LOCALES as $c) {
        $r = Posts::listing(Posts::SECTIONS[$sec], $c, 1, null, 'all');
        for ($pg = 2; $pg <= $r['pages']; $pg++) $o .= '<url><loc>' . $x($base . Site::localePath($c, "/$sec/page/$pg")) . '</loc></url>';
    }
    Seo::respond($o . '</urlset>', $lastAll, 'application/xml; charset=utf-8');
}

if ($file === '/feed.xml' || $file === '/atom.xml') {
    $items = $db->all("SELECT p.id, p.type, p.slug, p.published_at, p.updated_at, p.author, pi.title, pi.summary, pi.body_html, COALESCE(NULLIF(pi.slug,''), p.slug) AS lslug
        FROM posts p JOIN post_i18n pi ON pi.post_id = p.id AND pi.locale = ? WHERE $live AND p.type IN ('blog','news') ORDER BY p.published_at DESC, p.id DESC LIMIT 30", [$l]);
    $self = $base . Site::localePath($l, $file); $home = $base . Site::localePath($l, '/blog');
    $title = 'DYON — ' . I18n::t('site.nav_blog', [], $l); $desc = I18n::t('blog.lead', [], $l);
    $last = $items ? max(array_map(static fn($p) => (int)($p['updated_at'] ?: $p['published_at']), $items)) : 0;
    if ($file === '/feed.xml') {
        $o = $XML . '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>' . $x($title) . '</title><link>' . $x($home) . '</link><description>' . $x($desc) . '</description>'
            . '<language>' . $l . '</language><atom:link href="' . $x($self) . '" rel="self" type="application/rss+xml"/>' . ($last ? '<lastBuildDate>' . gmdate(DATE_RSS, $last) . '</lastBuildDate>' : '');
        foreach ($items as $p) {
            $u = $base . Posts::path($p, $l);
            $o .= '<item><title>' . $x((string)$p['title']) . '</title><link>' . $x($u) . '</link><guid isPermaLink="true">' . $x($u) . '</guid><pubDate>' . gmdate(DATE_RSS, (int)$p['published_at']) . '</pubDate>'
                . '<description>' . $x((string)$p['summary']) . '</description><content:encoded>' . str_replace(']]>', ']]]]><![CDATA[>', '<![CDATA[' . $p['body_html']) . ']]></content:encoded></item>';
        }
        Seo::respond($o . '</channel></rss>', $last, 'application/rss+xml; charset=utf-8');
    }
    $o = $XML . '<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="' . $l . '"><title>' . $x($title) . '</title><subtitle>' . $x($desc) . '</subtitle><id>' . $x($self) . '</id>'
        . '<link rel="self" type="application/atom+xml" href="' . $x($self) . '"/><link rel="alternate" type="text/html" href="' . $x($home) . '"/><updated>' . $iso($last ?: $now) . '</updated>';
    foreach ($items as $p) {
        $u = $base . Posts::path($p, $l);
        $o .= '<entry><title>' . $x((string)$p['title']) . '</title><id>' . $x($u) . '</id><link rel="alternate" type="text/html" href="' . $x($u) . '"/><published>' . $iso((int)$p['published_at']) . '</published>'
            . '<updated>' . $iso((int)($p['updated_at'] ?: $p['published_at'])) . '</updated><author><name>' . $x((string)($p['author'] ?: 'DYON')) . '</name></author><summary>' . $x((string)$p['summary']) . '</summary>'
            . '<content type="html">' . $x((string)$p['body_html']) . '</content></entry>';
    }
    Seo::respond($o . '</feed>', $last, 'application/atom+xml; charset=utf-8');
}
Site::notFound($l);
