<?php
require __DIR__ . '/_boot.php';
use Dyon\{Http, Geo};
Http::method('GET');
/* Country hint only. The IP is never logged, stored or returned. */
Http::json(['country' => Geo::country()], 200, ['Cache-Control' => 'private, max-age=3600', 'Vary' => 'CF-IPCountry']);
