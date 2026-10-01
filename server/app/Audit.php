<?php
declare(strict_types=1);

namespace Sotr;

/** "Who did what, when" — shown to the owner in the panel later. */
final class Audit
{
    public static function log(?int $userId, string $action, string $detail = ''): void
    {
        try {
            Db::run(
                'INSERT INTO audit_log (user_id, action, detail, ip, created_at) VALUES (?, ?, ?, ?, ?)',
                [$userId, $action, $detail !== '' ? $detail : null, Http::ip(), Db::now()]
            );
        } catch (\Throwable) {
            // Logging must never break the request it describes.
        }
    }
}
