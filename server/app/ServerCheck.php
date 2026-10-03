<?php
declare(strict_types=1);

namespace Sotr;

/**
 * "Is this hosting ready?" — answers the Phase 0 questions (PHP version, database, extensions,
 * writable folders, upload limits, HTTPS) from inside the admin, so nobody has to dig through hPanel.
 */
final class ServerCheck
{
    /** @return array<int, array{id:string,label:string,status:string,detail:string}> */
    public static function run(): array
    {
        $checks = [];
        $add = static function (string $id, string $label, string $status, string $detail) use (&$checks): void {
            $checks[] = ['id' => $id, 'label' => $label, 'status' => $status, 'detail' => $detail];
        };

        $add('php', 'PHP version', PHP_VERSION_ID >= 80100 ? 'ok' : 'fail', PHP_VERSION . ' (8.1 or newer needed)');

        $driver = Db::driver();
        try {
            $one = Db::one('SELECT 1 AS ok');
            $add('db', 'Database', ($one['ok'] ?? 0) == 1 ? 'ok' : 'fail', $driver . ' connected');
        } catch (\Throwable $e) {
            $add('db', 'Database', 'fail', $driver . ' — ' . (Config::isDev() ? $e->getMessage() : 'could not connect'));
        }

        $wanted = [
            'pdo'      => 'fail',
            'json'     => 'fail',
            'mbstring' => 'fail',
            'openssl'  => 'fail',
            'fileinfo' => 'warn',  // checking uploaded photos are really images
            'gd'       => 'fail',  // resizing uploaded photos
            'exif'     => 'warn',  // turning phone photos the right way up
            'dom'      => 'fail',  // cleaning article text
            'curl'     => 'warn',  // talking to payment gateways later
            'zip'      => 'warn',  // order/backup exports
        ];
        foreach ($wanted as $ext => $severity) {
            $has = extension_loaded($ext);
            $add('ext_' . $ext, 'Extension: ' . $ext, $has ? 'ok' : $severity, $has ? 'available' : 'missing');
        }
        $pdoDriver = $driver === 'sqlite' ? 'pdo_sqlite' : 'pdo_mysql';
        $add('ext_' . $pdoDriver, 'Extension: ' . $pdoDriver, extension_loaded($pdoDriver) ? 'ok' : 'fail', extension_loaded($pdoDriver) ? 'available' : 'missing');

        $add(
            'argon2',
            'Strong password hashing (Argon2id)',
            defined('PASSWORD_ARGON2ID') ? 'ok' : 'warn',
            defined('PASSWORD_ARGON2ID') ? 'available' : 'not available — bcrypt will be used instead (still safe)'
        );

        $root = Config::siteRoot();
        foreach ([
            'storage'       => Config::storagePath(),
            'data'          => $root . '/data',
            'journal'       => $root . '/journal',
            'photos'        => $root . '/public/images',
        ] as $name => $path) {
            $exists = is_dir($path);
            $add(
                'dir_' . $name,
                'Writable folder: ' . $name,
                $exists && is_writable($path) ? 'ok' : 'fail',
                $exists ? (is_writable($path) ? 'writable' : 'not writable') : 'folder not found'
            );
        }

        $free = @disk_free_space($root);
        if ($free !== false) {
            $gb = $free / 1073741824;
            $add('disk', 'Free disk space', $gb >= 1 ? 'ok' : 'warn', number_format($gb, 1) . ' GB');
        }

        $add('memory', 'PHP memory limit', 'ok', (string) ini_get('memory_limit'));
        $add('upload', 'Largest photo upload', self::bytes((string) ini_get('upload_max_filesize')) >= 8 * 1048576 ? 'ok' : 'warn', ini_get('upload_max_filesize') . ' (post limit ' . ini_get('post_max_size') . ')');
        $add('https', 'HTTPS', Http::isHttps() ? 'ok' : (Config::isDev() ? 'warn' : 'fail'), Http::isHttps() ? 'connection is secure' : 'this page was reached without HTTPS');
        $mailOk = (string) Config::get('mail.smtp_host') !== '' && (string) Config::get('mail.from') !== '';
        $add('mail', 'Email sending (order alerts)', $mailOk ? 'ok' : 'warn', $mailOk ? 'SMTP settings present' : 'SMTP not configured yet (needed in phase 3)');
        $add('config', 'Config file', Config::configFilePath() !== null ? 'ok' : 'warn', Config::configFilePath() !== null ? 'found outside or inside server/' : 'none found, using defaults');

        return $checks;
    }

    private static function bytes(string $v): int
    {
        $v = trim($v);
        $n = (int) $v;
        return match (strtolower(substr($v, -1))) {
            'g' => $n * 1073741824,
            'm' => $n * 1048576,
            'k' => $n * 1024,
            default => $n,
        };
    }
}
