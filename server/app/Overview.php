<?php
declare(strict_types=1);

namespace Sotr;

/** The numbers and lists on the admin's first screen, and the activity log. */
final class Overview
{
    /** @return array<string, mixed> */
    public static function data(): array
    {
        Content::ensureSeeded();
        $live = Content::lastSnapshot() ?? [];

        // Upcoming dated events from what visitors see now (Beirut time, same as the site).
        $now = (new \DateTimeImmutable('now', new \DateTimeZone('Asia/Beirut')))->format('Y-m-d\TH:i');
        $events = array_values(array_filter($live['runs']['events'] ?? [], static fn ($e) => ($e['ends'] ?? '') >= $now));
        usort($events, static fn ($a, $b) => strcmp((string) $a['starts'], (string) $b['starts']));
        $events = array_map(static fn ($e) => [
            'title' => $e['title'] ?? '', 'starts' => $e['starts'] ?? '', 'place' => $e['place'] ?? '', 'spots' => $e['spots'] ?? null,
        ], array_slice($events, 0, 5));

        // Tracked stock that is low or gone, from the live shop.
        $low = [];
        foreach ($live['shop']['categories'] ?? [] as $c) {
            if (!empty($c['comingSoon'])) {
                continue;
            }
            foreach ($c['items'] ?? [] as $p) {
                $stock = $p['stock'] ?? null;
                if ($stock === null) {
                    continue;
                }
                $entries = is_array($stock) ? $stock : ['' => $stock];
                foreach ($entries as $size => $n) {
                    if ((int) $n <= 2) {
                        $low[] = ['name' => $p['name'] ?? '', 'option' => (string) $size, 'left' => max(0, (int) $n)];
                    }
                }
            }
        }

        $recent = array_map(static fn ($o) => [
            'id' => (int) $o['id'], 'order_number' => $o['order_number'], 'name' => $o['customer_name'], 'status' => $o['status'],
            'total' => (float) $o['total'], 'unpriced' => (int) $o['unpriced'], 'created_at' => $o['created_at'],
        ], Db::all('SELECT id, order_number, customer_name, status, total, unpriced, created_at FROM orders ORDER BY id DESC LIMIT 5'));

        $lastBackup = null;
        foreach (glob(Backup::defaultDir() . '/sotr-backup-*.json') ?: [] as $f) {
            $lastBackup = max((int) $lastBackup, (int) filemtime($f));
        }

        return [
            'orders' => Orders::counts(),
            'messages' => Messages::counts(),
            'events' => $events,
            'low_stock' => array_slice($low, 0, 8),
            'recent_orders' => $recent,
            'last_backup' => $lastBackup ? gmdate('Y-m-d H:i:s', $lastBackup) : null,
        ];
    }

    /** @return array{items: array, total: int, per: int} */
    public static function activity(int $page, int $per = 50): array
    {
        $total = (int) (Db::one('SELECT COUNT(*) AS n FROM audit_log')['n'] ?? 0);
        $page = max(1, $page);
        $rows = Db::all(
            'SELECT a.id, a.action, a.detail, a.ip, a.created_at, u.email FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT ' . $per . ' OFFSET ' . (($page - 1) * $per)
        );
        return ['items' => array_map(static fn ($r) => [
            'id' => (int) $r['id'], 'what' => self::describe((string) $r['action'], (string) ($r['detail'] ?? '')), 'who' => $r['email'] ?? 'a visitor',
            'at' => $r['created_at'], 'ip' => $r['ip'],
        ], $rows), 'total' => $total, 'per' => $per];
    }

    /** Plain-English wording for the log; unknown actions are shown as they are. */
    private static function describe(string $action, string $detail): string
    {
        $map = [
            'login' => 'Signed in', 'logout' => 'Signed out', 'login.failed' => 'Wrong password tried', 'login.bad_code' => 'Wrong phone code tried',
            'login.recovery_code' => 'Signed in with a recovery code', 'twofa.enabled' => 'Turned on 2-step sign-in', 'setup.admin_created' => 'Created the first admin',
            'password.changed' => 'Changed password', 'email.changed' => 'Changed email', 'admin.invited' => 'Invited an admin', 'admin.invite_accepted' => 'Accepted an invite',
            'admin.invite_cancelled' => 'Cancelled an invite', 'admin.removed' => 'Removed an admin', 'content.saved' => 'Saved a draft of',
            'content.published' => 'Published the website', 'content.restored' => 'Restored an earlier version', 'content.discarded' => 'Discarded unpublished changes',
            'photo.uploaded' => 'Uploaded photo', 'photo.replaced' => 'Replaced photo', 'photo.updated' => 'Edited photo description', 'photo.deleted' => 'Deleted photo',
            'order.status' => 'Order status', 'order.payment' => 'Order payment', 'order.notes' => 'Order notes', 'order.deleted' => 'Deleted order',
            'message.status' => 'Message status', 'message.notes' => 'Message notes', 'message.deleted' => 'Deleted a message', 'backup.downloaded' => 'Downloaded a backup',
            'plan.uploaded' => 'Uploaded a plan file', 'plan.sample' => 'Changed the sample plan', 'plan.deleted' => 'Deleted a plan file',
        ];
        return ($map[$action] ?? $action) . ($detail !== '' ? ': ' . $detail : '');
    }
}
