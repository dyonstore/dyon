<?php
declare(strict_types=1);
namespace Dyon;

/** Newsletter subscribers: double opt-in, derived (never stored) tokens, per-stream preferences. GET never changes state — callers POST. */
final class Subscribers
{
    public const STREAMS = ['product', 'blog', 'events'];

    public static function normaliseEmail(string $e): ?string
    {
        $e = strtolower(trim($e));
        return $e !== '' && strlen($e) <= 254 && filter_var($e, FILTER_VALIDATE_EMAIL) ? $e : null;
    }

    /** @return string[] only known streams, de-duplicated, in canonical order */
    public static function cleanStreams(mixed $s): array
    {
        $s = is_array($s) ? $s : [];
        return array_values(array_intersect(self::STREAMS, array_map('strval', $s)));
    }

    public static function find(int $id): ?array { return Db::system()->one('SELECT * FROM subscribers WHERE id = ?', [$id]); }

    /** Token = "{id}.{mac}"; the mac covers purpose, id, email and a random salt held on the row. Nothing secret is stored. */
    public static function token(string $purpose, array $row): string
    {
        $salt = $purpose === 'confirm' ? (string)$row['confirm_hmac'] : (string)$row['unsub_hmac'];
        return $row['id'] . '.' . Crypto::hmac("$purpose|{$row['id']}|{$row['email']}|$salt", 'mail-token');
    }

    public static function verify(string $purpose, string $token): ?array
    {
        if (!preg_match('/^(\d{1,12})\.([A-Za-z0-9_-]{20,64})$/', $token, $m)) return null;
        $row = self::find((int)$m[1]);
        return $row && Crypto::constEq(self::token($purpose, $row), $token) ? $row : null;
    }

    /** Starts (or restarts) a double opt-in. Same outward result whatever the address's state, so the form cannot be used to probe who subscribes.
     *  @throws \InvalidArgumentException('email'|'streams') */
    public static function subscribe(string $email, string $locale, array $streams, ?string $country = null): void
    {
        $email = self::normaliseEmail($email) ?? throw new \InvalidArgumentException('email');
        $streams = self::cleanStreams($streams) ?: throw new \InvalidArgumentException('streams');
        $locale = in_array($locale, I18n::LOCALES, true) ? $locale : 'en';
        $db = Db::system(); $now = time();
        $row = $db->one('SELECT * FROM subscribers WHERE email = ?', [$email]);
        if ($row && ($row['status'] === 'active' || $row['status'] === 'bounced')) return;
        $salt = Crypto::randomToken(12);
        $recent = $row && (int)$db->val("SELECT COUNT(*) FROM email_queue WHERE to_email = ? AND template = 'subscribe_confirm' AND created_at > ?", [$email, $now - 600]) > 0;
        if ($row) {
            // a link already mailed in the last 10 minutes must keep working: only rotate the salt when a fresh mail goes out
            $db->exec("UPDATE subscribers SET status='pending', streams=?, locale=?, confirm_hmac=? WHERE id=?", [json_encode($streams), $locale, $recent ? $row['confirm_hmac'] : $salt, $row['id']]);
            $id = (int)$row['id'];
        } else {
            $db->exec("INSERT INTO subscribers(email, locale, country, streams, status, confirm_hmac, unsub_hmac, created_at) VALUES(?,?,?,?, 'pending', ?, ?, ?)",
                [$email, $locale, $country, json_encode($streams), $salt, Crypto::randomToken(12), $now]);
            $id = $db->lastId();
        }
        // at most one confirmation mail per address every 10 minutes
        if ((int)$db->val("SELECT COUNT(*) FROM email_queue WHERE to_email = ? AND template = 'subscribe_confirm' AND created_at > ?", [$email, $now - 600]) === 0)
            Mailer::queue($email, 'subscribe_confirm', $locale, ['sub_id' => $id], 'account');
    }

    /** Public entry for the form and the JSON endpoint: honeypot + per-address throttle, then subscribe(). Returns 'ok' or 'invalid'. */
    public static function submit(array $in, string $locale): string
    {
        if (trim((string)($in['website'] ?? '')) !== '') return 'ok';                       // honeypot: bots fill it; humans never see it
        $email = self::normaliseEmail((string)($in['email'] ?? ''));
        if ($email === null) return 'invalid';
        $streams = $in['streams'] ?? [];
        $streams = is_array($streams) ? $streams : [$streams];
        if (!self::cleanStreams($streams)) return 'invalid';
        $r = RateLimit::hit('subscribe-email:' . Crypto::hmac($email, 'rate'), 3, 86400);
        if (!$r['ok']) return 'ok';                                                          // silent: no signal to a prober
        $loc = in_array($in['locale'] ?? '', I18n::LOCALES, true) ? $in['locale'] : $locale;
        self::subscribe($email, $loc, $streams);
        return 'ok';
    }

    /** @return array|null the active row, or null when the token is stale / the person is not pending */
    public static function confirm(string $token): ?array
    {
        $row = self::verify('confirm', $token);
        if (!$row) return null;
        if ($row['status'] === 'active') return $row;
        if ($row['status'] !== 'pending') return null;
        Db::system()->exec("UPDATE subscribers SET status='active', confirmed_at=? WHERE id=?", [time(), $row['id']]);
        Mailer::queue($row['email'], 'subscribe_welcome', $row['locale'], ['sub_id' => (int)$row['id']], 'account');
        return self::find((int)$row['id']);
    }

    public static function unsubscribeAll(int $id, bool $confirmationMail = false): void
    {
        $db = Db::system(); $row = self::find($id); if (!$row) return;
        $was = $row['status'];
        $db->exec("UPDATE subscribers SET status='unsubscribed', streams='[]' WHERE id=?", [$id]);
        self::cancelBulk($row['email']);
        if ($confirmationMail && $was === 'active') Mailer::queue($row['email'], 'unsubscribe_done', $row['locale'], ['sub_id' => $id], 'account');
    }

    /** Preference centre: keeps only the chosen streams; none left = unsubscribed. */
    public static function setStreams(int $id, array $streams): void
    {
        $row = self::find($id); if (!$row || $row['status'] !== 'active') return;
        $streams = self::cleanStreams($streams);
        if (!$streams) { self::unsubscribeAll($id); return; }
        Db::system()->exec('UPDATE subscribers SET streams=? WHERE id=?', [json_encode($streams), $id]);
        self::cancelBulk($row['email'], $streams);
    }

    /** Queued non-transactional mail is cancelled the moment someone opts out of its stream. */
    private static function cancelBulk(string $email, array $keep = []): void
    {
        $db = Db::system();
        foreach (Mailer::TEMPLATES as $name => $t) {
            if (empty($t['bulk']) || in_array($t['sub_stream'], $keep, true)) continue;
            $db->exec("UPDATE email_queue SET status='cancelled' WHERE status='queued' AND to_email=? AND template=?", [$email, $name]);
        }
    }

    /** Active subscribers of a stream (optionally one locale), for broadcasts. */
    public static function activeFor(string $stream, ?string $locale = null): array
    {
        $rows = Db::system()->all("SELECT * FROM subscribers WHERE status='active'" . ($locale ? ' AND locale = ?' : ''), $locale ? [$locale] : []);
        return array_values(array_filter($rows, fn($r) => in_array($stream, json_decode((string)$r['streams'], true) ?: [], true)));
    }
}
