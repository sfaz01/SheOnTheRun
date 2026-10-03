<?php
declare(strict_types=1);

namespace Sotr;

/**
 * Shop orders. The browser only says WHAT was ordered (product reference, size, quantity); prices,
 * names, stock and delivery areas all come from the published shop on the server.
 */
final class Orders
{
    public const STATUSES = ['new', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled'];
    public const PAYMENT_METHODS = ['cod' => 'Pay on delivery', 'transfer' => 'Whish / OMT transfer'];
    private const MAX_LINES = 20;
    private const MAX_QTY = 10;

    /* ------------------------------------------------------------------ public */

    /** @return array{order_number:string, total:float|null, unpriced:int} */
    public static function create(array $in): array
    {
        if (!empty($in['website']) || !empty($in['_trap'])) {
            // A hidden field only bots fill in. Pretend it worked so they learn nothing.
            return ['order_number' => 'SOTR-' . strtoupper(bin2hex(random_bytes(3))), 'total' => null, 'unpriced' => 0];
        }
        $shop = (Content::lastSnapshot() ?? [])['shop'] ?? null;
        if (!is_array($shop)) {
            throw new HttpError(503, 'The shop isn’t ready yet. Please order on WhatsApp for now.', 'no_shop');
        }

        $name = self::text($in['name'] ?? '', 80);
        if (mb_strlen($name) < 2) {
            throw self::bad('name', 'Please enter your full name.');
        }
        $phone = trim((string) ($in['phone'] ?? ''));
        $digits = preg_replace('/\D/', '', $phone) ?? '';
        if (!preg_match('/^[+0-9 ()\-]{7,25}$/', $phone) || strlen($digits) < 7 || strlen($digits) > 15) {
            throw self::bad('phone', 'Please enter a phone number we can reach you on.');
        }
        $govs = array_merge($shop['governorates'] ?? [], $shop['ar']['governorates'] ?? []);
        $gov = self::text($in['governorate'] ?? '', 80);
        if ($gov === '' || !in_array($gov, $govs, true)) {
            throw self::bad('governorate', 'Please choose your governorate from the list.');
        }
        $address = self::text($in['address'] ?? '', 500, true);
        if (mb_strlen($address) < 5) {
            throw self::bad('address', 'Please enter your full address, with a landmark if it helps.');
        }
        $method = (string) ($in['payment_method'] ?? 'cod');
        if (!isset(self::PAYMENT_METHODS[$method])) {
            throw self::bad('payment_method', 'Please choose how you’d like to pay.');
        }

        // ---- lines: merge duplicates, then check each against the live shop
        $raw = $in['items'] ?? null;
        if (!is_array($raw) || !array_is_list($raw) || !$raw) {
            throw new HttpError(422, 'Your bag is empty.', 'empty');
        }
        if (count($raw) > self::MAX_LINES * 3) {
            throw new HttpError(422, 'That’s a very big order. Please send it in smaller parts.', 'too_many');
        }
        $lines = [];
        foreach ($raw as $r) {
            if (!is_array($r)) {
                throw new HttpError(422, 'Something is wrong with your bag. Please reload the shop.', 'bad_item');
            }
            $id = (string) ($r['id'] ?? '');
            $opt = (string) ($r['option'] ?? '');
            $qty = (int) ($r['qty'] ?? 0);
            if ($qty < 1 || $qty > self::MAX_QTY) {
                throw new HttpError(422, 'Each item can be ordered 1 to ' . self::MAX_QTY . ' at a time.', 'bad_qty');
            }
            $key = $id . "\0" . $opt;
            $lines[$key] = ['id' => $id, 'option' => $opt, 'qty' => ($lines[$key]['qty'] ?? 0) + $qty];
        }
        if (count($lines) > self::MAX_LINES) {
            throw new HttpError(422, 'That’s a very big order. Please send it in smaller parts.', 'too_many');
        }

        $priced = [];
        $total = 0.0;
        $unpriced = 0;
        foreach ($lines as $l) {
            $p = self::product($shop, $l['id']);
            if ($p === null) {
                throw new HttpError(409, 'One of the items in your bag isn’t available any more. Please reload the shop.', 'gone');
            }
            $options = array_values($p['options'] ?? []);
            if ($options) {
                if (!in_array($l['option'], $options, true)) {
                    throw new HttpError(422, 'Please choose a size for “' . $p['name'] . '”.', 'bad_option');
                }
            } elseif ($l['option'] !== '') {
                throw new HttpError(422, '“' . $p['name'] . '” doesn’t come in sizes.', 'bad_option');
            }
            $price = isset($p['price']) && $p['price'] !== '' && $p['price'] !== null ? (float) $p['price'] : null;
            if ($price === null) {
                $unpriced++;
            } else {
                $total += round($price * $l['qty'], 2);
            }
            $priced[] = ['id' => $l['id'], 'name' => (string) $p['name'], 'option' => $l['option'], 'qty' => $l['qty'], 'price' => $price];
        }

        // ---- store the order and take the stock, together or not at all
        $pdo = Db::pdo();
        $pdo->beginTransaction();
        try {
            Stock::changeLive($lines, -1);
            $number = self::newNumber();
            $now = Db::now();
            $id = Db::insert(
                'INSERT INTO orders (order_number, customer_name, customer_phone, governorate, address, payment_method, items, total, unpriced, status, stock_held, created_at, updated_at) '
                . "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', 1, ?, ?)",
                [$number, $name, $phone, $gov, $address, $method, Content::encode($priced), round($total, 2), $unpriced, $now, $now]
            );
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        Stock::changeDraft($lines, -1);
        Stock::republish();
        $mail = self::notify($number, $name, $phone, $gov, $address, $method, $priced, $total, $unpriced);
        Db::run('UPDATE orders SET mail_status = ? WHERE id = ?', [$mail, $id]);

        return ['order_number' => $number, 'total' => $unpriced ? null : round($total, 2), 'unpriced' => $unpriced];
    }

    /* ------------------------------------------------------------------- admin */

    /** @return array{orders: array, total: int, counts: array<string,int>} */
    public static function list(string $status, string $q, int $page, int $per = 30): array
    {
        $where = ['1=1'];
        $args = [];
        if (in_array($status, self::STATUSES, true)) {
            $where[] = 'status = ?';
            $args[] = $status;
        }
        $q = trim($q);
        if ($q !== '') {
            $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $q) . '%';
            $where[] = "(order_number LIKE ? ESCAPE '\\' OR customer_name LIKE ? ESCAPE '\\' OR customer_phone LIKE ? ESCAPE '\\')";
            array_push($args, $like, $like, $like);
        }
        $w = implode(' AND ', $where);
        $total = (int) (Db::one("SELECT COUNT(*) AS n FROM orders WHERE $w", $args)['n'] ?? 0);
        $page = max(1, $page);
        $rows = Db::all("SELECT * FROM orders WHERE $w ORDER BY id DESC LIMIT $per OFFSET " . (($page - 1) * $per), $args);
        return ['orders' => array_map([self::class, 'row'], $rows), 'total' => $total, 'per' => $per, 'counts' => self::counts()];
    }

    public static function counts(): array
    {
        $out = ['all' => 0] + array_fill_keys(self::STATUSES, 0);
        foreach (Db::all('SELECT status, COUNT(*) AS n FROM orders GROUP BY status') as $r) {
            $out[$r['status']] = (int) $r['n'];
            $out['all'] += (int) $r['n'];
        }
        return $out;
    }

    private static function find(int $id): array
    {
        $r = Db::one('SELECT * FROM orders WHERE id = ?', [$id]);
        if ($r === null) {
            throw new HttpError(404, 'That order doesn’t exist any more.');
        }
        return $r;
    }

    public static function get(int $id): array
    {
        return self::row(self::find($id));
    }

    /** Cancelling gives the stock back; reviving a cancelled order takes it again (and may be refused). */
    public static function setStatus(int $id, string $status, int $userId): array
    {
        if (!in_array($status, self::STATUSES, true)) {
            throw new HttpError(422, 'That isn’t a valid status.');
        }
        $o = self::find($id);
        $lines = self::lines($o);
        $held = (int) $o['stock_held'] === 1;
        $pdo = Db::pdo();
        $pdo->beginTransaction();
        try {
            $newHeld = $held;
            if ($status === 'cancelled' && $held) {
                Stock::changeLive($lines, +1);
                $newHeld = false;
            } elseif ($status !== 'cancelled' && !$held) {
                Stock::changeLive($lines, -1);
                $newHeld = true;
            }
            Db::run('UPDATE orders SET status = ?, stock_held = ?, updated_at = ? WHERE id = ?', [$status, $newHeld ? 1 : 0, Db::now(), $id]);
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
        if ($newHeld !== $held) {
            Stock::changeDraft($lines, $newHeld ? -1 : +1);
            Stock::republish();
        }
        Audit::log($userId, 'order.status', $o['order_number'] . ' → ' . $status);
        return self::get($id);
    }

    public static function setPayment(int $id, string $paid, string $ref, int $userId): array
    {
        $o = self::find($id);
        $status = $paid === 'paid' ? 'paid' : 'unpaid';
        Db::run('UPDATE orders SET payment_status = ?, payment_ref = ?, updated_at = ? WHERE id = ?', [$status, self::text($ref, 100) ?: null, Db::now(), $id]);
        Audit::log($userId, 'order.payment', $o['order_number'] . ' → ' . $status);
        return self::get($id);
    }

    public static function setNotes(int $id, string $notes, int $userId): array
    {
        $o = self::find($id);
        Db::run('UPDATE orders SET notes = ?, updated_at = ? WHERE id = ?', [self::text($notes, 2000, true) ?: null, Db::now(), $id]);
        Audit::log($userId, 'order.notes', $o['order_number']);
        return self::get($id);
    }

    /** Deleting an order that still holds stock gives the stock back. */
    public static function delete(int $id, int $userId): void
    {
        $o = self::find($id);
        $held = (int) $o['stock_held'] === 1;
        $pdo = Db::pdo();
        $pdo->beginTransaction();
        try {
            if ($held) {
                Stock::changeLive(self::lines($o), +1);
            }
            Db::run('DELETE FROM orders WHERE id = ?', [$id]);
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
        if ($held) {
            Stock::changeDraft(self::lines($o), +1);
            Stock::republish();
        }
        Audit::log($userId, 'order.deleted', $o['order_number']);
    }

    /** Stream every order as CSV. Cells that a spreadsheet would run as a formula are neutralised. */
    public static function exportCsv($out): void
    {
        fwrite($out, "\xEF\xBB\xBF"); // so Excel reads Arabic correctly
        self::csvRow($out, ['Order', 'Date (UTC)', 'Name', 'Phone', 'Governorate', 'Address', 'Status', 'Payment', 'Paid', 'Payment reference', 'Total (USD)', 'Items', 'Notes']);
        $last = PHP_INT_MAX;
        while (true) {
            $rows = Db::all('SELECT * FROM orders WHERE id < ? ORDER BY id DESC LIMIT 200', [$last]);
            if (!$rows) {
                break;
            }
            foreach ($rows as $r) {
                $o = self::row($r);
                $items = implode('; ', array_map(static fn ($i) => $i['qty'] . '× ' . $i['name'] . ($i['option'] !== '' ? ' (' . $i['option'] . ')' : ''), $o['items']));
                self::csvRow($out, [$o['order_number'], $o['created_at'], $o['name'], $o['phone'], $o['governorate'], $o['address'], $o['status'],
                    $o['payment_label'], $o['payment_status'], $o['payment_ref'] ?? '', $o['unpriced'] ? $o['total'] . ' + to confirm' : $o['total'], $items, $o['notes'] ?? '']);
                $last = (int) $r['id'];
            }
        }
    }

    private static function csvRow($out, array $cells): void
    {
        fputcsv($out, array_map(static function ($c) {
            $c = (string) $c;
            // A cell starting with = + - @ can be run as a formula by a spreadsheet, so those get a ' prefix.
            // Plain phone numbers (+961 70 123 456) and amounts are left alone so they read normally.
            $numberLike = (bool) preg_match('/^[+\-]?[\d\s().\-]+$/', $c);
            return $c !== '' && !$numberLike && strpbrk($c[0], "=+-@\t\r") !== false ? "'" . $c : $c;
        }, $cells), ',', '"', '\\');
    }

    /* ----------------------------------------------------------------- helpers */

    private static function row(array $r): array
    {
        return [
            'id' => (int) $r['id'],
            'order_number' => $r['order_number'],
            'name' => $r['customer_name'],
            'phone' => $r['customer_phone'],
            'governorate' => $r['governorate'],
            'address' => $r['address'],
            'payment_method' => $r['payment_method'],
            'payment_label' => self::PAYMENT_METHODS[$r['payment_method']] ?? $r['payment_method'],
            'payment_status' => $r['payment_status'],
            'payment_ref' => $r['payment_ref'],
            'items' => json_decode((string) $r['items'], true) ?: [],
            'total' => (float) $r['total'],
            'unpriced' => (int) $r['unpriced'],
            'status' => $r['status'],
            'notes' => $r['notes'],
            'mail_status' => $r['mail_status'],
            'created_at' => $r['created_at'],
        ];
    }

    private static function lines(array $o): array
    {
        return array_map(static fn ($i) => ['id' => $i['id'], 'option' => (string) $i['option'], 'qty' => (int) $i['qty']], json_decode((string) $o['items'], true) ?: []);
    }

    private static function product(array $shop, string $id): ?array
    {
        foreach ($shop['categories'] ?? [] as $cat) {
            if (!empty($cat['comingSoon'])) {
                continue;
            }
            foreach ($cat['items'] ?? [] as $p) {
                if (($p['id'] ?? '') === $id) {
                    return $p;
                }
            }
        }
        return null;
    }

    private static function newNumber(): string
    {
        $alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        for ($i = 0; $i < 10; $i++) {
            $n = 'SOTR-';
            for ($j = 0; $j < 6; $j++) {
                $n .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
            if (Db::one('SELECT id FROM orders WHERE order_number = ?', [$n]) === null) {
                return $n;
            }
        }
        throw new HttpError(500, 'Couldn’t create an order number. Please try again.');
    }

    private static function text(mixed $v, int $max, bool $multiline = false): string
    {
        $s = is_string($v) || is_numeric($v) ? (string) $v : '';
        $s = str_replace("\r\n", "\n", $s);
        $s = preg_replace($multiline ? '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u' : '/[\x00-\x1F\x7F]/u', '', $s) ?? '';
        return mb_substr(trim($s), 0, $max);
    }

    private static function bad(string $field, string $msg): HttpError
    {
        return new HttpError(422, $msg, 'invalid', ['field' => $field]);
    }

    private static function notify(string $num, string $name, string $phone, string $gov, string $addr, string $method, array $items, float $total, int $unpriced): string
    {
        $settings = (Content::lastSnapshot() ?? [])['settings'] ?? [];
        $to = (string) ($settings['email'] ?? '');
        $lines = array_map(static fn ($i) => '  ' . $i['qty'] . ' × ' . $i['name'] . ($i['option'] !== '' ? ' (' . $i['option'] . ')' : '')
            . ($i['price'] !== null ? ' — $' . number_format($i['price'] * $i['qty'], 2) : ' — price to confirm'), $items);
        $body = "New shop order $num\n\n"
            . "Name: $name\nPhone: $phone\nGovernorate: $gov\nAddress: $addr\n"
            . 'Payment: ' . self::PAYMENT_METHODS[$method] . "\n\n"
            . "Items:\n" . implode("\n", $lines) . "\n\n"
            . 'Total: $' . number_format($total, 2) . ($unpriced ? " + $unpriced item(s) to confirm" : '') . "\n\n"
            . 'Open it in the admin: ' . rtrim((string) Config::get('app_url'), '/') . "/admin/#orders\n";
        return Mailer::send($to, 'New order ' . $num . ' — ' . Mailer::line($name), $body);
    }
}
