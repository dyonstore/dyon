<?php
declare(strict_types=1);
/* php cron/seed-posts.php [content-dir] — idempotent: loads content/posts.json + content/posts/<slug>.<locale>.md. Posts that already exist are left as the editor saved them. */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/app/bootstrap.php';
$r = Dyon\Posts::seed($argv[1] ?? null);
echo "posts in manifest: {$r['posts']}, created: {$r['created']}\n";
