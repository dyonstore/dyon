<?php
declare(strict_types=1);
namespace Dyon;

/** §8 content model: blog / news / events (+ tags, per-locale slugs, slug redirects). Public reads never expose drafts or future-dated posts. */
final class Posts
{
    public const PER_PAGE = 12;
    /** URL words that can never be a slug (/blog/page/2, /blog/tag/x, /events/archive). */
    public const RESERVED = ['page', 'tag', 'archive'];
    /** URL section → posts.type */
    public const SECTIONS = ['blog' => 'blog', 'news' => 'news', 'events' => 'event'];
    private const MONTHS = [
        'en' => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
        'fr' => ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
        'ar' => ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    ];

    public static function section(string $type): string { return array_search($type, self::SECTIONS, true) ?: 'blog'; }

    /** Public URL path of a post in a locale (locale-prefixed). */
    public static function path(array $p, string $l): string { return Site::localePath($l, '/' . self::section($p['type']) . '/' . ($p['lslug'] ?? $p['slug'])); }

    public static function date(int $ts, string $l, ?string $tz = null, bool $time = false): string
    {
        $d = (new \DateTimeImmutable('@' . $ts))->setTimezone(new \DateTimeZone($tz && in_array($tz, \DateTimeZone::listIdentifiers(), true) ? $tz : 'UTC'));
        $s = $d->format('j') . ' ' . self::MONTHS[$l][(int)$d->format('n') - 1] . ' ' . $d->format('Y');
        return $time ? $s . ', ' . $d->format('H:i') . ($tz ? ' (' . $tz . ')' : ' UTC') : $s;
    }

    /* ---------- reads ---------- */

    private const COLS = 'p.id, p.type, p.slug, p.published_at, p.updated_at, p.author, pi.title, pi.summary, pi.body_html, pi.seo_title, pi.seo_desc,
        COALESCE(NULLIF(pi.slug, \'\'), p.slug) AS lslug, e.starts_at, e.ends_at, e.tz, e.place, e.online_url';
    private const FROM = 'FROM posts p JOIN post_i18n pi ON pi.post_id = p.id AND pi.locale = ? LEFT JOIN events e ON e.post_id = p.id';

    /** @return array{items:array,total:int,pages:int,page:int} only posts that exist in $l. $when: all|upcoming|past (events). */
    public static function listing(string $type, string $l, int $page = 1, ?string $tag = null, string $when = 'all', ?int $now = null): array
    {
        $now ??= time(); $db = Db::system(); $page = max(1, $page);
        $w = "p.type = ? AND p.status = 'published' AND p.published_at <= ?"; $a = [$l, $type, $now];
        if ($tag !== null) { $w .= ' AND EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id = p.id AND t.slug = ?)'; $a[] = $tag; }
        $end = 'COALESCE(e.ends_at, e.starts_at + 7200)';
        if ($when === 'upcoming') { $w .= " AND $end >= CAST(? AS INTEGER)"; $a[] = $now; } elseif ($when === 'past') { $w .= " AND $end < CAST(? AS INTEGER)"; $a[] = $now; }
        $order = $type === 'event' ? ($when === 'upcoming' ? 'e.starts_at ASC' : 'e.starts_at DESC') : 'p.published_at DESC, p.id DESC';
        $total = (int)$db->val('SELECT COUNT(*) ' . self::FROM . " WHERE $w", $a);
        $pages = max(1, (int)ceil($total / self::PER_PAGE)); $page = min($page, $pages);
        $items = $db->all('SELECT ' . self::COLS . ' ' . self::FROM . " WHERE $w ORDER BY $order LIMIT " . self::PER_PAGE . ' OFFSET ' . (($page - 1) * self::PER_PAGE), $a);
        return ['items' => $items, 'total' => $total, 'pages' => $pages, 'page' => $page];
    }

    /** @return array|null a published, translated, already-live post. */
    public static function find(string $type, string $slug, string $l, ?int $now = null): ?array
    {
        return Db::system()->one('SELECT ' . self::COLS . ' ' . self::FROM . " WHERE p.type = ? AND p.status = 'published' AND p.published_at <= ?
            AND COALESCE(NULLIF(pi.slug, ''), p.slug) = ?", [$l, $type, $now ?? time(), $slug]);
    }

    /** Old slug → current locale path (301), or null. */
    public static function redirectFor(string $type, string $slug, string $l): ?string
    {
        $id = Db::system()->val('SELECT post_id FROM slug_redirects WHERE type = ? AND locale = ? AND old_slug = ?', [$type, $l, $slug]);
        if (!$id) return null;
        $p = Db::system()->one('SELECT ' . self::COLS . ' ' . self::FROM . " WHERE p.id = ? AND p.status = 'published' AND p.published_at <= ?", [$l, $id, time()]);
        return $p ? self::path($p, $l) : null;
    }

    /** @return array<string,string> locale → path, for every translation of a live post (hreflang set). */
    public static function alternates(array $p): array
    {
        $out = [];
        foreach (Db::system()->all("SELECT locale, COALESCE(NULLIF(slug, ''), ?) AS s FROM post_i18n WHERE post_id = ? ORDER BY locale", [$p['slug'], $p['id']]) as $r)
            $out[$r['locale']] = Site::localePath($r['locale'], '/' . self::section($p['type']) . '/' . $r['s']);
        return $out;
    }

    /** @return list<array{slug:string,name:string}> */
    public static function tagsFor(int $postId, string $l): array
    {
        $o = [];
        foreach (Db::system()->all('SELECT t.slug, t.name_i18n FROM post_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id = ? ORDER BY t.slug', [$postId]) as $t)
            $o[] = ['slug' => $t['slug'], 'name' => (json_decode((string)$t['name_i18n'], true) ?: [])[$l] ?? $t['slug']];
        return $o;
    }

    public static function tagName(string $slug, string $l): ?string
    {
        $j = Db::system()->val('SELECT name_i18n FROM tags WHERE slug = ?', [$slug]);
        return $j === null || $j === false ? null : ((json_decode((string)$j, true) ?: [])[$l] ?? $slug);
    }

    /** @return list<array{slug:string,name:string}> tags used by at least one live post of $type in $l */
    public static function tagsInUse(string $type, string $l, ?int $now = null): array
    {
        $o = [];
        foreach (Db::system()->all("SELECT DISTINCT t.slug, t.name_i18n FROM tags t JOIN post_tags pt ON pt.tag_id = t.id JOIN posts p ON p.id = pt.post_id
            JOIN post_i18n pi ON pi.post_id = p.id AND pi.locale = ? WHERE p.type = ? AND p.status = 'published' AND p.published_at <= ? ORDER BY t.slug", [$l, $type, $now ?? time()]) as $t)
            $o[] = ['slug' => $t['slug'], 'name' => (json_decode((string)$t['name_i18n'], true) ?: [])[$l] ?? $t['slug']];
        return $o;
    }

    /** Allow-list HTML sanitiser for editor content: no script/style/iframe/forms/handlers; links only https:, mailto: or same-site paths. */
    public static function sanitize(string $html): string
    {
        if (trim($html) === '') return '';
        $ok = ['p' => [], 'h2' => [], 'h3' => [], 'h4' => [], 'ul' => [], 'ol' => [], 'li' => [], 'blockquote' => ['dir', 'lang'], 'strong' => [], 'em' => [], 'b' => [], 'i' => [], 'br' => [], 'code' => [], 'pre' => [], 'hr' => [],
            'bdi' => ['dir', 'lang'], 'span' => ['dir', 'lang'], 'a' => ['href', 'rel'], 'figure' => [], 'figcaption' => []];
        $doc = new \DOMDocument('1.0', 'UTF-8'); $prev = libxml_use_internal_errors(true);
        $doc->loadHTML('<?xml encoding="UTF-8"><div id="r">' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD); libxml_clear_errors(); libxml_use_internal_errors($prev);
        $walk = static function (\DOMNode $n) use (&$walk, $ok): void {
            foreach (iterator_to_array($n->childNodes) as $c) {
                if ($c instanceof \DOMComment || $c instanceof \DOMProcessingInstruction) { $n->removeChild($c); continue; }
                if (!$c instanceof \DOMElement) continue;
                $name = strtolower($c->nodeName);
                if (in_array($name, ['script', 'style', 'iframe', 'object', 'embed', 'form', 'svg', 'math', 'template', 'noscript', 'link', 'meta', 'base'], true)) { $n->removeChild($c); continue; }
                $walk($c);
                if (!isset($ok[$name])) { while ($c->firstChild) $n->insertBefore($c->firstChild, $c); $n->removeChild($c); continue; }
                foreach (iterator_to_array($c->attributes) as $a) {
                    $an = strtolower($a->nodeName); $v = trim($a->nodeValue);
                    $keep = in_array($an, $ok[$name], true) && !($an === 'href' && !preg_match('#^(https://[^\s]+|mailto:[^\s]+|/(?!/)[^\s]*)$#i', $v)) && !($an === 'dir' && !in_array($v, ['rtl', 'ltr'], true)) && !($an === 'lang' && !preg_match('/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/', $v));
                    if (!$keep) $c->removeAttribute($a->nodeName);
                }
                if ($name === 'a' && str_starts_with((string)$c->getAttribute('href'), 'https://')) $c->setAttribute('rel', 'noopener');
                elseif ($name === 'a') $c->removeAttribute('rel');
            }
        };
        $root = $doc->getElementById('r'); if (!$root) return '';
        $walk($root); $out = '';
        foreach ($root->childNodes as $c) $out .= $doc->saveHTML($c);
        return $out;
    }

    /* ---------- writes (seed, admin, tests) ---------- */

    /** Creates or updates one post. $d: type, slug, status, published_at, author, tags[], i18n[l]=>[title,summary,body_html,seo_title,seo_desc,slug], event=>[starts_at,ends_at,tz,place,online_url].
     *  Renaming a slug keeps the old URL alive through slug_redirects. @return int post id */
    public static function save(array $d): int
    {
        $db = Db::system(); $now = time(); $slug = (string)$d['slug'];
        if (!preg_match('/^[a-z0-9][a-z0-9-]{0,80}$/', $slug) || in_array($slug, self::RESERVED, true) || !in_array($d['type'], ['blog', 'news', 'event'], true)) throw new \InvalidArgumentException('bad post');
        $row = $db->one('SELECT id FROM posts WHERE type = ? AND slug = ?', [$d['type'], $slug]);
        $vals = [$d['status'] ?? 'draft', $d['published_at'] ?? null, $now, $d['author'] ?? 'DYON'];
        if ($row) { $id = (int)$row['id']; $db->exec('UPDATE posts SET status=?, published_at=?, updated_at=?, author=? WHERE id=?', [...$vals, $id]); }
        else { $db->exec('INSERT INTO posts(type, slug, status, published_at, updated_at, author) VALUES(?,?,?,?,?,?)', [$d['type'], $slug, ...$vals]); $id = $db->lastId(); }
        foreach ($d['i18n'] ?? [] as $l => $t) {
            if (!in_array($l, I18n::LOCALES, true)) continue;
            $old = $db->val('SELECT slug FROM post_i18n WHERE post_id = ? AND locale = ?', [$id, $l]);
            $new = ($t['slug'] ?? '') !== '' ? (string)$t['slug'] : null;
            if ($old && $old !== $new) $db->exec('INSERT OR IGNORE INTO slug_redirects(type, locale, old_slug, post_id) VALUES(?,?,?,?)', [$d['type'], $l, $old, $id]);
            $db->exec('INSERT INTO post_i18n(post_id, locale, title, summary, body_html, seo_title, seo_desc, slug) VALUES(?,?,?,?,?,?,?,?)
                ON CONFLICT(post_id, locale) DO UPDATE SET title=excluded.title, summary=excluded.summary, body_html=excluded.body_html, seo_title=excluded.seo_title, seo_desc=excluded.seo_desc, slug=excluded.slug',
                [$id, $l, (string)$t['title'], $t['summary'] ?? null, self::sanitize((string)($t['body_html'] ?? '')), $t['seo_title'] ?? null, $t['seo_desc'] ?? null, $new]);
        }
        if (isset($d['event'])) $db->exec('INSERT INTO events(post_id, starts_at, ends_at, tz, place, online_url) VALUES(?,?,?,?,?,?)
            ON CONFLICT(post_id) DO UPDATE SET starts_at=excluded.starts_at, ends_at=excluded.ends_at, tz=excluded.tz, place=excluded.place, online_url=excluded.online_url',
            [$id, (int)$d['event']['starts_at'], $d['event']['ends_at'] ?? null, $d['event']['tz'] ?? null, $d['event']['place'] ?? null, $d['event']['online_url'] ?? null]);
        if (isset($d['tags'])) {
            $db->exec('DELETE FROM post_tags WHERE post_id = ?', [$id]);
            foreach ($d['tags'] as $ts) {
                $db->exec("INSERT OR IGNORE INTO tags(slug, name_i18n) VALUES(?, '{}')", [$ts]);
                $db->exec('INSERT OR IGNORE INTO post_tags(post_id, tag_id) SELECT ?, id FROM tags WHERE slug = ?', [$id, $ts]);
            }
        }
        return $id;
    }

    /** Idempotent: loads content/posts.json + content/posts/<slug>.<locale>.md. Existing posts are left as the editor saved them. @return array{posts:int,created:int} */
    public static function seed(?string $dir = null): array
    {
        $dir ??= DYON_ROOT . '/content'; $db = Db::system();
        $m = json_decode((string)file_get_contents($dir . '/posts.json'), true, 16, JSON_THROW_ON_ERROR);
        foreach ($m['tags'] ?? [] as $slug => $names) $db->exec('INSERT INTO tags(slug, name_i18n) VALUES(?,?) ON CONFLICT(slug) DO UPDATE SET name_i18n = excluded.name_i18n', [$slug, json_encode($names, JSON_UNESCAPED_UNICODE)]);
        $created = 0;
        foreach ($m['posts'] as $p) {
            if ($db->one('SELECT 1 FROM posts WHERE type = ? AND slug = ?', [$p['type'], $p['slug']])) continue;
            $i18n = [];
            foreach (I18n::LOCALES as $l) {
                $f = "$dir/posts/{$p['slug']}.$l.md"; if (!is_file($f)) continue;
                [$meta, $body] = self::parseFile((string)file_get_contents($f));
                $i18n[$l] = ['title' => $meta['title'], 'summary' => $meta['summary'] ?? null, 'seo_desc' => $meta['summary'] ?? null, 'body_html' => self::md($body)];
            }
            self::save(['type' => $p['type'], 'slug' => $p['slug'], 'status' => 'published', 'published_at' => strtotime($p['date'] . ' UTC'), 'author' => $p['author'] ?? 'DYON',
                'tags' => $p['tags'] ?? [], 'i18n' => $i18n] + (isset($p['event']) ? ['event' => $p['event']] : []));
            $created++;
        }
        return ['posts' => count($m['posts']), 'created' => $created];
    }

    /** "key: value" lines, a line with ---, then markdown. */
    public static function parseFile(string $s): array
    {
        [$head, $body] = array_pad(explode("\n---\n", str_replace("\r\n", "\n", $s), 2), 2, '');
        $meta = [];
        foreach (explode("\n", $head) as $line) if (preg_match('/^(\w+):\s*(.+)$/u', $line, $m)) $meta[$m[1]] = trim($m[2]);
        if (empty($meta['title'])) throw new \RuntimeException('post file without title');
        return [$meta, $body];
    }

    /** Tiny, safe markdown: ## h2, - lists, > quote, paragraphs, **bold**, [text](https://… | /path), {ar:text} for inline Arabic. Raw HTML is always escaped. */
    public static function md(string $src): string
    {
        $inline = static function (string $s): string {
            $s = htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
            $s = preg_replace('/\*\*(.+?)\*\*/u', '<strong>$1</strong>', $s);
            $s = preg_replace('/\{ar:(.+?)\}/u', '<bdi lang="ar" dir="rtl">$1</bdi>', $s);
            return preg_replace_callback('/\[([^\]]+)\]\(((?:https:\/\/|\/)[A-Za-z0-9\-._~:\/?#@!$&;=%+]*)\)/u',
                static fn($m) => '<a href="' . $m[2] . '"' . ($m[2][0] === '/' ? '' : ' rel="noopener"') . '>' . $m[1] . '</a>', $s);
        };
        $out = ''; $para = []; $list = [];
        $flush = static function () use (&$out, &$para, &$list, $inline): void {
            if ($para) { $out .= '<p>' . $inline(implode(' ', $para)) . '</p>'; $para = []; }
            if ($list) { $out .= '<ul>' . implode('', array_map(static fn($i) => '<li>' . $inline($i) . '</li>', $list)) . '</ul>'; $list = []; }
        };
        foreach (preg_split('/\R/u', trim($src)) as $line) {
            $line = rtrim($line);
            if ($line === '') { $flush(); continue; }
            if (preg_match('/^## (.+)$/u', $line, $m)) { $flush(); $out .= '<h2>' . $inline($m[1]) . '</h2>'; }
            elseif (preg_match('/^> (.+)$/u', $line, $m)) { $flush(); $out .= '<blockquote><p>' . $inline($m[1]) . '</p></blockquote>'; }
            elseif (preg_match('/^- (.+)$/u', $line, $m)) { if ($para) $flush(); $list[] = $m[1]; }
            else { if ($list) $flush(); $para[] = $line; }
        }
        $flush();
        return $out;
    }

    /* ---------- email hooks (admin publish / cron) ---------- */

    /** Queues digest_blog (blog/news → stream blog) or a notice for events, once per address, only for active subscribers in a locale the post exists in. @return int queued */
    public static function queueDigest(int $postId): int
    {
        $db = Db::system(); $p = $db->one('SELECT id, type, slug FROM posts WHERE id = ? AND status = ?', [$postId, 'published']);
        if (!$p) return 0;
        $stream = $p['type'] === 'event' ? 'events' : 'blog'; $n = 0; $base = rtrim((string)Config::get('base_url', ''), '/');
        foreach (I18n::LOCALES as $l) {
            $row = self::find($p['type'], (string)$db->val("SELECT COALESCE(NULLIF(slug,''), ?) FROM post_i18n WHERE post_id = ? AND locale = ?", [$p['slug'], $postId, $l]) ?: '', $l);
            if (!$row) continue;
            $url = $base . self::path($row, $l);
            foreach (Subscribers::activeFor($stream, $l) as $s) {
                if ($db->val("SELECT 1 FROM email_queue WHERE to_email = ? AND template = 'digest_blog' AND vars LIKE ?", [$s['email'], '%' . json_encode($url, JSON_UNESCAPED_SLASHES) . '%'])) continue;
                Mailer::queue($s['email'], 'digest_blog', $l, ['title' => $row['title'], 'summary' => (string)$row['summary'], 'url' => $url, 'sub_id' => (int)$s['id']]); $n++;
            }
        }
        return $n;
    }
}
