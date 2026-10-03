<?php
declare(strict_types=1);

namespace Sotr;

/**
 * Turns the stored documents back into the exact data files the website already reads
 * (window.SITE_SHOP, window.SITE_RUNS, …). English goes to its usual file; the Arabic
 * written beside each item is gathered into data/ar.js, matched by id as before.
 */
final class Generator
{
    public const FILES = ['config.js', 'products.js', 'runs.js', 'packages.js', 'testimonials.js', 'ar.js', 'posts.js', 'images.js', 'gallery.js'];

    /** @param array<string, array> $docs  area => document @return array<string, string> filename => contents */
    public static function files(array $docs): array
    {
        $shop = $docs['shop'] ?? ['categories' => []];
        $runs = $docs['runs'] ?? ['events' => []];
        $offer = $docs['offer'] ?? [];
        $extras = $docs['extras'] ?? [];

        $posts = $docs['posts'] ?? ['items' => []];
        $gallery = $docs['gallery'] ?? ['community' => [], 'fieldwork' => []];
        $images = $docs['images'] ?? ['items' => []];

        // The public posts list: published articles only, without bodies or Google wording.
        $publicPosts = [];
        foreach (Journal::published($posts) as $p) {
            $publicPosts[] = [
                'slug' => $p['slug'], 'title' => $p['title'], 'kicker' => $p['kicker'] ?? '', 'date' => $p['date'],
                'readingTime' => $p['readingTime'] ?? '', 'excerpt' => $p['excerpt'] ?? '', 'image' => $p['image'] ?? '', 'draft' => false,
            ];
        }
        $publicImages = [];
        foreach ($images['items'] ?? [] as $im) {
            $entry = ['w' => $im['w'], 'r' => $im['r'], 'alt' => $im['alt'] ?? ''];
            if (!empty($im['ar']['alt'])) {
                $entry['altAr'] = $im['ar']['alt'];
            }
            $publicImages[$im['name']] = $entry;
        }
        ksort($publicImages);
        $publicGallery = [];
        foreach (['community', 'fieldwork'] as $run) {
            $publicGallery[$run] = array_map(static fn ($g) => ['img' => $g['img'], 'caption' => $g['caption'] ?? ''], $gallery[$run] ?? []);
        }

        return [
            'config.js'       => self::js('SITE', $docs['settings'] ?? []),
            'products.js'     => self::js('SITE_SHOP', self::english($shop)),
            'runs.js'         => self::js('SITE_RUNS', self::english($runs)),
            'packages.js'     => self::js('SITE_OFFER', self::english($offer)),
            'testimonials.js' => self::js('SITE_TESTIMONIALS', self::english($docs['testimonials']['items'] ?? [])),
            'ar.js'           => self::js('SITE_AR', self::arabic($shop, $runs, $offer, $extras, $posts, $gallery)),
            'posts.js'        => self::js('SITE_POSTS', $publicPosts),
            'images.js'       => self::js('SITE_IMAGES', $publicImages),
            'gallery.js'      => self::js('SITE_GALLERY', $publicGallery),
        ];
    }

    /** The document with every "ar" key removed. */
    public static function english(mixed $node): mixed
    {
        if (!is_array($node)) {
            return $node;
        }
        $out = [];
        foreach ($node as $k => $v) {
            if ($k === 'ar' && !array_is_list($node)) {
                continue;
            }
            $out[$k] = self::english($v);
        }
        return $out;
    }

    private static function arabic(array $shop, array $runs, array $offer, array $extras, array $posts, array $gallery): array
    {
        $byId = static function (array $list): array {
            $map = [];
            foreach ($list as $x) {
                if (!empty($x['ar']) && isset($x['id'])) {
                    $map[$x['id']] = $x['ar'];
                }
            }
            return $map;
        };

        $items = [];
        foreach ($shop['categories'] ?? [] as $c) {
            $items += $byId($c['items'] ?? []);
        }

        $ar = [
            'services'  => $byId($offer['services'] ?? []),
            'packages'  => $byId($offer['packages'] ?? []),
            'challenge' => $offer['challenge']['ar'] ?? null,
            'fit'       => $offer['ar']['fit'] ?? null,
            'recurring' => $runs['recurring']['ar'] ?? null,
            'events'    => $byId($runs['events'] ?? []),
            'shop'      => ['categories' => $byId($shop['categories'] ?? []), 'items' => $items],
            'governorates' => $shop['ar']['governorates'] ?? null,
            'posts'     => self::arPosts($posts),
            'gallery'   => self::arGallery($gallery),
        ];
        foreach ($extras['ar'] ?? [] as $k => $v) {
            $ar[$k] = $v;
        }
        return array_filter($ar, static fn ($v) => $v !== null);
    }

    /** slug => the Arabic card wording for each article that has any. */
    private static function arPosts(array $posts): array
    {
        $map = [];
        foreach ($posts['items'] ?? [] as $p) {
            if (!empty($p['ar']) && !empty($p['slug'])) {
                $map[$p['slug']] = $p['ar'];
            }
        }
        return $map;
    }

    /** photo name => Arabic caption (the site matches captions to photos by name). */
    private static function arGallery(array $gallery): array
    {
        $map = [];
        foreach (['community', 'fieldwork'] as $run) {
            foreach ($gallery[$run] ?? [] as $g) {
                if (!empty($g['ar']['caption']) && !empty($g['img'])) {
                    $map[$g['img']] = $g['ar']['caption'];
                }
            }
        }
        return $map;
    }

    private static function js(string $global, mixed $data): string
    {
        $json = json_encode(
            self::objects($data),
            JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
        );
        return "/* Generated by the SheOnTheRun admin panel. Edit it at /admin — changes made\n"
            . "   to this file by hand are replaced the next time someone presses Publish. */\n\n"
            . "window.$global = $json;\n";
    }

    /** Empty maps must stay objects ({}), not become lists ([]), in the generated JavaScript. */
    private static function objects(mixed $node): mixed
    {
        if (!is_array($node)) {
            return $node;
        }
        if ($node === []) {
            return $node;
        }
        $out = [];
        foreach ($node as $k => $v) {
            $out[$k] = self::objects($v);
        }
        if (!array_is_list($node)) {
            return (object) $out;
        }
        return $out;
    }
}
