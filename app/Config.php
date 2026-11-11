<?php
declare(strict_types=1);
namespace Dyon;

/* Layered config: config.example.php defaults < config/config.php < config/config.local.php < env DYON_*. */
final class Config
{
    private static ?array $cfg = null;

    public static function load(bool $force = false): array
    {
        if (self::$cfg !== null && !$force) return self::$cfg;
        $dir = dirname(__DIR__) . '/config';
        $cfg = require $dir . '/config.example.php';
        foreach (['config.php', 'config.local.php'] as $f) {
            if (is_file("$dir/$f")) $cfg = array_replace_recursive($cfg, (array)require "$dir/$f");
        }
        $dot = self::dotenv(dirname(__DIR__) . '/.env');
        foreach ($cfg as $k => $v) {
            $name = 'DYON_' . strtoupper($k);
            $e = getenv($name);                                  // a real environment variable always wins over .env
            if ($e === false && isset($dot[$name])) $e = $dot[$name];
            if ($e !== false && !is_array($v)) {
                $cfg[$k] = is_bool($v) ? in_array(strtolower($e), ['1', 'true', 'yes', 'on'], true)
                         : (is_int($v) ? (int)$e : $e);
            }
        }
        return self::$cfg = $cfg;
    }

    /** Minimal .env reader: KEY=VALUE, '#' comments, optional single/double quotes. Never executed, never echoed. @return array<string,string> */
    public static function dotenv(string $file): array
    {
        if (!is_file($file) || !is_readable($file)) return [];
        $out = [];
        foreach (preg_split('/\R/', (string)file_get_contents($file)) as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#' || !preg_match('/^(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/', $line, $m)) continue;
            $v = trim($m[2]);
            if (preg_match('/^"(.*)"$/s', $v, $q) || preg_match("/^'(.*)'$/s", $v, $q)) $v = $q[1];
            else $v = trim(preg_replace('/\s+#.*$/', '', $v));
            $out[$m[1]] = $v;
        }
        return $out;
    }

    /** URL segment of the admin area (config 'admin_path' / DYON_ADMIN_PATH). Letters, digits, '-' and '_' only; anything else falls back to 'admin'. */
    public static function adminPath(): string
    {
        $p = trim((string)self::get('admin_path', 'admin'), '/');
        return preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]{0,40}$/', $p) && !in_array(strtolower($p), ['api', 'blog', 'news', 'events', 'storage', 'ar', 'fr', 'js', 'css', 'dev'], true) ? $p : 'admin';
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        $v = self::load();
        foreach (explode('.', $key) as $part) {
            if (!is_array($v) || !array_key_exists($part, $v)) return $default;
            $v = $v[$part];
        }
        return $v;
    }

    /** Test helper: override values for the current process. */
    public static function set(array $override): void
    {
        self::$cfg = array_replace_recursive(self::load(), $override);
    }

    public static function isDev(): bool { return self::get('env') === 'dev'; }
}
