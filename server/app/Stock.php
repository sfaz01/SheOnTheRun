<?php
declare(strict_types=1);

namespace Sotr;

/**
 * Shop stock, kept honest. Orders change stock as an operational fact, not an edit, so the
 * numbers are changed in the LIVE (last published) shop and, in step, in the draft the owner may be
 * editing — then the live products.js is rewritten. Discard and Restore therefore never bring old
 * stock numbers back (restore also keeps the current numbers: see Content::restore).
 *
 * A "line" is ['id' => product reference, 'option' => size or '', 'qty' => int].
 * Stock that has no number for a size means "not tracked": it never runs out.
 */
final class Stock
{
    /**
     * Take (-1) or give back (+1) stock in the live shop. Must be called inside the caller's DB
     * transaction: it uses compare-and-swap on the published snapshot, so two simultaneous orders
     * can never both take the last item.
     *
     * @param array<int, array{id:string, option:string, qty:int}> $lines
     */
    public static function changeLive(array $lines, int $sign): void
    {
        for ($try = 0; $try < 8; $try++) {
            $row = Db::one('SELECT id, snapshot FROM publishes ORDER BY id DESC LIMIT 1');
            if ($row === null) {
                throw new HttpError(503, 'The shop isn’t ready yet.', 'no_shop');
            }
            $snap = json_decode($row['snapshot'], true) ?? [];
            $shop = $snap['shop'] ?? ['categories' => []];
            self::apply($shop, $lines, $sign, true);
            $snap['shop'] = $shop;
            $n = Db::run('UPDATE publishes SET snapshot = ? WHERE id = ? AND snapshot = ?', [Content::encode($snap), $row['id'], $row['snapshot']]);
            if ($n === 1) {
                return;
            }
        }
        throw new HttpError(409, 'The shop is busy right now. Please try again in a moment.', 'busy');
    }

    /** Mirror the same change in the owner's draft (quietly: an unpublished edit may have removed the product). */
    public static function changeDraft(array $lines, int $sign): void
    {
        for ($try = 0; $try < 8; $try++) {
            $cur = Content::get('shop');
            $doc = $cur['doc'];
            if (!self::apply($doc, $lines, $sign, false)) {
                return;
            }
            $n = Db::run(
                'UPDATE content SET doc = ?, rev = rev + 1, updated_at = ? WHERE area = ? AND rev = ?',
                [Content::encode($doc), Db::now(), 'shop', $cur['rev']]
            );
            if ($n === 1) {
                return;
            }
        }
    }

    /** Rewrite the live data/products.js (and ar.js) from the live snapshot, so visitors see the new stock. */
    public static function republish(): bool
    {
        try {
            $snap = Content::lastSnapshot();
            if ($snap === null) {
                return false;
            }
            $files = Generator::files($snap);
            Content::writeFiles([
                'data/products.js' => $files['products.js'],
                'data/ar.js' => $files['ar.js'],
            ]);
            return true;
        } catch (\Throwable $e) {
            error_log('[sotr] could not rewrite products.js after an order: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Change one shop document in place. $strict = true throws a clear error when an order can't be
     * satisfied; false skips what doesn't apply. Returns whether anything changed.
     */
    private static function apply(array &$shop, array $lines, int $sign, bool $strict): bool
    {
        $changed = false;
        foreach ($lines as $line) {
            $found = false;
            foreach ($shop['categories'] ?? [] as $ci => $cat) {
                if (!empty($cat['comingSoon'])) {
                    continue;
                }
                foreach ($cat['items'] ?? [] as $ii => $p) {
                    if (($p['id'] ?? '') !== $line['id']) {
                        continue;
                    }
                    $found = true;
                    $stock = $p['stock'] ?? null;
                    $opt = $line['option'];
                    $qty = $line['qty'];
                    $name = (string) ($p['name'] ?? $line['id']);
                    if ($sign < 0 && $strict && !empty($p['soldOut'])) {
                        throw new HttpError(409, "“{$name}” has just sold out.", 'sold_out');
                    }
                    if ($stock === null) {
                        break; // not tracked at all
                    }
                    if (is_array($stock)) {
                        if ($opt === '' || !array_key_exists($opt, $stock)) {
                            break; // this size isn't tracked
                        }
                        $have = (int) $stock[$opt];
                        if ($sign < 0 && $have < $qty) {
                            if ($strict) {
                                throw new HttpError(409, $have <= 0 ? "“{$name}” ($opt) has just sold out." : "Only $have left of “{$name}” ($opt).", 'out_of_stock');
                            }
                            $shop['categories'][$ci]['items'][$ii]['stock'][$opt] = 0;
                        } else {
                            $shop['categories'][$ci]['items'][$ii]['stock'][$opt] = $have + $sign * $qty;
                        }
                    } else {
                        $have = (int) $stock;
                        if ($sign < 0 && $have < $qty) {
                            if ($strict) {
                                throw new HttpError(409, $have <= 0 ? "“{$name}” has just sold out." : "Only $have left of “{$name}”.", 'out_of_stock');
                            }
                            $shop['categories'][$ci]['items'][$ii]['stock'] = 0;
                        } else {
                            $shop['categories'][$ci]['items'][$ii]['stock'] = $have + $sign * $qty;
                        }
                    }
                    $changed = true;
                    break 2;
                }
            }
            if (!$found && $strict && $sign < 0) {
                throw new HttpError(409, 'One of the items in your bag isn’t available any more. Please reload the shop.', 'gone');
            }
        }
        return $changed;
    }
}
