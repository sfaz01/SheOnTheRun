<?php
/* Command line only. Creates an admin, or resets an existing admin's password AND two-step setup.
   Usage (over SSH):   php server/bin/create-admin.php you@example.com 'a long passphrase here'
   Use this if she is ever locked out and has lost her recovery codes. */
declare(strict_types=1);

use Sotr\Auth;
use Sotr\Db;
use Sotr\Migrator;

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require dirname(__DIR__) . '/app/bootstrap.php';

[$script, $email, $password] = $argv + [null, null, null];
if (!$email || !$password) {
    fwrite(STDERR, "Usage: php server/bin/create-admin.php EMAIL PASSWORD\n");
    exit(1);
}
$email = mb_strtolower($email);
if (!Auth::validEmail($email)) {
    fwrite(STDERR, "That email address isn't valid.\n");
    exit(1);
}
if (($problem = Auth::passwordProblem($password, $email)) !== null) {
    fwrite(STDERR, $problem . "\n");
    exit(1);
}

Migrator::ensure();
$existing = Db::one('SELECT id FROM users WHERE email = ?', [$email]);
if ($existing) {
    Db::run(
        'UPDATE users SET password_hash = ?, totp_secret = NULL, totp_enabled = 0, totp_last_step = 0 WHERE id = ?',
        [Auth::hashPassword($password), $existing['id']]
    );
    Db::run('DELETE FROM recovery_codes WHERE user_id = ?', [$existing['id']]);
    Db::run('DELETE FROM login_attempts');
    echo "Password reset for $email. They will set up the authenticator app again at next sign-in.\n";
} else {
    Auth::createAdmin($email, $password);
    echo "Admin created: $email. They will set up the authenticator app at first sign-in.\n";
}
