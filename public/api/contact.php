<?php
require __DIR__ . '/_boot.php';
use Dyon\{Http, Csrf, RateLimit, Db, Mailer, Subscribers, I18n};
Http::method('POST');
if (!Csrf::sameOrigin()) Http::error(403, 'csrf', 'Cross-site request refused');
RateLimit::guard('contact', 5, 3600);
$in = Http::jsonBody(12000);
if (trim((string)($in['website'] ?? '')) !== '') Http::json(['ok' => true]);          // honeypot
$email = Subscribers::normaliseEmail((string)($in['email'] ?? ''));
$msg = trim((string)($in['message'] ?? ''));
$name = mb_substr(trim((string)($in['name'] ?? '')), 0, 80);
$topic = in_array($in['topic'] ?? '', ['general', 'bug', 'privacy', 'press', 'partner'], true) ? $in['topic'] : 'general';
$len = mb_strlen($msg);
if ($email === null || $len < 5 || $len > 5000) Http::error(400, 'invalid', 'Check the address and the message');
$loc = in_array($in['locale'] ?? '', I18n::LOCALES, true) ? $in['locale'] : I18n::detect(null, $_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? null);
Db::system()->exec('INSERT INTO contact_messages(name,email,topic,message,locale,created_at) VALUES(?,?,?,?,?,?)', [$name, $email, $topic, $msg, $loc, time()]);
Mailer::queue($email, 'contact_received', $loc, ['name' => Mailer::firstName($name)]);
Http::json(['ok' => true]);
