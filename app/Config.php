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
        foreach ($cfg as $k => $v) {
            $e = getenv('DYON_' . strtoupper($k));
            if ($e !== false && !is_array($v)) {
                $cfg[$k] = is_bool($v) ? in_array(strtolower($e), ['1', 'true', 'yes', 'on'], true)
                         : (is_int($v) ? (int)$e : $e);
            }
        }
        return self::$cfg = $cfg;
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
