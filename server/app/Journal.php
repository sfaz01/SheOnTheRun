<?php
declare(strict_types=1);

namespace Sotr;

/**
 * Phase 2: Journal article management, drafts, publishing, static HTML page generation, feed.xml, and sitemap.xml.
 */
final class Journal
{
    /** List all journal posts from the database. */
    public static function list(): array
    {
        self::ensureSeeded();
        $row = Db::one('SELECT doc FROM content WHERE area = ?', ['posts']);
        $doc = $row ? (json_decode($row['doc'], true) ?: []) : [];
        $items = $doc['items'] ?? [];
        usort($items, static fn ($a, $b) => strcmp($b['date'] ?? '', $a['date'] ?? ''));
        return $items;
    }

    /** Get a single post by slug, including bodyHtml. */
    public static function get(string $slug): ?array
    {
        self::ensureSeeded();
        $items = self::list();
        foreach ($items as $post) {
            if (($post['slug'] ?? '') === $slug) {
                // If bodyHtml is not stored in doc, attempt to read from existing journal HTML file
                if (empty($post['bodyHtml'])) {
                    $post['bodyHtml'] = self::extractProseFromHtml($slug);
                }
                return $post;
            }
        }
        return null;
    }

    /** Save an article (creates or updates). */
    public static function save(array $data, int $userId): array
    {
        self::ensureSeeded();
        $title = trim((string) ($data['title'] ?? ''));
        if ($title === '' || mb_strlen($title) > 150) {
            throw new HttpError(422, 'Please enter an article title.', 'invalid', ['field' => 'title']);
        }

        $slug = trim(mb_strtolower((string) ($data['slug'] ?? '')));
        if ($slug === '') {
            $slug = self::slugify($title);
        } else {
            $slug = preg_replace('/[^a-z0-9-_]/', '-', $slug) ?: self::slugify($title);
            $slug = trim($slug, '-');
        }

        $kicker = trim((string) ($data['kicker'] ?? "Women's nutrition"));
        $date = trim((string) ($data['date'] ?? date('Y-m-d')));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            $date = date('Y-m-d');
        }

        $readingTime = trim((string) ($data['readingTime'] ?? '5 min'));
        $excerpt = trim((string) ($data['excerpt'] ?? ''));
        $image = trim((string) ($data['image'] ?? 'journal-10k'));
        $draft = !empty($data['draft']);
        $bodyHtml = trim((string) ($data['bodyHtml'] ?? ''));

        $items = self::list();
        $found = false;
        $updated = [];
        foreach ($items as $p) {
            if ($p['slug'] === $slug) {
                $updated[] = [
                    'slug' => $slug,
                    'title' => $title,
                    'kicker' => $kicker,
                    'date' => $date,
                    'readingTime' => $readingTime,
                    'excerpt' => $excerpt,
                    'image' => $image,
                    'draft' => $draft,
                    'bodyHtml' => $bodyHtml,
                ];
                $found = true;
            } else {
                $updated[] = $p;
            }
        }

        if (!$found) {
            array_unshift($updated, [
                'slug' => $slug,
                'title' => $title,
                'kicker' => $kicker,
                'date' => $date,
                'readingTime' => $readingTime,
                'excerpt' => $excerpt,
                'image' => $image,
                'draft' => $draft,
                'bodyHtml' => $bodyHtml,
            ]);
        }

        Db::run(
            'UPDATE content SET doc = ?, rev = rev + 1, updated_at = ?, updated_by = ? WHERE area = ?',
            [json_encode(['items' => $updated], JSON_UNESCAPED_UNICODE), Db::now(), $userId, 'posts']
        );
        Audit::log($userId, 'journal.saved', $slug);

        return self::get($slug);
    }

    /** Delete an article. */
    public static function delete(string $slug, int $userId): void
    {
        self::ensureSeeded();
        $items = self::list();
        $filtered = array_values(array_filter($items, static fn ($p) => ($p['slug'] ?? '') !== $slug));

        Db::run(
            'UPDATE content SET doc = ?, rev = rev + 1, updated_at = ?, updated_by = ? WHERE area = ?',
            [json_encode(['items' => $filtered], JSON_UNESCAPED_UNICODE), Db::now(), $userId, 'posts']
        );
        Audit::log($userId, 'journal.deleted', $slug);
    }

    /** Generate static HTML page for an article. */
    public static function generateHtml(array $post): string
    {
        $title = htmlspecialchars($post['title'] ?? '', ENT_QUOTES, 'UTF-8');
        $kicker = htmlspecialchars($post['kicker'] ?? '', ENT_QUOTES, 'UTF-8');
        $date = htmlspecialchars($post['date'] ?? '', ENT_QUOTES, 'UTF-8');
        $readingTime = htmlspecialchars($post['readingTime'] ?? '5 min', ENT_QUOTES, 'UTF-8');
        $excerpt = htmlspecialchars($post['excerpt'] ?? '', ENT_QUOTES, 'UTF-8');
        $slug = htmlspecialchars($post['slug'] ?? '', ENT_QUOTES, 'UTF-8');
        $image = htmlspecialchars($post['image'] ?? 'journal-10k', ENT_QUOTES, 'UTF-8');
        $body = $post['bodyHtml'] ?? '';
        if ($body === '') {
            $body = "<p>$excerpt</p>";
        }

        // Format date display e.g. "2 Sep 2026"
        $ts = strtotime($date);
        $dateFmt = $ts ? date('j M Y', $ts) : $date;

        return <<<HTML
<!doctype html>
<html lang="en">
<head>
<script>document.documentElement.className += " js";</script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{$title} — {$kicker} | Fatima Mouzahem</title>
<meta name="description" content="{$excerpt}">
<link rel="canonical" href="https://sheontherun.com/journal/{$slug}.html">
<meta name="theme-color" content="#FCFBF9">
<meta property="og:type" content="article">
<meta property="og:title" content="{$title}">
<meta property="og:description" content="{$excerpt}">
<meta property="og:url" content="https://sheontherun.com/journal/{$slug}.html">
<meta property="og:image" content="https://sheontherun.com/public/images/{$image}-1440.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="../assets/img/favicon.svg" type="image/svg+xml">
<link rel="alternate icon" href="../favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="../assets/img/apple-touch-icon.png">
<link rel="alternate" type="application/rss+xml" title="The Journal — Fatima Mouzahem" href="../feed.xml">
<link rel="manifest" href="../site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,300..700,0..100,0..1&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&display=swap">
<link rel="stylesheet" href="../assets/css/style.css">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{$title}",
  "description": "{$excerpt}",
  "datePublished": "{$date}",
  "inLanguage": "en",
  "author": {
    "@type": "Person",
    "name": "Fatima Mouzahem",
    "jobTitle": "Licensed Dietitian and Certified Sports Nutritionist",
    "url": "https://sheontherun.com/about.html"
  },
  "publisher": { "@type": "Person", "name": "Fatima Mouzahem" },
  "mainEntityOfPage": "https://sheontherun.com/journal/{$slug}.html"
}
</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>

<header class="site-header">
  <div class="wrap">
    <a class="brand" href="../index.html">
      <span class="bn">Fatima Mouzahem</span>
      <span class="bs">Dietitian · Sports Nutritionist</span>
    </a>
    <nav class="nav" data-nav aria-label="Primary">
      <a href="../about.html">About me</a>
      <a href="../dietontherun.html">DietOnTheRun</a>
      <a href="../sheontherun.html">SheOnTheRun</a>
      <a href="../public-health.html">Public Health</a>
      <a href="../shop.html">Shop</a>
      <a class="btn sm lilac" href="../connect.html">Connect with me</a>
    </nav>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="drawer">
      <span class="bars" aria-hidden="true"><i></i><i></i><i></i></span><span>Menu</span>
    </button>
  </div>
</header>

<div class="drawer" id="drawer" hidden>
  <nav data-nav aria-label="Menu">
    <a href="../index.html">Home</a>
    <a href="../about.html">About me</a>
    <a href="../dietontherun.html">DietOnTheRun</a>
    <a href="../sheontherun.html">SheOnTheRun</a>
    <a href="../public-health.html">Public Health</a>
    <a href="../shop.html">Shop</a>
  </nav>
  <div class="drawer-foot">
    <a class="btn lilac block" href="../connect.html">Connect with me <span class="arw" aria-hidden="true">→</span></a>
    <div class="drawer-meta">
      <a data-wa="Hi Fatima! I found you through your website." data-interest="general" href="../connect.html">WhatsApp</a>
      <a data-instagram data-instagram-label href="../connect.html">Instagram</a>
      <a data-email="Enquiry via your website" href="../connect.html"><span data-email-text>Email</span></a>
    </div>
  </div>
</div>

<main id="main">

  <article class="band-tight">
    <div class="wrap">
      <div class="article">
        <a class="tlink mb-m" href="index.html"><span class="arw" aria-hidden="true">←</span> The Journal</a>

        <p class="measured mt-m">{$kicker} · {$dateFmt} · {$readingTime}</p>
        <h1 class="page-title mt-s reveal in">{$title}</h1>
        <p class="lede mt-m" style="max-width:38ch">{$excerpt}</p>

        <div class="fig r-32 mt-l" data-img="{$image}" data-sizes="(min-width: 900px) 42rem, 92vw" data-eager></div>

        <div class="prose mt-l">
{$body}
        </div>

        <div class="author-card mt-xl reveal">
          <div class="fig-round sm" data-img="dotr-portrait"></div>
          <div>
            <p class="measured">Written by</p>
            <h3>Fatima Mouzahem</h3>
            <p class="prose mt-s">Licensed dietitian, certified sports nutritionist and public health professional. Founder of SheOnTheRun. Beirut, Lebanon — and online, wherever you are.</p>
            <div class="btn-row mt-m">
              <a class="btn lilac sm" href="../connect.html">Work with me</a>
              <a class="btn ghost sm" href="../about.html">About me</a>
            </div>
          </div>
        </div>

      </div>
    </div>
  </article>

</main>

<footer class="site-footer">
  <div class="wrap">
    <div class="foot-top">
      <div>
        <p class="foot-name">Fatima<br>Mouzahem</p>
        <p class="foot-sub">Licensed dietitian, certified sports nutritionist and public health professional. Beirut, Lebanon — and online, wherever you are.</p>
        <div class="lanes" style="max-width:110px;margin-top:1.75rem" aria-hidden="true"></div>
      </div>
      <div class="foot-col">
        <h4>Explore</h4>
        <ul>
          <li><a href="../about.html">About me</a></li>
          <li><a href="../dietontherun.html">DietOnTheRun</a></li>
          <li><a href="../sheontherun.html">SheOnTheRun</a></li>
          <li><a href="../public-health.html">Public Health</a></li>
          <li><a href="../shop.html">Shop</a></li>
          <li><a href="index.html">The Journal</a></li>
        </ul>
      </div>
      <div class="foot-col">
        <h4>Start a conversation</h4>
        <ul>
          <li><a data-wa="Hi Fatima! I found you through your website." data-interest="general" href="../connect.html">WhatsApp</a></li>
          <li><a data-email="Enquiry via your website" href="../connect.html"><span data-email-text>Email</span></a></li>
          <li><a data-instagram data-instagram-label href="../connect.html">Instagram</a></li>
          <li><a href="../connect.html">Connect with me</a></li>
        </ul>
      </div>
    </div>
    <div class="foot-bottom">
      <p>© <span class="num">2026</span> Fatima Mouzahem</p>
      <p>Beirut, Lebanon</p>
      <p>Nutrition advice on this site is general. A consultation is personal.</p>
    </div>
  </div>
</footer>

<script src="../data/config.js"></script>
<script src="../data/images.js"></script>
<script src="../assets/js/site.js" defer></script>
<script src="../assets/js/motion.js" defer></script>
</body>
</html>
HTML;
    }

    /** Generate feed.xml RSS 2.0. */
    public static function generateFeed(array $posts): string
    {
        $siteUrl = 'https://sheontherun.com/';
        $published = array_values(array_filter($posts, static fn ($p) => empty($p['draft'])));
        usort($published, static fn ($a, $b) => strcmp($b['date'] ?? '', $a['date'] ?? ''));

        $items = [];
        foreach ($published as $p) {
            $url = $siteUrl . 'journal/' . $p['slug'] . '.html';
            $title = htmlspecialchars($p['title'] ?? '', ENT_QUOTES, 'UTF-8');
            $kicker = htmlspecialchars($p['kicker'] ?? '', ENT_QUOTES, 'UTF-8');
            $excerpt = htmlspecialchars($p['excerpt'] ?? '', ENT_QUOTES, 'UTF-8');
            $pubDate = gmdate(DATE_RSS, strtotime(($p['date'] ?? date('Y-m-d')) . 'T08:00:00+03:00'));

            $items[] = <<<ITEM
    <item>
      <title>{$title}</title>
      <link>{$url}</link>
      <guid>{$url}</guid>
      <category>{$kicker}</category>
      <pubDate>{$pubDate}</pubDate>
      <description>{$excerpt}</description>
    </item>
ITEM;
        }

        $itemsXml = implode("\n", $items);
        return <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>The Journal — Fatima Mouzahem</title>
    <link>{$siteUrl}journal/</link>
    <atom:link href="{$siteUrl}feed.xml" rel="self" type="application/rss+xml"/>
    <description>Nutrition, running and everyday wellbeing — from a licensed dietitian and sports nutritionist in Beirut.</description>
    <language>en</language>
{$itemsXml}
  </channel>
</rss>
XML;
    }

    /** Generate sitemap.xml. */
    public static function generateSitemap(array $posts): string
    {
        $siteUrl = 'https://sheontherun.com/';
        $pages = [
            ['', '1.0'], ['dietontherun.html', '0.9'], ['about.html', '0.8'],
            ['sheontherun.html', '0.8'], ['public-health.html', '0.8'], ['shop.html', '0.7'],
            ['connect.html', '0.7'], ['journal/', '0.6'], ['ar/', '0.7'],
            ['ar/about.html', '0.6'], ['ar/dietontherun.html', '0.7'], ['ar/sheontherun.html', '0.6'],
            ['ar/public-health.html', '0.6'], ['ar/shop.html', '0.5'], ['ar/connect.html', '0.5'],
        ];

        $urls = [];
        foreach ($pages as [$path, $priority]) {
            $urls[] = "  <url><loc>{$siteUrl}{$path}</loc><priority>{$priority}</priority></url>";
        }

        $published = array_filter($posts, static fn ($p) => empty($p['draft']));
        foreach ($published as $p) {
            $date = htmlspecialchars($p['date'] ?? date('Y-m-d'), ENT_QUOTES, 'UTF-8');
            $urls[] = "  <url><loc>{$siteUrl}journal/{$p['slug']}.html</loc><lastmod>{$date}</lastmod><priority>0.5</priority></url>";
        }

        $urlsXml = implode("\n", $urls);
        return <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{$urlsXml}
</urlset>
XML;
    }

    /** Seed posts area from data/posts.js if empty. */
    public static function ensureSeeded(): void
    {
        $has = Db::one('SELECT COUNT(*) AS c FROM content WHERE area = ?', ['posts']);
        if ((int) ($has['c'] ?? 0) === 0) {
            $postsFile = dirname(SOTR_ROOT) . '/data/posts.js';
            $items = [];
            if (is_file($postsFile)) {
                $content = (string) file_get_contents($postsFile);
                if (preg_match('/window\.SITE_POSTS\s*=\s*(\[.*?\]);/s', $content, $m)) {
                    $jsonLike = preg_replace('/(\w+)\s*:/', '"$1":', $m[1]);
                    $jsonLike = preg_replace('/,\s*([\]\}])/', '$1', $jsonLike);
                    $decoded = json_decode($jsonLike, true);
                    if (is_array($decoded)) {
                        $items = $decoded;
                    }
                }
            }
            if (empty($items)) {
                $items = [
                    [
                        'slug' => 'a-month-in-shanghai',
                        'title' => 'A month in Shanghai',
                        'kicker' => 'Traditional wisdom',
                        'date' => '2026-09-26',
                        'readingTime' => '3 min',
                        'excerpt' => 'Evidence and tradition were never enemies. One month at the Shanghai University of Traditional Chinese Medicine, following curiosity.',
                        'image' => 'china-summer-school',
                        'draft' => false,
                        'bodyHtml' => '',
                    ],
                    [
                        'slug' => 'fuelling-your-first-10k',
                        'title' => 'Fuelling your first 10k',
                        'kicker' => 'Sports & active nutrition',
                        'date' => '2026-09-02',
                        'readingTime' => '7 min',
                        'excerpt' => 'What to eat the week before, the morning of, and — the part nobody talks about — in the hour after you finish.',
                        'image' => 'journal-10k',
                        'draft' => false,
                        'bodyHtml' => '',
                    ],
                ];
            }
            Db::run('INSERT INTO content (area, doc, rev, updated_at) VALUES (?, ?, 1, ?)', [
                'posts', json_encode(['items' => $items], JSON_UNESCAPED_UNICODE), Db::now()
            ]);
        }
    }

    private static function extractProseFromHtml(string $slug): string
    {
        $file = dirname(SOTR_ROOT) . "/journal/{$slug}.html";
        if (is_file($file)) {
            $html = (string) file_get_contents($file);
            if (preg_match('/<div class="prose mt-l">(.*?)<\/div>\s*<div class="author-card/s', $html, $m)) {
                return trim($m[1]);
            }
        }
        return '';
    }

    private static function slugify(string $text): string
    {
        $text = mb_strtolower($text);
        $text = preg_replace('/[^\p{L}\p{Nd}]+/u', '-', $text);
        return trim($text ?: 'article-' . time(), '-');
    }
}
