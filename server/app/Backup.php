<?php
declare(strict_types=1);

namespace Sotr;

/**
 * A readable backup of everything the owner would hate to lose: all content, publish history
 * (latest few), orders and messages. Passwords, 2-step secrets and recovery codes are NEVER included.
 * Used by the admin's "Download backup" button and by the nightly cron job (server/bin/backup.php).
 */
final class Backup
{
    /** @return array<string, mixed> */
    public static function snapshot(): array
    {
        Content::ensureSeeded();
        $content = [];
        foreach (Db::all('SELECT area, doc, rev, updated_at FROM content ORDER BY area') as $r) {
            $content[$r['area']] = ['rev' => (int) $r['rev'], 'updated_at' => $r['updated_at'], 'doc' => json_decode($r['doc'], true)];
        }
        $history = [];
        foreach (Db::all('SELECT id, note, created_at, snapshot FROM publishes ORDER BY id DESC LIMIT 5') as $r) {
            $history[] = ['id' => (int) $r['id'], 'note' => $r['note'], 'created_at' => $r['created_at'], 'snapshot' => json_decode($r['snapshot'], true)];
        }
        return [
            'about' => 'SheOnTheRun admin backup. Contains content, orders and messages — keep it private. Contains no passwords.',
            'created_at' => gmdate('c'),
            'content' => $content,
            'publish_history' => $history,
            'orders' => Db::all('SELECT * FROM orders ORDER BY id'),
            'messages' => Db::all('SELECT * FROM messages ORDER BY id'),
            'admins' => array_map(static fn ($u) => ['email' => $u['email'], 'created_at' => $u['created_at']], Db::all('SELECT email, created_at FROM users ORDER BY id')),
        ];
    }

    public static function json(): string
    {
        return json_encode(self::snapshot(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT | JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR);
    }

    /**
     * Write today's backup into $dir (created if needed, closed to the web) and keep the newest $keep.
     * @return string the file written
     */
    public static function writeTo(string $dir, int $keep = 14): string
    {
        if (!is_dir($dir) && !@mkdir($dir, 0700, true)) {
            throw new \RuntimeException("Can't create $dir");
        }
        @file_put_contents($dir . '/.htaccess', "Require all denied\n");
        $file = $dir . '/sotr-backup-' . gmdate('Y-m-d') . '.json';
        $tmp = $file . '.tmp';
        file_put_contents($tmp, self::json());
        @chmod($tmp, 0600);
        rename($tmp, $file);
        $all = glob($dir . '/sotr-backup-*.json') ?: [];
        rsort($all);
        foreach (array_slice($all, $keep) as $old) {
            @unlink($old);
        }
        return $file;
    }

    /** Where the nightly job writes: beside the config file, outside the web folder. */
    public static function defaultDir(): string
    {
        return dirname(SOTR_ROOT, 2) . '/sotr-backups';
    }
}
