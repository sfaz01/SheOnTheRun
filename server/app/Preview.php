<?php
declare(strict_types=1);

namespace Sotr;

/**
 * Preview the drafts on the real pages, before pressing Publish.
 *
 * The public site reads plain data/*.js files, so a preview is the same page with its
 * data script tags pointed at /api/preview/data/<name>.js — the generator's output for
 * the saved drafts. Only a signed-in admin can open one, and nothing here writes a file:
 * the live site and its data files are untouched, so a preview can never break anything.
 */
final class Preview
{
    /** Folders that are never preview pages, whatever the link says. */
    private const BLOCKED = ['admin/', 'api/', 'server/', 'data/', 'docs/', 'tools/'];

    public static function page(string $path): never
    {
        $rel = self::clean($path);
        $html = self::html($rel);
        if ($html === null) {
            throw new HttpError(404, 'That page isn’t part of the website.');
        }
        $html = self::rewrite($html, self::dirOf($rel));
        header_remove('Content-Type');
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-store');
        echo $html;
        exit;
    }

    public static function data(string $name): never
    {
        if (!preg_match('/^[a-z0-9-]+\.js$/', $name) || !in_array($name, Generator::FILES, true)) {
            throw new HttpError(404, 'Not found.');
        }
        $files = Generator::files(Content::drafts());
        if (!isset($files[$name])) {
            throw new HttpError(404, 'Not found.');
        }
        header_remove('Content-Type');
        header('Content-Type: application/javascript; charset=utf-8');
        header('Cache-Control: no-store');
        echo $files[$name];
        exit;
    }

    /* ---------------------------------------------------------------- internals */

    /** A safe, normalised page path like "ar/shop.html" or "journal/some-post.html". */
    private static function clean(string $path): string
    {
        $path = str_replace('\\', '/', trim($path));
        if ($path === '' || str_contains($path, "\0") || strlen($path) > 200) {
            throw new HttpError(400, 'That preview link isn’t valid.');
        }
        $parts = [];
        foreach (explode('/', ltrim($path, '/')) as $seg) {
            if ($seg === '' || $seg === '.') {
                continue;
            }
            if ($seg === '..' || $seg[0] === '.' || !preg_match('/^[A-Za-z0-9._-]+$/', $seg)) {
                throw new HttpError(400, 'That preview link isn’t valid.');
            }
            $parts[] = strtolower($seg);
        }
        $rel = implode('/', $parts);
        if (!str_ends_with($rel, '.html')) {
            throw new HttpError(400, 'Preview only opens website pages.');
        }
        foreach (self::BLOCKED as $blocked) {
            if (str_starts_with($rel, $blocked)) {
                throw new HttpError(404, 'That page isn’t part of the website.');
            }
        }
        return $rel;
    }

    /** The page's HTML: a draft article generated from the drafts, or the file itself. */
    private static function html(string $rel): ?string
    {
        if (preg_match('#^journal/([a-z0-9-]+)\.html$#', $rel, $m)) {
            foreach (Content::drafts()['posts']['items'] ?? [] as $post) {
                if (($post['slug'] ?? '') === $m[1]) {
                    return Journal::page($post); // drafts included, exactly as Publish would write them
                }
            }
        }
        foreach ([Config::siteRoot(), dirname(SOTR_ROOT)] as $root) {
            $file = $root . '/' . $rel;
            if (is_file($file)) {
                return (string) file_get_contents($file);
            }
        }
        return null;
    }

    private static function dirOf(string $rel): string
    {
        $dir = dirname($rel);
        return $dir === '.' ? '' : $dir;
    }

    /**
     * Point the data scripts at the draft generator, make relative assets resolve from the
     * preview address, and keep every internal page link inside the preview.
     */
    private static function rewrite(string $html, string $dir): string
    {
        $base = '/' . ($dir === '' ? '' : $dir . '/');

        if (!preg_match('/<base\b/i', $html)) {
            $withBase = preg_replace('/<head(\s[^>]*)?>/i', '$0' . "\n<base href=\"" . $base . '">', $html, 1);
            $html = is_string($withBase) ? $withBase : $html;
        }

        // <script src="data/…js"> → the same data, generated from the saved drafts.
        $html = preg_replace_callback(
            '#(<script\b[^>]*?\bsrc\s*=\s*)(["\'])(?:\.\./|\./)*data/([a-z0-9-]+)\.js[^"\']*\2#i',
            static function (array $m): string {
                if (!in_array($m[3] . '.js', Generator::FILES, true)) {
                    return $m[0];
                }
                return $m[1] . $m[2] . '/api/preview/data/' . $m[3] . '.js' . $m[2];
            },
            $html
        );

        // Links to other site pages keep showing the drafts while she clicks around.
        $html = preg_replace_callback(
            '#(\bhref\s*=\s*)(["\'])([^"\']+)\2#i',
            static function (array $m) use ($dir): string {
                $href = $m[3];
                if ($href === '' || $href[0] === '#'
                    || preg_match('#^[a-z][a-z0-9+.-]*:#i', $href) || str_starts_with($href, '//')) {
                    return $m[0];
                }
                $cut = strcspn($href, '?#');
                $target = substr($href, 0, $cut);
                $suffix = substr($href, $cut);
                if ($target === '' || strtolower(substr($target, -5)) !== '.html') {
                    return $m[0];
                }
                $joined = self::joinPath($dir, $target);
                if ($joined === null || !str_ends_with($joined, '.html')) {
                    return $m[0];
                }
                if ($suffix !== '' && $suffix[0] === '?') {
                    $suffix = '&' . substr($suffix, 1); // the preview address already has a query
                }
                $encoded = implode('/', array_map('rawurlencode', explode('/', $joined)));
                return $m[1] . $m[2] . '/api/preview/page?p=' . $encoded . $suffix . $m[2];
            },
            $html
        );

        return $html;
    }

    /** Resolve a relative page link against the folder the page is in; null when it escapes the site. */
    private static function joinPath(string $dir, string $target): ?string
    {
        $parts = $dir === '' ? [] : explode('/', $dir);
        $file = $target;
        if (str_starts_with($target, '/')) { // a rooted link is relative to the site root
            $parts = [];
            $file = ltrim($target, '/');
        }
        foreach (explode('/', $file) as $seg) {
            if ($seg === '' || $seg === '.') {
                continue;
            }
            if ($seg === '..') {
                if (!$parts) {
                    return null;
                }
                array_pop($parts);
                continue;
            }
            $parts[] = $seg;
        }
        return implode('/', $parts);
    }
}
