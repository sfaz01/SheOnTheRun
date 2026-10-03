<?php
declare(strict_types=1);

namespace Sotr;

/**
 * Sign-in: password, then a 6-digit code from an authenticator app (mandatory).
 * A session passes through two stages:
 *   'password' — correct password, still needs the code (or has to set up the app first). Expires in 10 minutes.
 *   'full'     — signed in.
 */
final class Auth
{
    public const MIN_PASSWORD = 12;
    private const PASSWORD_STAGE_SECONDS = 600;
    private const RECOVERY_CODES = 8;

    /* ------------------------------------------------------------ passwords */

    public static function hashPassword(string $password): string
    {
        $algo = defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_BCRYPT;
        return password_hash($password, $algo);
    }

    /** Returns a human message when the password is unacceptable, or null when it's fine. */
    public static function passwordProblem(string $password, string $email): ?string
    {
        if (mb_strlen($password) < self::MIN_PASSWORD) {
            return 'Use at least ' . self::MIN_PASSWORD . ' characters. A few words strung together works well.';
        }
        if (mb_strtolower($password) === mb_strtolower($email)) {
            return 'The password can’t be your email address.';
        }
        if (preg_match('/^(.)\1+$/u', $password)) {
            return 'Pick something less repetitive.';
        }
        return null;
    }

    public static function validEmail(string $email): bool
    {
        return strlen($email) <= 190 && filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    /* -------------------------------------------------------------- accounts */

    public static function userCount(): int
    {
        return (int) (Db::one('SELECT COUNT(*) AS n FROM users')['n'] ?? 0);
    }

    public static function setupAvailable(): bool
    {
        return (string) Config::get('setup_token', '') !== '' && self::userCount() === 0;
    }

    public static function createAdmin(string $email, string $password): int
    {
        return Db::insert(
            'INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, ?, ?)',
            [mb_strtolower($email), self::hashPassword($password), 'admin', Db::now()]
        );
    }

    /* --------------------------------------------------------------- session */

    /** The signed-in user, or null. Enforces idle and absolute timeouts. */
    public static function currentUser(): ?array
    {
        if (($_SESSION['stage'] ?? '') !== 'full') {
            return null;
        }
        $now = time();
        $idle = (int) Config::get('session.idle_minutes') * 60;
        $absolute = (int) Config::get('session.absolute_minutes') * 60;
        if ($now - (int) ($_SESSION['last'] ?? 0) > $idle || $now - (int) ($_SESSION['started'] ?? 0) > $absolute) {
            self::destroySession();
            return null;
        }
        $user = Db::one('SELECT id, email, role FROM users WHERE id = ?', [(int) ($_SESSION['uid'] ?? 0)]);
        if ($user === null) {
            self::destroySession();
            return null;
        }
        $_SESSION['last'] = $now;
        return $user;
    }

    public static function requireUser(): array
    {
        $user = self::currentUser();
        if ($user === null) {
            throw new HttpError(401, 'Please sign in.', 'auth');
        }
        return $user;
    }

    /** The user who has passed the password step but not the code step yet. */
    private static function passwordStageUser(): array
    {
        if (($_SESSION['stage'] ?? '') !== 'password' || time() - (int) ($_SESSION['pw_at'] ?? 0) > self::PASSWORD_STAGE_SECONDS) {
            unset($_SESSION['stage'], $_SESSION['uid'], $_SESSION['pending_secret']);
            throw new HttpError(401, 'Please sign in again.', 'auth');
        }
        $user = Db::one('SELECT * FROM users WHERE id = ?', [(int) ($_SESSION['uid'] ?? 0)]);
        if ($user === null) {
            throw new HttpError(401, 'Please sign in again.', 'auth');
        }
        return $user;
    }

    private static function beginPasswordStage(int $userId): void
    {
        session_regenerate_id(true);
        $_SESSION['stage'] = 'password';
        $_SESSION['uid'] = $userId;
        $_SESSION['pw_at'] = time();
        unset($_SESSION['pending_secret']);
    }

    /** Used after accepting an invite: password is set, the authenticator app comes next. */
    public static function startEnrollmentFor(int $userId): void
    {
        self::beginPasswordStage($userId);
    }

    private static function completeLogin(array $user): void
    {
        session_regenerate_id(true);
        $_SESSION['stage'] = 'full';
        $_SESSION['uid'] = (int) $user['id'];
        $_SESSION['started'] = time();
        $_SESSION['last'] = time();
        unset($_SESSION['pw_at'], $_SESSION['pending_secret']);
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
        Db::run('UPDATE users SET last_login_at = ? WHERE id = ?', [Db::now(), $user['id']]);
    }

    public static function destroySession(): void
    {
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }
    }

    /** What the admin app needs to know on page load. */
    public static function state(): array
    {
        $out = [
            'csrf'            => Http::csrfToken(),
            'stage'           => 'anonymous',
            'setup_available' => self::setupAvailable(),
        ];
        $user = self::currentUser();
        if ($user !== null) {
            $out['stage'] = 'full';
            $out['user'] = ['email' => $user['email'], 'role' => $user['role']];
        } elseif (($_SESSION['stage'] ?? '') === 'password') {
            try {
                $u = self::passwordStageUser();
                $out['stage'] = 'password';
                $out['next'] = (int) $u['totp_enabled'] === 1 ? '2fa' : 'enroll';
            } catch (HttpError) {
                // fall through as anonymous
            }
        }
        return $out;
    }

    /* ----------------------------------------------------------------- steps */

    public static function setup(string $token, string $email, string $password): array
    {
        $ip = Http::ip();
        RateLimit::check('setup', $ip);
        if (!self::setupAvailable()) {
            throw new HttpError(403, 'Setup is not available.', 'setup_closed');
        }
        if (!hash_equals((string) Config::get('setup_token'), $token)) {
            RateLimit::fail('setup', $ip);
            throw new HttpError(403, 'That setup token isn’t right.', 'bad_token');
        }
        $email = mb_strtolower($email);
        if (!self::validEmail($email)) {
            throw new HttpError(422, 'Enter a valid email address.', 'bad_email');
        }
        if (($problem = self::passwordProblem($password, $email)) !== null) {
            throw new HttpError(422, $problem, 'weak_password');
        }
        $id = self::createAdmin($email, $password);
        Audit::log($id, 'setup.admin_created', $email);
        self::beginPasswordStage($id);
        return ['next' => 'enroll'];
    }

    public static function login(string $email, string $password): array
    {
        $ip = Http::ip();
        $email = mb_strtolower($email);
        $key = 'login:' . $email;
        RateLimit::check($key, $ip);

        $user = $email !== '' ? Db::one('SELECT * FROM users WHERE email = ?', [$email]) : null;
        // Always spend the same time hashing, so response time doesn't reveal which emails exist.
        $hash = $user['password_hash'] ?? self::dummyHash();
        $ok = password_verify($password, $hash) && $user !== null;
        if (!$ok) {
            RateLimit::fail($key, $ip);
            Audit::log($user['id'] ?? null, 'login.failed', $email);
            throw new HttpError(401, 'That email or password isn’t right.', 'bad_login');
        }
        if (password_needs_rehash($hash, defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_BCRYPT)) {
            Db::run('UPDATE users SET password_hash = ? WHERE id = ?', [self::hashPassword($password), $user['id']]);
        }
        self::beginPasswordStage((int) $user['id']);
        return ['next' => (int) $user['totp_enabled'] === 1 ? '2fa' : 'enroll'];
    }

    /** Step 2 for an account that already has an authenticator app: a 6-digit code or a recovery code. */
    public static function verifySecondStep(string $input): array
    {
        $user = self::passwordStageUser();
        if ((int) $user['totp_enabled'] !== 1) {
            throw new HttpError(409, 'Set up your authenticator app first.', 'needs_enroll');
        }
        $ip = Http::ip();
        $key = '2fa:' . $user['id'];
        RateLimit::check($key, $ip);

        $step = Totp::verify((string) $user['totp_secret'], $input, (int) $user['totp_last_step']);
        $viaRecovery = false;
        if ($step !== null) {
            Db::run('UPDATE users SET totp_last_step = ? WHERE id = ?', [$step, $user['id']]);
        } elseif (self::useRecoveryCode((int) $user['id'], $input)) {
            $viaRecovery = true;
        } else {
            RateLimit::fail($key, $ip);
            Audit::log((int) $user['id'], 'login.bad_code');
            throw new HttpError(401, 'That code isn’t right. Check the latest code in your app.', 'bad_code');
        }
        RateLimit::succeed($key);
        RateLimit::succeed('login:' . $user['email']);
        self::completeLogin($user);
        Audit::log((int) $user['id'], $viaRecovery ? 'login.recovery_code' : 'login');
        return ['recovery_used' => $viaRecovery, 'recovery_left' => self::recoveryCodesLeft((int) $user['id'])];
    }

    /** Enrollment, part 1: make a secret for the QR code. Nothing is saved until the first code is confirmed. */
    public static function beginEnrollment(): array
    {
        $user = self::passwordStageUser();
        if ((int) $user['totp_enabled'] === 1) {
            throw new HttpError(409, 'Already set up.', 'already_enrolled');
        }
        $secret = Totp::generateSecret();
        $_SESSION['pending_secret'] = $secret;
        return ['secret' => $secret, 'uri' => Totp::uri((string) $user['email'], $secret)];
    }

    /** Enrollment, part 2: confirm with a first code, turn 2-step on, hand out one-time recovery codes. */
    public static function finishEnrollment(string $code): array
    {
        $user = self::passwordStageUser();
        $secret = (string) ($_SESSION['pending_secret'] ?? '');
        if ($secret === '' || (int) $user['totp_enabled'] === 1) {
            throw new HttpError(409, 'Start the setup again.', 'no_pending');
        }
        $ip = Http::ip();
        $key = '2fa:' . $user['id'];
        RateLimit::check($key, $ip);
        $step = Totp::verify($secret, $code, 0);
        if ($step === null) {
            RateLimit::fail($key, $ip);
            throw new HttpError(401, 'That code isn’t right. Check the latest code in your app.', 'bad_code');
        }
        Db::run(
            'UPDATE users SET totp_secret = ?, totp_enabled = 1, totp_last_step = ? WHERE id = ?',
            [$secret, $step, $user['id']]
        );
        $codes = self::issueRecoveryCodes((int) $user['id']);
        RateLimit::succeed($key);
        RateLimit::succeed('login:' . $user['email']);
        self::completeLogin($user);
        Audit::log((int) $user['id'], 'twofa.enabled');
        return ['recovery_codes' => $codes];
    }

    public static function changePassword(array $user, string $current, string $new): void
    {
        $ip = Http::ip();
        $key = 'pwchange:' . $user['id'];
        RateLimit::check($key, $ip);
        $row = Db::one('SELECT password_hash FROM users WHERE id = ?', [$user['id']]);
        if ($row === null || !password_verify($current, $row['password_hash'])) {
            RateLimit::fail($key, $ip);
            throw new HttpError(401, 'Your current password isn’t right.', 'bad_login');
        }
        if (($problem = self::passwordProblem($new, (string) $user['email'])) !== null) {
            throw new HttpError(422, $problem, 'weak_password');
        }
        Db::run('UPDATE users SET password_hash = ? WHERE id = ?', [self::hashPassword($new), $user['id']]);
        RateLimit::succeed($key);
        session_regenerate_id(true);
        Audit::log((int) $user['id'], 'password.changed');
    }

    /* -------------------------------------------------------- recovery codes */

    /** @return string[] the plain codes — shown once, stored only as hashes */
    private static function issueRecoveryCodes(int $userId): array
    {
        Db::run('DELETE FROM recovery_codes WHERE user_id = ?', [$userId]);
        $alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'; // no look-alikes (i, l, o, 0, 1)
        $codes = [];
        for ($i = 0; $i < self::RECOVERY_CODES; $i++) {
            $raw = '';
            for ($j = 0; $j < 10; $j++) {
                $raw .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
            $codes[] = substr($raw, 0, 5) . '-' . substr($raw, 5);
            Db::run(
                'INSERT INTO recovery_codes (user_id, code_hash) VALUES (?, ?)',
                [$userId, self::hashPassword(str_replace('-', '', $raw))]
            );
        }
        return $codes;
    }

    private static function useRecoveryCode(int $userId, string $input): bool
    {
        $plain = strtolower(str_replace(['-', ' '], '', trim($input)));
        if (!preg_match('/^[a-z0-9]{10}$/', $plain)) {
            return false;
        }
        foreach (Db::all('SELECT id, code_hash FROM recovery_codes WHERE user_id = ? AND used_at IS NULL', [$userId]) as $row) {
            if (password_verify($plain, $row['code_hash'])) {
                Db::run('UPDATE recovery_codes SET used_at = ? WHERE id = ?', [Db::now(), $row['id']]);
                return true;
            }
        }
        return false;
    }

    private static function recoveryCodesLeft(int $userId): int
    {
        return (int) (Db::one('SELECT COUNT(*) AS n FROM recovery_codes WHERE user_id = ? AND used_at IS NULL', [$userId])['n'] ?? 0);
    }

    private static function dummyHash(): string
    {
        static $hash = null;
        return $hash ??= self::hashPassword('not-a-real-password-' . bin2hex(random_bytes(8)));
    }
}
