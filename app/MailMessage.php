<?php
declare(strict_types=1);
namespace Dyon;

use PHPMailer\PHPMailer\PHPMailer;

/** PHPMailer RFC 2047-encodes long custom headers, which makes List-Unsubscribe unreadable to mail providers (RFC 2369/8058 need plain ASCII).
 *  Raw headers are ASCII-only (enforced) and folded after commas. */
final class MailMessage extends PHPMailer
{
    /** @var array<string,string> */
    private array $raw = [];

    public function addRawHeader(string $name, string $value): void
    {
        if (!preg_match('/^[A-Za-z-]+$/', $name) || preg_match('/[^\x20-\x7E]/', $value)) throw new \InvalidArgumentException('raw header must be ASCII');
        $this->raw[$name] = $value;
    }

    public function createHeader(): string
    {
        $h = parent::createHeader();
        foreach ($this->raw as $n => $v) $h .= $n . ': ' . str_replace(', ', ',' . static::$LE . ' ', $v) . static::$LE;
        return $h;
    }
}
