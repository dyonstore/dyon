<?php
declare(strict_types=1);
namespace Dyon;

/** Shared server-rendered page shell (storage, blog, news, events, unsubscribe). No inline script/style: the CSP forbids both. */
final class Site
{
    public const NAMES = ['en' => 'English', 'ar' => 'العربية', 'fr' => 'Français'];

    public static function e(string $s): string { return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

    public static function localePath(string $l, string $path): string { return ($l === 'en' ? '' : '/' . $l) . $path; }

    /** Strips a leading /ar or /fr; returns [locale, rest]. Locale comes from the path only, so every URL has one language (clean SEO). */
    public static function split(string $uri): array
    {
        $l = I18n::detect($uri, null);
        return [$l, $l === 'en' ? $uri : (substr($uri, strlen($l) + 1) ?: '/')];
    }

    public static function notFound(string $l = 'en'): never
    {
        Http::securityHeaders();
        http_response_code(404);
        header('Content-Type: text/html; charset=utf-8');
        echo self::page(['locale' => $l, 'path' => '/', 'title' => I18n::t('site.not_found', [], $l) . ' — DYON', 'noindex' => true,
            'body' => '<h1>' . self::e(I18n::t('site.not_found', [], $l)) . '</h1><p><a class="btn" href="/">' . self::e(I18n::t('storage.open_app', [], $l)) . '</a></p>']);
        exit;
    }

    /** @param array{locale:string,path:string,title:string,desc?:string,body:string,scripts?:string[],noindex?:bool,alternates?:bool,type?:string} $o */
    public static function page(array $o): string
    {
        $l = $o['locale']; $dir = I18n::dir($l); $base = rtrim((string)Config::get('base_url', ''), '/');
        $t = static fn(string $k, array $v = []) => I18n::t($k, $v, $l);
        $alts = ''; $switch = ''; $map = $o['alts'] ?? null;      // alts: locale => localised path, for pages that exist in only some languages
        foreach (self::NAMES as $code => $name) {
            $href = $map !== null ? ($map[$code] ?? null) : self::localePath($code, $o['path']);
            if ($href === null) continue;
            if ($o['alternates'] ?? true) $alts .= '<link rel="alternate" hreflang="' . $code . '" href="' . self::e($base . $href) . '">' . "\n";
            $switch .= '<a href="' . self::e($href) . '" lang="' . $code . '" hreflang="' . $code . '"' . ($code === $l ? ' aria-current="true"' : '') . '>' . self::e($name) . '</a>';
        }
        $canon = $base . ($map !== null ? ($map[$l] ?? self::localePath($l, $o['path'])) : self::localePath($l, $o['path']));
        if ($o['alternates'] ?? true) $alts .= '<link rel="alternate" hreflang="x-default" href="' . self::e($base . ($map !== null ? ($map['en'] ?? reset($map)) : $o['path'])) . '">' . "\n";
        $desc = $o['desc'] ?? '';
        $h  = '<!DOCTYPE html><html lang="' . $l . '" dir="' . $dir . '"><head><meta charset="utf-8">';
        $h .= '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">';
        $h .= '<title>' . self::e($o['title']) . '</title>';
        if ($desc !== '') $h .= '<meta name="description" content="' . self::e($desc) . '">';
        if (!empty($o['noindex'])) $h .= '<meta name="robots" content="noindex">';
        else $h .= '<link rel="canonical" href="' . self::e($canon) . '">' . "\n" . $alts;
        $h .= '<meta property="og:site_name" content="DYON"><meta property="og:type" content="' . self::e($o['type'] ?? 'website') . '"><meta property="og:title" content="' . self::e($o['title']) . '">';
        if ($desc !== '') $h .= '<meta property="og:description" content="' . self::e($desc) . '">';
        if (empty($o['noindex'])) $h .= '<meta property="og:url" content="' . self::e($canon) . '"><meta property="og:locale" content="' . ['en' => 'en_US', 'ar' => 'ar_AR', 'fr' => 'fr_FR'][$l] . '">'
            . '<meta property="og:image" content="' . self::e($base . '/images/icon-512.jpg') . '"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="' . self::e($o['title']) . '">'
            . ($desc !== '' ? '<meta name="twitter:description" content="' . self::e($desc) . '">' : '');
        $h .= '<meta name="color-scheme" content="light dark"><meta name="theme-color" content="#0b1020">';
        $h .= '<link rel="icon" href="/images/icon.svg" type="image/svg+xml"><link rel="stylesheet" href="/vendor/fonts/fonts.css"><link rel="stylesheet" href="/css/site.css">';
        $h .= $o['head'] ?? '';
        $h .= '</head><body><a class="skip" href="#main">' . self::e($t('storage.skip')) . '</a>';
        $h .= '<header class="site-head"><div class="wrap"><a class="brand" href="' . self::e(self::localePath($l, '/')) . '" aria-label="DYON">DYON</a>';
        $h .= '<nav class="main-nav" aria-label="' . self::e($t('site.nav')) . '">';
        foreach (['blog', 'news', 'events'] as $sec) $h .= '<a href="' . self::e(self::localePath($l, '/' . $sec)) . '">' . self::e($t('site.nav_' . $sec)) . '</a>';
        $h .= '</nav><nav class="lang" aria-label="' . self::e($t('storage.lang')) . '">' . $switch . '</nav>';
        $h .= '<a class="btn btn-sm" href="/">' . self::e($t('storage.open_app')) . '</a></div></header>';
        $h .= '<main id="main" class="wrap prose">' . $o['body'] . '</main>';
        $h .= '<footer class="site-foot"><div class="wrap"><p>' . self::e($t('storage.footer')) . '</p><p><a href="/privacy.html">' . self::e($t('storage.privacy')) . '</a> · <a href="' . self::e(self::localePath($l, '/subscribe')) . '">' . self::e($t('site.subscribe')) . '</a> · <a href="' . self::e(self::localePath($l, '/feed.xml')) . '">' . self::e($t('site.feed')) . '</a></p></div></footer>';
        foreach ($o['scripts'] ?? [] as $s) $h .= '<script type="module" src="' . self::e($s) . '"></script>';
        return $h . '</body></html>';
    }
}
