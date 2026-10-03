<?php
declare(strict_types=1);

namespace Sotr;

/**
 * Phase 2: Media library (photos), automatic responsive image resizing, alt text, and gallery assignment.
 */
final class Media
{
    public const TARGET_WIDTHS = [480, 960, 1440, 2000];

    /** List all images with metadata, widths and alt text. */
    public static function list(): array
    {
        self::ensureSeeded();
        $row = Db::one('SELECT doc FROM content WHERE area = ?', ['images']);
        $doc = $row ? (json_decode($row['doc'], true) ?: []) : [];
        $rawItems = $doc['items'] ?? [];

        $result = [];
        foreach ($rawItems as $key => $meta) {
            $name = is_string($key) && !is_numeric($key) ? $key : ($meta['name'] ?? (string) $key);
            $result[] = [
                'name' => $name,
                'w'    => $meta['w'] ?? [480, 960],
                'r'    => (float) ($meta['r'] ?? 1.0),
                'alt'  => $meta['alt'] ?? '',
                'ar'   => $meta['ar'] ?? ['alt' => ''],
                'url'  => '/public/images/' . $name . '-' . ($meta['w'][0] ?? 480) . '.jpg',
            ];
        }
        usort($result, static fn ($a, $b) => strcmp($a['name'], $b['name']));
        return $result;
    }

    /** Update alt text for an image. */
    public static function update(string $name, string $altEn, ?string $altAr, int $userId): array
    {
        self::ensureSeeded();
        $row = Db::one('SELECT doc, rev FROM content WHERE area = ?', ['images']);
        if (!$row) {
            throw new HttpError(404, 'Images library not found.');
        }
        $doc = json_decode($row['doc'], true) ?: [];
        $items = $doc['items'] ?? [];
        $found = false;

        if (isset($items[$name])) {
            $items[$name]['alt'] = trim($altEn);
            if ($altAr !== null) {
                $items[$name]['ar'] = ['alt' => trim($altAr)];
            }
            $found = true;
        } else {
            foreach ($items as $i => $item) {
                if (($item['name'] ?? '') === $name) {
                    $items[$i]['alt'] = trim($altEn);
                    if ($altAr !== null) {
                        $items[$i]['ar'] = ['alt' => trim($altAr)];
                    }
                    $found = true;
                    break;
                }
            }
        }

        if (!$found) {
            $items[$name] = ['w' => [480, 960], 'r' => 1.0, 'alt' => trim($altEn), 'ar' => ['alt' => trim($altAr ?? '')]];
        }

        $doc['items'] = $items;
        Db::run(
            'UPDATE content SET doc = ?, rev = rev + 1, updated_at = ?, updated_by = ? WHERE area = ?',
            [json_encode($doc, JSON_UNESCAPED_UNICODE), Db::now(), $userId, 'images']
        );
        Audit::log($userId, 'media.updated', $name);

        return ['name' => $name, 'alt' => $altEn, 'ar' => ['alt' => $altAr ?? '']];
    }

    /** Upload and resize a new photo into 480, 960, 1440, 2000 widths in WebP and JPEG. */
    public static function upload(array $file, string $name, string $altEn, ?string $altAr, int $userId): array
    {
        $name = trim(mb_strtolower($name));
        $name = preg_replace('/[^a-z0-9-_]/', '-', $name) ?: 'photo-' . time();
        $name = trim($name, '-');

        if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            // Check for direct testing / CLI path
            if (!isset($file['tmp_name']) || !is_file($file['tmp_name'])) {
                throw new HttpError(400, 'No file was uploaded.', 'no_file');
            }
        }

        if ($file['size'] > 20 * 1024 * 1024) {
            throw new HttpError(413, 'The image is too large. Please upload an image under 20MB.', 'file_too_large');
        }

        $raw = @file_get_contents($file['tmp_name']);
        if ($raw === false) {
            throw new HttpError(400, 'Failed to read uploaded file.');
        }

        $src = @imagecreatefromstring($raw);
        if ($src === false) {
            throw new HttpError(422, 'The uploaded file is not a valid JPEG, PNG or WebP image.', 'invalid_image');
        }

        $origW = imagesx($src);
        $origH = imagesy($src);
        if ($origW < 10 || $origH < 10) {
            imagedestroy($src);
            throw new HttpError(422, 'The image dimensions are too small.');
        }

        $r = round($origW / $origH, 4);

        // Calculate responsive widths
        $widths = [];
        foreach (self::TARGET_WIDTHS as $tw) {
            if ($tw <= $origW || empty($widths)) {
                $widths[] = $tw;
            }
        }
        if (empty($widths)) {
            $widths = [480];
        }

        $imgDir = dirname(SOTR_ROOT) . '/public/images';
        if (!is_dir($imgDir)) {
            @mkdir($imgDir, 0755, true);
        }

        foreach ($widths as $w) {
            $h = max(1, (int) round($w / $r));
            $dst = imagecreatetruecolor($w, $h);
            imagecopyresampled($dst, $src, 0, 0, 0, 0, $w, $h, $origW, $origH);

            $base = $imgDir . '/' . $name . '-' . $w;
            if (function_exists('imagewebp')) {
                @imagewebp($dst, $base . '.webp', 85);
            }
            if (function_exists('imagejpeg')) {
                @imagejpeg($dst, $base . '.jpg', 85);
            }
            imagedestroy($dst);
        }
        imagedestroy($src);

        // Update database doc in images area
        self::ensureSeeded();
        $row = Db::one('SELECT doc FROM content WHERE area = ?', ['images']);
        $doc = $row ? (json_decode($row['doc'], true) ?: []) : [];
        if (!isset($doc['items'])) {
            $doc['items'] = [];
        }

        $doc['items'][$name] = [
            'w' => $widths,
            'r' => $r,
            'alt' => trim($altEn),
            'ar' => ['alt' => trim($altAr ?? '')],
        ];

        Db::run(
            'UPDATE content SET doc = ?, rev = rev + 1, updated_at = ?, updated_by = ? WHERE area = ?',
            [json_encode($doc, JSON_UNESCAPED_UNICODE), Db::now(), $userId, 'images']
        );
        Audit::log($userId, 'media.uploaded', $name);

        return [
            'ok' => true,
            'name' => $name,
            'w' => $widths,
            'r' => $r,
            'alt' => trim($altEn),
            'url' => '/public/images/' . $name . '-' . $widths[0] . '.jpg',
        ];
    }

    /** Delete photo from library. */
    public static function delete(string $name, int $userId): void
    {
        self::ensureSeeded();
        $row = Db::one('SELECT doc FROM content WHERE area = ?', ['images']);
        if (!$row) return;
        $doc = json_decode($row['doc'], true) ?: [];
        if (isset($doc['items'][$name])) {
            unset($doc['items'][$name]);
            Db::run(
                'UPDATE content SET doc = ?, rev = rev + 1, updated_at = ?, updated_by = ? WHERE area = ?',
                [json_encode($doc, JSON_UNESCAPED_UNICODE), Db::now(), $userId, 'images']
            );
            Audit::log($userId, 'media.deleted', $name);
        }
    }

    /** Get both community and fieldwork galleries. */
    public static function getGalleries(): array
    {
        self::ensureSeeded();
        $row = Db::one('SELECT doc FROM content WHERE area = ?', ['gallery']);
        if ($row) {
            return json_decode($row['doc'], true) ?: ['community' => [], 'fieldwork' => []];
        }
        return ['community' => [], 'fieldwork' => []];
    }

    /** Save updated galleries. */
    public static function saveGalleries(array $data, int $userId): array
    {
        self::ensureSeeded();
        $clean = [
            'community' => [],
            'fieldwork' => [],
        ];
        foreach (['community', 'fieldwork'] as $k) {
            foreach ($data[$k] ?? [] as $item) {
                if (!empty($item['img'])) {
                    $clean[$k][] = [
                        'img' => trim((string) $item['img']),
                        'caption' => trim((string) ($item['caption'] ?? '')),
                    ];
                }
            }
        }

        Db::run(
            'UPDATE content SET doc = ?, rev = rev + 1, updated_at = ?, updated_by = ? WHERE area = ?',
            [json_encode($clean, JSON_UNESCAPED_UNICODE), Db::now(), $userId, 'gallery']
        );
        Audit::log($userId, 'gallery.updated');
        return $clean;
    }

    /** Ensure images and gallery areas are initialized in content table. */
    public static function ensureSeeded(): void
    {
        $hasImg = Db::one('SELECT COUNT(*) AS c FROM content WHERE area = ?', ['images']);
        if ((int) ($hasImg['c'] ?? 0) === 0) {
            $imgFile = dirname(SOTR_ROOT) . '/data/images.js';
            $items = [];
            if (is_file($imgFile)) {
                $content = (string) file_get_contents($imgFile);
                if (preg_match('/window\.SITE_IMAGES\s*=\s*(\{.*?\});/s', $content, $m)) {
                    // Extract keys and values safely
                    preg_match_all('/"([a-z0-9-_]+)":\s*\{\s*w:\s*\[([\d,\s]+)\],\s*r:\s*([\d.]+),\s*alt:\s*"([^"]*)"\s*\}/', $m[1], $matches, PREG_SET_ORDER);
                    foreach ($matches as $match) {
                        $widths = array_map('intval', explode(',', $match[2]));
                        $items[$match[1]] = [
                            'w' => $widths,
                            'r' => (float) $match[3],
                            'alt' => $match[4],
                            'ar' => ['alt' => ''],
                        ];
                    }
                }
            }
            Db::run('INSERT INTO content (area, doc, rev, updated_at) VALUES (?, ?, 1, ?)', [
                'images', json_encode(['items' => $items], JSON_UNESCAPED_UNICODE), Db::now()
            ]);
        }

        $hasGal = Db::one('SELECT COUNT(*) AS c FROM content WHERE area = ?', ['gallery']);
        if ((int) ($hasGal['c'] ?? 0) === 0) {
            $galFile = dirname(SOTR_ROOT) . '/data/gallery.js';
            $gal = ['community' => [], 'fieldwork' => []];
            if (is_file($galFile)) {
                $content = (string) file_get_contents($galFile);
                foreach (['community', 'fieldwork'] as $g) {
                    if (preg_match('/' . $g . ':\s*\[(.*?)\]/s', $content, $m)) {
                        preg_match_all('/\{\s*img:\s*"([^"]+)",\s*caption:\s*"([^"]*)"\s*\}/', $m[1], $matches, PREG_SET_ORDER);
                        foreach ($matches as $match) {
                            $gal[$g][] = ['img' => $match[1], 'caption' => $match[2]];
                        }
                    }
                }
            }
            Db::run('INSERT INTO content (area, doc, rev, updated_at) VALUES (?, ?, 1, ?)', [
                'gallery', json_encode($gal, JSON_UNESCAPED_UNICODE), Db::now()
            ]);
        }
    }
}
