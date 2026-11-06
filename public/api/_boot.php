<?php
declare(strict_types=1);
/* Shared bootstrap for public/api/*.php. Files starting with "_" are never routed (router + .htaccess deny them). */
require dirname(__DIR__, 2) . '/app/bootstrap.php';

use Dyon\{Http, Csrf, Config};

Http::securityHeaders();
set_exception_handler(static function (Throwable $e): void {
    error_log('[dyon] ' . get_class($e) . ': ' . $e->getMessage());
    if (!headers_sent()) Http::error(500, 'server_error', 'Something went wrong on our side');
});

/** Call at the top of every state-changing endpoint. */
function dyon_post_guard(): void { Http::method('POST'); Csrf::enforce(); }
