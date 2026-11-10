<?php
declare(strict_types=1);
/* DYON — root entry point for hosts whose document root is the project folder (not public/).
   Apache: .htaccess sends every request here that is not a real file under public/; this file serves the PWA shell
   (public/index.html) through the same gate that handles the admin path. Nothing outside public/ is ever served. */
require __DIR__ . '/public/gate.php';
