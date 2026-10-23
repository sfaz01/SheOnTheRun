<?php
/* Plain PHP unit checks:  php server/tests/unit.php   (exits non-zero on any failure) */
declare(strict_types=1);

use Sotr\Auth;
use Sotr\Config;
use Sotr\Db;
use Sotr\Migrator;
use Sotr\Totp;

require dirname(__DIR__) . '/app/bootstrap.php';

$failures = 0;
function check(string $name, bool $ok): void
{
    global $failures;
    echo ($ok ? '  ok   ' : '  FAIL ') . $name . "\n";
    if (!$ok) {
        $failures++;
    }
}

/* ---- TOTP against the RFC 6238 test vectors (SHA-1, secret "12345678901234567890") */
$secret = Totp::base32Encode('12345678901234567890');
check('base32 encodes the RFC secret', $secret === 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
check('base32 round-trips', Totp::base32Decode($secret) === '12345678901234567890');
check('RFC vector t=59', Totp::code($secret, intdiv(59, 30)) === '287082');
check('RFC vector t=1111111109', Totp::code($secret, intdiv(1111111109, 30)) === '081804');
check('RFC vector t=20000000000', Totp::code($secret, intdiv(20000000000, 30)) === '353130');
check('8-digit RFC vector t=59', Totp::code($secret, intdiv(59, 30), 8) === '94287082');

$now = 1700000000;
$step = intdiv($now, 30);
$good = Totp::code($secret, $step);
check('verify accepts the current code', Totp::verify($secret, $good, 0, $now) === $step);
check('verify accepts spaces in the code', Totp::verify($secret, substr($good, 0, 3) . ' ' . substr($good, 3), 0, $now) === $step);
check('verify accepts the previous step (clock drift)', Totp::verify($secret, Totp::code($secret, $step - 1), 0, $now) === $step - 1);
check('verify rejects two steps away', Totp::verify($secret, Totp::code($secret, $step + 2), 0, $now) === null);
check('verify rejects a replay', Totp::verify($secret, $good, $step, $now) === null);
check('verify rejects garbage', Totp::verify($secret, 'abcdef', 0, $now) === null);
check('generated secrets are 32 chars of base32', (bool) preg_match('/^[A-Z2-7]{32}$/', Totp::generateSecret()));

/* ---- password rules */
check('short password refused', Auth::passwordProblem('too short', 'a@b.co') !== null);
check('email as password refused', Auth::passwordProblem('fatima@example.com', 'fatima@example.com') !== null);
check('repeated character refused', Auth::passwordProblem(str_repeat('a', 20), 'a@b.co') !== null);
check('a passphrase is accepted', Auth::passwordProblem('three purple running shoes', 'a@b.co') === null);
check('hash verifies', password_verify('hello world 123', Auth::hashPassword('hello world 123')));

/* ---- migrations on a throw-away SQLite file */
$tmp = sys_get_temp_dir() . '/sotr-unit-' . bin2hex(random_bytes(4)) . '.sqlite';
Config::load(['db' => ['driver' => 'sqlite', 'path' => $tmp]]);
Db::reset();
$applied = Migrator::run();
check('migration 001 applies', in_array('001_init.sql', $applied, true));
check('migrations are idempotent', Migrator::run() === []);
$tables = array_column(Db::all("SELECT name FROM sqlite_master WHERE type='table'"), 'name');
foreach (['users', 'recovery_codes', 'login_attempts', 'audit_log', 'migrations'] as $t) {
    check("table $t exists", in_array($t, $tables, true));
}
$id = Auth::createAdmin('Owner@Example.com', 'three purple running shoes');
check('admin created with lower-cased email', Db::one('SELECT email FROM users WHERE id = ?', [$id])['email'] === 'owner@example.com');
Db::reset();
@unlink($tmp);


/* ---- article text cleaner */
$S = '\Sotr\Sanitizer';
check('cleaner drops scripts, handlers and unknown classes', !preg_match('/script|onclick|evil/', $S::clean('<p class="evil" onclick="x()">Hi</p><script>alert(1)</script>')));
check('cleaner keeps Arabic and accents intact', $S::clean('<p>مرحبا — café “quoted” &amp; more</p>') === '<p>مرحبا — café “quoted” &amp; more</p>');
check('cleaner turns headings 1/4 into allowed ones', $S::clean('<h1>A</h1><h4>B</h4>') === "<h2>A</h2>\n\n<h3>B</h3>");
check('cleaner refuses javascript/data links but keeps the words', $S::clean('<p><a href="data:text/html,x">hi</a></p>') === '<p>hi</p>');
check('cleaner allows .html and absolute-path links', str_contains($S::clean('<p><a href="shop.html">s</a></p>'), 'href="shop.html"') && str_contains($S::clean('<p><a href="/about.html">a</a></p>'), 'href="/about.html"'));
$once = $S::clean('<p>One <b>two</b> <i>three</i></p><ul><li>a<li>b</ul>loose<br>text');
check('cleaner is idempotent', $S::clean($once) === $once);
check('cleaner wraps loose text in a paragraph', $S::clean('just words') === '<p>just words</p>');
check('cleaner returns empty for empty-ish input', $S::clean("  <p> </p> <script>x</script> ") === '');
check('cleaner neutralises broken markup', !str_contains($S::clean('<p>a<scr<script>ipt>alert(1)</script>'), '<script'));

/* ---- shop products: extra photos, colours, hidden */
$V = '\Sotr\Validator';
$beltDoc = static fn (array $over = []) => ['categories' => [['id' => 'c', 'name' => 'C', 'items' => [array_merge([
    'id' => 'belt', 'name' => 'Belt', 'image' => 'img-a', 'options' => ['Black', 'Navy'],
    'gallery' => ['img-b', 'img-b', '', 'img-c'],
    'optionPhotos' => ['Navy' => ['n-1', 'n-2'], 'Black' => ['b-1'], 'Gone' => ['x']],
], $over)]]], 'governorates' => ['Beirut']];
[$clean, $errs] = $V::run('shop', $beltDoc());
$item = $clean['categories'][0]['items'][0];
check('shop: a valid product with photos and colours has no errors', $errs === []);
check('shop: extra photos drop blanks and repeats', $item['gallery'] === ['img-b', 'img-c']);
check('shop: colour photos follow the colours’ order and drop unknown colours', array_keys($item['optionPhotos']) === ['Black', 'Navy']);
[$clean] = $V::run('shop', $beltDoc(['options' => []]));
check('shop: taking the colours away takes their photos away', !isset($clean['categories'][0]['items'][0]['optionPhotos']));
[$clean] = $V::run('shop', $beltDoc(['optionPhotos' => ['Black' => []]]));
check('shop: a colour with no photos is left out', !isset($clean['categories'][0]['items'][0]['optionPhotos']));
[, $errs] = $V::run('shop', $beltDoc(['gallery' => ['Not A Photo!']]));
check('shop: a bad photo name is refused beside its field', in_array('categories.0.items.0.gallery', array_column($errs, 'path'), true));
[, $errs] = $V::run('shop', $beltDoc(['gallery' => array_map(static fn ($n) => "p-$n", range(1, 9))]));
check('shop: more than 8 extra photos is refused', in_array('categories.0.items.0.gallery', array_column($errs, 'path'), true));
[, $errs] = $V::run('shop', $beltDoc(['optionPhotos' => ['Black' => array_map(static fn ($n) => "p-$n", range(1, 9))]]));
check('shop: more than 8 photos for one colour is refused', in_array('categories.0.items.0.optionPhotos.0', array_column($errs, 'path'), true));
[, $errs] = $V::run('shop', $beltDoc(['ar' => ['options' => ['أسود']]]));
check('shop: Arabic colours must match the English ones one for one', in_array('categories.0.items.0.ar.options', array_column($errs, 'path'), true));
[$clean, $errs] = $V::run('shop', $beltDoc(['ar' => ['options' => ['أسود', 'كحلي']], 'hidden' => true]));
check('shop: matching Arabic colours and the hidden switch are kept', $errs === [] && $clean['categories'][0]['items'][0]['ar']['options'] === ['أسود', 'كحلي'] && $clean['categories'][0]['items'][0]['hidden'] === true);
[$clean] = $V::run('shop', $beltDoc());
check('shop: an untouched hidden switch stays absent', !array_key_exists('hidden', $clean['categories'][0]['items'][0]));

$withHidden = ['categories' => [
    ['id' => 'a', 'name' => 'A', 'items' => [['id' => 'shown', 'name' => 'Shown', 'ar' => ['name' => 'ظاهر']], ['id' => 'away', 'name' => 'Away', 'hidden' => true, 'ar' => ['name' => 'مخفي']]]],
    ['id' => 'b', 'name' => 'B', 'items' => [['id' => 'gone', 'name' => 'Gone', 'hidden' => true]]],
], 'governorates' => ['Beirut']];
$files = \Sotr\Generator::files(['shop' => $withHidden]);
check('hidden products never reach the public products.js', str_contains($files['products.js'], '"shown"') && !str_contains($files['products.js'], 'away') && !str_contains($files['products.js'], 'gone'));
check('hidden products’ Arabic never reaches the public ar.js', str_contains($files['ar.js'], 'ظاهر') && !str_contains($files['ar.js'], 'مخفي'));

/* ---- the October 2026 shop upgrade, on the shop exactly as the live site had it */
$U = '\Sotr\ContentUpgrades';
$seedAreas = \Sotr\Content::seedAreas();
$oldShop = json_decode((string) file_get_contents(__DIR__ . '/fixtures/shop-before-2026-10.json'), true)['shop'];
$up = $U::shop($oldShop, $seedAreas['shop']);
$ids = static fn (array $shop): array => array_merge(...array_map(static fn ($c) => array_column($c['items'], 'id'), $shop['categories']));
$byId = static function (array $shop, string $id): ?array {
    foreach ($shop['categories'] as $c) {
        foreach ($c['items'] as $p) {
            if ($p['id'] === $id) {
                return $p;
            }
        }
    }
    return null;
};
[, $upErrors] = $V::run('shop', $up);
check('upgrade: the upgraded shop is valid', $upErrors === []);
check('upgrade: the cap is removed', !in_array('sotr-cap', $ids($up), true));
check('upgrade: the old “Sports Socks” becomes four separate socks, in its place', !in_array('sotr-socks', $ids($up), true)
    && array_slice($ids($up), 0, 6) === ['sotr-tee', 'sotr-bag', 'socks-grip-white', 'socks-striped', 'socks-corgi', 'socks-cherry']);
check('upgrade: sock prices are $3, $3, $5, $5', array_map(static fn ($id) => $byId($up, $id)['price'], ['socks-grip-white', 'socks-striped', 'socks-corgi', 'socks-cherry']) === [3, 3, 5, 5]);
check('upgrade: the tee costs $30', $byId($up, 'sotr-tee')['price'] === 30);
check('upgrade: the run bag, wellness tools, bottle and shaker are hidden, not deleted',
    array_reduce(['sotr-bag', 'food-scale', 'measuring-cups', 'portion-set', 'journal', 'pick-bottle', 'pick-shaker'], static fn ($ok, $id) => $ok && ($byId($up, $id)['hidden'] ?? false) === true, true));
check('upgrade: the socks and the belt are not hidden', ($byId($up, 'socks-corgi')['hidden'] ?? false) === false && ($byId($up, 'pick-belt')['hidden'] ?? false) === false);
$belt = $byId($up, 'pick-belt');
check('upgrade: the belt bag is one product in three colours at $12', $belt['price'] === 12 && $belt['options'] === ['Burgundy', 'Black', 'Navy'] && array_keys($belt['optionPhotos']) === ['Burgundy', 'Black', 'Navy']);
check('upgrade: the belt bag has its Arabic colours', $belt['ar']['options'] === ['عنّابي', 'أسود', 'كحلي']);
$myPicks = array_values(array_filter($up['categories'], static fn ($c) => $c['id'] === 'my-picks'))[0]['items'];
check('upgrade: the wrist pouch is new, right after the belt, at $12 in two colours', $myPicks[1]['id'] === 'pick-wrist-pouch' && $myPicks[1]['price'] === 12 && $myPicks[1]['options'] === ['Cream', 'Pink']);
check('upgrade: running it again changes nothing', $U::shop($up, $seedAreas['shop']) === $up);

$edited = $oldShop;
$edited['categories'][0]['items'][0]['blurb'] = 'My own words.';
$edited['categories'][0]['items'][0]['price'] = 28;
$kept = $U::shop($edited, $seedAreas['shop']);
check('upgrade: a tee price the owner already set, and her own words, are left alone', $byId($kept, 'sotr-tee')['price'] === 28 && $byId($kept, 'sotr-tee')['blurb'] === 'My own words.');
$twenty5 = $oldShop;
$twenty5['categories'][0]['items'][0]['price'] = 25;
check('upgrade: the old $25 placeholder on the tee becomes $30', $byId($U::shop($twenty5, $seedAreas['shop']), 'sotr-tee')['price'] === 30);
$noSocks = $oldShop;
$noSocks['categories'][0]['items'] = array_values(array_filter($noSocks['categories'][0]['items'], static fn ($p) => $p['id'] !== 'sotr-socks'));
check('upgrade: the four socks are still added if the old socks product is already gone', in_array('socks-cherry', $ids($U::shop($noSocks, $seedAreas['shop'])), true));

$oldPhotos = ['items' => array_values(array_filter($seedAreas['images']['items'], static fn ($i) => !preg_match('/^shop-(belt-|pouch-|socks-)/', $i['name'])))];
foreach ($oldPhotos['items'] as $k => $i) {
    if ($i['name'] === 'shop-belt') {
        $oldPhotos['items'][$k]['w'] = [480, 628];
    }
}
$newPhotos = $U::images($oldPhotos, $seedAreas['images']);
check('upgrade: all 26 new shop photos are added to the library', count($newPhotos['items']) === count($oldPhotos['items']) + 26 && count($newPhotos['items']) === count($seedAreas['images']['items']));
check('upgrade: the burgundy photo gains its small size', array_values(array_filter($newPhotos['items'], static fn ($i) => $i['name'] === 'shop-belt'))[0]['w'] === [160, 480, 628]);
check('upgrade: the new photos carry Arabic descriptions', !empty(array_values(array_filter($newPhotos['items'], static fn ($i) => $i['name'] === 'shop-pouch-pink-worn'))[0]['ar']['alt']));
check('upgrade: adding photos twice changes nothing', $U::images($newPhotos, $seedAreas['images']) === $newPhotos);
$everyProductPhoto = true;
foreach ($seedAreas['shop']['categories'] as $c) {
    foreach ($c['items'] as $p) {
        $names = array_merge([$p['image'] ?? ''], $p['gallery'] ?? [], ...array_values($p['optionPhotos'] ?? []));
        foreach (array_filter($names) as $n) {
            $everyProductPhoto = $everyProductPhoto && in_array($n, array_column($seedAreas['images']['items'], 'name'), true);
        }
    }
}
check('every photo a product uses is in the photo library', $everyProductPhoto);
$allExist = true;
foreach ($seedAreas['images']['items'] as $i) {
    if (str_starts_with($i['name'], 'shop-')) {
        foreach ($i['w'] as $w) {
            $allExist = $allExist && is_file(dirname(__DIR__, 2) . "/public/images/{$i['name']}-$w.jpg") && is_file(dirname(__DIR__, 2) . "/public/images/{$i['name']}-$w.webp");
        }
    }
}
check('every shop photo listed has its JPEG and WebP files on disk', $allExist);

echo $failures === 0 ? "\nAll checks passed.\n" : "\n$failures check(s) failed.\n";
exit($failures === 0 ? 0 : 1);
