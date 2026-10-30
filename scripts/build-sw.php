<?php
/* Rewrites `const VERSION = 'dyon-…'` in the service worker with a hash of
   every CORE file, so any change to a cached asset produces a new worker.
   Usage: php scripts/build-sw.php [--check]   (--check exits 1 if stale) */
declare(strict_types=1);

$root = dirname(__DIR__);
$web  = is_file("$root/public/sw.js") ? "$root/public" : $root;
$swPath = "$web/sw.js";
$sw = file_get_contents($swPath);
if ($sw === false) { fwrite(STDERR, "sw.js not found\n"); exit(2); }

if (!preg_match('/const CORE = \[(.*?)\];/s', $sw, $m)) { fwrite(STDERR, "CORE list not found\n"); exit(2); }
preg_match_all("/'([^']+)'/", $m[1], $files);

$ctx = hash_init('sha256');
foreach ($files[1] as $rel) {
    $rel = ltrim(preg_replace('#^\./#', '', $rel), '/');
    if ($rel === '') $rel = 'index.html';
    $path = "$web/$rel";
    if (!is_file($path)) { fwrite(STDERR, "missing CORE file: $rel\n"); exit(2); }
    hash_update($ctx, $rel . "\0" . hash_file('sha256', $path) . "\n");
}
$version = 'dyon-' . substr(hash_final($ctx), 0, 12);
$new = preg_replace("/const VERSION = '[^']*';/", "const VERSION = '$version';", $sw, 1);

if (in_array('--check', $argv, true)) {
    if ($new !== $sw) { fwrite(STDERR, "sw.js VERSION is stale; run php scripts/build-sw.php\n"); exit(1); }
    echo "sw.js up to date ($version)\n"; exit(0);
}
file_put_contents($swPath, $new);
echo "sw.js VERSION = $version (" . count($files[1]) . " files)\n";
