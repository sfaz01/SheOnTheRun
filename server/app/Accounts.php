<?php
declare(strict_types=1);

namespace Sotr;

/**
 * Managing who can sign in: list admins, invite a new one (a one-time code the inviter
 * passes on by WhatsApp — no email is sent), remove one, and change your own email.
 */
final class Accounts
{
    private const INVITE_HOURS = 72;

    public static function list(int $currentUserId): array
    {
        $users = array_map(static fn ($u) => [
            'id' => (int) $u['id'],
            'email' => $u['email'],
            'created_at' => $u['created_at'],
            'last_login_at' => $u['last_login_at'],
            'twofa' => (int) $u['totp_enabled'] === 1,
            'you' => (int) $u['id'] === $currentUserId,
        ], Db::all('SELECT id, email, created_at, last_login_at, totp_enabled FROM users ORDER BY id'));
        $invites = array_map(static fn ($i) => [
            'id' => (int) $i['id'],
            'email' => $i['email'],
            'expires_at' => $i['expires_at'],
        ], Db::all('SELECT id, email, expires_at FROM invites WHERE used_at IS NULL AND expires_at > ? ORDER BY id', [Db::now()]));
        return ['admins' => $users, 'invites' => $invites];
    }

    /** @return array{code:string, expires_at:string} — the code is shown once, only its hash is kept */
    public static function invite(array $by, string $email): array
    {
        $email = mb_strtolower(trim($email));
        if (!Auth::validEmail($email)) {
            throw new HttpError(422, 'Enter a valid email address.', 'bad_email');
        }
        if (Db::one('SELECT id FROM users WHERE email = ?', [$email]) !== null) {
            throw new HttpError(409, 'That email already has an admin account.', 'exists');
        }
        Db::run('DELETE FROM invites WHERE email = ? AND used_at IS NULL', [$email]);
        $alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
        $raw = '';
        for ($i = 0; $i < 10; $i++) {
            $raw .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }
        $expires = Db::now(time() + self::INVITE_HOURS * 3600);
        Db::insert(
            'INSERT INTO invites (email, code_hash, created_by, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
            [$email, Auth::hashPassword($raw), $by['id'], $expires, Db::now()]
        );
        Audit::log((int) $by['id'], 'admin.invited', $email);
        return ['code' => substr($raw, 0, 5) . '-' . substr($raw, 5), 'expires_at' => $expires];
    }

    public static function cancelInvite(array $by, int $inviteId): void
    {
        Db::run('DELETE FROM invites WHERE id = ? AND used_at IS NULL', [$inviteId]);
        Audit::log((int) $by['id'], 'admin.invite_cancelled', '#' . $inviteId);
    }

    /** The invited person sets their password; next they set up their authenticator app. */
    public static function acceptInvite(string $email, string $code, string $password): array
    {
        $email = mb_strtolower(trim($email));
        $ip = Http::ip();
        $key = 'invite:' . $email;
        RateLimit::check($key, $ip);
        $plain = strtolower(str_replace(['-', ' '], '', trim($code)));
        $match = null;
        foreach (Db::all('SELECT id, code_hash FROM invites WHERE email = ? AND used_at IS NULL AND expires_at > ?', [$email, Db::now()]) as $inv) {
            if (password_verify($plain, $inv['code_hash'])) {
                $match = $inv;
                break;
            }
        }
        if ($match === null) {
            RateLimit::fail($key, $ip);
            throw new HttpError(401, 'That email and invite code don’t match, or the invite has expired. Ask for a new one.', 'bad_invite');
        }
        if (($problem = Auth::passwordProblem($password, $email)) !== null) {
            throw new HttpError(422, $problem, 'weak_password');
        }
        if (Db::one('SELECT id FROM users WHERE email = ?', [$email]) !== null) {
            throw new HttpError(409, 'That email already has an admin account.', 'exists');
        }
        $id = Auth::createAdmin($email, $password);
        Db::run('UPDATE invites SET used_at = ? WHERE id = ?', [Db::now(), $match['id']]);
        RateLimit::succeed($key);
        Audit::log($id, 'admin.invite_accepted', $email);
        Auth::startEnrollmentFor($id);
        return ['next' => 'enroll'];
    }

    public static function remove(array $by, int $userId): void
    {
        if ($userId === (int) $by['id']) {
            throw new HttpError(409, 'You can’t remove your own account. Ask another admin to do it.', 'self');
        }
        $target = Db::one('SELECT email FROM users WHERE id = ?', [$userId]);
        if ($target === null) {
            throw new HttpError(404, 'That admin no longer exists.');
        }
        Db::run('DELETE FROM recovery_codes WHERE user_id = ?', [$userId]);
        Db::run('DELETE FROM users WHERE id = ?', [$userId]);
        Audit::log((int) $by['id'], 'admin.removed', $target['email']);
    }

    public static function changeEmail(array $user, string $password, string $newEmail): void
    {
        $ip = Http::ip();
        $key = 'email:' . $user['id'];
        RateLimit::check($key, $ip);
        $row = Db::one('SELECT password_hash FROM users WHERE id = ?', [$user['id']]);
        if ($row === null || !password_verify($password, $row['password_hash'])) {
            RateLimit::fail($key, $ip);
            throw new HttpError(401, 'Your password isn’t right.', 'bad_login');
        }
        $newEmail = mb_strtolower(trim($newEmail));
        if (!Auth::validEmail($newEmail)) {
            throw new HttpError(422, 'Enter a valid email address.', 'bad_email');
        }
        $other = Db::one('SELECT id FROM users WHERE email = ?', [$newEmail]);
        if ($other !== null && (int) $other['id'] !== (int) $user['id']) {
            throw new HttpError(409, 'Another admin already uses that email.', 'exists');
        }
        Db::run('UPDATE users SET email = ? WHERE id = ?', [$newEmail, $user['id']]);
        RateLimit::succeed($key);
        Audit::log((int) $user['id'], 'email.changed', $user['email'] . ' → ' . $newEmail);
    }
}
