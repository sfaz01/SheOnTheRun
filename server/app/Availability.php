<?php
declare(strict_types=1);

namespace Sotr;

/**
 * When Fatima can see clients. One small document, edited on the admin's Availability page and live the
 * moment it is saved (there is no Publish step for something that changes every week):
 *
 *   weekly       the times she works on each weekday, each with where it is (Gemmayze, Ohana Fitness, online)
 *   daysOff      dates with nothing bookable, whatever the weekly pattern says
 *   extra        one-off days with their own times (a Saturday clinic, an evening online)
 *   horizonDays  how far ahead clients can book
 *   noticeHours  how soon before a time it stops being offered
 *   note         a line shown beside the calendar
 *
 * What clients are offered is that pattern minus anything already requested or booked, in Beirut time.
 */
final class Availability
{
    public const TZ = 'Asia/Beirut';
    public const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    public const PLACES = ['gemmayze' => 'Gemmayze clinic', 'ohana' => 'Ohana Fitness, Haret Hreik', 'online' => 'Online'];
    private const MAX_PER_DAY = 14;
    private const MAX_DAYS_OFF = 400;
    private const MAX_EXTRA = 120;

    public static function defaults(): array
    {
        return [
            'weekly' => array_fill_keys(self::DAYS, []),
            'daysOff' => [],
            'extra' => [],
            'horizonDays' => 28,
            'noticeHours' => 12,
            'note' => '',
        ];
    }

    /** The saved document with anything missing filled in. */
    public static function get(): array
    {
        $row = Db::one('SELECT doc, updated_at FROM availability WHERE id = 1');
        $doc = $row ? (json_decode($row['doc'], true) ?: []) : [];
        $out = array_replace(self::defaults(), array_intersect_key($doc, self::defaults()));
        $out['weekly'] = array_replace(array_fill_keys(self::DAYS, []), is_array($out['weekly']) ? $out['weekly'] : []);
        return $out;
    }

    public static function updatedAt(): ?string
    {
        return Db::one('SELECT updated_at FROM availability WHERE id = 1')['updated_at'] ?? null;
    }

    /** @return array{0: array, 1: array<int, array{path:string,message:string}>} */
    public static function validate(mixed $in): array
    {
        $errors = [];
        $err = static function (string $path, string $message) use (&$errors): void {
            $errors[] = ['path' => $path, 'message' => $message];
        };
        $in = is_array($in) ? $in : [];
        $out = self::defaults();

        $slots = function (mixed $list, string $path) use ($err): array {
            if ($list === null || $list === []) {
                return [];
            }
            if (!is_array($list) || !array_is_list($list)) {
                $err($path, 'Unexpected data here.');
                return [];
            }
            $seen = [];
            foreach ($list as $i => $s) {
                $time = is_array($s) ? trim((string) ($s['time'] ?? '')) : '';
                $place = is_array($s) ? (string) ($s['place'] ?? '') : '';
                if ($time === '' && $place === '' ) {
                    continue; // an empty row
                }
                if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $time)) {
                    $err("$path.$i.time", 'Enter a time like 10:30.');
                    continue;
                }
                if (!isset(self::PLACES[$place])) {
                    $err("$path.$i.place", 'Choose where this time is.');
                    continue;
                }
                if (isset($seen[$time])) {
                    $err("$path.$i.time", 'There is already a time at ' . $time . ' on this day.');
                    continue;
                }
                $seen[$time] = $place;
            }
            ksort($seen);
            $clean = [];
            foreach ($seen as $time => $place) {
                $clean[] = ['time' => (string) $time, 'place' => $place];
            }
            if (count($clean) > self::MAX_PER_DAY) {
                $err($path, 'That is a lot of times for one day (' . self::MAX_PER_DAY . ' at most).');
            }
            return $clean;
        };

        foreach (self::DAYS as $d) {
            $out['weekly'][$d] = $slots(($in['weekly'] ?? [])[$d] ?? [], "weekly.$d");
        }

        $date = static function (mixed $v): ?string {
            $v = is_string($v) ? trim($v) : '';
            if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $v, $m) || !checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
                return null;
            }
            return $v;
        };

        $off = [];
        foreach ((array) ($in['daysOff'] ?? []) as $i => $v) {
            if (is_string($v) && trim($v) === '') {
                continue;
            }
            $d = $date($v);
            if ($d === null) {
                $err("daysOff.$i", 'Enter a date.');
            } else {
                $off[$d] = true;
            }
        }
        ksort($off);
        $out['daysOff'] = array_keys($off);
        if (count($out['daysOff']) > self::MAX_DAYS_OFF) {
            $err('daysOff', 'Too many days off (' . self::MAX_DAYS_OFF . ' at most).');
        }

        $extra = [];
        foreach ((array) ($in['extra'] ?? []) as $i => $x) {
            $d = $date(is_array($x) ? ($x['date'] ?? '') : '');
            if ($d === null) {
                $err("extra.$i.date", 'Enter a date.');
                continue;
            }
            $times = $slots($x['slots'] ?? [], "extra.$i.slots");
            if (isset($extra[$d])) {
                $err("extra.$i.date", 'That date is already in the list.');
                continue;
            }
            $extra[$d] = $times;
        }
        ksort($extra);
        foreach ($extra as $d => $times) {
            $out['extra'][] = ['date' => (string) $d, 'slots' => $times];
        }
        $out['extra'] = array_slice($out['extra'], 0, self::MAX_EXTRA);

        $h = $in['horizonDays'] ?? 28;
        if (!is_numeric($h) || (int) $h < 7 || (int) $h > 120) {
            $err('horizonDays', 'Choose between 1 and 17 weeks ahead.');
        } else {
            $out['horizonDays'] = (int) $h;
        }
        $n = $in['noticeHours'] ?? 12;
        if (!is_numeric($n) || (int) $n < 0 || (int) $n > 336) {
            $err('noticeHours', 'Choose a minimum notice between 0 and 14 days.');
        } else {
            $out['noticeHours'] = (int) $n;
        }
        $note = is_string($in['note'] ?? '') ? preg_replace('/[\x00-\x1F\x7F]/u', ' ', (string) ($in['note'] ?? '')) ?? '' : '';
        $note = trim($note);
        if (mb_strlen($note) > 300) {
            $err('note', 'Too long — 300 characters at most (now ' . mb_strlen($note) . ').');
        }
        $out['note'] = $note;

        return [$out, $errors];
    }

    public static function save(array $doc, int $userId): array
    {
        $json = Content::encode($doc);
        $n = Db::run('UPDATE availability SET doc = ?, updated_at = ? WHERE id = 1', [$json, Db::now()]);
        if ($n === 0) {
            Db::run('INSERT INTO availability (id, doc, updated_at) VALUES (1, ?, ?)', [$json, Db::now()]);
        }
        Audit::log($userId, 'availability.saved');
        return self::get();
    }

    /** Has she set anything up at all? Until she has, the site keeps booking on WhatsApp. */
    public static function isConfigured(array $doc): bool
    {
        foreach ($doc['weekly'] as $slots) {
            if ($slots) {
                return true;
            }
        }
        foreach ($doc['extra'] as $x) {
            if ($x['slots']) {
                return true;
            }
        }
        return false;
    }

    public static function now(): \DateTimeImmutable
    {
        return new \DateTimeImmutable('now', new \DateTimeZone(self::TZ));
    }

    /**
     * What a client may pick right now.
     * @return array{configured: bool, days: array<string, array<int, array{time:string, place:string}>>}
     */
    public static function open(?\DateTimeImmutable $now = null, ?array $doc = null): array
    {
        $doc ??= self::get();
        $now ??= self::now();
        $tz = new \DateTimeZone(self::TZ);
        $configured = self::isConfigured($doc);
        if (!$configured) {
            return ['configured' => false, 'days' => []];
        }

        $taken = [];
        foreach (Db::all('SELECT slot_key FROM bookings WHERE slot_key IS NOT NULL AND slot_date >= ?', [$now->format('Y-m-d')]) as $r) {
            $taken[$r['slot_key']] = true;
        }
        $off = array_flip($doc['daysOff']);
        $extra = [];
        foreach ($doc['extra'] as $x) {
            $extra[$x['date']] = $x['slots'];
        }
        $earliest = $now->modify('+' . (int) $doc['noticeHours'] . ' hours')->getTimestamp();

        $days = [];
        $day = $now->setTime(0, 0);
        for ($i = 0; $i <= (int) $doc['horizonDays']; $i++, $day = $day->modify('+1 day')) {
            $date = $day->format('Y-m-d');
            if (isset($off[$date])) {
                continue;
            }
            $weekday = self::DAYS[(int) $day->format('N') - 1];
            $list = [];
            foreach (array_merge($doc['weekly'][$weekday] ?? [], $extra[$date] ?? []) as $s) {
                if (isset($taken["$date {$s['time']}"])) {
                    continue;
                }
                $at = \DateTimeImmutable::createFromFormat('Y-m-d H:i', "$date {$s['time']}", $tz);
                if ($at === false || $at->getTimestamp() < $earliest) {
                    continue;
                }
                $list[$s['time']] = ['time' => $s['time'], 'place' => $s['place']];
            }
            if ($list) {
                ksort($list);
                $days[$date] = array_values($list);
            }
        }
        return ['configured' => true, 'days' => $days];
    }

    /** What the public page gets: no names, no bookings, only what can be picked. */
    public static function publicView(): array
    {
        $doc = self::get();
        $open = self::open(null, $doc);
        return [
            'configured' => $open['configured'],
            'timezone' => self::TZ,
            'places' => self::PLACES,
            'note' => $doc['note'],
            'horizonDays' => $doc['horizonDays'],
            'today' => self::now()->format('Y-m-d'),
            'days' => (object) $open['days'],
        ];
    }

    public static function isOpen(string $date, string $time, string $place): bool
    {
        foreach (self::open()['days'][$date] ?? [] as $s) {
            if ($s['time'] === $time && $s['place'] === $place) {
                return true;
            }
        }
        return false;
    }
}
