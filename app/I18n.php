<?php
declare(strict_types=1);
namespace Dyon;

/** Server-side messages from public/locales/{en,ar,fr}.json. Same ICU subset as js/i18n.js: {name}, plural, select, #, '' escape. */
final class I18n
{
    public const LOCALES = ['en', 'ar', 'fr'];
    public const RTL = ['ar'];
    private static array $cache = [];

    public static function load(string $l): array
    {
        $l = in_array($l, self::LOCALES, true) ? $l : 'en';
        return self::$cache[$l] ??= (json_decode((string)file_get_contents(DYON_PUBLIC . "/locales/$l.json"), true) ?: []);
    }

    public static function dir(string $l): string { return in_array($l, self::RTL, true) ? 'rtl' : 'ltr'; }

    public static function t(string $key, array $vars = [], string $l = 'en'): string
    {
        $msg = self::load($l)[$key] ?? self::load('en')[$key] ?? null;
        return $msg === null ? $key : self::format($msg, $vars, $l);
    }

    /** CLDR plural categories for en/fr/ar (the three shipped locales). */
    public static function pluralCat(string $l, float|int $n): string
    {
        $i = (int)abs($n); $isInt = floor((float)$n) == $n;
        if ($l === 'ar') {
            if (!$isInt) return 'other';
            $m = $i % 100;
            return match (true) { $i === 0 => 'zero', $i === 1 => 'one', $i === 2 => 'two', $m >= 3 && $m <= 10 => 'few', $m >= 11 => 'many', default => 'other' };
        }
        if ($l === 'fr') return ($i === 0 || $i === 1) && ($isInt || abs($n) < 2) ? 'one' : (($isInt && $i !== 0 && $i % 1000000 === 0) ? 'many' : 'other');
        return $isInt && $i === 1 ? 'one' : 'other';
    }

    private static function branches(string $body): array
    {
        $out = []; $i = 0; $len = strlen($body);
        while ($i < $len) {
            while ($i < $len && ctype_space($body[$i])) $i++;
            $key = '';
            while ($i < $len && $body[$i] !== '{') { $key .= $body[$i]; $i++; }
            $key = trim($key);
            if ($i >= $len || $body[$i] !== '{') break;
            $depth = 0; $val = '';
            for (; $i < $len; $i++) {
                $ch = $body[$i];
                if ($ch === '{') { $depth++; if ($depth === 1) continue; }
                if ($ch === '}') { $depth--; if ($depth === 0) { $i++; break; } }
                $val .= $ch;
            }
            $out[$key] = $val;
        }
        return $out;
    }

    public static function format(string $msg, array $vars = [], string $l = 'en', ?string $hash = null): string
    {
        $out = ''; $i = 0; $len = strlen($msg);
        while ($i < $len) {
            $ch = $msg[$i];
            if ($ch === "'" && ($msg[$i + 1] ?? '') === "'") { $out .= "'"; $i += 2; continue; }
            if ($ch === '#' && $hash !== null) { $out .= $hash; $i++; continue; }
            if ($ch !== '{') { $out .= $ch; $i++; continue; }
            $depth = 0; $inner = '';
            for (; $i < $len; $i++) {
                $c = $msg[$i];
                if ($c === '{') { $depth++; if ($depth === 1) continue; }
                if ($c === '}') { $depth--; if ($depth === 0) { $i++; break; } }
                $inner .= $c;
            }
            if (preg_match('/^\s*(\w+)\s*,\s*(plural|select|selectordinal)\s*,([\s\S]*)$/', $inner, $m)) {
                [, $name, $type, $body] = $m;
                $b = self::branches($body); $v = $vars[$name] ?? null;
                if ($type === 'select') {
                    $out .= self::format($b[(string)$v] ?? $b['other'] ?? '', $vars, $l, $hash);
                } else {
                    $n = $v === null ? 0 : $v + 0;
                    $chosen = $b['=' . $n] ?? $b[self::pluralCat($l, $n)] ?? $b['other'] ?? '';
                    $out .= self::format($chosen, $vars, $l, (string)$n);
                }
            } else {
                $name = trim($inner);
                $out .= array_key_exists($name, $vars) && $vars[$name] !== null ? (string)$vars[$name] : '{' . $name . '}';
            }
        }
        return $out;
    }

    /** Best locale from a path prefix, then Accept-Language, else 'en'. */
    public static function detect(?string $path = null, ?string $acceptLanguage = null): string
    {
        if ($path !== null && preg_match('#^/(ar|fr)(/|$)#', $path, $m)) return $m[1];
        foreach (explode(',', (string)$acceptLanguage) as $part) {
            $tag = strtolower(trim(explode(';', $part)[0]));
            $p = substr($tag, 0, 2);
            if (in_array($p, self::LOCALES, true)) return $p;
        }
        return 'en';
    }
}
