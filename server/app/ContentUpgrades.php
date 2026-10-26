<?php
declare(strict_types=1);

namespace Sotr;

/**
 * One-time changes to the owner's saved content that a plain deploy can't make: her shop lives in
 * the database, not in files. Each upgrade runs once, on the first request after it is deployed,
 * and changes the DRAFTS only — the live site stays exactly as it is until she has looked at it
 * (Preview) and pressed Publish. What each one adds comes from the seed file, so there is one
 * source for the new products, and everything is matched by reference, never by position, so
 * edits she has already made are left alone.
 */
final class ContentUpgrades
{
    /** The October 2026 shop update: separate socks, colours and photos, prices, hidden products, and orders taken in the admin. */
    public const SHOP_2026_10 = 'shop-2026-10';

    private const REMOVE = ['sotr-cap'];
    private const SOCKS = ['socks-grip-white', 'socks-striped', 'socks-corgi', 'socks-cherry'];
    /** The price she gave the tee, and the two values it can still have from before (nothing yet, or the old placeholder). */
    private const TEE = ['id' => 'sotr-tee', 'was' => [null, 25]];

    public static function apply(): void
    {
        $extras = Content::get('extras');
        $done = $extras['doc']['upgrades'] ?? [];
        if (in_array(self::SHOP_2026_10, $done, true)) {
            return;
        }

        $pdo = Db::pdo();
        $pdo->beginTransaction();
        try {
            $seed = Content::seedAreas();
            $shop = Content::get('shop');
            $images = Content::get('images');
            $settings = Content::get('settings');
            $newShop = self::shop($shop['doc'], $seed['shop']);
            $newImages = self::images($images['doc'], $seed['images']);
            $newSettings = self::settings($settings['doc']);

            $problem = null;
            [$cleanShop, $errors] = Validator::run('shop', $newShop);
            [$cleanSettings, $settingsErrors] = Validator::run('settings', $newSettings);
            if ($errors) {
                $problem = 'shop: ' . $errors[0]['path'] . ' ' . $errors[0]['message'];
            } elseif ($settingsErrors) {
                $problem = 'settings: ' . $settingsErrors[0]['path'] . ' ' . $settingsErrors[0]['message'];
            }

            $changed = [];
            if ($problem === null) {
                if ($cleanShop !== $shop['doc']) {
                    self::write('shop', $cleanShop, $shop['rev']);
                    $changed[] = 'shop';
                }
                if ($newImages !== $images['doc']) {
                    self::write('images', $newImages, $images['rev']);
                    $changed[] = 'images';
                }
                if ($newSettings !== $settings['doc']) {
                    self::write('settings', $cleanSettings, $settings['rev']);
                    $changed[] = 'settings';
                }
            }
            // Recorded either way, so a problem is reported once instead of on every request.
            $doc = $extras['doc'];
            $doc['upgrades'] = array_merge($done, [self::SHOP_2026_10]);
            self::write('extras', $doc, $extras['rev']);
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            // Most likely another request did it at the same moment; the next request will see that.
            error_log('[sotr] content upgrade ' . self::SHOP_2026_10 . ' did not apply: ' . $e->getMessage());
            return;
        }
        if ($problem !== null) {
            error_log('[sotr] content upgrade ' . self::SHOP_2026_10 . ' skipped: ' . $problem);
            Audit::log(null, 'content.upgrade_skipped', self::SHOP_2026_10 . ' — ' . $problem);
        } elseif ($changed) {
            Audit::log(null, 'content.upgraded', self::SHOP_2026_10 . ' (' . implode(', ', $changed) . ')');
        }
    }

    /** Write a document if nobody changed it since we read it. */
    private static function write(string $area, array $doc, int $rev): void
    {
        $n = Db::run(
            'UPDATE content SET doc = ?, rev = rev + 1, updated_at = ? WHERE area = ? AND rev = ?',
            [Content::encode($doc), Db::now(), $area, $rev]
        );
        if ($n !== 1) {
            throw new \RuntimeException("$area changed while upgrading");
        }
    }

    /* ------------------------------------------------------------------ the shop */

    public static function shop(array $draft, array $seed): array
    {
        $want = [];
        foreach ($seed['categories'] ?? [] as $cat) {
            foreach ($cat['items'] ?? [] as $p) {
                $want[$p['id']] = ['item' => $p, 'category' => $cat['id']];
            }
        }
        $find = static function (array $shop, string $id): ?array {
            foreach ($shop['categories'] ?? [] as $ci => $cat) {
                foreach ($cat['items'] ?? [] as $ii => $p) {
                    if (($p['id'] ?? '') === $id) {
                        return [$ci, $ii];
                    }
                }
            }
            return null;
        };
        $categoryIndex = static function (array $shop, string $id): ?int {
            foreach ($shop['categories'] ?? [] as $ci => $cat) {
                if (($cat['id'] ?? '') === $id) {
                    return $ci;
                }
            }
            return null;
        };
        $insert = static function (array &$shop, int $ci, int $at, array $item): void {
            array_splice($shop['categories'][$ci]['items'], $at, 0, [$item]);
        };

        $shop = $draft;

        // The cap is gone.
        foreach (self::REMOVE as $id) {
            if (($at = $find($shop, $id)) !== null) {
                array_splice($shop['categories'][$at[0]]['items'], $at[1], 1);
            }
        }

        // One "Sports Socks" product becomes four separate ones, in its place.
        $position = null;
        if (($at = $find($shop, 'sotr-socks')) !== null) {
            array_splice($shop['categories'][$at[0]]['items'], $at[1], 1);
            $position = $at;
        }
        $fresh = array_values(array_filter(self::SOCKS, static fn ($id) => $find($shop, $id) === null && isset($want[$id])));
        if ($fresh) {
            if ($position === null) {
                $tee = $find($shop, self::TEE['id']);
                $ci = $tee !== null ? $tee[0] : $categoryIndex($shop, $want[$fresh[0]]['category']);
                $position = $ci === null ? null : [$ci, $tee !== null ? $tee[1] + 1 : count($shop['categories'][$ci]['items'] ?? [])];
            }
            if ($position !== null) {
                foreach ($fresh as $n => $id) {
                    $insert($shop, $position[0], $position[1] + $n, $want[$id]['item']);
                }
            }
        }

        // The tee costs $30 (only changed if it still has the placeholder it started with).
        if (($at = $find($shop, self::TEE['id'])) !== null && isset($want[self::TEE['id']])) {
            $price = $shop['categories'][$at[0]]['items'][$at[1]]['price'] ?? null;
            if (in_array($price, self::TEE['was'], true)) {
                $shop['categories'][$at[0]]['items'][$at[1]]['price'] = $want[self::TEE['id']]['item']['price'];
            }
        }

        // Products she asked to keep out of sight for now.
        foreach ($want as $id => $w) {
            if (!empty($w['item']['hidden']) && ($at = $find($shop, $id)) !== null) {
                $shop['categories'][$at[0]]['items'][$at[1]]['hidden'] = true;
            }
        }

        // The belt bag becomes one product with colours; the wrist pouch is new, right after it.
        if (isset($want['pick-belt'])) {
            if (($at = $find($shop, 'pick-belt')) !== null) {
                $shop['categories'][$at[0]]['items'][$at[1]] = $want['pick-belt']['item'];
            } elseif (($ci = $categoryIndex($shop, $want['pick-belt']['category'])) !== null) {
                $insert($shop, $ci, 0, $want['pick-belt']['item']);
            }
        }
        if (isset($want['pick-arm-bag']) && $find($shop, 'pick-arm-bag') === null) {
            if (($at = $find($shop, 'pick-belt')) !== null) {
                $insert($shop, $at[0], $at[1] + 1, $want['pick-arm-bag']['item']);
            } elseif (($ci = $categoryIndex($shop, $want['pick-arm-bag']['category'])) !== null) {
                $insert($shop, $ci, count($shop['categories'][$ci]['items'] ?? []), $want['pick-arm-bag']['item']);
            }
        }
        return $shop;
    }

    /* ------------------------------------------------------------------ the settings */

    /** The checkout takes real orders: they are stored in the admin, stock comes off, and she is emailed. */
    public static function settings(array $draft): array
    {
        if (!array_key_exists('adminOrders', $draft)) {
            $draft['adminOrders'] = true;
        }
        return $draft;
    }

    /* ------------------------------------------------------------------ the photos */

    /** Adds the new shop photos to the library (they're already on disk — a deploy puts them there). */
    public static function images(array $draft, array $seed): array
    {
        $have = [];
        foreach ($draft['items'] ?? [] as $i => $im) {
            $have[$im['name']] = $i;
        }
        $out = $draft;
        foreach ($seed['items'] ?? [] as $im) {
            if (!str_starts_with($im['name'], 'shop-')) {
                continue;
            }
            if (!isset($have[$im['name']])) {
                $out['items'][] = $im;
            } elseif ($im['name'] === 'shop-belt' && ($out['items'][$have[$im['name']]]['w'] ?? null) === [480, 628]) {
                $out['items'][$have[$im['name']]]['w'] = $im['w']; // gains a small size for the thumbnails
            }
        }
        return $out;
    }
}
