<?php
/* Test helper: makes a user, issues a login code, prints {"code","pending","uid"} (pending = value of the dyon_pending cookie). */
require dirname(__DIR__) . '/app/bootstrap.php';
use Dyon\{Auth, Crypto, LoginCode};
[$id] = Auth::upsertUser('google', $argv[1] ?? 'verify-e2e', 'maher@example.org', 'Maher T', null);
$code = LoginCode::issue($id); Dyon\Mailer::run(5);
echo json_encode(['code' => $code, 'pending' => Crypto::sign(['uid' => $id, 'ret' => '/'], 600, 'pending'), 'uid' => $id]);
