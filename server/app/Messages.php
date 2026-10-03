<?php
declare(strict_types=1);

namespace Sotr;

/**
 * Phase 3: Connect form messages inbox, routing, status tracking, and notes.
 */
final class Messages
{
    public const STATUSES = ['unread', 'handled', 'archived'];

    /** Public connect form submission. */
    public static function create(array $input): array
    {
        // Bot honeypots
        if (!empty($input['_trap']) || !empty($input['url']) || !empty($input['website'])) {
            throw new HttpError(400, 'Invalid request.');
        }

        $name = trim((string) ($input['name'] ?? ''));
        if ($name === '' || mb_strlen($name) > 120) {
            throw new HttpError(422, 'Please enter your name.', 'invalid', ['field' => 'name']);
        }

        $email = trim((string) ($input['email'] ?? ''));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 190) {
            throw new HttpError(422, 'Please enter a valid email address.', 'invalid', ['field' => 'email']);
        }

        $about = trim((string) ($input['about'] ?? $input['interest'] ?? 'General'));
        if (mb_strlen($about) > 80) {
            $about = mb_substr($about, 0, 80);
        }

        $inbox = trim((string) ($input['inbox'] ?? ''));
        if ($inbox === '' || !filter_var($inbox, FILTER_VALIDATE_EMAIL)) {
            // Default inbox routing per topic
            $low = mb_strtolower($about);
            if (str_contains($low, 'nutrition')) {
                $inbox = 'dietontherun@gmail.com';
            } elseif (str_contains($low, 'run') || str_contains($low, 'event')) {
                $inbox = 'sheonzrun@gmail.com';
            } else {
                $inbox = 'fatimahmouzahem08@gmail.com';
            }
        }

        $message = trim((string) ($input['message'] ?? ''));
        if ($message === '' || mb_strlen($message) > 5000) {
            throw new HttpError(422, 'Please enter your message.', 'invalid', ['field' => 'message']);
        }

        $now = Db::now();
        $id = Db::insert(
            'INSERT INTO messages (name, email, about, inbox, message, status, notes, created_at, updated_at) '
            . 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [$name, $email, $about, $inbox, $message, 'unread', null, $now, $now]
        );

        self::notifyOwner($name, $email, $about, $inbox, $message);

        return ['ok' => true, 'id' => $id];
    }

    /** Admin: list messages. */
    public static function list(string $filter = 'all'): array
    {
        $sql = 'SELECT * FROM messages';
        $params = [];
        if ($filter !== 'all' && in_array($filter, self::STATUSES, true)) {
            $sql .= ' WHERE status = ?';
            $params[] = $filter;
        }
        $sql .= ' ORDER BY id DESC LIMIT 200';
        $rows = Db::all($sql, $params);
        return array_map(self::formatRow(...), $rows);
    }

    /** Admin: get single message. */
    public static function get(int $id): ?array
    {
        $row = Db::one('SELECT * FROM messages WHERE id = ?', [$id]);
        return $row ? self::formatRow($row) : null;
    }

    /** Admin: update message status (unread / handled / archived). */
    public static function updateStatus(int $id, string $status, int $userId): array
    {
        if (!in_array($status, self::STATUSES, true)) {
            throw new HttpError(422, 'Invalid status.');
        }
        $n = Db::run('UPDATE messages SET status = ?, updated_at = ? WHERE id = ?', [$status, Db::now(), $id]);
        if ($n === 0) {
            throw new HttpError(404, 'Message not found.');
        }
        Audit::log($userId, 'message.status', "#$id -> $status");
        return self::get($id);
    }

    /** Admin: update private notes on a message. */
    public static function updateNotes(int $id, string $notes, int $userId): array
    {
        $n = Db::run('UPDATE messages SET notes = ?, updated_at = ? WHERE id = ?', [trim($notes), Db::now(), $id]);
        if ($n === 0) {
            throw new HttpError(404, 'Message not found.');
        }
        Audit::log($userId, 'message.notes', "#$id");
        return self::get($id);
    }

    /** Admin: delete message. */
    public static function delete(int $id, int $userId): void
    {
        $n = Db::run('DELETE FROM messages WHERE id = ?', [$id]);
        if ($n === 0) {
            throw new HttpError(404, 'Message not found.');
        }
        Audit::log($userId, 'message.deleted', "#$id");
    }

    /** Counts of messages by status for badges. */
    public static function counts(): array
    {
        $rows = Db::all('SELECT status, COUNT(*) AS c FROM messages GROUP BY status');
        $map = ['all' => 0, 'unread' => 0, 'handled' => 0, 'archived' => 0];
        foreach ($rows as $r) {
            $st = $r['status'];
            $c = (int) $r['c'];
            if (isset($map[$st])) {
                $map[$st] = $c;
            }
            $map['all'] += $c;
        }
        return $map;
    }

    private static function formatRow(array $r): array
    {
        return [
            'id' => (int) $r['id'],
            'name' => $r['name'],
            'email' => $r['email'],
            'about' => $r['about'],
            'inbox' => $r['inbox'],
            'message' => $r['message'],
            'status' => $r['status'],
            'notes' => $r['notes'],
            'created_at' => $r['created_at'],
            'updated_at' => $r['updated_at'],
        ];
    }

    private static function notifyOwner(string $name, string $email, string $about, string $inbox, string $msg): void
    {
        try {
            $subj = "New Website Message from $name ($about)";
            $body = "New message received from the website Connect form:\n\n"
                . "From: $name <$email>\n"
                . "Topic: $about\n"
                . "Routed to: $inbox\n\n"
                . "Message:\n$msg\n\n"
                . "Manage your messages in your admin panel: /admin/#messages\n";
            @mail($inbox, $subj, $body, "From: connect@sheontherun.com\r\nReply-To: $email\r\nX-Mailer: PHP/" . phpversion());
        } catch (\Throwable) {
        }
    }
}
