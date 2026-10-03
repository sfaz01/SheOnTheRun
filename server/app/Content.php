<?php
declare(strict_types=1);

namespace Sotr;

/**
 * Drafts, publishing and history.
 *   - Each area (shop, runs, …) is one JSON document in `content`. Saving changes the draft only.
 *   - Publish validates every area, regenerates data/*.js and records a snapshot in `publishes`.
 *   - Any snapshot can be restored into the drafts; "discard" restores the last published one.
 * The first time it runs, it imports the website's current data from server/database/seed/content.json.
 */
final class Content
{
    private const HISTORY_KEEP = 100;

    public static function ensureSeeded(): void
    {
        if ((int) (Db::one('SELECT COUNT(*) AS n FROM content')['n'] ?? 0) === 0) {
            self::seed(Schema::ALL);
            return;
        }
        // An existing site that predates the Journal/gallery/photo areas (phase 2): add them from the
        // website's own files, upgrade the photo list, and fold them into the "imported" snapshot so
        // the panel doesn't claim there are unpublished changes that nobody made.
        if (Db::one('SELECT area FROM content WHERE area = ?', ['posts']) === null) {
            self::seed(['posts', 'gallery'], true);
            $seed = self::seedAreas();
            Db::run('UPDATE content SET doc = ?, rev = rev + 1, updated_at = ? WHERE area = ?', [self::encode($seed['images']), Db::now(), 'images']);
            $extras = self::get('extras')['doc'];
            unset($extras['ar']['posts'], $extras['ar']['gallery']);
            Db::run('UPDATE content SET doc = ?, updated_at = ? WHERE area = ?', [self::encode($extras), Db::now(), 'extras']);
            $last = Db::one('SELECT id, snapshot FROM publishes ORDER BY id DESC LIMIT 1');
            if ($last !== null) {
                $snap = json_decode($last['snapshot'], true) ?? [];
                foreach (['posts', 'gallery', 'images'] as $a) {
                    $snap[$a] = $seed[$a];
                }
                $snap['extras'] = $extras;
                Db::run('UPDATE publishes SET snapshot = ? WHERE id = ?', [self::encode($snap), $last['id']]);
            }
        }
    }

    /** @return array<string, array> the website's current content, normalised the way a save would store it */
    private static function seedAreas(): array
    {
        $path = SOTR_ROOT . '/database/seed/content.json';
        $seed = is_file($path) ? json_decode((string) file_get_contents($path), true) : null;
        if (!is_array($seed) || !is_array($seed['areas'] ?? null)) {
            throw new HttpError(500, 'The starting content is missing (server/database/seed/content.json).');
        }
        $areas = $seed['areas'];
        foreach (Schema::EDITABLE as $area) {
            [$areas[$area]] = Validator::run($area, $areas[$area] ?? []);
        }
        return $areas;
    }

    private static function seed(array $which, bool $addOnly = false): void
    {
        $areas = self::seedAreas();
        $pdo = Db::pdo();
        $pdo->beginTransaction();
        try {
            foreach ($which as $area) {
                Db::run(
                    'INSERT INTO content (area, doc, rev, updated_at, updated_by) VALUES (?, ?, 1, ?, NULL)',
                    [$area, self::encode($areas[$area] ?? []), Db::now()]
                );
            }
            if (!$addOnly) {
                Db::insert(
                    'INSERT INTO publishes (snapshot, note, user_id, created_at) VALUES (?, ?, NULL, ?)',
                    [self::encode(self::publishable($areas)), 'Imported from the website', Db::now()]
                );
            }
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    /** The documents as they were at the last publish (what visitors see), or null. */
    public static function lastSnapshot(): ?array
    {
        $last = self::lastPublish();
        return $last ? (json_decode($last['snapshot'], true) ?? []) : null;
    }

    /** @return array{doc: array, rev: int, updated_at: string} */
    public static function get(string $area): array
    {
        self::assertArea($area, Schema::ALL);
        $row = Db::one('SELECT doc, rev, updated_at FROM content WHERE area = ?', [$area]);
        if ($row === null) {
            throw new HttpError(404, 'Not found.');
        }
        return ['doc' => json_decode($row['doc'], true) ?? [], 'rev' => (int) $row['rev'], 'updated_at' => $row['updated_at']];
    }

    /** @return array<string, array> every area's draft document */
    public static function drafts(): array
    {
        $out = [];
        foreach (Db::all('SELECT area, doc FROM content') as $row) {
            $out[$row['area']] = json_decode($row['doc'], true) ?? [];
        }
        return $out;
    }

    /** Validate and store a draft. Throws 422 with field errors, or 409 if someone saved in between. */
    public static function save(string $area, mixed $doc, int $baseRev, int $userId): array
    {
        self::assertArea($area, Schema::GENERIC);
        [$clean, $errors] = Validator::run($area, $doc);
        if ($errors) {
            throw new HttpError(422, 'Some fields need fixing.', 'invalid', ['errors' => $errors]);
        }
        $n = Db::run(
            'UPDATE content SET doc = ?, rev = rev + 1, updated_at = ?, updated_by = ? WHERE area = ? AND rev = ?',
            [self::encode($clean), Db::now(), $userId, $area, $baseRev]
        );
        if ($n === 0) {
            throw new HttpError(409, 'This was changed in another tab or by another admin. Reload to see the latest, then make your change again.', 'conflict');
        }
        Audit::log($userId, 'content.saved', $area);
        return self::get($area);
    }

    /** Which areas have changes that aren't live yet. */
    public static function status(): array
    {
        $last = self::lastPublish();
        $published = $last ? (json_decode($last['snapshot'], true) ?? []) : [];
        $drafts = self::drafts();
        $changed = [];
        foreach (Schema::EDITABLE as $area) {
            $changed[$area] = self::encode($drafts[$area] ?? []) !== self::encode($published[$area] ?? []);
        }
        return [
            'changed' => $changed,
            'last_publish' => $last ? ['at' => $last['created_at'], 'by' => $last['email'] ?? null, 'note' => $last['note']] : null,
        ];
    }

    /** Regenerate the live data files from the drafts. */
    public static function publish(int $userId, string $note): array
    {
        $drafts = self::drafts();
        $all = [];
        foreach (Schema::EDITABLE as $area) {
            [$clean, $errors] = Validator::run($area, $drafts[$area] ?? []);
            foreach ($errors as $e) {
                $all[] = ['area' => $area] + $e;
            }
            $drafts[$area] = $clean;
        }
        if ($all) {
            throw new HttpError(422, 'Some content needs fixing before it can go live.', 'invalid', ['errors' => $all]);
        }

        $previous = self::lastSnapshot() ?? [];
        $files = [];
        foreach (Generator::files($drafts) as $name => $contents) {
            $files['data/' . $name] = $contents;
        }
        $live = Journal::published($drafts['posts'] ?? []);
        foreach ($live as $p) {
            $files['journal/' . $p['slug'] . '.html'] = Journal::page($p);
        }
        $files['feed.xml'] = Journal::feed($live);
        $files['sitemap.xml'] = Journal::sitemap($live);
        self::writeFiles($files);
        // An article that was live and is now a draft or deleted must come off the site.
        $nowLive = array_column($live, 'slug');
        foreach (Journal::published($previous['posts'] ?? []) as $p) {
            if (!in_array($p['slug'], $nowLive, true) && preg_match('/^[a-z0-9-]+$/', $p['slug'])) {
                @unlink(Config::siteRoot() . '/journal/' . $p['slug'] . '.html');
            }
        }

        $id = Db::insert(
            'INSERT INTO publishes (snapshot, note, user_id, created_at) VALUES (?, ?, ?, ?)',
            [self::encode(self::publishable($drafts)), $note !== '' ? mb_substr($note, 0, 200) : null, $userId, Db::now()]
        );
        // Keep the history bounded.
        $cut = Db::one('SELECT id FROM publishes ORDER BY id DESC LIMIT 1 OFFSET ' . self::HISTORY_KEEP);
        if ($cut !== null) {
            Db::run('DELETE FROM publishes WHERE id <= ?', [$cut['id']]);
        }
        Audit::log($userId, 'content.published', $note);
        return ['id' => $id];
    }

    public static function history(): array
    {
        return array_map(static fn ($r) => [
            'id' => (int) $r['id'],
            'at' => $r['created_at'],
            'by' => $r['email'],
            'note' => $r['note'],
        ], Db::all(
            'SELECT p.id, p.created_at, p.note, u.email FROM publishes p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.id DESC LIMIT 50'
        ));
    }

    /** Put a published version back into the drafts (it goes live on the next Publish). */
    public static function restore(int $publishId, int $userId): void
    {
        $row = Db::one('SELECT snapshot FROM publishes WHERE id = ?', [$publishId]);
        if ($row === null) {
            throw new HttpError(404, 'That version no longer exists.');
        }
        $snap = json_decode($row['snapshot'], true) ?? [];
        // Orders have changed the stock since then; an old version must not bring old stock numbers back.
        $now = (self::lastSnapshot() ?? [])['shop'] ?? null;
        if (is_array($now) && isset($snap['shop'])) {
            $stock = [];
            foreach ($now['categories'] ?? [] as $c) {
                foreach ($c['items'] ?? [] as $p) {
                    if (array_key_exists('stock', $p)) {
                        $stock[$p['id']] = $p['stock'];
                    }
                }
            }
            foreach ($snap['shop']['categories'] ?? [] as $ci => $c) {
                foreach ($c['items'] ?? [] as $ii => $p) {
                    if (isset($stock[$p['id']])) {
                        $snap['shop']['categories'][$ci]['items'][$ii]['stock'] = $stock[$p['id']];
                    }
                }
            }
        }
        self::replaceDrafts($snap, $userId);
        Audit::log($userId, 'content.restored', '#' . $publishId);
    }

    /** Throw away unpublished changes. */
    public static function discard(int $userId): void
    {
        $last = self::lastPublish();
        if ($last === null) {
            throw new HttpError(409, 'Nothing has been published yet.');
        }
        self::replaceDrafts(json_decode($last['snapshot'], true) ?? [], $userId);
        Audit::log($userId, 'content.discarded');
    }

    /* ---------------------------------------------------------------- internal */

    private static function replaceDrafts(array $snapshot, int $userId): void
    {
        foreach (Schema::EDITABLE as $area) {
            if (array_key_exists($area, $snapshot)) {
                Db::run(
                    'UPDATE content SET doc = ?, rev = rev + 1, updated_at = ?, updated_by = ? WHERE area = ?',
                    [self::encode($snapshot[$area]), Db::now(), $userId, $area]
                );
            }
        }
    }

    /** The areas that make up the live site (images are only a picker list). */
    private static function publishable(array $areas): array
    {
        $out = [];
        foreach (array_merge(Schema::EDITABLE, ['extras']) as $a) {
            $out[$a] = $areas[$a] ?? [];
        }
        return $out;
    }

    private static function lastPublish(): ?array
    {
        return Db::one(
            'SELECT p.snapshot, p.created_at, p.note, u.email FROM publishes p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.id DESC LIMIT 1'
        );
    }

    /**
     * Write each file to a temporary name first, then swap them all in, so visitors never see half a file.
     * @param array<string,string> $files path (from the site root) => contents
     */
    public static function writeFiles(array $files): void
    {
        $root = Config::siteRoot();
        $tmp = [];
        try {
            foreach ($files as $rel => $contents) {
                $target = $root . '/' . $rel;
                $dir = dirname($target);
                if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
                    throw new HttpError(500, 'The website’s ' . dirname($rel) . ' folder can’t be created, so nothing was published.');
                }
                if (!is_writable($dir)) {
                    throw new HttpError(500, 'The website’s ' . dirname($rel) . ' folder isn’t writable, so nothing was published.');
                }
                $t = $dir . '/.' . basename($rel) . '.' . bin2hex(random_bytes(4)) . '.tmp';
                if (file_put_contents($t, $contents, LOCK_EX) === false) {
                    throw new HttpError(500, 'Couldn’t write ' . $rel . '. Nothing was published.');
                }
                @chmod($t, 0644);
                $tmp[$rel] = $t;
            }
            foreach ($tmp as $rel => $t) {
                if (!rename($t, $root . '/' . $rel)) {
                    throw new HttpError(500, 'Couldn’t replace ' . $rel . '. Try publishing again.');
                }
                unset($tmp[$rel]);
            }
        } finally {
            foreach ($tmp as $t) {
                @unlink($t);
            }
        }
    }

    private static function assertArea(string $area, array $allowed): void
    {
        if (!in_array($area, $allowed, true)) {
            throw new HttpError(404, 'Not found.');
        }
    }

    public static function encode(mixed $v): string
    {
        return json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }
}
