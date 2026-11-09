<?php
declare(strict_types=1);
namespace Dyon;

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailException;

/** Outgoing mail. Everything goes through `email_queue`; cron/send-mail.php drains it. Copy comes from the locale files (ICU), layout from templates/email/layout.php.
 *  Never addresses a third party named in a ledger: recipients are only account holders, subscribers, and people who wrote to us. */
final class Mailer
{
    public const MAX_ATTEMPTS = 5;

    /** stream: queue stream; bulk: non-transactional (needs an active subscription + List-Unsubscribe); sub_stream: subscription stream it belongs to; cta: [url builder key, label key]. */
    public const TEMPLATES = [
        'subscribe_confirm' => ['stream' => 'account',    'bulk' => false, 'sub_stream' => null,     'cta' => 'confirm_url', 'cta_label' => 'mail.cta_confirm'],
        'subscribe_welcome' => ['stream' => 'account',    'bulk' => false, 'sub_stream' => null,     'cta' => 'manage_url',  'cta_label' => 'mail.cta_manage'],
        'unsubscribe_done'  => ['stream' => 'account',    'bulk' => false, 'sub_stream' => null,     'cta' => 'subscribe_url', 'cta_label' => 'mail.cta_resubscribe'],
        'signin_new_device' => ['stream' => 'account',    'bulk' => false, 'sub_stream' => null,     'cta' => 'devices_url', 'cta_label' => 'mail.cta_devices'],
        'sync_enabled'      => ['stream' => 'account',    'bulk' => false, 'sub_stream' => null,     'cta' => 'devices_url', 'cta_label' => 'mail.cta_devices'],
        'sync_device_added' => ['stream' => 'account',    'bulk' => false, 'sub_stream' => null,     'cta' => 'devices_url', 'cta_label' => 'mail.cta_devices'],
        'sync_wiped'        => ['stream' => 'account',    'bulk' => false, 'sub_stream' => null,     'cta' => 'devices_url', 'cta_label' => 'mail.cta_devices'],
        'account_deleted'   => ['stream' => 'account',    'bulk' => false, 'sub_stream' => null,     'cta' => null,          'cta_label' => null],
        'export_reminder'   => ['stream' => 'notify',     'bulk' => true,  'sub_stream' => 'product', 'cta' => 'data_url',   'cta_label' => 'mail.cta_data'],
        'contact_received'  => ['stream' => 'contact',    'bulk' => false, 'sub_stream' => null,     'cta' => null,          'cta_label' => null],
        'contact_reply'     => ['stream' => 'contact',    'bulk' => false, 'sub_stream' => null,     'cta' => null,          'cta_label' => null],
        'digest_blog'       => ['stream' => 'newsletter', 'bulk' => true,  'sub_stream' => 'blog',   'cta' => 'url',         'cta_label' => 'mail.cta_read'],
        'event_reminder'    => ['stream' => 'notify',     'bulk' => true,  'sub_stream' => 'events', 'cta' => 'url',         'cta_label' => 'mail.cta_event'],
    ];

    /* ---------- queue ---------- */

    public static function queue(string $to, string $template, string $locale = 'en', array $vars = [], ?string $stream = null, ?int $now = null): int
    {
        $spec = self::TEMPLATES[$template] ?? throw new \InvalidArgumentException("unknown template $template");
        $to = Subscribers::normaliseEmail($to) ?? throw new \InvalidArgumentException('bad recipient');
        $locale = in_array($locale, I18n::LOCALES, true) ? $locale : 'en';
        $json = json_encode($vars, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false || strlen($json) > 20000) throw new \InvalidArgumentException('vars too large');
        $now ??= time();
        $db = Db::system();
        $db->exec('INSERT INTO email_queue(to_email, template, locale, vars, stream, status, attempts, next_try_at, created_at) VALUES(?,?,?,?,?,?,0,?,?)',
            [$to, $template, $locale, $json, $spec['stream'], 'queued', $now, $now]);
        return $db->lastId();
    }

    /** Queue a message for a signed-in account holder (their own address only). Silent when they have no address. */
    public static function toUser(int $uid, string $template, array $vars = []): ?int
    {
        $u = Db::system()->one('SELECT email, name, locale FROM users WHERE id = ? AND deleted_at IS NULL', [$uid]);
        if (!$u || !$u['email'] || Subscribers::normaliseEmail((string)$u['email']) === null) return null;
        $loc = in_array($u['locale'], I18n::LOCALES, true) ? $u['locale'] : I18n::detect(null, $_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? null);
        return self::queue((string)$u['email'], $template, $loc, $vars + ['name' => self::firstName((string)$u['name'])]);
    }

    public static function firstName(string $n): string { $n = trim(preg_split('/\s+/u', trim($n))[0] ?? ''); return mb_substr($n, 0, 40); }

    /* ---------- links ---------- */

    public static function base(): string { return rtrim((string)Config::get('base_url', ''), '/'); }
    private static function lp(string $l): string { return $l === 'en' ? '' : '/' . $l; }

    /** Every link a template may use. Tokens are derived at send time, never stored in the queue. */
    private static function links(string $l, ?array $sub, array $vars): array
    {
        $b = self::base();
        $out = ['devices_url' => "$b/#/settings?s=devices", 'data_url' => "$b/#/settings?s=data", 'subscribe_url' => $b . self::lp($l) . '/subscribe'];
        if ($sub) {
            $out['confirm_url'] = $b . self::lp($l) . '/subscribe/confirm?t=' . rawurlencode(Subscribers::token('confirm', $sub));
            $out['manage_url'] = $b . self::lp($l) . '/unsubscribe?t=' . rawurlencode(Subscribers::token('unsub', $sub));
            $out['unsub_url'] = $b . '/unsubscribe?t=' . rawurlencode(Subscribers::token('unsub', $sub));      // locale-free: used for one-click POST
        }
        $u = (string)($vars['url'] ?? '');
        if ($u !== '' && str_starts_with($u, $b . '/')) $out['url'] = $u;                                    // only links back to us
        return $out;
    }

    /* ---------- render ---------- */

    /** @return array{subject:string,text:string,html:string,cta_url:?string} */
    public static function render(string $template, string $locale, array $vars = [], ?array $sub = null): array
    {
        $spec = self::TEMPLATES[$template] ?? throw new \InvalidArgumentException("unknown template $template");
        $l = in_array($locale, I18n::LOCALES, true) ? $locale : 'en';
        $t = static fn(string $k, array $v = []) => I18n::t($k, $v, $l);
        $links = self::links($l, $sub, $vars);
        $v = array_map(static fn($x) => is_scalar($x) ? (string)$x : '', $vars);
        if (($v['place'] ?? '') === '') $v['place'] = $t('mail.online');
        $v += ['name' => '', 'device' => '', 'provider' => '', 'when' => '', 'title' => '', 'summary' => '', 'where' => '', 'reply' => ''];
        if (isset($vars['days'])) $v['days'] = (int)$vars['days'];

        $subject = $t("mail.$template.subject");                 // static text: no variables, so never an amount
        $paras = array_values(array_filter(array_map('trim', explode("\n\n", $t("mail.$template.body", $v))), 'strlen'));
        $greeting = $v['name'] !== '' ? $t('mail.greeting', ['name' => $v['name']]) : '';
        $cta = $spec['cta'] !== null ? ($links[$spec['cta']] ?? null) : null;
        $ctaLabel = $cta && $spec['cta_label'] ? $t($spec['cta_label']) : null;
        $footer = $spec['bulk'] ? $t('mail.footer_bulk') : ($spec['stream'] === 'contact' ? $t('mail.footer_contact') : $t('mail.footer_account'));
        $manage = $spec['bulk'] && $sub ? ($links['manage_url'] ?? null) : null;

        $text = ($greeting !== '' ? $greeting . "\n\n" : '') . implode("\n\n", $paras) . "\n\n";
        if ($cta) $text .= $ctaLabel . ': ' . $cta . "\n\n";
        $text .= "--\nDYON\n" . $footer . "\n";
        if ($manage) $text .= $t('mail.manage_link') . ': ' . $manage . "\n";

        ob_start();
        $dir = I18n::dir($l); $lang = $l; $brand = 'DYON'; $heading = $subject; $manageLabel = $manage ? $t('mail.manage_link') : null;
        $e = static fn(string $s) => htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        include DYON_ROOT . '/templates/email/layout.php';
        $html = (string)ob_get_clean();
        return ['subject' => $subject, 'text' => $text, 'html' => $html, 'cta_url' => $cta];
    }

    /* ---------- build + deliver ---------- */

    /** Builds the PHPMailer message for a queue row; throws MailSkip when it must not be sent. */
    public static function build(array $row): MailMessage
    {
        $template = (string)$row['template'];
        $spec = self::TEMPLATES[$template] ?? throw new MailSkip('unknown template');
        $vars = json_decode((string)$row['vars'], true) ?: [];
        $sub = null;
        if (!empty($vars['sub_id'])) $sub = Subscribers::find((int)$vars['sub_id']);
        if ($spec['bulk']) {                                             // consent is checked at send time, not only at queue time
            $sub = Db::system()->one('SELECT * FROM subscribers WHERE email = ?', [$row['to_email']]);
            $streams = $sub ? (json_decode((string)$sub['streams'], true) ?: []) : [];
            if (!$sub || $sub['status'] !== 'active' || !in_array($spec['sub_stream'], $streams, true)) throw new MailSkip('not subscribed');
        }
        if ($template === 'subscribe_confirm' && (!$sub || $sub['status'] !== 'pending')) throw new MailSkip('nothing to confirm');
        $r = self::render($template, (string)$row['locale'], $vars, $sub);

        $smtp = (array)Config::get('smtp', []);
        $from = (string)($smtp['from'] ?? 'dyon@dyon.store');
        $m = new MailMessage(true);
        $m->CharSet = 'UTF-8'; $m->Encoding = PHPMailer::ENCODING_QUOTED_PRINTABLE; $m->XMailer = ' ';
        $m->setFrom($from, (string)($smtp['from_name'] ?? 'DYON'), false);
        $m->Sender = (string)($smtp['bounce'] ?? $from);
        $m->addAddress((string)$row['to_email']);
        $m->Subject = $r['subject']; $m->isHTML(true); $m->Body = $r['html']; $m->AltBody = $r['text'];
        $domain = substr(strrchr($from, '@') ?: '@dyon.store', 1);
        $m->MessageID = '<' . bin2hex(random_bytes(14)) . '@' . $domain . '>';
        $m->addCustomHeader('Auto-Submitted', 'auto-generated');
        $m->addCustomHeader('Content-Language', (string)$row['locale']);
        if ($spec['bulk'] && $sub) {
            $links = self::links((string)$row['locale'], $sub, $vars);
            $mailbox = (string)Config::get('unsubscribe_mailbox', 'unsubscribe@' . $domain);
            $token = Subscribers::token('unsub', $sub);
            $m->addRawHeader('List-Unsubscribe', '<' . $links['unsub_url'] . '>, <mailto:' . $mailbox . '?subject=' . rawurlencode('unsubscribe ' . $token) . '>');
            $m->addRawHeader('List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');
            $m->addCustomHeader('Precedence', 'bulk');
        }
        return $m;
    }

    /** Sends one row through the configured transport. Returns the Message-ID. */
    public static function deliver(array $row): string
    {
        $m = self::build($row);
        $transport = (string)Config::get('mail_transport', 'smtp');
        if ($transport === 'file') {
            $m->preSend();
            $dir = rtrim((string)Config::get('data_dir'), '/') . '/mail-out';
            if (!is_dir($dir)) mkdir($dir, 0700, true);
            $file = sprintf('%s/%d-%d-%s.eml', $dir, time(), $row['id'], bin2hex(random_bytes(3)));
            if (file_put_contents($file, $m->getSentMIMEMessage()) === false) throw new \RuntimeException('cannot write mail-out');
            return $m->getLastMessageID();
        }
        $s = (array)Config::get('smtp', []);
        if (trim((string)($s['host'] ?? '')) === '') throw new \RuntimeException('smtp host not configured');
        if (!in_array($s['secure'] ?? '', ['tls', 'ssl'], true)) throw new \RuntimeException('smtp: TLS is required (secure = tls|ssl)');
        $m->isSMTP(); $m->Host = (string)$s['host']; $m->Port = (int)($s['port'] ?? 587); $m->Timeout = 20;
        $m->SMTPSecure = $s['secure'] === 'ssl' ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
        $m->SMTPAutoTLS = true;
        if (($s['user'] ?? '') !== '') { $m->SMTPAuth = true; $m->Username = (string)$s['user']; $m->Password = (string)($s['pass'] ?? ''); }
        try { $m->send(); } catch (MailException $e) { throw new \RuntimeException($e->getMessage()); }
        return $m->getLastMessageID();
    }

    /* ---------- worker ---------- */

    /** Drains up to $batch due rows. $send(row): string is injectable for tests. @return array{sent:int,retry:int,failed:int,skipped:int} */
    public static function run(int $batch = 50, ?int $now = null, ?callable $send = null): array
    {
        $now ??= time(); $send ??= [self::class, 'deliver'];
        $db = Db::system(); $out = ['sent' => 0, 'retry' => 0, 'failed' => 0, 'skipped' => 0];
        $db->exec("UPDATE email_queue SET status='queued' WHERE status='sending' AND next_try_at < ?", [$now - 600]);       // a crashed worker never strands a message
        $rows = $db->all("SELECT * FROM email_queue WHERE status='queued' AND next_try_at <= ? ORDER BY id LIMIT ?", [$now, $batch]);
        foreach ($rows as $row) {
            if ($db->exec("UPDATE email_queue SET status='sending', next_try_at=? WHERE id=? AND status='queued'", [$now, $row['id']]) !== 1) continue;
            try {
                $id = $send($row);
                $db->exec("UPDATE email_queue SET status='sent', sent_at=?, attempts=attempts+1, last_error=NULL WHERE id=?", [$now, $row['id']]);
                $db->exec("INSERT INTO email_log(queue_id, status, smtp_id, at) VALUES(?, 'sent', ?, ?)", [$row['id'], $id, $now]);
                $out['sent']++;
            } catch (MailSkip $e) {
                $db->exec("UPDATE email_queue SET status='cancelled', last_error=? WHERE id=?", [$e->getMessage(), $row['id']]);
                $db->exec("INSERT INTO email_log(queue_id, status, error, at) VALUES(?, 'skipped', ?, ?)", [$row['id'], $e->getMessage(), $now]);
                $out['skipped']++;
            } catch (\Throwable $e) {
                $n = (int)$row['attempts'] + 1; $msg = substr($e->getMessage(), 0, 300);
                $final = $n >= self::MAX_ATTEMPTS;
                $db->exec('UPDATE email_queue SET status=?, attempts=?, next_try_at=?, last_error=? WHERE id=?',
                    [$final ? 'failed' : 'queued', $n, $now + self::backoff($n), $msg, $row['id']]);
                $db->exec("INSERT INTO email_log(queue_id, status, error, at) VALUES(?, ?, ?, ?)", [$row['id'], $final ? 'failed' : 'retry', $msg, $now]);
                $out[$final ? 'failed' : 'retry']++;
            }
        }
        return $out;
    }

    /** 1 min, 2, 4, 8… capped at a day. */
    public static function backoff(int $attempt): int { return min(86400, 60 * (2 ** max(0, $attempt - 1))); }
}
