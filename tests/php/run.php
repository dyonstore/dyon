<?php
declare(strict_types=1);
/* Usage: php tests/php/run.php [filter]   (npm run test:php) */
require dirname(__DIR__, 2) . '/app/bootstrap.php';
require __DIR__ . '/lib.php';
$filter = $argv[1] ?? '';
foreach (glob(__DIR__ . '/*Test.php') as $f) { if ($filter === '' || stripos($f, $filter) !== false) require $f; }
$t = $GLOBALS['__t'];
foreach ($t['fails'] as $f) fwrite(STDERR, "  FAIL $f\n");
echo "php: {$t['pass']} passed · {$t['fail']} failed\n";
exit($t['fail'] ? 1 : 0);
