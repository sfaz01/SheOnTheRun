<?php
/* =============================================================================
   API FRONT CONTROLLER — every /api/... request lands here (see .htaccess).
   ========================================================================== */
declare(strict_types=1);

use Sotr\Accounts;
use Sotr\Auth;
use Sotr\Content;
use Sotr\Config;
use Sotr\Db;
use Sotr\Http;
use Sotr\HttpError;
use Sotr\Messages;
use Sotr\Migrator;
use Sotr\Orders;
use Sotr\Photos;
use Sotr\RateLimit;
use Sotr\Schema;
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

    /* Public forms (no sign-in): JSON + same-origin + honeypot + rate limits. */
    if ($method === 'POST' && ($path === '/orders' || $path === '/messages')) {
        Http::guardPublic();
        $ip = Http::ip();
        $limits = (array) Config::get('limits', []);
        if ($path === '/orders') {
            RateLimit::throttle('public:orders', $ip, (int) ($limits['orders_per_hour'] ?? 5));
            Http::json(['ok' => true] + Orders::create(Http::body()), 201);
        }
        RateLimit::throttle('public:messages', $ip, (int) ($limits['messages_per_hour'] ?? 5));
        Http::json(Messages::create(Http::body()), 201);
    }

    if ($method === 'GET' && $path === '/admin/orders/export') {
        Auth::requireUser();
        header_remove('Content-Type');
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="sheontherun-orders-' . gmdate('Y-m-d') . '.csv"');
        $out = fopen('php://output', 'w');
        Orders::exportCsv($out);
        exit;
    }

    // Photo upload is the one multipart request; it gets the same origin + CSRF checks as every write.
    if ($method === 'POST' && $path === '/admin/photos') {
        $user = Auth::requireUser();
        Http::guardWrite(true);
        Content::ensureSeeded();
        $file = $_FILES['file'] ?? [];
        Http::json(Photos::upload(
            is_array($file) ? $file : [],
            (string) ($_POST['name'] ?? ''),
            (string) ($_POST['alt'] ?? ''),
            (string) ($_POST['alt_ar'] ?? ''),
            (string) ($_POST['replace'] ?? ''),
            (int) $user['id']
        ), 201);
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

        case 'POST /auth/email':
            $user = Auth::requireUser();
            Accounts::changeEmail($user, Http::raw('password'), Http::str('email', 190));
            Http::json(['ok' => true]);

        case 'POST /auth/invite/accept':
            Http::json(Accounts::acceptInvite(Http::str('email', 190), Http::str('code', 40), Http::raw('password')));

        case 'GET /admin/server-check':
            Auth::requireUser();
            Http::json(['checks' => ServerCheck::run()]);

        /* --------------------------------------------------------- content */
        case 'GET /admin/counts':
            Auth::requireUser();
            Http::json(['orders_new' => Orders::counts()['new'], 'messages_unread' => Messages::counts()['unread']]);

        case 'GET /admin/orders':
            Auth::requireUser();
            Http::json(Orders::list((string) ($_GET['status'] ?? ''), (string) ($_GET['q'] ?? ''), (int) ($_GET['page'] ?? 1)));

        case 'GET /admin/messages':
            Auth::requireUser();
            Http::json(Messages::list((string) ($_GET['status'] ?? ''), (int) ($_GET['page'] ?? 1)));

        case 'GET /admin/photos':
            Auth::requireUser();
            Content::ensureSeeded();
            Http::json(['photos' => Photos::list()]);

        case 'GET /admin/schema':
            Auth::requireUser();
            Content::ensureSeeded();
            Http::json(['areas' => Schema::forClient(), 'images' => Content::get('images')['doc']['items'] ?? []]);

        case 'GET /admin/status':
            Auth::requireUser();
            Content::ensureSeeded();
            Http::json(Content::status());

        case 'POST /admin/publish':
            $user = Auth::requireUser();
            Http::json(Content::publish((int) $user['id'], Http::str('note', 200)));

        case 'GET /admin/history':
            Auth::requireUser();
            Http::json(['versions' => Content::history()]);

        case 'POST /admin/discard':
            $user = Auth::requireUser();
            Content::discard((int) $user['id']);
            Http::json(['ok' => true]);

        /* ---------------------------------------------------------- admins */
        case 'GET /admin/admins':
            $user = Auth::requireUser();
            Http::json(Accounts::list((int) $user['id']));

        case 'POST /admin/admins/invite':
            $user = Auth::requireUser();
            Http::json(Accounts::invite($user, Http::str('email', 190)));
    }

    // Content area routes
    if (preg_match('#^/admin/content/([a-z]+)$#', $path, $m)) {
        $user = Auth::requireUser();
        Content::ensureSeeded();
        if ($method === 'GET') {
            Http::json(Content::get($m[1]));
        }
        if ($method === 'PUT') {
            $body = Http::body();
            Http::json(Content::save($m[1], $body['doc'] ?? null, (int) ($body['rev'] ?? 0), (int) $user['id']));
        }
    }
    if (preg_match('#^/admin/photos/([a-z0-9-]+)$#', $path, $m)) {
        $user = Auth::requireUser();
        Content::ensureSeeded();
        if ($method === 'PUT') {
            $b = Http::body();
            Http::json(Photos::update($m[1], (string) ($b['alt'] ?? ''), (string) ($b['alt_ar'] ?? ''), (int) $user['id']));
        }
        if ($method === 'DELETE') {
            Photos::delete($m[1], (int) $user['id']);
            Http::json(['ok' => true]);
        }
    }
    if (preg_match('#^/admin/orders/(\d+)(?:/(status|payment|notes))?$#', $path, $m)) {
        $user = Auth::requireUser();
        $id = (int) $m[1];
        $part = $m[2] ?? '';
        if ($part === '' && $method === 'GET') {
            Http::json(Orders::get($id));
        }
        if ($part === '' && $method === 'DELETE') {
            Orders::delete($id, (int) $user['id']);
            Http::json(['ok' => true]);
        }
        if ($part === 'status' && $method === 'PUT') {
            Http::json(Orders::setStatus($id, Http::str('status', 30), (int) $user['id']));
        }
        if ($part === 'payment' && $method === 'PUT') {
            Http::json(Orders::setPayment($id, Http::str('payment_status', 10), Http::str('payment_ref', 100), (int) $user['id']));
        }
        if ($part === 'notes' && $method === 'PUT') {
            Http::json(Orders::setNotes($id, Http::raw('notes', 2000), (int) $user['id']));
        }
    }
    if (preg_match('#^/admin/messages/(\d+)(?:/(status|notes))?$#', $path, $m)) {
        $user = Auth::requireUser();
        $id = (int) $m[1];
        $part = $m[2] ?? '';
        if ($part === '' && $method === 'DELETE') {
            Messages::delete($id, (int) $user['id']);
            Http::json(['ok' => true]);
        }
        if ($part === 'status' && $method === 'PUT') {
            Http::json(Messages::setStatus($id, Http::str('status', 30), (int) $user['id']));
        }
        if ($part === 'notes' && $method === 'PUT') {
            Http::json(Messages::setNotes($id, Http::raw('notes', 2000), (int) $user['id']));
        }
    }
    if ($method === 'POST' && preg_match('#^/admin/history/(\d+)/restore$#', $path, $m)) {
        $user = Auth::requireUser();
        Content::restore((int) $m[1], (int) $user['id']);
        Http::json(['ok' => true]);
    }
    if ($method === 'POST' && preg_match('#^/admin/admins/(\d+)/remove$#', $path, $m)) {
        $user = Auth::requireUser();
        Accounts::remove($user, (int) $m[1]);
        Http::json(['ok' => true]);
    }
    if ($method === 'POST' && preg_match('#^/admin/invites/(\d+)/cancel$#', $path, $m)) {
        $user = Auth::requireUser();
        Accounts::cancelInvite($user, (int) $m[1]);
        Http::json(['ok' => true]);
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
