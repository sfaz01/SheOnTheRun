<?php
/* Command line only. Writes a backup file and keeps the newest 14.
   Run nightly from hPanel → Advanced → Cron Jobs:
     php /home/<account>/domains/sheontherun.com/public_html/server/bin/backup.php
   Optional argument: a different folder to write into. */
declare(strict_types=1);

use Sotr\Backup;
use Sotr\Migrator;

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require dirname(__DIR__) . '/app/bootstrap.php';

Migrator::ensure();
$dir = $argv[1] ?? Backup::defaultDir();
try {
    $file = Backup::writeTo($dir);
    echo 'Backup written: ' . $file . ' (' . number_format((int) filesize($file)) . " bytes)\n";
} catch (Throwable $e) {
    fwrite(STDERR, 'Backup failed: ' . $e->getMessage() . "\n");
    exit(1);
}
