<?php
/* Test helper: creates a user + session in DYON_DATA_DIR and prints {"sess","csrf"} (cookie values) for Playwright.
   Usage: DYON_DATA_DIR=… DYON_SECRET_KEY=… DYON_COOKIE_SECURE=0 php scripts/e2e-session.php [sub] */
require dirname(__DIR__) . '/app/bootstrap.php';
use Dyon\{Auth, Session, Crypto};
[$id] = Auth::upsertUser('google', $argv[1] ?? 'e2e-user', 'sam@example.org', 'Sam Lee', null);
$tok = Session::start($id);
echo json_encode(['sess' => $tok, 'csrf' => Crypto::randomToken(16), 'user' => $id]);
