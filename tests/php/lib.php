<?php
declare(strict_types=1);
/* Minimal PHP test runner (no PHPUnit). Files tests/php/*Test.php call test('name', fn) / eq() / ok(). */
$GLOBALS['__t'] = ['pass' => 0, 'fail' => 0, 'fails' => []];
function test(string $name, callable $fn): void {
    try { $r = $fn(); if ($r === false) throw new Exception('returned false'); $GLOBALS['__t']['pass']++; }
    catch (Throwable $e) { $GLOBALS['__t']['fail']++; $GLOBALS['__t']['fails'][] = "$name: " . $e->getMessage(); }
}
function ok($cond, string $msg = 'assertion failed'): void { if (!$cond) throw new Exception($msg); }
function eq($a, $b, string $msg = ''): void {
    if ($a !== $b) throw new Exception(($msg ? "$msg: " : '') . 'expected ' . var_export($b, true) . ', got ' . var_export($a, true));
}
function throws(callable $fn, string $contains = ''): void {
    try { $fn(); } catch (Throwable $e) { if ($contains === '' || stripos($e->getMessage(), $contains) !== false) return; throw new Exception("wrong exception: " . $e->getMessage()); }
    throw new Exception('expected exception');
}
/** Temp dir for a test; removed at shutdown. */
function tmpdir(): string {
    $d = sys_get_temp_dir() . '/dyon-t-' . bin2hex(random_bytes(4)); mkdir($d, 0700, true);
    register_shutdown_function(static function () use ($d) { exec('rm -rf ' . escapeshellarg($d)); });
    return $d;
}
/** Spawn `php -S` on a free port with the router; returns [base, stop]. */
function dev_server(array $env = []): array {
    do { $port = random_int(18000, 18900); $probe = @fsockopen('127.0.0.1', $port, $pe, $ps, 0.05); if ($probe) fclose($probe); } while ($probe);
    $envs = ''; foreach ($env as $k => $v) $envs .= $k . '=' . escapeshellarg($v) . ' ';
    $cmd = $envs . 'php -S 127.0.0.1:' . $port . ' -t ' . escapeshellarg(DYON_ROOT . '/public') . ' ' . escapeshellarg(DYON_ROOT . '/public/router.php') . ' >/dev/null 2>&1 & echo $!';
    $pid = (int)trim((string)shell_exec($cmd));
    for ($i = 0; $i < 50; $i++) { $s = @fsockopen('127.0.0.1', $port, $en, $es, 0.1); if ($s) { fclose($s); break; } usleep(100000); }
    register_shutdown_function(static function () use ($pid) { if ($pid) @posix_kill($pid, 15) ?: exec('kill ' . $pid . ' 2>/dev/null'); });
    return ['http://127.0.0.1:' . $port, $pid];
}
/** Raw HTTP request (keeps ".." paths intact). Returns [status, headers(lowercase), body]. */
function http(string $base, string $path, string $method = 'GET', array $headers = [], ?string $body = null): array {
    $u = parse_url($base); $s = fsockopen($u['host'], $u['port'], $en, $es, 3);
    $req = "$method $path HTTP/1.1\r\nHost: {$u['host']}:{$u['port']}\r\nConnection: close\r\n";
    foreach ($headers as $k => $v) $req .= "$k: $v\r\n";
    if ($body !== null) $req .= 'Content-Length: ' . strlen($body) . "\r\n";
    fwrite($s, $req . "\r\n" . ($body ?? '')); $raw = stream_get_contents($s); fclose($s);
    [$head, $b] = array_pad(explode("\r\n\r\n", $raw, 2), 2, '');
    $lines = explode("\r\n", $head); preg_match('#HTTP/\S+ (\d+)#', array_shift($lines), $m);
    $h = []; foreach ($lines as $l) { if (strpos($l, ':')) { [$k, $v] = explode(':', $l, 2); $h[strtolower(trim($k))] = trim($v); } }
    return [(int)($m[1] ?? 0), $h, $b];
}
