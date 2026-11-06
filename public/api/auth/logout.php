<?php
require dirname(__DIR__) . '/_boot.php';
use Dyon\Session;
dyon_post_guard();
Session::destroy();
Dyon\Http::json(['ok' => true]);
