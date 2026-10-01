<?php
declare(strict_types=1);

namespace Sotr;

/**
 * Applies database/migrations/*.sql in name order, once each.
 * Migration files are written once, with tokens that become the right SQL per database:
 *   {{PK}}      auto-increment primary key
 *   {{TEXT}}    long text
 *   {{ENGINE}}  table options (InnoDB/utf8mb4 on MySQL, nothing on SQLite)
 * Statements are separated by a semicolon at the end of a line.
 */
final class Migrator
{
    /** Cheap check run on API requests: applies anything pending (no SSH needed on shared hosting). */
    public static function ensure(): void
    {
        try {
            $done = Db::all('SELECT name FROM migrations');
        } catch (\PDOException) {
            $done = [];
        }
        $files = glob(SOTR_ROOT . '/database/migrations/*.sql') ?: [];
        if (count($done) < count($files)) {
            self::run();
        }
    }

    /** @return string[] names of the migrations applied in this run */
    public static function run(): array
    {
        $mysql = Db::driver() === 'mysql';
        Db::pdo()->exec(
            'CREATE TABLE IF NOT EXISTS migrations (name VARCHAR(120) NOT NULL PRIMARY KEY, applied_at DATETIME NOT NULL)'
            . ($mysql ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4' : '')
        );
        $done = array_column(Db::all('SELECT name FROM migrations'), 'name');
        $files = glob(SOTR_ROOT . '/database/migrations/*.sql') ?: [];
        sort($files);

        $applied = [];
        foreach ($files as $file) {
            $name = basename($file);
            if (in_array($name, $done, true)) {
                continue;
            }
            $sql = strtr((string) file_get_contents($file), [
                '{{PK}}'     => $mysql ? 'INT AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT',
                '{{TEXT}}'   => $mysql ? 'LONGTEXT' : 'TEXT',
                '{{ENGINE}}' => $mysql ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci' : '',
            ]);
            foreach (preg_split('/;\s*[\r\n]+/', $sql) ?: [] as $statement) {
                $statement = trim($statement);
                if ($statement !== '') {
                    Db::pdo()->exec($statement);
                }
            }
            Db::run('INSERT INTO migrations (name, applied_at) VALUES (?, ?)', [$name, Db::now()]);
            $applied[] = $name;
        }
        return $applied;
    }
}
