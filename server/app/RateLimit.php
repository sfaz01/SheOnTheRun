<?php
declare(strict_types=1);

namespace Sotr;

/** Lock-out after repeated failures, per account/step and per IP. Stored in login_attempts. */
final class RateLimit
{
    private const WINDOW_SECONDS = 900;   // 15 minutes
    private const MAX_PER_KEY = 5;
    private const MAX_PER_IP = 20;

    /** Throws 429 when the key or the IP has too many recent failures. */
    public static function check(string $key, string $ip): void
    {
        $since = Db::now(time() - self::WINDOW_SECONDS);
        $byKey = (int) (Db::one(
            'SELECT COUNT(*) AS n FROM login_attempts WHERE throttle_key = ? AND success = 0 AND created_at > ?',
            [$key, $since]
        )['n'] ?? 0);
        $byIp = (int) (Db::one(
            'SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND success = 0 AND created_at > ?',
            [$ip, $since]
        )['n'] ?? 0);
        if ($byKey >= self::MAX_PER_KEY || $byIp >= self::MAX_PER_IP) {
            throw new HttpError(
                429,
                'Too many attempts. Please wait 15 minutes and try again.',
                'locked',
                ['retry_after' => self::WINDOW_SECONDS]
            );
        }
    }

    public static function fail(string $key, string $ip): void
    {
        Db::run(
            'INSERT INTO login_attempts (throttle_key, ip, success, created_at) VALUES (?, ?, 0, ?)',
            [$key, $ip, Db::now()]
        );
    }

    /** A success wipes that key's failures. Old rows of any kind are tidied away. */
    public static function succeed(string $key): void
    {
        Db::run('DELETE FROM login_attempts WHERE throttle_key = ?', [$key]);
        Db::run('DELETE FROM login_attempts WHERE created_at < ?', [Db::now(time() - 86400)]);
    }
}
