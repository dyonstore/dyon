<?php
declare(strict_types=1);
namespace Dyon;

use PDO;

/** PDO SQLite, one instance per file. WAL + FKs on. migrate() applies migrations/NNN_*.sql by PRAGMA user_version. */
final class Db
{
    /** @var array<string,Db> */
    private static array $open = [];
    public readonly PDO $pdo;

    private function __construct(public readonly string $file)
    {
        $dir = dirname($file);
        if (!is_dir($dir)) mkdir($dir, 0700, true);
        $new = !is_file($file);
        $this->pdo = new PDO('sqlite:' . $file, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        $this->pdo->exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA synchronous=NORMAL;');
        if ($new) @chmod($file, 0600);
    }

    public static function open(string $file): self { return self::$open[$file] ??= new self($file); }

    /** The system database (data/system.sqlite), migrated on first use. */
    public static function system(): self
    {
        $db = self::open(rtrim((string)Config::get('data_dir'), '/') . '/system.sqlite');
        if ($db->version() < self::latestVersion()) $db->migrate();
        return $db;
    }

    /** Test helper: forget cached handles. */
    public static function reset(): void { self::$open = []; }

    public function version(): int { return (int)$this->pdo->query('PRAGMA user_version')->fetchColumn(); }

    /** @return array<int,string> version => file */
    public static function migrationFiles(?string $dir = null): array
    {
        $dir ??= dirname(__DIR__) . '/migrations';
        $out = [];
        foreach (glob($dir . '/*.sql') ?: [] as $f) {
            if (preg_match('/^(\d+)_/', basename($f), $m)) $out[(int)$m[1]] = $f;
        }
        ksort($out);
        return $out;
    }

    public static function latestVersion(): int { $m = self::migrationFiles(); return $m ? max(array_keys($m)) : 0; }

    /** Applies pending migrations, each in a transaction. Returns the number applied. */
    public function migrate(?string $dir = null): int
    {
        $n = 0;
        foreach (self::migrationFiles($dir) as $v => $file) {
            if ($v <= $this->version()) continue;
            $sql = (string)file_get_contents($file);
            $this->pdo->exec('BEGIN IMMEDIATE');
            try {
                if ($v <= $this->version()) { $this->pdo->exec('ROLLBACK'); continue; } // raced with another process
                $this->pdo->exec($sql);
                $this->pdo->exec('PRAGMA user_version = ' . $v);
                $this->pdo->exec('COMMIT');
                $n++;
            } catch (\Throwable $e) {
                if ($this->pdo->inTransaction()) $this->pdo->exec('ROLLBACK');
                throw new \RuntimeException("migration $v failed: " . $e->getMessage(), 0, $e);
            }
        }
        return $n;
    }

    public function exec(string $sql, array $p = []): int
    {
        $st = $this->pdo->prepare($sql); $st->execute($p); return $st->rowCount();
    }
    public function all(string $sql, array $p = []): array
    {
        $st = $this->pdo->prepare($sql); $st->execute($p); return $st->fetchAll();
    }
    public function one(string $sql, array $p = []): ?array
    {
        $st = $this->pdo->prepare($sql); $st->execute($p); $r = $st->fetch(); return $r === false ? null : $r;
    }
    public function val(string $sql, array $p = []): mixed
    {
        $st = $this->pdo->prepare($sql); $st->execute($p); $r = $st->fetchColumn(); return $r === false ? null : $r;
    }
    public function lastId(): int { return (int)$this->pdo->lastInsertId(); }

    /** Runs $fn in a transaction (nested calls join the outer one). */
    public function tx(callable $fn): mixed
    {
        if ($this->pdo->inTransaction()) return $fn($this);
        $this->pdo->exec('BEGIN IMMEDIATE');
        try { $r = $fn($this); $this->pdo->exec('COMMIT'); return $r; }
        catch (\Throwable $e) { if ($this->pdo->inTransaction()) $this->pdo->exec('ROLLBACK'); throw $e; }
    }
}
