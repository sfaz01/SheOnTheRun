<?php
declare(strict_types=1);

namespace Sotr;

/**
 * Phase 3: Orders management, server-side price recalculation, stock tracking, and checkout.
 */
final class Orders
{
    public const STATUSES = ['new', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled'];
    public const PAYMENT_STATUSES = ['unpaid', 'paid'];

    /** Public checkout: recalculates prices from the database, checks stock, stores order. */
    public static function create(array $input): array
    {
        // Bot honeypots
        if (!empty($input['_trap']) || !empty($input['website'])) {
            throw new HttpError(400, 'Invalid request.');
        }

        $name = trim((string) ($input['name'] ?? ''));
        if ($name === '' || mb_strlen($name) > 120) {
            throw new HttpError(422, 'Please enter your full name.', 'invalid', ['field' => 'name']);
        }

        $phone = trim((string) ($input['phone'] ?? ''));
        if ($phone === '' || mb_strlen($phone) < 7 || mb_strlen($phone) > 50) {
            throw new HttpError(422, 'Please enter a valid phone number.', 'invalid', ['field' => 'phone']);
        }

        $gov = trim((string) ($input['governorate'] ?? ''));
        if ($gov === '' || mb_strlen($gov) > 80) {
            throw new HttpError(422, 'Please select your governorate.', 'invalid', ['field' => 'governorate']);
        }

        $address = trim((string) ($input['address'] ?? ''));
        if ($address === '' || mb_strlen($address) > 1000) {
            throw new HttpError(422, 'Please enter your delivery address.', 'invalid', ['field' => 'address']);
        }

        $paymentMethod = trim((string) ($input['payment_method'] ?? $input['payment'] ?? 'Pay on delivery'));
        if (!in_array($paymentMethod, ['Pay on delivery', 'Whish/OMT', 'Cash on delivery'], true)) {
            $paymentMethod = 'Pay on delivery';
        }
        $paymentRef = isset($input['payment_ref']) ? trim(mb_substr((string) $input['payment_ref'], 0, 100)) : null;

        $rawItems = $input['items'] ?? [];
        if (!is_array($rawItems) || count($rawItems) === 0) {
            throw new HttpError(422, 'Your cart is empty.', 'empty_cart');
        }

        // Build product catalog from database
        Content::ensureSeeded();
        $shop = Content::get('shop');
        $shopDoc = $shop['doc'] ?? [];
        $catalog = [];
        foreach ($shopDoc['categories'] ?? [] as $ci => $cat) {
            foreach ($cat['items'] ?? [] as $ii => $p) {
                $catalog[$p['id']] = [
                    'p' => $p,
                    'cat_idx' => $ci,
                    'item_idx' => $ii,
                ];
            }
        }

        $verifiedItems = [];
        $grandTotal = 0.0;
        $stockChanged = false;

        foreach ($rawItems as $item) {
            $id = trim((string) ($item['id'] ?? ''));
            $qty = max(1, (int) ($item['qty'] ?? 1));
            $option = trim((string) ($item['option'] ?? ''));

            if (!isset($catalog[$id])) {
                throw new HttpError(400, "One of the items in your cart is no longer available ($id).", 'item_not_found');
            }

            $entry = &$catalog[$id];
            $prod = &$entry['p'];

            if (!empty($prod['soldOut'])) {
                throw new HttpError(400, "{$prod['name']} is currently sold out.", 'sold_out');
            }

            // Verify option
            $prodOptions = $prod['options'] ?? [];
            if (!empty($prodOptions)) {
                if ($option === '' || !in_array($option, $prodOptions, true)) {
                    $option = $prodOptions[0]; // fallback to first option
                }
            } else {
                $option = '';
            }

            // Verify stock
            $stock = $prod['stock'] ?? null;
            if ($stock !== null) {
                if (is_array($stock) && $option !== '') {
                    $avail = (int) ($stock[$option] ?? 0);
                    if ($avail < $qty) {
                        throw new HttpError(400, "Only $avail left for {$prod['name']} ($option).", 'out_of_stock');
                    }
                    $stock[$option] = max(0, $avail - $qty);
                    $prod['stock'] = $stock;
                    $stockChanged = true;
                } elseif (is_numeric($stock)) {
                    $avail = (int) $stock;
                    if ($avail < $qty) {
                        throw new HttpError(400, "Only $avail left for {$prod['name']}.", 'out_of_stock');
                    }
                    $prod['stock'] = max(0, $avail - $qty);
                    $stockChanged = true;
                }
            }

            // Price from database
            $price = isset($prod['price']) && $prod['price'] !== null && $prod['price'] !== ''
                ? (float) $prod['price']
                : 0.0;
            $lineTotal = round($price * $qty, 2);
            $grandTotal += $lineTotal;

            $verifiedItems[] = [
                'id' => $id,
                'name' => $prod['name'],
                'option' => $option,
                'price' => $price,
                'qty' => $qty,
                'total' => $lineTotal,
            ];
        }

        // Generate unique friendly order number e.g. SOTR-78A2BC
        $orderNumber = 'SOTR-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));

        $pdo = Db::pdo();
        $pdo->beginTransaction();
        try {
            $now = Db::now();
            $orderId = Db::insert(
                'INSERT INTO orders (order_number, customer_name, customer_phone, governorate, address, payment_method, payment_ref, payment_status, items, total, status, notes, created_at, updated_at) '
                . 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    $orderNumber,
                    $name,
                    $phone,
                    $gov,
                    $address,
                    $paymentMethod,
                    $paymentRef,
                    'unpaid',
                    json_encode($verifiedItems, JSON_UNESCAPED_UNICODE),
                    $grandTotal,
                    'new',
                    null,
                    $now,
                    $now,
                ]
            );

            // If stock changed, persist updated stock back into shop content doc
            if ($stockChanged) {
                foreach ($catalog as $id => $entry) {
                    $ci = $entry['cat_idx'];
                    $ii = $entry['item_idx'];
                    $shopDoc['categories'][$ci]['items'][$ii] = $entry['p'];
                }
                Db::run(
                    'UPDATE content SET doc = ?, rev = rev + 1, updated_at = ? WHERE area = ?',
                    [json_encode($shopDoc, JSON_UNESCAPED_UNICODE), $now, 'shop']
                );
            }

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        // Try sending notification alert (fail silently if SMTP not configured)
        self::notifyOwner($orderNumber, $name, $phone, $gov, $address, $verifiedItems, $grandTotal, $paymentMethod);

        return [
            'ok' => true,
            'order_id' => $orderId,
            'order_number' => $orderNumber,
            'total' => $grandTotal,
        ];
    }

    /** Admin: list orders with filtering and search. */
    public static function list(array $filters = []): array
    {
        $status = $filters['status'] ?? 'all';
        $search = trim((string) ($filters['search'] ?? ''));

        $sql = 'SELECT * FROM orders WHERE 1=1';
        $params = [];

        if ($status !== 'all' && in_array($status, self::STATUSES, true)) {
            $sql .= ' AND status = ?';
            $params[] = $status;
        }

        if ($search !== '') {
            $sql .= ' AND (order_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)';
            $like = '%' . $search . '%';
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        $sql .= ' ORDER BY id DESC LIMIT 200';
        $rows = Db::all($sql, $params);

        return array_map(self::formatRow(...), $rows);
    }

    /** Admin: get single order details. */
    public static function get(int $id): ?array
    {
        $row = Db::one('SELECT * FROM orders WHERE id = ?', [$id]);
        return $row ? self::formatRow($row) : null;
    }

    /** Admin: update order workflow status. */
    public static function updateStatus(int $id, string $status, int $userId): array
    {
        if (!in_array($status, self::STATUSES, true)) {
            throw new HttpError(422, 'Invalid status.');
        }
        $n = Db::run('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', [$status, Db::now(), $id]);
        if ($n === 0) {
            throw new HttpError(404, 'Order not found.');
        }
        Audit::log($userId, 'order.status', "#$id -> $status");
        return self::get($id);
    }

    /** Admin: update payment status (unpaid / paid) and reference. */
    public static function updatePayment(int $id, string $paymentStatus, ?string $ref, int $userId): array
    {
        if (!in_array($paymentStatus, self::PAYMENT_STATUSES, true)) {
            throw new HttpError(422, 'Invalid payment status.');
        }
        $n = Db::run(
            'UPDATE orders SET payment_status = ?, payment_ref = ?, updated_at = ? WHERE id = ?',
            [$paymentStatus, $ref !== null ? mb_substr(trim($ref), 0, 100) : null, Db::now(), $id]
        );
        if ($n === 0) {
            throw new HttpError(404, 'Order not found.');
        }
        Audit::log($userId, 'order.payment', "#$id -> $paymentStatus");
        return self::get($id);
    }

    /** Admin: update internal notes. */
    public static function updateNotes(int $id, string $notes, int $userId): array
    {
        $n = Db::run('UPDATE orders SET notes = ?, updated_at = ? WHERE id = ?', [trim($notes), Db::now(), $id]);
        if ($n === 0) {
            throw new HttpError(404, 'Order not found.');
        }
        Audit::log($userId, 'order.notes', "#$id");
        return self::get($id);
    }

    /** Admin: delete order. */
    public static function delete(int $id, int $userId): void
    {
        $n = Db::run('DELETE FROM orders WHERE id = ?', [$id]);
        if ($n === 0) {
            throw new HttpError(404, 'Order not found.');
        }
        Audit::log($userId, 'order.deleted', "#$id");
    }

    /** Export orders as CSV. */
    public static function exportCsv(): string
    {
        $orders = self::list(['status' => 'all']);
        $out = fopen('php://temp', 'r+');
        fputcsv($out, ['Order #', 'Date', 'Customer Name', 'Phone', 'Governorate', 'Address', 'Status', 'Payment Method', 'Payment Status', 'Total ($)', 'Items', 'Notes']);
        foreach ($orders as $o) {
            $itemSummary = implode('; ', array_map(static fn ($i) => "{$i['qty']}x {$i['name']}" . ($i['option'] ? " ({$i['option']})" : '') . " [\${$i['total']}]", $o['items']));
            fputcsv($out, [
                $o['order_number'],
                $o['created_at'],
                $o['customer_name'],
                $o['customer_phone'],
                $o['governorate'],
                $o['address'],
                $o['status'],
                $o['payment_method'],
                $o['payment_status'],
                $o['total'],
                $itemSummary,
                $o['notes'] ?? '',
            ]);
        }
        rewind($out);
        $csv = stream_get_contents($out);
        fclose($out);
        return $csv ?: '';
    }

    /** Dashboard metrics and badge counts. */
    public static function counts(): array
    {
        $rows = Db::all('SELECT status, COUNT(*) AS c FROM orders GROUP BY status');
        $map = ['all' => 0, 'new' => 0, 'confirmed' => 0, 'out_for_delivery' => 0, 'delivered' => 0, 'cancelled' => 0];
        foreach ($rows as $r) {
            $st = $r['status'];
            $c = (int) $r['c'];
            if (isset($map[$st])) {
                $map[$st] = $c;
            }
            $map['all'] += $c;
        }
        return $map;
    }

    private static function formatRow(array $r): array
    {
        return [
            'id' => (int) $r['id'],
            'order_number' => $r['order_number'],
            'customer_name' => $r['customer_name'],
            'customer_phone' => $r['customer_phone'],
            'governorate' => $r['governorate'],
            'address' => $r['address'],
            'payment_method' => $r['payment_method'],
            'payment_ref' => $r['payment_ref'],
            'payment_status' => $r['payment_status'],
            'items' => json_decode($r['items'] ?? '[]', true) ?: [],
            'total' => (float) $r['total'],
            'status' => $r['status'],
            'notes' => $r['notes'],
            'created_at' => $r['created_at'],
            'updated_at' => $r['updated_at'],
        ];
    }

    private static function notifyOwner(string $num, string $name, string $phone, string $gov, string $addr, array $items, float $total, string $pay): void
    {
        try {
            $to = 'sheonzrun@gmail.com';
            $subj = "New Order $num — $name (\$$total)";
            $lines = [];
            foreach ($items as $it) {
                $lines[] = "- {$it['qty']} × {$it['name']}" . ($it['option'] ? " ({$it['option']})" : '') . " — \${$it['total']}";
            }
            $body = "New shop order received:\n\n"
                . "Order: $num\n"
                . "Customer: $name\n"
                . "Phone: $phone\n"
                . "Governorate: $gov\n"
                . "Address:\n$addr\n"
                . "Payment: $pay\n"
                . "Total: \$$total\n\n"
                . "Items:\n" . implode("\n", $lines) . "\n\n"
                . "Manage this order in your admin panel: /admin/#orders\n";
            @mail($to, $subj, $body, "From: orders@sheontherun.com\r\nX-Mailer: PHP/" . phpversion());
        } catch (\Throwable) {
            // Notifications should never break the customer checkout
        }
    }
}
