<?php
declare(strict_types=1);
namespace Dyon;

/** Thrown while delivering when a message must NOT be sent (unsubscribed, unknown template…). The queue row is cancelled, not retried. */
final class MailSkip extends \RuntimeException {}
