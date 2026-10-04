<?php
declare(strict_types=1);

namespace Sotr;

/**
 * The meal-plan library: the files Fatima sends clients and the sample the tracker opens.
 *
 * Files live in data/plans/ exactly as the tracker and the dietontherun page already expect
 * (.html plan pages, .csv spreadsheet plans, .json saved copies). She uploads and deletes
 * them here, and picks which HTML page the "Try the sample plan" button opens; that choice
 * is part of the drafts, so it goes live with Publish and comes back with a rollback.
 */
final class Plans
{
    public const DEFAULT_SAMPLE = 'fatimas-plate.html';
    public const TEMPLATE = 'meal-plan-template.csv';
    public const MAX_BYTES = 3_145_728; // the tracker refuses plan pages bigger than 3 MB
    public const NAME = '/^[a-z0-9][a-z0-9-]{0,60}\.(?:html|csv|json)$/';

    public static function dir(): string
    {
        return Config::siteRoot() . '/data/plans';
    }

    /** @return array<int, array> the library, alphabetical */
    public static function list(): array
    {
        $sample = self::sample();
        $out = [];
        foreach (glob(self::dir() . '/*') ?: [] as $f) {
            $name = basename($f);
            if (!is_file($f) || !preg_match(self::NAME, $name)) {
                continue;
            }
            $out[] = [
                'name' => $name,
                'kind' => pathinfo($name, PATHINFO_EXTENSION),
                'size' => (int) filesize($f),
                'modified' => gmdate('Y-m-d H:i:s', (int) filemtime($f)),
                'sample' => $name === $sample,
                'protected' => $name === self::TEMPLATE,
                'canDelete' => $name !== $sample && $name !== self::TEMPLATE,
            ];
        }
        usort($out, static fn ($a, $b) => strcmp($a['name'], $b['name']));
        return $out;
    }

    /** The HTML page the sample button opens (the saved draft choice, or the built-in one). */
    public static function sample(): string
    {
        $name = (string) (Content::get('plans')['doc']['sample'] ?? '');
        return preg_match(self::NAME, $name) && str_ends_with($name, '.html') && is_file(self::dir() . '/' . $name)
            ? $name : self::DEFAULT_SAMPLE;
    }

    public static function setSample(string $name, int $userId): array
    {
        if (!preg_match(self::NAME, $name) || !str_ends_with($name, '.html')) {
            throw new HttpError(422, 'Choose an .html plan page to be the sample.', 'invalid');
        }
        if (!is_file(self::dir() . '/' . $name)) {
            throw new HttpError(404, 'That plan file isn’t in the library.');
        }
        self::mutate(['sample' => $name], $userId);
        Audit::log($userId, 'plan.sample', $name);
        return ['sample' => $name];
    }

    /** @param array $file one entry of $_FILES */
    public static function upload(array $file, string $name, int $userId): array
    {
        $err = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($err === UPLOAD_ERR_INI_SIZE || $err === UPLOAD_ERR_FORM_SIZE) {
            throw new HttpError(413, 'That plan file is too large for the server. Plan pages up to 3 MB work.', 'too_large');
        }
        if ($err !== UPLOAD_ERR_OK || !isset($file['tmp_name']) || !is_uploaded_file((string) $file['tmp_name'])) {
            throw new HttpError(400, 'No file was received. Please try again.', 'no_file');
        }
        $original = (string) ($file['name'] ?? '');
        $ext = strtolower(pathinfo($original, PATHINFO_EXTENSION));
        if (!in_array($ext, ['html', 'csv', 'json'], true)) {
            throw new HttpError(422, 'Plan files are .html (a plan page), .csv (a spreadsheet plan) or .json (a saved copy).', 'bad_type');
        }
        $size = (int) ($file['size'] ?? 0);
        if ($size <= 0 || $size > self::MAX_BYTES) {
            throw new HttpError(413, 'That plan file is too large (3 MB at most).', 'too_large');
        }
        $name = self::slug($name !== '' ? $name : pathinfo($original, PATHINFO_FILENAME), $ext);
        if (!preg_match(self::NAME, $name)) {
            throw new HttpError(422, 'Give the file a short name using letters, numbers and dashes.', 'bad_name');
        }
        if (is_file(self::dir() . '/' . $name)) {
            throw new HttpError(409, 'A plan file called “' . $name . '” is already in the library. Choose another name.', 'name_taken');
        }

        $contents = (string) file_get_contents((string) $file['tmp_name']);
        self::verify($name, $contents);

        $dir = self::dir();
        if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
            throw new HttpError(500, 'The plan folder can’t be created on the server.');
        }
        if (!is_writable($dir)) {
            throw new HttpError(500, 'The plan folder isn’t writable on the server.');
        }
        $tmp = $dir . '/.' . $name . '.' . bin2hex(random_bytes(4)) . '.tmp';
        if (file_put_contents($tmp, $contents, LOCK_EX) === false) {
            throw new HttpError(500, 'Couldn’t save the plan file.');
        }
        @chmod($tmp, 0644);
        if (!rename($tmp, $dir . '/' . $name)) {
            @unlink($tmp);
            throw new HttpError(500, 'Couldn’t save the plan file.');
        }
        Audit::log($userId, 'plan.uploaded', $name);
        return ['name' => $name, 'kind' => $ext, 'size' => strlen($contents)];
    }

    public static function delete(string $name, int $userId): void
    {
        if (!preg_match(self::NAME, $name)) {
            throw new HttpError(404, 'That plan file isn’t in the library.');
        }
        if ($name === self::TEMPLATE) {
            throw new HttpError(409, 'This is the spreadsheet template the site hands out, so it can’t be deleted.', 'builtin');
        }
        if ($name === self::sample()) {
            throw new HttpError(409, 'This file is the sample the tracker opens. Choose another sample first.', 'in_use');
        }
        if (!is_file(self::dir() . '/' . $name)) {
            throw new HttpError(404, 'That plan file isn’t in the library.');
        }
        @unlink(self::dir() . '/' . $name);
        Audit::log($userId, 'plan.deleted', $name);
    }

    /* ----------------------------------------------------------------- helpers */

    /** Reject the obviously-wrong file early, so she finds out here and not from a client. */
    private static function verify(string $name, string $contents): void
    {
        if (str_ends_with($name, '.html')) {
            if (preg_match('/<\?(?:php|=)/i', $contents)) {
                throw new HttpError(422, 'Plan pages can’t contain server code. Upload the page exactly as it was saved.', 'bad_file');
            }
            if (!preg_match('/<script|<body|<div/i', $contents)) {
                throw new HttpError(422, 'That doesn’t look like a plan page. Upload the file exactly as it was saved.', 'bad_file');
            }
        } elseif (str_ends_with($name, '.csv')) {
            if (!str_contains($contents, ',')) {
                throw new HttpError(422, 'That spreadsheet has no columns — upload the .csv file the tracker made or the template.', 'bad_file');
            }
        } else {
            $decoded = json_decode($contents, true);
            if (!is_array($decoded)) {
                throw new HttpError(422, 'That isn’t a valid .json file.', 'bad_file');
            }
        }
    }

    private static function slug(string $s, string $ext): string
    {
        $s = mb_strtolower(trim($s));
        $s = preg_replace('/[^a-z0-9]+/', '-', iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s) ?: $s) ?? '';
        $s = trim($s, '-');
        $s = substr($s !== '' ? $s : 'plan', 0, 50);
        return trim($s, '-') . '.' . strtolower($ext);
    }

    /** Save the plans document safely: re-read, change, write only if nobody else wrote in between. */
    private static function mutate(array $doc, int $userId): void
    {
        for ($try = 0; $try < 5; $try++) {
            $cur = Content::get('plans');
            $n = Db::run(
                'UPDATE content SET doc = ?, rev = rev + 1, updated_at = ?, updated_by = ? WHERE area = ? AND rev = ?',
                [Content::encode($doc), Db::now(), $userId, 'plans', $cur['rev']]
            );
            if ($n === 1) {
                return;
            }
        }
        throw new HttpError(409, 'The plan library is busy. Please try again.', 'conflict');
    }
}
