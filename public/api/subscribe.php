<?php
require __DIR__ . '/_boot.php';
use Dyon\{Http, Csrf, RateLimit, Subscribers, I18n};
Http::method('POST');
if (!Csrf::sameOrigin()) Http::error(403, 'csrf', 'Cross-site request refused');
RateLimit::guard('subscribe', 10, 3600);
$in = Http::jsonBody(2048);
$loc = in_array($in['locale'] ?? '', I18n::LOCALES, true) ? $in['locale'] : I18n::detect(null, $_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? null);
/* Same answer whether or not the address was already known: no way to probe the list. */
if (Subscribers::submit($in, $loc) === 'invalid') Http::error(400, 'invalid', 'Check the address and choose at least one topic');
Http::json(['ok' => true, 'next' => 'check_email']);
