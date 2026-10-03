<?php
declare(strict_types=1);

namespace Sotr;

/** Request/response helpers, session setup and the CSRF / same-origin checks. */
final class Http
{
    private static ?array $body = null;

    public static function ip(): string
    {
        // REMOTE_ADDR only: X-Forwarded-For can be forged by anyone and would let an attacker dodge the lock-out.
        return substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
    }

    public static function isHttps(): bool
    {
        return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    }

    public static function sendHeaders(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: no-referrer');
        header('X-Frame-Options: DENY');
        header('X-Robots-Tag: noindex, nofollow');
    }

    public static function json(mixed $data, int $status = 200): never
    {
        http_response_code($status);
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    }

    /** The decoded JSON body (empty array for none). */
    public static function body(): array
    {
        if (self::$body !== null) {
            return self::$body;
        }
        $raw = file_get_contents('php://input');
        if ($raw === false || $raw === '') {
            return self::$body = [];
        }
        if (strlen($raw) > 1_000_000) {
            throw new HttpError(413, 'Request too large.');
        }
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            throw new HttpError(400, 'Invalid JSON.');
        }
        return self::$body = $data;
    }

    public static function str(string $key, int $max = 500): string
    {
        $v = self::body()[$key] ?? '';
        return is_string($v) ? mb_substr(trim($v), 0, $max) : '';
    }

    /** Secrets (passwords) must not be trimmed. */
    public static function raw(string $key, int $max = 1000): string
    {
        $v = self::body()[$key] ?? '';
        return is_string($v) ? mb_substr($v, 0, $max) : '';
    }

    public static function startSession(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }
        $dir = Config::storagePath('sessions');
        if (!is_dir($dir)) {
            @mkdir($dir, 0700, true);
        }
        session_save_path($dir);
        session_name('sotr_admin');
        session_cache_limiter(''); // keep our own Cache-Control: no-store
        session_set_cookie_params([
            'lifetime' => 0,
            'path'     => '/',
            'secure'   => !Config::isDev() || self::isHttps(),
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
        ini_set('session.use_strict_mode', '1');
        ini_set('session.gc_maxlifetime', (string) (Config::get('session.absolute_minutes') * 60));
        session_start();
    }

    /**
     * Every state-changing request must:
     *  - be JSON (a cross-site <form> cannot send that without a CORS preflight, which we never allow),
     *  - come from our own origin when the browser says where it came from, and
     *  - carry the CSRF token the session handed out.
     */
    public static function guardWrite(bool $multipart = false): void
    {
        if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            return;
        }
        $type = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
        if (!str_starts_with($type, $multipart ? 'multipart/form-data' : 'application/json')) {
            throw new HttpError(415, $multipart ? 'Send the photo as a form upload.' : 'Send JSON.');
        }
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if ($origin !== '') {
            $host = parse_url($origin, PHP_URL_HOST);
            $port = parse_url($origin, PHP_URL_PORT);
            $originHost = $host . ($port ? ':' . $port : '');
            $ownHost = (string) ($_SERVER['HTTP_HOST'] ?? '');
            if (!hash_equals(strtolower($ownHost), strtolower((string) $originHost))) {
                throw new HttpError(403, 'Cross-site request blocked.');
            }
        }
        $sent = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
        $have = (string) ($_SESSION['csrf'] ?? '');
        if ($have === '' || !hash_equals($have, $sent)) {
            throw new HttpError(403, 'Your session expired. Reload the page.', 'csrf');
        }
    }

    /**
     * Public forms (checkout, contact) have no session, so no CSRF token. They are protected by:
     * JSON only (a cross-site <form> can't send it and we never allow CORS), an Origin that must be
     * our own host, a hidden honeypot field, and rate limits.
     */
    public static function guardPublic(): void
    {
        $type = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
        if (!str_starts_with($type, 'application/json')) {
            throw new HttpError(415, 'Send JSON.');
        }
        $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
        if ($origin === '') {
            throw new HttpError(403, 'Cross-site request blocked.'); // browsers always send Origin on a JSON POST
        }
        $host = parse_url($origin, PHP_URL_HOST);
        $port = parse_url($origin, PHP_URL_PORT);
        $originHost = $host . ($port ? ':' . $port : '');
        if (!hash_equals(strtolower((string) ($_SERVER['HTTP_HOST'] ?? '')), strtolower((string) $originHost))) {
            throw new HttpError(403, 'Cross-site request blocked.');
        }
    }

    public static function csrfToken(): string
    {
        if (empty($_SESSION['csrf'])) {
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf'];
    }
}
