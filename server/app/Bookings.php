<?php
declare(strict_types=1);

namespace Sotr;

/**
 * Consultation bookings. A client picks one of the times Fatima offers (see Availability). By default
 * the time is booked straight away; if she has switched automatic confirmation off it is a request that
 * holds the time until she confirms it. Either way nobody else can take it, and cancelling frees it.
 * The browser says WHAT was picked; the server checks it is still open.
 */
final class Bookings
{
    public const STATUSES = ['new', 'confirmed', 'cancelled'];
    private const OTHER = ['discovery' => 'Free 15-minute discovery call', 'general' => 'Consultation'];

    /* ------------------------------------------------------------------ public */

    /** @return array{ok: true, booking_number: string, status: string, when: string, place: string} */
    public static function create(array $in): array
    {
        if (!empty($in['website']) || !empty($in['_trap'])) {
            // A hidden field only bots fill in. Pretend it worked so they learn nothing.
            return ['ok' => true, 'booking_number' => 'BK-' . strtoupper(bin2hex(random_bytes(3))), 'status' => 'confirmed', 'when' => '', 'place' => ''];
        }
        $name = self::text($in['name'] ?? '', 80);
        if (mb_strlen($name) < 2) {
            throw self::bad('name', 'Please enter your full name.');
        }
        $phone = trim((string) ($in['phone'] ?? ''));
        $digits = preg_replace('/\D/', '', $phone) ?? '';
        if (!preg_match('/^[+0-9 ()\-]{7,25}$/', $phone) || strlen($digits) < 7 || strlen($digits) > 15) {
            throw self::bad('phone', 'Please enter a phone number I can reach you on.');
        }
        $email = trim((string) ($in['email'] ?? ''));
        if ($email !== '' && (strlen($email) > 190 || filter_var($email, FILTER_VALIDATE_EMAIL) === false)) {
            throw self::bad('email', 'That email address doesn’t look right.');
        }
        $note = self::text($in['note'] ?? '', 600, true);

        $date = (string) ($in['date'] ?? '');
        $time = (string) ($in['time'] ?? '');
        $place = (string) ($in['place'] ?? '');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !preg_match('/^\d{2}:\d{2}$/', $time) || !isset(Availability::PLACES[$place])) {
            throw new HttpError(422, 'Please choose a time from the calendar.', 'invalid', ['field' => 'slot']);
        }
        if (!Availability::isOpen($date, $time, $place)) {
            throw new HttpError(409, 'That time has just been taken. Please choose another.', 'slot_taken', ['field' => 'slot']);
        }
        $service = self::serviceName((string) ($in['service'] ?? ''));

        $status = Availability::get()['autoConfirm'] ? 'confirmed' : 'new';
        $number = self::newNumber();
        $now = Db::now();
        try {
            $id = Db::insert(
                'INSERT INTO bookings (booking_number, slot_date, slot_time, place, slot_key, service, name, phone, email, note, status, created_at, updated_at) '
                . 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [$number, $date, $time, $place, "$date $time", $service, $name, $phone, $email !== '' ? $email : null, $note !== '' ? $note : null, $status, $now, $now]
            );
        } catch (\PDOException $e) {
            if (self::isDuplicate($e)) {
                // Two requests for the same time at the same moment: the second one lands here.
                throw new HttpError(409, 'That time has just been taken. Please choose another.', 'slot_taken', ['field' => 'slot']);
            }
            throw $e;
        }

        $when = self::when($date, $time);
        $settings = (Content::lastSnapshot() ?? [])['settings'] ?? [];
        $to = (string) (($settings['emails'] ?? [])['nutrition'] ?? $settings['email'] ?? '');
        $body = ($status === 'confirmed' ? "New booking from the website (confirmed automatically)\n\n" : "New consultation request from the website\n\n")
            . "When:    $when (Beirut time)\nWhere:   " . Availability::PLACES[$place] . "\nFor:     $service\n\n"
            . "Name:    $name\nPhone:   $phone\nEmail:   " . ($email !== '' ? $email : '—') . "\n"
            . ($note !== '' ? "\nNote from the client:\n$note\n" : '')
            . ($status === 'confirmed' ? "\nThe time is booked for them. You can cancel it in the admin and message them if it doesn’t work.\nOpen it in the admin: " : "\nThe time is held for them until you confirm or cancel it.\nOpen it in the admin: ") . rtrim((string) Config::get('app_url'), '/') . "/admin/#bookings\n";
        $mail = Mailer::send($to, ($status === 'confirmed' ? 'New booking — ' : 'Booking request — ') . $when . ' — ' . Mailer::line($name), $body, $email !== '' ? $email : null);
        Db::run('UPDATE bookings SET mail_status = ? WHERE id = ?', [$mail, $id]);

        return ['ok' => true, 'booking_number' => $number, 'status' => $status, 'when' => $when, 'place' => Availability::PLACES[$place]];
    }

    /* ------------------------------------------------------------------- admin */

    /** @return array{bookings: array, total: int, per: int, counts: array<string,int>} */
    public static function list(string $status, string $scope, int $page, int $per = 30): array
    {
        $today = Availability::now()->format('Y-m-d');
        $where = [];
        $args = [];
        if (in_array($status, self::STATUSES, true)) {
            $where[] = 'status = ?';
            $args[] = $status;
        }
        // Upcoming (today onward, soonest first) is what she works from; Past is the record.
        $past = $scope === 'past';
        $where[] = $past ? 'slot_date < ?' : 'slot_date >= ?';
        $args[] = $today;
        $w = implode(' AND ', $where);
        $total = (int) (Db::one("SELECT COUNT(*) AS n FROM bookings WHERE $w", $args)['n'] ?? 0);
        $order = $past ? 'slot_date DESC, slot_time DESC' : 'slot_date ASC, slot_time ASC';
        $rows = Db::all("SELECT * FROM bookings WHERE $w ORDER BY $order LIMIT $per OFFSET " . ((max(1, $page) - 1) * $per), $args);
        return ['bookings' => array_map([self::class, 'row'], $rows), 'total' => $total, 'per' => $per, 'counts' => self::counts()];
    }

    /** Counts of upcoming requests by status (what the menu badge and tabs show). */
    public static function counts(): array
    {
        $today = Availability::now()->format('Y-m-d');
        $out = ['all' => 0] + array_fill_keys(self::STATUSES, 0);
        foreach (Db::all('SELECT status, COUNT(*) AS n FROM bookings WHERE slot_date >= ? GROUP BY status', [$today]) as $r) {
            $out[$r['status']] = (int) $r['n'];
            $out['all'] += (int) $r['n'];
        }
        return $out;
    }

    /** The next few appointments she has said yes to (or not yet answered), for the Overview. */
    public static function upcoming(int $limit = 5): array
    {
        $today = Availability::now()->format('Y-m-d');
        $rows = Db::all(
            "SELECT * FROM bookings WHERE status <> 'cancelled' AND slot_date >= ? ORDER BY slot_date ASC, slot_time ASC LIMIT " . (int) $limit,
            [$today]
        );
        return array_map([self::class, 'row'], $rows);
    }

    public static function setStatus(int $id, string $status, int $userId): array
    {
        if (!in_array($status, self::STATUSES, true)) {
            throw new HttpError(422, 'That isn’t a valid status.');
        }
        $b = self::find($id);
        // Cancelling frees the time; bringing it back takes the time again, if nobody else has it.
        $key = $status === 'cancelled' ? null : $b['slot_date'] . ' ' . $b['slot_time'];
        try {
            Db::run('UPDATE bookings SET status = ?, slot_key = ?, updated_at = ? WHERE id = ?', [$status, $key, Db::now(), $id]);
        } catch (\PDOException $e) {
            if (self::isDuplicate($e)) {
                throw new HttpError(409, 'Someone else has asked for that time since. Choose a new time with them, or cancel the other request first.', 'slot_taken');
            }
            throw $e;
        }
        Audit::log($userId, 'booking.status', "#$id → $status");
        return self::row(self::find($id));
    }

    public static function setNotes(int $id, string $notes, int $userId): array
    {
        self::find($id);
        Db::run('UPDATE bookings SET admin_notes = ?, updated_at = ? WHERE id = ?', [self::text($notes, 2000, true) ?: null, Db::now(), $id]);
        Audit::log($userId, 'booking.notes', "#$id");
        return self::row(self::find($id));
    }

    public static function delete(int $id, int $userId): void
    {
        self::find($id);
        Db::run('DELETE FROM bookings WHERE id = ?', [$id]);
        Audit::log($userId, 'booking.deleted', "#$id");
    }

    /* ---------------------------------------------------------------- internal */

    private static function find(int $id): array
    {
        $r = Db::one('SELECT * FROM bookings WHERE id = ?', [$id]);
        if ($r === null) {
            throw new HttpError(404, 'That booking doesn’t exist any more.');
        }
        return $r;
    }

    private static function row(array $r): array
    {
        return [
            'id' => (int) $r['id'], 'booking_number' => $r['booking_number'], 'date' => $r['slot_date'], 'time' => $r['slot_time'],
            'when' => self::when($r['slot_date'], $r['slot_time']), 'place' => $r['place'], 'place_label' => Availability::PLACES[$r['place']] ?? $r['place'],
            'service' => $r['service'], 'name' => $r['name'], 'phone' => $r['phone'], 'email' => $r['email'], 'note' => $r['note'],
            'status' => $r['status'], 'notes' => $r['admin_notes'], 'mail_status' => $r['mail_status'], 'created_at' => $r['created_at'],
        ];
    }

    /** "Tuesday 3 November 2026 at 10:00" */
    public static function when(string $date, string $time): string
    {
        $d = \DateTimeImmutable::createFromFormat('Y-m-d', $date, new \DateTimeZone(Availability::TZ));
        return ($d ? $d->format('l j F Y') : $date) . ' at ' . $time;
    }

    /** The service name comes from the published offer, never from what the browser typed. */
    private static function serviceName(string $id): string
    {
        if (isset(self::OTHER[$id])) {
            return self::OTHER[$id];
        }
        $offer = (Content::lastSnapshot() ?? [])['offer'] ?? [];
        foreach ($offer['services'] ?? [] as $s) {
            if (($s['id'] ?? '') === $id) {
                return (string) ($s['title'] ?? self::OTHER['general']);
            }
        }
        foreach ($offer['packages'] ?? [] as $p) {
            if (($p['id'] ?? '') === $id) {
                return (string) ($p['name'] ?? self::OTHER['general']) . ' package';
            }
        }
        return self::OTHER['general'];
    }

    private static function isDuplicate(\PDOException $e): bool
    {
        return (string) $e->getCode() === '23000' || stripos($e->getMessage(), 'unique') !== false || stripos($e->getMessage(), 'duplicate') !== false;
    }

    private static function newNumber(): string
    {
        for ($i = 0; $i < 6; $i++) {
            $n = 'BK-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
            if (Db::one('SELECT id FROM bookings WHERE booking_number = ?', [$n]) === null) {
                return $n;
            }
        }
        return 'BK-' . strtoupper(bin2hex(random_bytes(5)));
    }

    private static function bad(string $field, string $message): HttpError
    {
        return new HttpError(422, $message, 'invalid', ['field' => $field]);
    }

    private static function text(mixed $v, int $max, bool $multiline = false): string
    {
        $s = is_string($v) || is_numeric($v) ? (string) $v : '';
        $s = str_replace("\r\n", "\n", $s);
        $s = preg_replace($multiline ? '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u' : '/[\x00-\x1F\x7F]/u', '', $s) ?? '';
        return mb_substr(trim($s), 0, $max);
    }
}
