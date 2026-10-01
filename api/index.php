<?php
/* =============================================================================
   API FRONT CONTROLLER — every /api/... request lands here (see .htaccess).
   ========================================================================== */
declare(strict_types=1);

use Sotr\Auth;
use Sotr\Config;
use Sotr\Db;
use Sotr\Http;
use Sotr\HttpError;
use Sotr\Migrator;
use Sotr\ServerCheck;

require_once dirname(__DIR__) . '/server/app/bootstrap.php';

Http::sendHeaders();

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $path = '/' . trim((string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH), '/');
    $path = preg_replace('#^/api#', '', $path) ?: '/';
    $path = '/' . trim($path, '/');

    if ($method === 'OPTIONS') {
        // Never allow cross-site calls: no CORS headers are ever sent.
        Http::json(['error' => 'Not allowed.'], 405);
    }

    Http::startSession();

    /* ------------------------------------------------------------ public */
    if ($method === 'GET' && $path === '/health') {
        $db = false;
        try {
            $db = (Db::one('SELECT 1 AS ok')['ok'] ?? 0) == 1;
        } catch (Throwable) {
        }
        Http::json(['ok' => true, 'db' => $db]);
    }

    Migrator::ensure();

    if ($method === 'GET' && $path === '/auth/state') {
        Http::json(Auth::state());
    }

    Http::guardWrite();

    switch ($method . ' ' . $path) {
        case 'POST /auth/setup':
            Http::json(Auth::setup(Http::str('token'), Http::str('email', 190), Http::raw('password')));

        case 'POST /auth/login':
            Http::json(Auth::login(Http::str('email', 190), Http::raw('password')));

        case 'POST /auth/2fa':
            Http::json(Auth::verifySecondStep(Http::str('code', 40)));

        case 'POST /auth/2fa/begin':
            Http::json(Auth::beginEnrollment());

        case 'POST /auth/2fa/enable':
            Http::json(Auth::finishEnrollment(Http::str('code', 20)));

        case 'POST /auth/logout':
            $user = Auth::currentUser();
            if ($user !== null) {
                \Sotr\Audit::log((int) $user['id'], 'logout');
            }
            Auth::destroySession();
            Http::json(['ok' => true]);

        /* ----------------------------------------------------- signed in */
        case 'POST /auth/password':
            $user = Auth::requireUser();
            Auth::changePassword($user, Http::raw('current'), Http::raw('new'));
            Http::json(['ok' => true]);

        case 'GET /admin/server-check':
            Auth::requireUser();
            Http::json(['checks' => ServerCheck::run()]);
    }

    throw new HttpError(404, 'Not found.');
} catch (HttpError $e) {
    Http::json(['error' => $e->getMessage(), 'code' => $e->errorCode] + $e->extra, $e->status);
} catch (PDOException $e) {
    error_log('[sotr] database error: ' . $e->getMessage());
    $detail = Config::isDev() ? ' (' . $e->getMessage() . ')' : '';
    Http::json(['error' => 'The database isn’t ready yet.' . $detail, 'code' => 'db'], 503);
} catch (Throwable $e) {
    error_log('[sotr] ' . $e::class . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    Http::json(['error' => 'Something went wrong on our side.'], 500);
}
