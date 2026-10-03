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
use Sotr\Journal;
use Sotr\Media;
use Sotr\Messages;
use Sotr\Migrator;
use Sotr\Orders;
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

    /* Public checkout — price recalculated server-side */
    if ($method === 'POST' && $path === '/orders') {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        RateLimit::check('order_' . $ip, $ip);
        $body = Http::body();
        Http::json(Orders::create($body), 201);
    }

    /* Public connect form submission */
    if ($method === 'POST' && $path === '/messages') {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        RateLimit::check('msg_' . $ip, $ip);
        $body = Http::body();
        Http::json(Messages::create($body), 201);
    }

    /* Media photo upload — multipart/form-data with CSRF check */
    if ($method === 'POST' && $path === '/admin/media/upload') {
        $user = Auth::requireUser();
        $sent = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
        $have = (string) ($_SESSION['csrf'] ?? '');
        if ($have === '' || !hash_equals($have, $sent)) {
            throw new HttpError(403, 'Your session expired. Reload the page.', 'csrf');
        }
        $file = $_FILES['file'] ?? [];
        $name = (string) ($_POST['name'] ?? '');
        $altEn = (string) ($_POST['alt'] ?? '');
        $altAr = isset($_POST['alt_ar']) ? (string) $_POST['alt_ar'] : null;
        Http::json(Media::upload($file, $name, $altEn, $altAr, (int) $user['id']), 201);
    }

    /* Orders CSV export (GET request by signed-in admin) */
    if ($method === 'GET' && $path === '/admin/orders/export') {
        Auth::requireUser();
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="sheontherun-orders-' . date('Y-m-d') . '.csv"');
        echo Orders::exportCsv();
        exit;
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

        case 'GET /admin/counts':
            Auth::requireUser();
            Content::ensureSeeded();
            Http::json([
                'orders' => Orders::counts(),
                'messages' => Messages::counts(),
                'status' => Content::status(),
            ]);

        /* --------------------------------------------------------- orders */
        case 'GET /admin/orders':
            Auth::requireUser();
            Http::json([
                'orders' => Orders::list($_GET),
                'counts' => Orders::counts(),
            ]);

        /* ------------------------------------------------------- messages */
        case 'GET /admin/messages':
            Auth::requireUser();
            Http::json([
                'messages' => Messages::list((string) ($_GET['status'] ?? 'all')),
                'counts' => Messages::counts(),
            ]);

        /* ---------------------------------------------------------- media */
        case 'GET /admin/media':
            Auth::requireUser();
            Http::json(['images' => Media::list()]);

        case 'GET /admin/gallery':
            Auth::requireUser();
            Http::json(Media::getGalleries());

        case 'PUT /admin/gallery':
            $user = Auth::requireUser();
            Http::json(Media::saveGalleries(Http::body(), (int) $user['id']));

        /* -------------------------------------------------------- journal */
        case 'GET /admin/journal':
            Auth::requireUser();
            Http::json(['posts' => Journal::list()]);

        case 'POST /admin/journal':
            $user = Auth::requireUser();
            Http::json(Journal::save(Http::body(), (int) $user['id']));

        /* --------------------------------------------------------- content */
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

    // Orders parameterized routes
    if (preg_match('#^/admin/orders/(\d+)$#', $path, $m)) {
        Auth::requireUser();
        if ($method === 'GET') {
            $order = Orders::get((int) $m[1]);
            if (!$order) throw new HttpError(404, 'Order not found.');
            Http::json($order);
        }
        if ($method === 'DELETE') {
            $user = Auth::requireUser();
            Orders::delete((int) $m[1], (int) $user['id']);
            Http::json(['ok' => true]);
        }
    }
    if ($method === 'PUT' && preg_match('#^/admin/orders/(\d+)/status$#', $path, $m)) {
        $user = Auth::requireUser();
        $b = Http::body();
        Http::json(Orders::updateStatus((int) $m[1], (string) ($b['status'] ?? ''), (int) $user['id']));
    }
    if ($method === 'PUT' && preg_match('#^/admin/orders/(\d+)/payment$#', $path, $m)) {
        $user = Auth::requireUser();
        $b = Http::body();
        Http::json(Orders::updatePayment((int) $m[1], (string) ($b['payment_status'] ?? ''), $b['payment_ref'] ?? null, (int) $user['id']));
    }
    if ($method === 'PUT' && preg_match('#^/admin/orders/(\d+)/notes$#', $path, $m)) {
        $user = Auth::requireUser();
        $b = Http::body();
        Http::json(Orders::updateNotes((int) $m[1], (string) ($b['notes'] ?? ''), (int) $user['id']));
    }

    // Messages parameterized routes
    if (preg_match('#^/admin/messages/(\d+)$#', $path, $m)) {
        Auth::requireUser();
        if ($method === 'GET') {
            $msg = Messages::get((int) $m[1]);
            if (!$msg) throw new HttpError(404, 'Message not found.');
            Http::json($msg);
        }
        if ($method === 'DELETE') {
            $user = Auth::requireUser();
            Messages::delete((int) $m[1], (int) $user['id']);
            Http::json(['ok' => true]);
        }
    }
    if ($method === 'PUT' && preg_match('#^/admin/messages/(\d+)/status$#', $path, $m)) {
        $user = Auth::requireUser();
        $b = Http::body();
        Http::json(Messages::updateStatus((int) $m[1], (string) ($b['status'] ?? ''), (int) $user['id']));
    }
    if ($method === 'PUT' && preg_match('#^/admin/messages/(\d+)/notes$#', $path, $m)) {
        $user = Auth::requireUser();
        $b = Http::body();
        Http::json(Messages::updateNotes((int) $m[1], (string) ($b['notes'] ?? ''), (int) $user['id']));
    }

    // Media item routes
    if (preg_match('#^/admin/media/([a-z0-9-_]+)$#', $path, $m)) {
        $user = Auth::requireUser();
        if ($method === 'PUT') {
            $b = Http::body();
            Http::json(Media::update($m[1], (string) ($b['alt'] ?? ''), $b['alt_ar'] ?? null, (int) $user['id']));
        }
        if ($method === 'DELETE') {
            Media::delete($m[1], (int) $user['id']);
            Http::json(['ok' => true]);
        }
    }

    // Journal item routes
    if (preg_match('#^/admin/journal/([a-z0-9-_]+)$#', $path, $m)) {
        Auth::requireUser();
        if ($method === 'GET') {
            $post = Journal::get($m[1]);
            if (!$post) throw new HttpError(404, 'Article not found.');
            Http::json($post);
        }
        if ($method === 'PUT') {
            $user = Auth::requireUser();
            $b = Http::body();
            $b['slug'] = $m[1];
            Http::json(Journal::save($b, (int) $user['id']));
        }
        if ($method === 'DELETE') {
            $user = Auth::requireUser();
            Journal::delete($m[1], (int) $user['id']);
            Http::json(['ok' => true]);
        }
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
    $msg = Config::isDev() ? ($e::class . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine()) : 'Something went wrong on our side.';
    Http::json(['error' => $msg], 500);
}
