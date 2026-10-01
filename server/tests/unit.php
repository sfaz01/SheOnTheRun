<?php
/* Plain PHP unit checks:  php server/tests/unit.php   (exits non-zero on any failure) */
declare(strict_types=1);

use Sotr\Auth;
use Sotr\Config;
use Sotr\Db;
use Sotr\Migrator;
use Sotr\Totp;

require dirname(__DIR__) . '/app/bootstrap.php';

$failures = 0;
function check(string $name, bool $ok): void
{
    global $failures;
    echo ($ok ? '  ok   ' : '  FAIL ') . $name . "\n";
    if (!$ok) {
        $failures++;
    }
}

/* ---- TOTP against the RFC 6238 test vectors (SHA-1, secret "12345678901234567890") */
$secret = Totp::base32Encode('12345678901234567890');
check('base32 encodes the RFC secret', $secret === 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
check('base32 round-trips', Totp::base32Decode($secret) === '12345678901234567890');
check('RFC vector t=59', Totp::code($secret, intdiv(59, 30)) === '287082');
check('RFC vector t=1111111109', Totp::code($secret, intdiv(1111111109, 30)) === '081804');
check('RFC vector t=20000000000', Totp::code($secret, intdiv(20000000000, 30)) === '353130');
check('8-digit RFC vector t=59', Totp::code($secret, intdiv(59, 30), 8) === '94287082');

$now = 1700000000;
$step = intdiv($now, 30);
$good = Totp::code($secret, $step);
check('verify accepts the current code', Totp::verify($secret, $good, 0, $now) === $step);
check('verify accepts spaces in the code', Totp::verify($secret, substr($good, 0, 3) . ' ' . substr($good, 3), 0, $now) === $step);
check('verify accepts the previous step (clock drift)', Totp::verify($secret, Totp::code($secret, $step - 1), 0, $now) === $step - 1);
check('verify rejects two steps away', Totp::verify($secret, Totp::code($secret, $step + 2), 0, $now) === null);
check('verify rejects a replay', Totp::verify($secret, $good, $step, $now) === null);
check('verify rejects garbage', Totp::verify($secret, 'abcdef', 0, $now) === null);
check('generated secrets are 32 chars of base32', (bool) preg_match('/^[A-Z2-7]{32}$/', Totp::generateSecret()));

/* ---- password rules */
check('short password refused', Auth::passwordProblem('too short', 'a@b.co') !== null);
check('email as password refused', Auth::passwordProblem('fatima@example.com', 'fatima@example.com') !== null);
check('repeated character refused', Auth::passwordProblem(str_repeat('a', 20), 'a@b.co') !== null);
check('a passphrase is accepted', Auth::passwordProblem('three purple running shoes', 'a@b.co') === null);
check('hash verifies', password_verify('hello world 123', Auth::hashPassword('hello world 123')));

/* ---- migrations on a throw-away SQLite file */
$tmp = sys_get_temp_dir() . '/sotr-unit-' . bin2hex(random_bytes(4)) . '.sqlite';
Config::load(['db' => ['driver' => 'sqlite', 'path' => $tmp]]);
Db::reset();
$applied = Migrator::run();
check('migration 001 applies', in_array('001_init.sql', $applied, true));
check('migrations are idempotent', Migrator::run() === []);
$tables = array_column(Db::all("SELECT name FROM sqlite_master WHERE type='table'"), 'name');
foreach (['users', 'recovery_codes', 'login_attempts', 'audit_log', 'migrations'] as $t) {
    check("table $t exists", in_array($t, $tables, true));
}
$id = Auth::createAdmin('Owner@Example.com', 'three purple running shoes');
check('admin created with lower-cased email', Db::one('SELECT email FROM users WHERE id = ?', [$id])['email'] === 'owner@example.com');
Db::reset();
@unlink($tmp);

echo $failures === 0 ? "\nAll checks passed.\n" : "\n$failures check(s) failed.\n";
exit($failures === 0 ? 0 : 1);
