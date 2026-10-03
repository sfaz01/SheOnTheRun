<?php
declare(strict_types=1);

namespace Sotr;

/** The Connect-form inbox. The email alert goes to the inbox Site settings pick for the subject. */
final class Messages
{
    public const STATUSES = ['unread', 'handled', 'archived'];
    public const TOPICS = ['nutrition' => 'Nutrition consultation', 'sheontherun' => 'SheOnTheRun', 'events' => 'Events & partnerships', 'research' => 'Research', 'general' => 'General'];

    public static function create(array $in): array
    {
        if (!empty($in['website']) || !empty($in['_trap'])) {
            return ['ok' => true]; // a bot filled the hidden field; say nothing
        }
        $name = self::text($in['name'] ?? '', 80);
        if (mb_strlen($name) < 2) {
            throw new HttpError(422, 'Please tell me your name.', 'invalid', ['field' => 'name']);
        }
        $email = trim((string) ($in['email'] ?? ''));
        if ($email !== '' && (strlen($email) > 190 || filter_var($email, FILTER_VALIDATE_EMAIL) === false)) {
            throw new HttpError(422, 'That email address doesn’t look right.', 'invalid', ['field' => 'email']);
        }
        $message = self::text($in['message'] ?? '', 4000, true);
        if (mb_strlen($message) < 3) {
            throw new HttpError(422, 'Please write a message.', 'invalid', ['field' => 'message']);
        }
        $topic = (string) ($in['about'] ?? 'general');
        $topic = isset(self::TOPICS[$topic]) ? $topic : 'general';

        $settings = (Content::lastSnapshot() ?? [])['settings'] ?? [];
        $to = (string) (($settings['emails'] ?? [])[$topic] ?? $settings['email'] ?? '');
        $now = Db::now();
        $id = Db::insert(
            'INSERT INTO messages (name, email, topic, message, status, routed_to, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [$name, $email !== '' ? $email : null, $topic, $message, 'unread', $to !== '' ? $to : null, $now, $now]
        );
        $body = "New message from the website — " . self::TOPICS[$topic] . "\n\nFrom: $name" . ($email !== '' ? " <$email>" : ' (no email given)')
            . "\n\n$message\n\nOpen it in the admin: " . rtrim((string) Config::get('app_url'), '/') . "/admin/#messages\n";
        $mail = Mailer::send($to, 'Website message — ' . self::TOPICS[$topic] . ' — ' . Mailer::line($name), $body, $email !== '' ? $email : null);
        Db::run('UPDATE messages SET mail_status = ? WHERE id = ?', [$mail, $id]);
        return ['ok' => true];
    }

    /** @return array{messages: array, total: int, counts: array<string,int>} */
    public static function list(string $status, int $page, int $per = 30): array
    {
        $where = '1=1';
        $args = [];
        if (in_array($status, self::STATUSES, true)) {
            $where = 'status = ?';
            $args[] = $status;
        }
        $total = (int) (Db::one("SELECT COUNT(*) AS n FROM messages WHERE $where", $args)['n'] ?? 0);
        $page = max(1, $page);
        $rows = Db::all("SELECT * FROM messages WHERE $where ORDER BY id DESC LIMIT $per OFFSET " . (($page - 1) * $per), $args);
        return ['messages' => array_map([self::class, 'row'], $rows), 'total' => $total, 'per' => $per, 'counts' => self::counts()];
    }

    public static function counts(): array
    {
        $out = ['all' => 0] + array_fill_keys(self::STATUSES, 0);
        foreach (Db::all('SELECT status, COUNT(*) AS n FROM messages GROUP BY status') as $r) {
            $out[$r['status']] = (int) $r['n'];
            $out['all'] += (int) $r['n'];
        }
        return $out;
    }

    public static function setStatus(int $id, string $status, int $userId): array
    {
        if (!in_array($status, self::STATUSES, true)) {
            throw new HttpError(422, 'That isn’t a valid status.');
        }
        self::find($id);
        Db::run('UPDATE messages SET status = ?, updated_at = ? WHERE id = ?', [$status, Db::now(), $id]);
        Audit::log($userId, 'message.status', "#$id → $status");
        return self::row(self::find($id));
    }

    public static function setNotes(int $id, string $notes, int $userId): array
    {
        self::find($id);
        Db::run('UPDATE messages SET notes = ?, updated_at = ? WHERE id = ?', [self::text($notes, 2000, true) ?: null, Db::now(), $id]);
        Audit::log($userId, 'message.notes', "#$id");
        return self::row(self::find($id));
    }

    public static function delete(int $id, int $userId): void
    {
        self::find($id);
        Db::run('DELETE FROM messages WHERE id = ?', [$id]);
        Audit::log($userId, 'message.deleted', "#$id");
    }

    private static function find(int $id): array
    {
        $r = Db::one('SELECT * FROM messages WHERE id = ?', [$id]);
        if ($r === null) {
            throw new HttpError(404, 'That message doesn’t exist any more.');
        }
        return $r;
    }

    private static function row(array $r): array
    {
        return [
            'id' => (int) $r['id'], 'name' => $r['name'], 'email' => $r['email'], 'topic' => $r['topic'],
            'topic_label' => self::TOPICS[$r['topic']] ?? $r['topic'], 'message' => $r['message'], 'status' => $r['status'],
            'notes' => $r['notes'], 'routed_to' => $r['routed_to'], 'mail_status' => $r['mail_status'], 'created_at' => $r['created_at'],
        ];
    }

    private static function text(mixed $v, int $max, bool $multiline = false): string
    {
        $s = is_string($v) || is_numeric($v) ? (string) $v : '';
        $s = str_replace("\r\n", "\n", $s);
        $s = preg_replace($multiline ? '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u' : '/[\x00-\x1F\x7F]/u', '', $s) ?? '';
        return mb_substr(trim($s), 0, $max);
    }
}
