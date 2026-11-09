<?php
declare(strict_types=1);
namespace Dyon;

/** §8 SEO helpers: JSON-LD, conditional GET, XML escaping. Everything is same-origin; nothing is fetched. */
final class Seo
{
    public static function base(): string { return rtrim((string)Config::get('base_url', ''), '/'); }

    public static function desc(string $s, int $max = 158): string
    {
        $s = trim(preg_replace('/\s+/u', ' ', strip_tags($s)) ?? '');
        return mb_strlen($s) <= $max ? $s : rtrim(mb_substr($s, 0, $max - 1), " ,.;:–-") . '…';
    }

    /** @param array<int,array> $graphs */
    public static function jsonLd(array $graphs): string
    {
        $out = '';
        foreach ($graphs as $g) $out .= '<script type="application/ld+json">' . json_encode(['@context' => 'https://schema.org'] + $g,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) . '</script>';
        return $out;
    }

    public static function organization(): array
    {
        $b = self::base();
        return ['@type' => 'Organization', '@id' => $b . '/#org', 'name' => 'DYON', 'url' => $b . '/', 'logo' => $b . '/images/icon-512.jpg'];
    }

    public static function website(string $l): array
    {
        $b = self::base();
        return ['@type' => 'WebSite', '@id' => $b . '/#site', 'name' => 'DYON', 'url' => $b . '/', 'inLanguage' => $l, 'publisher' => ['@id' => $b . '/#org']];
    }

    /** @param list<array{0:string,1:string}> $crumbs [name, absolute url] */
    public static function breadcrumbs(array $crumbs): array
    {
        $items = [];
        foreach ($crumbs as $i => [$name, $url]) $items[] = ['@type' => 'ListItem', 'position' => $i + 1, 'name' => $name, 'item' => $url];
        return ['@type' => 'BreadcrumbList', 'itemListElement' => $items];
    }

    public static function iso(int $ts, ?string $tz = null): string
    {
        return (new \DateTimeImmutable('@' . $ts))->setTimezone(new \DateTimeZone($tz && in_array($tz, \DateTimeZone::listIdentifiers(), true) ? $tz : 'UTC'))->format('c');
    }

    public static function article(array $p, string $l, string $url): array
    {
        $b = self::base();
        return ['@type' => $p['type'] === 'news' ? 'NewsArticle' : 'BlogPosting', 'headline' => mb_substr((string)$p['title'], 0, 110), 'description' => self::desc((string)($p['seo_desc'] ?: $p['summary'] ?: '')),
            'datePublished' => self::iso((int)$p['published_at']), 'dateModified' => self::iso((int)($p['updated_at'] ?: $p['published_at'])), 'inLanguage' => $l,
            'mainEntityOfPage' => $url, 'url' => $url, 'image' => $b . '/images/icon-512.jpg',
            'author' => ['@type' => 'Organization', 'name' => (string)($p['author'] ?: 'DYON'), 'url' => $b . '/'], 'publisher' => ['@id' => $b . '/#org']];
    }

    public static function event(array $p, string $l, string $url): array
    {
        $online = (string)$p['online_url'] !== ''; $place = (string)$p['place'] !== '';
        $mode = $online && $place ? 'MixedEventAttendanceMode' : ($online ? 'OnlineEventAttendanceMode' : 'OfflineEventAttendanceMode');
        $loc = [];
        if ($place) $loc[] = ['@type' => 'Place', 'name' => (string)$p['place']];
        if ($online) $loc[] = ['@type' => 'VirtualLocation', 'url' => (string)$p['online_url']];
        $ev = ['@type' => 'Event', 'name' => (string)$p['title'], 'description' => self::desc((string)($p['seo_desc'] ?: $p['summary'] ?: '')),
            'startDate' => self::iso((int)$p['starts_at'], $p['tz']), 'eventStatus' => 'https://schema.org/EventScheduled', 'eventAttendanceMode' => 'https://schema.org/' . $mode,
            'location' => count($loc) === 1 ? $loc[0] : $loc, 'inLanguage' => $l, 'url' => $url, 'organizer' => ['@id' => self::base() . '/#org']];
        if ($p['ends_at']) $ev['endDate'] = self::iso((int)$p['ends_at'], $p['tz']);
        return $ev;
    }

    /** Sends a cacheable body with ETag / Last-Modified and answers conditional requests with 304. */
    public static function respond(string $body, int $lastMod, string $type = 'text/html; charset=utf-8', int $status = 200): never
    {
        $etag = '"' . substr(sha1($body), 0, 20) . '"';
        header('Content-Type: ' . $type); header('ETag: ' . $etag);
        header('Cache-Control: public, max-age=300, must-revalidate');
        if ($lastMod > 0) header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $lastMod) . ' GMT');
        $inm = $_SERVER['HTTP_IF_NONE_MATCH'] ?? ''; $ims = $_SERVER['HTTP_IF_MODIFIED_SINCE'] ?? '';
        $fresh = $inm !== '' ? in_array($etag, array_map('trim', explode(',', str_replace('W/', '', $inm))), true)
            : ($ims !== '' && $lastMod > 0 && ($t = strtotime($ims)) !== false && $t >= $lastMod);
        if ($status === 200 && $fresh) { http_response_code(304); exit; }
        http_response_code($status);
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') echo $body;
        exit;
    }

    public static function x(string $s): string { return htmlspecialchars($s, ENT_XML1 | ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
}
