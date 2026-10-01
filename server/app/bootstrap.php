<?php
/* =============================================================================
   BOOTSTRAP — loads the small set of classes the admin backend needs.
   No framework, no Composer: everything is a plain file in this folder.
   ========================================================================== */
declare(strict_types=1);

namespace Sotr;

if (PHP_VERSION_ID < 80100) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'PHP 8.1 or newer is required.']);
    exit;
}

define('SOTR_ROOT', dirname(__DIR__)); // …/server

foreach (['Config', 'Db', 'Migrator', 'HttpError', 'Http', 'Totp', 'RateLimit', 'Audit', 'Auth', 'ServerCheck'] as $class) {
    require_once __DIR__ . '/' . $class . '.php';
}

mb_internal_encoding('UTF-8');
date_default_timezone_set('UTC'); // everything is stored in UTC; the UI converts to Beirut time
