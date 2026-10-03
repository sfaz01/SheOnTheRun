<?php
declare(strict_types=1);

namespace Sotr;

/**
 * The photo library. Uploading turns one phone/camera photo into the set of files the site
 * already uses — WebP and JPEG at 480/960/1440/2000 px wide (never bigger than the original) —
 * in public/images/<name>-<width>.<ext>, and records its alt text (English + Arabic) in the
 * `images` area. The files are inert until a page or product refers to the photo, and the
 * metadata goes live with the next Publish like everything else.
 */
final class Photos
{
    private const WIDTHS = [480, 960, 1440, 2000];
    private const MAX_PIXELS = 40_000_000;
    private const NAME = '/^[a-z0-9][a-z0-9-]{1,60}$/';

    public static function dir(): string
    {
        return Config::siteRoot() . '/public/images';
    }

    /** @return array<int, array> photos for the library grid */
    public static function list(): array
    {
        $doc = Content::get('images')['doc'];
        $out = [];
        foreach ($doc['items'] ?? [] as $im) {
            $out[] = [
                'name' => $im['name'],
                'alt' => $im['alt'] ?? '',
                'altAr' => $im['ar']['alt'] ?? '',
                'w' => $im['w'],
                'r' => $im['r'],
                'canDelete' => empty($im['seeded']),
                'used' => self::usedBy($im['name']),
            ];
        }
        usort($out, static fn ($a, $b) => strcmp($a['name'], $b['name']));
        return $out;
    }

    /**
     * @param array $file one entry of $_FILES
     * @return array the stored photo
     */
    public static function upload(array $file, string $name, string $alt, string $altAr, string $replace, int $userId): array
    {
        $err = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($err === UPLOAD_ERR_INI_SIZE || $err === UPLOAD_ERR_FORM_SIZE) {
            throw new HttpError(413, 'That photo is too large for the server (limit ' . ini_get('upload_max_filesize') . '). Try a smaller one.', 'too_large');
        }
        if ($err !== UPLOAD_ERR_OK || !isset($file['tmp_name']) || !is_uploaded_file((string) $file['tmp_name'])) {
            throw new HttpError(400, 'No photo was received. Please try again.', 'no_file');
        }
        if (!extension_loaded('gd')) {
            throw new HttpError(500, 'The server can’t process photos yet (the GD extension is missing).', 'no_gd');
        }

        $alt = trim($alt);
        $altAr = trim($altAr);
        if ($alt === '' || mb_strlen($alt) > 200 || mb_strlen($altAr) > 200) {
            throw new HttpError(422, 'Describe the photo in a few words (up to 200 characters). It’s read aloud to people who can’t see it.', 'invalid');
        }

        $replace = trim($replace);
        $name = $replace !== '' ? $replace : self::slug($name !== '' ? $name : pathinfo((string) ($file['name'] ?? ''), PATHINFO_FILENAME));
        if (!preg_match(self::NAME, $name)) {
            throw new HttpError(422, 'Give the photo a short name using letters, numbers and dashes.', 'bad_name');
        }

        $existing = self::find($name);
        if ($replace === '' && $existing !== null) {
            throw new HttpError(409, 'A photo called “' . $name . '” already exists. Choose another name, or use Replace on that photo.', 'name_taken');
        }
        if ($replace !== '' && $existing === null) {
            throw new HttpError(404, 'That photo isn’t in the library.');
        }

        [$img, $w, $h] = self::load((string) $file['tmp_name']);
        $r = round($w / $h, 4);
        $widths = array_values(array_filter(self::WIDTHS, static fn ($t) => $t <= $w));
        if (!$widths) {
            $widths = [$w];
        }

        $dir = self::dir();
        if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
            imagedestroy($img);
            throw new HttpError(500, 'The photo folder can’t be created on the server.');
        }
        if (!is_writable($dir)) {
            imagedestroy($img);
            throw new HttpError(500, 'The photo folder isn’t writable on the server.');
        }

        $written = [];
        try {
            foreach ($widths as $tw) {
                $th = max(1, (int) round($tw / $r));
                $copy = imagecreatetruecolor($tw, $th);
                imagealphablending($copy, false);
                imagesavealpha($copy, true);
                imagefill($copy, 0, 0, imagecolorallocatealpha($copy, 255, 255, 255, 127));
                imagecopyresampled($copy, $img, 0, 0, 0, 0, $tw, $th, $w, $h);

                if (function_exists('imagewebp')) {
                    $tmp = "$dir/.$name-$tw.webp." . bin2hex(random_bytes(3)) . '.tmp';
                    if (@imagewebp($copy, $tmp, 82)) {
                        $written[$tmp] = "$dir/$name-$tw.webp";
                    }
                }
                // JPEG has no transparency: flatten onto white.
                $flat = imagecreatetruecolor($tw, $th);
                imagefill($flat, 0, 0, imagecolorallocate($flat, 255, 255, 255));
                imagecopy($flat, $copy, 0, 0, 0, 0, $tw, $th);
                $tmp = "$dir/.$name-$tw.jpg." . bin2hex(random_bytes(3)) . '.tmp';
                if (!@imagejpeg($flat, $tmp, 85)) {
                    throw new HttpError(500, 'Couldn’t save the resized photo.');
                }
                $written[$tmp] = "$dir/$name-$tw.jpg";
                imagedestroy($flat);
                imagedestroy($copy);
            }
        } catch (\Throwable $e) {
            foreach (array_keys($written) as $t) {
                @unlink($t);
            }
            imagedestroy($img);
            throw $e;
        }
        imagedestroy($img);

        if ($replace !== '') {
            self::removeFiles($name); // drop old widths that don't exist any more
        }
        foreach ($written as $tmp => $final) {
            rename($tmp, $final);
        }

        $item = [
            'name' => $name, 'alt' => $alt, 'w' => $widths, 'r' => $r,
        ] + ($altAr !== '' ? ['ar' => ['alt' => $altAr]] : []);
        if ($existing !== null && !empty($existing['seeded'])) {
            $item['seeded'] = true;
        }
        self::mutate(static function (array $items) use ($item, $name, $replace): array {
            if ($replace !== '') {
                foreach ($items as $i => $x) {
                    if ($x['name'] === $name) {
                        $items[$i] = $item;
                    }
                }
            } else {
                $items[] = $item;
            }
            return $items;
        });
        Audit::log($userId, $replace !== '' ? 'photo.replaced' : 'photo.uploaded', $name);
        return $item;
    }

    public static function update(string $name, string $alt, string $altAr, int $userId): array
    {
        $alt = trim($alt);
        $altAr = trim($altAr);
        if ($alt === '' || mb_strlen($alt) > 200 || mb_strlen($altAr) > 200) {
            throw new HttpError(422, 'Describe the photo in a few words (up to 200 characters).', 'invalid');
        }
        if (self::find($name) === null) {
            throw new HttpError(404, 'That photo isn’t in the library.');
        }
        $updated = null;
        self::mutate(static function (array $items) use ($name, $alt, $altAr, &$updated): array {
            foreach ($items as $i => $x) {
                if ($x['name'] === $name) {
                    $x['alt'] = $alt;
                    unset($x['ar']);
                    if ($altAr !== '') {
                        $x['ar'] = ['alt' => $altAr];
                    }
                    $items[$i] = $updated = $x;
                }
            }
            return $items;
        });
        Audit::log($userId, 'photo.updated', $name);
        return $updated;
    }

    public static function delete(string $name, int $userId): void
    {
        $im = self::find($name);
        if ($im === null) {
            throw new HttpError(404, 'That photo isn’t in the library.');
        }
        if (!empty($im['seeded'])) {
            throw new HttpError(409, 'This photo is built into the website’s pages, so it can’t be deleted here. You can replace it with a new photo instead.', 'builtin');
        }
        $used = self::usedBy($name);
        if ($used) {
            throw new HttpError(409, 'This photo is still used by: ' . implode(', ', $used) . '. Change those first.', 'in_use');
        }
        self::mutate(static fn (array $items): array => array_values(array_filter($items, static fn ($x) => $x['name'] !== $name)));
        self::removeFiles($name);
        Audit::log($userId, 'photo.deleted', $name);
    }

    /* ----------------------------------------------------------------- helpers */

    /** Where a photo is used — in the drafts and in what is live (so nothing live loses its picture). */
    public static function usedBy(string $name): array
    {
        $sources = [Content::drafts()];
        $live = Content::lastSnapshot();
        if ($live !== null) {
            $sources[] = $live;
        }
        $used = [];
        foreach ($sources as $docs) {
            foreach ($docs['shop']['categories'] ?? [] as $c) {
                foreach ($c['items'] ?? [] as $p) {
                    if (($p['image'] ?? '') === $name) {
                        $used['product “' . ($p['name'] ?? '') . '”'] = true;
                    }
                }
            }
            foreach ($docs['posts']['items'] ?? [] as $p) {
                if (($p['image'] ?? '') === $name) {
                    $used['article “' . ($p['title'] ?? '') . '”'] = true;
                }
            }
            foreach (['community', 'fieldwork'] as $run) {
                foreach ($docs['gallery'][$run] ?? [] as $g) {
                    if (($g['img'] ?? '') === $name) {
                        $used['the ' . ($run === 'community' ? 'SheOnTheRun' : 'Public Health') . ' gallery'] = true;
                    }
                }
            }
        }
        return array_keys($used);
    }

    private static function find(string $name): ?array
    {
        foreach (Content::get('images')['doc']['items'] ?? [] as $im) {
            if ($im['name'] === $name) {
                return $im;
            }
        }
        return null;
    }

    /** Change the photo list safely: re-read, change, write only if nobody else wrote in between. */
    private static function mutate(callable $change): void
    {
        for ($try = 0; $try < 5; $try++) {
            $cur = Content::get('images');
            $items = $change($cur['doc']['items'] ?? []);
            $doc = $cur['doc'];
            $doc['items'] = $items;
            $n = Db::run(
                'UPDATE content SET doc = ?, rev = rev + 1, updated_at = ? WHERE area = ? AND rev = ?',
                [Content::encode($doc), Db::now(), 'images', $cur['rev']]
            );
            if ($n === 1) {
                return;
            }
        }
        throw new HttpError(409, 'The photo library is busy. Please try again.', 'conflict');
    }

    private static function removeFiles(string $name): void
    {
        foreach (glob(self::dir() . '/' . $name . '-*.{jpg,webp}', GLOB_BRACE) ?: [] as $f) {
            if (preg_match('/-\d+\.(jpg|webp)$/', $f)) {
                @unlink($f);
            }
        }
    }

    private static function slug(string $s): string
    {
        $s = mb_strtolower(trim($s));
        $s = preg_replace('/[^a-z0-9]+/', '-', iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s) ?: $s) ?? '';
        $s = trim($s, '-');
        return substr($s !== '' ? $s : 'photo-' . date('Ymd-His'), 0, 60);
    }

    /** @return array{0: \GdImage, 1: int, 2: int} decoded, correctly rotated image and its size */
    private static function load(string $path): array
    {
        $info = @getimagesize($path);
        if ($info === false || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) {
            throw new HttpError(422, 'That file isn’t a JPEG, PNG or WebP photo.', 'bad_type');
        }
        [$w, $h] = $info;
        if ($w < 200 || $h < 200) {
            throw new HttpError(422, 'That photo is too small (at least 200 pixels each way).', 'too_small');
        }
        if ($w * $h > self::MAX_PIXELS) {
            throw new HttpError(422, 'That photo is huge (over 40 megapixels). Please export a smaller one.', 'too_big');
        }
        $limit = self::bytes((string) ini_get('memory_limit'));
        if ($limit > 0 && $w * $h * 6 > $limit * 0.85) {
            throw new HttpError(422, 'The server doesn’t have enough memory for a photo this large. Please upload a smaller version (about 3000 pixels wide is plenty).', 'memory');
        }
        $img = match ($info[2]) {
            IMAGETYPE_JPEG => @imagecreatefromjpeg($path),
            IMAGETYPE_PNG => @imagecreatefrompng($path),
            default => @imagecreatefromwebp($path),
        };
        if ($img === false) {
            throw new HttpError(422, 'That photo couldn’t be read. Try saving it again from your photo app.', 'corrupt');
        }
        // Phones store "rotate me" in the photo's EXIF data instead of turning the pixels.
        if ($info[2] === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
            $exif = @exif_read_data($path);
            $o = (int) ($exif['Orientation'] ?? 1);
            if (in_array($o, [2, 4, 5, 7], true)) {
                imageflip($img, $o === 4 ? IMG_FLIP_VERTICAL : IMG_FLIP_HORIZONTAL);
            }
            $deg = [3 => 180, 5 => 90, 6 => -90, 7 => -90, 8 => 90][$o] ?? 0;
            if ($deg !== 0) {
                $rot = imagerotate($img, $deg, 0);
                if ($rot !== false) {
                    imagedestroy($img);
                    $img = $rot;
                }
            }
        }
        return [$img, imagesx($img), imagesy($img)];
    }

    private static function bytes(string $v): int
    {
        $v = trim($v);
        if ($v === '-1' || $v === '') {
            return 0;
        }
        $n = (int) $v;
        return match (strtolower(substr($v, -1))) {
            'g' => $n * 1073741824,
            'm' => $n * 1048576,
            'k' => $n * 1024,
            default => $n,
        };
    }
}
