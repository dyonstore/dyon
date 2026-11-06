<?php
require __DIR__ . '/_boot.php';
use Dyon\Http;
Http::method('GET', 'HEAD');                      // heartbeat for the sync status chip (§6)
Http::json(['ok' => true, 't' => time()]);
