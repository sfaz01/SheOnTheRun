<?php
declare(strict_types=1);

namespace Sotr;

/**
 * Builds the public Journal from the articles stored in the panel:
 * one HTML page per published article (from server/templates/article.html, which is the site's own
 * article page), plus feed.xml and sitemap.xml. Mirrors tools/build.js so the output is identical
 * whether the CI build or the panel wrote it.
 */
final class Journal
{
    private const SITE = 'https://sheontherun.com/';
    private const PAGES = [
        ['', '1.0'], ['dietontherun.html', '0.9'], ['about.html', '0.8'],
        ['sheontherun.html', '0.8'], ['public-health.html', '0.8'], ['shop.html', '0.7'],
        ['connect.html', '0.7'], ['journal/', '0.6'], ['ar/', '0.7'],
        ['ar/about.html', '0.6'], ['ar/dietontherun.html', '0.7'], ['ar/sheontherun.html', '0.6'],
        ['ar/public-health.html', '0.6'], ['ar/shop.html', '0.5'], ['ar/connect.html', '0.5'],
    ];

    /** @return array<int, array> the published (non-draft) articles, newest first */
    public static function published(array $postsDoc): array
    {
        $items = array_values(array_filter($postsDoc['items'] ?? [], static fn ($p) => empty($p['draft']) && ($p['slug'] ?? '') !== ''));
        usort($items, static fn ($a, $b) => strcmp((string) ($b['date'] ?? ''), (string) ($a['date'] ?? '')));
        return $items;
    }

    private static function e(string $s): string
    {
        return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    /** Text safe inside a JSON string that sits inside an HTML <script type="application/ld+json">. */
    private static function j(string $s): string
    {
        $enc = json_encode($s, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) ?: '""';
        return substr($enc, 1, -1);
    }

    public static function page(array $post): string
    {
        $tpl = (string) file_get_contents(SOTR_ROOT . '/templates/article.html');
        $title = (string) ($post['title'] ?? '');
        $kicker = (string) ($post['kicker'] ?? '');
        $excerpt = (string) ($post['excerpt'] ?? '');
        $date = (string) ($post['date'] ?? '');
        $ts = strtotime($date . ' 12:00:00 UTC');
        $dateLong = $ts ? gmdate('j M Y', $ts) : $date;
        $desc = trim((string) ($post['seoDescription'] ?? '')) !== '' ? (string) $post['seoDescription'] : $excerpt;
        $seoTitle = trim((string) ($post['seoTitle'] ?? '')) !== '' ? (string) $post['seoTitle'] : $title . ' — ' . $kicker . ' | Fatima Mouzahem';
        $image = (string) ($post['image'] ?? '');

        return strtr($tpl, [
            '{{SEO_TITLE}}'     => self::e($seoTitle),
            '{{DESCRIPTION}}'   => self::e($desc),
            '{{DESCRIPTION_J}}' => self::j($desc),
            '{{SLUG}}'          => self::e((string) $post['slug']),
            '{{TITLE}}'         => self::e($title),
            '{{TITLE_J}}'       => self::j($title),
            '{{EXCERPT}}'       => self::e($excerpt),
            '{{IMAGE}}'         => self::e($image),
            '{{DATE_ISO}}'      => self::e($date),
            '{{DATE_LONG}}'     => self::e($dateLong),
            '{{KICKER}}'        => self::e($kicker),
            '{{READING}}'       => self::e((string) ($post['readingTime'] ?? '')),
            '{{JOBTITLE}}'      => 'Licensed Dietitian and Certified Sports Nutritionist',
            // The body is already sanitised (Sanitizer) when it is saved; clean again on the way out as a second lock.
            '{{BODY}}'          => preg_replace('/^(?=.)/m', '          ', Sanitizer::clean((string) ($post['bodyHtml'] ?? ''))),
        ]);
    }

    public static function feed(array $published): string
    {
        $items = array_map(static function (array $p): string {
            $url = self::SITE . 'journal/' . $p['slug'] . '.html';
            $pub = gmdate('D, d M Y H:i:s', (int) strtotime(($p['date'] ?? '1970-01-01') . 'T08:00:00+03:00')) . ' GMT';
            return "    <item>\n      <title>" . self::e((string) $p['title']) . "</title>\n      <link>$url</link>\n      <guid>$url</guid>\n"
                . '      <category>' . self::e((string) ($p['kicker'] ?? '')) . "</category>\n      <pubDate>$pub</pubDate>\n"
                . '      <description>' . self::e((string) ($p['excerpt'] ?? '')) . "</description>\n    </item>";
        }, $published);
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<rss version=\"2.0\" xmlns:atom=\"http://www.w3.org/2005/Atom\">\n  <channel>\n"
            . "    <title>The Journal — Fatima Mouzahem</title>\n    <link>" . self::SITE . "journal/</link>\n"
            . '    <atom:link href="' . self::SITE . "feed.xml\" rel=\"self\" type=\"application/rss+xml\"/>\n"
            . "    <description>Nutrition, running and everyday wellbeing — from a licensed dietitian and sports nutritionist in Beirut.</description>\n"
            . "    <language>en</language>\n" . implode("\n", $items) . "\n  </channel>\n</rss>\n";
    }

    public static function sitemap(array $published): string
    {
        $urls = [];
        foreach (self::PAGES as [$p, $pr]) {
            $urls[] = '  <url><loc>' . self::SITE . "$p</loc><priority>$pr</priority></url>";
        }
        foreach ($published as $p) {
            $urls[] = '  <url><loc>' . self::SITE . 'journal/' . $p['slug'] . '.html</loc><lastmod>' . self::e((string) $p['date']) . '</lastmod><priority>0.5</priority></url>';
        }
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n" . implode("\n", $urls) . "\n</urlset>\n";
    }
}
