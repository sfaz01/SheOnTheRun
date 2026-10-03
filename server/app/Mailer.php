<?php
declare(strict_types=1);

namespace Sotr;

/**
 * Sends the owner's "new order" / "new message" emails. Uses the Hostinger mailbox over SMTP
 * (settings in sotr-config.php under 'mail'); falls back to PHP's mail() when only a From address
 * is set; does nothing if neither is configured. Never throws: a failed email must not fail an order.
 * Recipients are always chosen by the server from Site settings — never from anything a visitor sent.
 */
final class Mailer
{
    /** @return 'sent'|'failed'|'skipped' */
    public static function send(string $to, string $subject, string $body, ?string $replyTo = null): string
    {
        try {
            $from = self::addr((string) Config::get('mail.from', ''));
            $to = self::addr($to);
            if ($from === null || $to === null) {
                return 'skipped';
            }
            $reply = $replyTo !== null ? self::addr($replyTo) : null;
            $headers = [
                'From' => 'SheOnTheRun website <' . $from . '>',
                'To' => $to,
                'Subject' => '=?UTF-8?B?' . base64_encode(self::line($subject)) . '?=',
                'Date' => gmdate('D, d M Y H:i:s') . ' +0000',
                'Message-ID' => '<' . bin2hex(random_bytes(12)) . '@sheontherun.com>',
                'MIME-Version' => '1.0',
                'Content-Type' => 'text/plain; charset=UTF-8',
                'Content-Transfer-Encoding' => 'base64',
            ];
            if ($reply !== null) {
                $headers['Reply-To'] = $reply;
            }
            $payload = chunk_split(base64_encode(str_replace(["\r\n", "\r"], "\n", $body)), 76, "\r\n");

            if ((string) Config::get('mail.smtp_host', '') !== '') {
                return self::smtp($from, $to, $headers, $payload) ? 'sent' : 'failed';
            }
            $h = '';
            foreach ($headers as $k => $v) {
                if ($k !== 'To' && $k !== 'Subject') {
                    $h .= "$k: $v\r\n";
                }
            }
            return @mail($to, $headers['Subject'], $payload, rtrim($h)) ? 'sent' : 'failed';
        } catch (\Throwable $e) {
            error_log('[sotr] mail failed: ' . $e->getMessage());
            return 'failed';
        }
    }

    /** One clean header-safe line: no CR/LF, so nothing a visitor typed can add headers. */
    public static function line(string $s): string
    {
        return trim(preg_replace('/[\x00-\x1F\x7F]+/', ' ', $s) ?? '');
    }

    private static function addr(string $a): ?string
    {
        $a = trim($a);
        return $a !== '' && strlen($a) <= 190 && filter_var($a, FILTER_VALIDATE_EMAIL) !== false ? $a : null;
    }

    private static function smtp(string $from, string $to, array $headers, string $payload): bool
    {
        $host = (string) Config::get('mail.smtp_host');
        $port = (int) Config::get('mail.smtp_port', 465);
        $secure = (string) Config::get('mail.smtp_secure', $port === 465 ? 'ssl' : 'tls'); // ssl | tls | none
        $errno = 0;
        $errstr = '';
        $fp = @stream_socket_client(($secure === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port, $errno, $errstr, 10);
        if (!$fp) {
            error_log("[sotr] smtp connect failed: $errstr");
            return false;
        }
        stream_set_timeout($fp, 10);
        $read = static function () use ($fp): string {
            $out = '';
            while (($line = fgets($fp, 1024)) !== false) {
                $out .= $line;
                if (strlen($line) < 4 || $line[3] === ' ') {
                    break;
                }
            }
            return $out;
        };
        $cmd = static function (string $c, string $expect) use ($fp, $read): bool {
            fwrite($fp, $c . "\r\n");
            return str_starts_with($read(), $expect);
        };
        try {
            if (!str_starts_with($read(), '220')) {
                return false;
            }
            if (!$cmd('EHLO sheontherun.com', '250')) {
                return false;
            }
            if ($secure === 'tls') {
                if (!$cmd('STARTTLS', '220') || !stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT) || !$cmd('EHLO sheontherun.com', '250')) {
                    return false;
                }
            }
            $user = (string) Config::get('mail.smtp_user', '');
            if ($user !== '') {
                if (!$cmd('AUTH LOGIN', '334') || !$cmd(base64_encode($user), '334') || !$cmd(base64_encode((string) Config::get('mail.smtp_pass', '')), '235')) {
                    return false;
                }
            }
            if (!$cmd("MAIL FROM:<$from>", '250') || !$cmd("RCPT TO:<$to>", '250') || !$cmd('DATA', '354')) {
                return false;
            }
            $head = '';
            foreach ($headers as $k => $v) {
                $head .= "$k: $v\r\n";
            }
            fwrite($fp, $head . "\r\n" . $payload . "\r\n.\r\n"); // base64 body has no lines starting with "."
            $ok = str_starts_with($read(), '250');
            $cmd('QUIT', '221');
            return $ok;
        } finally {
            fclose($fp);
        }
    }
}
