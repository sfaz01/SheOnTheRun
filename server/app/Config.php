<?php
declare(strict_types=1);

namespace Sotr;

/**
 * Reads the secrets/config file. It is looked for, in order:
 *   1. the path in the SOTR_CONFIG environment variable (local development, tests)
 *   2. two folders above server/ — i.e. beside public_html, OUTSIDE the web root (best)
 *   3. server/config.php (fallback; the folder is blocked from the web by .htaccess)
 */
final class Config
{
    private static ?array $data = null;

    private const DEFAULTS = [
        'env'          => 'production',   // 'dev' relaxes the Secure-cookie rule for http://localhost
        'app_url'      => 'https://sheontherun.com',
        'setup_token'  => '',             // one-time token that allows creating the first admin
        'db'           => [
            'driver'   => 'mysql',        // 'mysql' (Hostinger) or 'sqlite' (local development)
            'host'     => 'localhost',
            'name'     => '',
            'user'     => '',
            'pass'     => '',
            'path'     => '',             // sqlite file; defaults to server/storage/app.sqlite
        ],
        'site_root'    => '',             // the folder the website lives in; defaults to the folder above server/
        'session'      => [
            'idle_minutes'     => 720,    // 12 hours without activity
            'absolute_minutes' => 10080,  // 7 days, then log in again
        ],
        'mail'         => [
            'from'      => '',
            'smtp_host' => '',
            'smtp_port' => 465,
            'smtp_user' => '',
            'smtp_pass' => '',
        ],
    ];

    public static function load(?array $override = null): void
    {
        $loaded = $override ?? self::readFile();
        self::$data = self::merge(self::DEFAULTS, $loaded);
    }

    /** Dotted lookup: Config::get('db.driver'). */
    public static function get(string $key, mixed $default = null): mixed
    {
        if (self::$data === null) {
            self::load();
        }
        $node = self::$data;
        foreach (explode('.', $key) as $part) {
            if (!is_array($node) || !array_key_exists($part, $node)) {
                return $default;
            }
            $node = $node[$part];
        }
        return $node;
    }

    public static function isDev(): bool
    {
        return self::get('env') === 'dev';
    }

    public static function siteRoot(): string
    {
        $root = (string) self::get('site_root', '');
        return $root !== '' ? rtrim($root, '/\\') : dirname(SOTR_ROOT);
    }

    public static function storagePath(string $sub = ''): string
    {
        return SOTR_ROOT . '/storage' . ($sub !== '' ? '/' . ltrim($sub, '/') : '');
    }

    public static function configFilePath(): ?string
    {
        foreach (self::candidates() as $path) {
            if (is_file($path)) {
                return $path;
            }
        }
        return null;
    }

    /** @return string[] */
    private static function candidates(): array
    {
        $list = [];
        $env = getenv('SOTR_CONFIG');
        if (is_string($env) && $env !== '') {
            $list[] = $env;
        }
        $list[] = dirname(SOTR_ROOT, 2) . '/sotr-config.php';
        $list[] = SOTR_ROOT . '/config.php';
        return $list;
    }

    private static function readFile(): array
    {
        $path = self::configFilePath();
        if ($path === null) {
            return [];
        }
        $cfg = require $path;
        return is_array($cfg) ? $cfg : [];
    }

    private static function merge(array $base, array $over): array
    {
        foreach ($over as $k => $v) {
            if (is_array($v) && isset($base[$k]) && is_array($base[$k])) {
                $base[$k] = self::merge($base[$k], $v);
            } else {
                $base[$k] = $v;
            }
        }
        return $base;
    }
}
