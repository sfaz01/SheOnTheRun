<?php
/* Command line only. Builds the data/*.js files from the seed (no database), for testing:
     php server/bin/generate.php OUTPUT_DIR
   Prints any validation problems in the seed and exits non-zero if there are some. */
declare(strict_types=1);

use Sotr\Generator;
use Sotr\Journal;
use Sotr\Schema;
use Sotr\Validator;

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require dirname(__DIR__) . '/app/bootstrap.php';

$out = $argv[1] ?? '';
if ($out === '' || !is_dir($out)) {
    fwrite(STDERR, "Usage: php server/bin/generate.php EXISTING_OUTPUT_DIR\n");
    exit(1);
}
$seed = json_decode((string) file_get_contents(SOTR_ROOT . '/database/seed/content.json'), true);
$docs = $seed['areas'];
$problems = 0;
foreach (Schema::EDITABLE as $area) {
    [$docs[$area], $errors] = Validator::run($area, $docs[$area] ?? []);
    foreach ($errors as $e) {
        fwrite(STDERR, "$area.{$e['path']}: {$e['message']}\n");
        $problems++;
    }
}
foreach (Generator::files($docs) as $name => $contents) {
    file_put_contents($out . '/' . $name, $contents);
}
$live = Journal::published($docs['posts']);
@mkdir($out . '/journal');
foreach ($live as $p) {
    file_put_contents($out . '/journal/' . $p['slug'] . '.html', Journal::page($p));
}
file_put_contents($out . '/feed.xml', Journal::feed($live));
file_put_contents($out . '/sitemap.xml', Journal::sitemap($live));
echo "Wrote " . count(Generator::FILES) . " files to $out" . ($problems ? " ($problems validation problems)" : '') . "\n";
exit($problems ? 2 : 0);
