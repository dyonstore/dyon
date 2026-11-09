<?php
declare(strict_types=1);
/* §8 — /blog, /news, /events (+ /ar, /fr): lists (12 per page), tag pages, posts, events (upcoming / archive). Server-rendered, no JS needed to read.
   Drafts, future-dated posts and posts without a translation in the requested language are 404. Old slugs 301 to the current one. */
require dirname(__DIR__) . '/app/bootstrap.php';

use Dyon\{Site, I18n, Http, Posts, Seo};

$full = urldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
[$l, $path] = Site::split($full);
Http::securityHeaders(); header('Content-Language: ' . $l);
if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET', 'HEAD'], true)) Http::error(405, 'method_not_allowed', 'Method not allowed');

$t = static fn(string $k, array $v = []) => I18n::t($k, $v, $l);
$e = static fn(string $s) => Site::e($s);
$tpl = static function (string $name, array $vars) use ($l, $t, $e): string {
    $vars += ['l' => $l, 't' => $t, 'e' => $e]; extract($vars, EXTR_SKIP); ob_start(); include DYON_ROOT . "/templates/site/$name.php"; return (string)ob_get_clean();
};
$parts = array_values(array_filter(explode('/', $path), 'strlen'));
$sec = $parts[0] ?? ''; $type = Posts::SECTIONS[$sec] ?? null;
if ($type === null) Site::notFound($l);
$base = Seo::base(); $abs = static fn(string $p) => $base . Site::localePath($GLOBALS['l'], $p);
$secName = $t('site.nav_' . $sec);
$ld = [Seo::organization(), Seo::website($l)];
$feedLinks = '<link rel="alternate" type="application/rss+xml" title="DYON" href="' . $e(Site::localePath($l, '/feed.xml')) . '"><link rel="alternate" type="application/atom+xml" title="DYON" href="' . $e(Site::localePath($l, '/atom.xml')) . '">';
$send = static function (array $o, int $lastMod) use ($l, $feedLinks): never {
    $o += ['locale' => $l]; $o['head'] = ($o['head'] ?? '') . $feedLinks;
    Seo::respond(Site::page($o), $lastMod);
};
$lastOf = static fn(array $items) => $items ? max(array_map(static fn($p) => (int)($p['updated_at'] ?: $p['published_at']), $items)) : 0;
$page = static fn(array $m) => max(1, (int)($m[1] ?? 1));

/* ---- listing: /blog, /blog/page/N, /blog/tag/x[/page/N], /events/archive[/page/N] ---- */
$n = count($parts); $tag = null; $when = $type === 'event' ? 'upcoming' : 'all'; $pg = 1; $listPath = '/' . $sec; $isList = false; $i = 1;
if ($n === 1) $isList = true;
else {
    if ($type === 'event' && ($parts[1] ?? '') === 'archive') { $when = 'past'; $listPath .= '/archive'; $i = 2; $isList = $n === 2 || ($n === 4 && $parts[2] === 'page'); }
    elseif (($parts[1] ?? '') === 'tag' && $n >= 3) { $tag = $parts[2]; $listPath .= '/tag/' . $tag; $i = 3; $isList = $n === 3 || ($n === 5 && $parts[3] === 'page'); }
    elseif (($parts[1] ?? '') === 'page' && $n === 3) { $i = 1; $isList = true; }
    if ($isList && ($parts[$i] ?? '') === 'page') { if (!ctype_digit($parts[$i + 1] ?? '') || (int)$parts[$i + 1] < 1) Site::notFound($l); $pg = (int)$parts[$i + 1]; }
}
if ($isList) {
    if ($tag !== null && Posts::tagName($tag, $l) === null) Site::notFound($l);
    $r = Posts::listing($type, $l, $pg, $tag, $when);
    if ($pg > 1 && $pg > $r['pages']) Site::notFound($l);
    if (isset($parts[$i]) && $parts[$i] === 'page' && $pg === 1) Http::redirect(Site::localePath($l, $listPath), 301);
    $tagName = $tag !== null ? (string)Posts::tagName($tag, $l) : null;
    $title = $tagName !== null ? $t('blog.tag_title', ['tag' => $tagName]) : ($when === 'past' ? $t('events.past') : $t($sec . '.title'));
    $h = '<h1>' . $e($title) . '</h1><p class="lead">' . $e($t($sec . '.lead')) . '</p>';
    $chips = Posts::tagsInUse($type, $l);
    if ($chips && $type !== 'event') { $h .= '<p class="chips" aria-label="' . $e($t('blog.topics')) . '">';
        foreach ($chips as $c) $h .= '<a href="' . $e(Site::localePath($l, "/$sec/tag/{$c['slug']}")) . '"' . ($c['slug'] === $tag ? ' aria-current="true"' : '') . '>' . $e($c['name']) . '</a>';
        $h .= '</p>'; }
    if ($type === 'event') $h .= '<p class="chips"><a href="' . $e(Site::localePath($l, '/events')) . '"' . ($when === 'upcoming' ? ' aria-current="true"' : '') . '>' . $e($t('events.upcoming')) . '</a><a href="' . $e(Site::localePath($l, '/events/archive')) . '"' . ($when === 'past' ? ' aria-current="true"' : '') . '>' . $e($t('events.past')) . '</a></p>';
    if (!$r['items']) $h .= '<p class="msg">' . $e($t($type === 'event' && $when === 'upcoming' ? 'events.none' : 'blog.empty')) . '</p>';
    foreach ($r['items'] as $p) $h .= $tpl('card', ['p' => $p]);
    $h .= $tpl('pager', ['page' => $r['page'], 'pages' => $r['pages'], 'base' => $listPath]);
    $h .= '<aside class="panel"><h2>' . $e($t('blog.cta_title')) . '</h2><p>' . $e($t('blog.cta_body')) . '</p><div class="row"><a class="btn btn-primary" href="' . $e(Site::localePath($l, '/subscribe')) . '">' . $e($t('blog.cta_btn')) . '</a></div></aside>';
    $head = '';
    if ($r['page'] > 1) $head .= '<link rel="prev" href="' . $e($base . Site::localePath($l, $r['page'] === 2 ? $listPath : "$listPath/page/" . ($r['page'] - 1))) . '">';
    if ($r['page'] < $r['pages']) $head .= '<link rel="next" href="' . $e($base . Site::localePath($l, "$listPath/page/" . ($r['page'] + 1))) . '">';
    $crumbs = [[$t('blog.crumb_home'), $base . Site::localePath($l, '/')], [$secName, $abs('/' . $sec)]];
    if ($listPath !== '/' . $sec) $crumbs[] = [$title, $abs($listPath)];
    $ld[] = Seo::breadcrumbs($crumbs);
    $pagePath = $r['page'] > 1 ? "$listPath/page/{$r['page']}" : $listPath;
    $send(['path' => $pagePath, 'title' => ($r['page'] > 1 ? $title . ' — ' . $t('blog.page_of', ['page' => $r['page'], 'total' => $r['pages']]) : $title) . ' — DYON',
        'desc' => $t($sec . '.lead'), 'body' => $h, 'head' => $head . Seo::jsonLd($ld)], $lastOf($r['items']));
}

/* ---- single post / event ---- */
if ($n !== 2) Site::notFound($l);
$slug = $parts[1];
$p = Posts::find($type, $slug, $l);
if (!$p) { $to = Posts::redirectFor($type, $slug, $l); if ($to) Http::redirect($to, 301); Site::notFound($l); }
$own = Posts::path($p, $l);
if ($own !== Site::localePath($l, "/$sec/$slug")) Http::redirect($own, 301);
$tags = Posts::tagsFor((int)$p['id'], $l);
$url = $base . $own;
$ld[] = $type === 'event' ? Seo::event($p, $l, $url) : Seo::article($p, $l, $url);
$ld[] = Seo::breadcrumbs([[$t('blog.crumb_home'), $base . Site::localePath($l, '/')], [$secName, $abs('/' . $sec)], [(string)$p['title'], $url]]);
$desc = Seo::desc((string)($p['seo_desc'] ?: $p['summary'] ?: $p['body_html']));
$head = $type === 'event' ? '' : '<meta property="article:published_time" content="' . $e(Seo::iso((int)$p['published_at'])) . '"><meta property="article:modified_time" content="' . $e(Seo::iso((int)($p['updated_at'] ?: $p['published_at']))) . '">';
$send(['path' => "/$sec/$slug", 'alts' => Posts::alternates($p), 'title' => ((string)($p['seo_title'] ?: $p['title'])) . ' — DYON', 'desc' => $desc, 'type' => $type === 'event' ? 'website' : 'article',
    'body' => $tpl('post', ['p' => $p, 'tags' => $tags]), 'head' => $head . Seo::jsonLd($ld)], (int)($p['updated_at'] ?: $p['published_at']));
