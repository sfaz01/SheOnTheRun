<?php
declare(strict_types=1);

namespace Sotr;

/** Time-based one-time passwords (RFC 6238) — the 6-digit codes from Google Authenticator, Authy, 1Password, etc. */
final class Totp
{
    private const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    public const PERIOD = 30;

    public static function generateSecret(): string
    {
        return self::base32Encode(random_bytes(20)); // 160 bits
    }

    public static function uri(string $email, string $secret, string $issuer = 'SheOnTheRun'): string
    {
        return 'otpauth://totp/' . rawurlencode($issuer . ':' . $email)
            . '?secret=' . $secret . '&issuer=' . rawurlencode($issuer) . '&algorithm=SHA1&digits=6&period=' . self::PERIOD;
    }

    public static function code(string $secret, int $step, int $digits = 6): string
    {
        $key = self::base32Decode($secret);
        $hash = hash_hmac('sha1', pack('J', $step), $key, true);
        $offset = ord($hash[19]) & 0x0F;
        $bin = ((ord($hash[$offset]) & 0x7F) << 24)
            | (ord($hash[$offset + 1]) << 16)
            | (ord($hash[$offset + 2]) << 8)
            | ord($hash[$offset + 3]);
        return str_pad((string) ($bin % (10 ** $digits)), $digits, '0', STR_PAD_LEFT);
    }

    /**
     * Returns the matching time step (to store, so the same code can't be used twice) or null.
     * Accepts one step either side to forgive a slightly wrong phone clock.
     */
    public static function verify(string $secret, string $input, int $lastUsedStep = 0, ?int $now = null): ?int
    {
        $input = preg_replace('/\s+/', '', $input) ?? '';
        if (!preg_match('/^\d{6}$/', $input)) {
            return null;
        }
        $current = intdiv($now ?? time(), self::PERIOD);
        for ($i = -1; $i <= 1; $i++) {
            $step = $current + $i;
            if ($step > $lastUsedStep && hash_equals(self::code($secret, $step), $input)) {
                return $step;
            }
        }
        return null;
    }

    public static function base32Encode(string $bytes): string
    {
        $bits = '';
        foreach (str_split($bytes) as $c) {
            $bits .= str_pad(decbin(ord($c)), 8, '0', STR_PAD_LEFT);
        }
        $out = '';
        foreach (str_split($bits, 5) as $chunk) {
            $out .= self::ALPHABET[bindec(str_pad($chunk, 5, '0'))];
        }
        return $out;
    }

    public static function base32Decode(string $text): string
    {
        $bits = '';
        foreach (str_split(strtoupper(rtrim($text, '='))) as $c) {
            $pos = strpos(self::ALPHABET, $c);
            if ($pos === false) {
                continue;
            }
            $bits .= str_pad(decbin($pos), 5, '0', STR_PAD_LEFT);
        }
        $out = '';
        foreach (str_split($bits, 8) as $byte) {
            if (strlen($byte) === 8) {
                $out .= chr(bindec($byte));
            }
        }
        return $out;
    }
}
