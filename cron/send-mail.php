<?php
declare(strict_types=1);
/* Every minute:  * * * * * php /path/to/dyon/cron/send-mail.php   (CLI only; a lock file prevents overlap) */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/app/bootstrap.php';
$lock = fopen(sys_get_temp_dir() . '/dyon-send-mail-' . substr(sha1(__DIR__), 0, 8) . '.lock', 'c');
if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) { fwrite(STDERR, "send-mail: already running\n"); exit(0); }
$r = Dyon\Mailer::run(50);
if (array_sum($r) > 0) echo json_encode($r), "\n";
