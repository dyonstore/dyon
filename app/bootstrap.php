<?php
declare(strict_types=1);
/* DYON bootstrap: tiny PSR-4 autoloader for namespace Dyon\ -> /app. No framework. */

define('DYON_ROOT', dirname(__DIR__));
define('DYON_PUBLIC', DYON_ROOT . '/public');

spl_autoload_register(static function (string $class): void {
    if (strncmp($class, 'Dyon\\', 5) !== 0) return;
    $file = __DIR__ . '/' . str_replace('\\', '/', substr($class, 5)) . '.php';
    if (is_file($file)) require $file;
});

/* Vendor (PHPMailer etc.) lives in vendor-php/ because /vendor holds fonts/icons. */
if (is_file(DYON_ROOT . '/vendor-php/autoload.php')) require DYON_ROOT . '/vendor-php/autoload.php';
