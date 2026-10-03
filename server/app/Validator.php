<?php
declare(strict_types=1);

namespace Sotr;

/**
 * Cleans and checks an area document against its Schema.
 * Returns the normalised document plus a list of errors, each pointing at a field path
 * like "categories.0.items.2.price" so the editor can show the message beside that field.
 *
 * Keys present in the input are kept (even when empty) so a save never reshapes data it
 * wasn't asked to change; keys the schema doesn't know are carried through untouched.
 */
final class Validator
{
    /** @var array<int, array{path:string,message:string}> */
    private array $errors = [];

    /** @return array{0: array, 1: array<int, array{path:string,message:string}>} */
    public static function run(string $area, mixed $doc): array
    {
        $schema = Schema::all()[$area] ?? null;
        if ($schema === null) {
            return [is_array($doc) ? $doc : [], []]; // areas without an editor are stored as-is
        }
        $v = new self();
        $clean = $v->object($schema['fields'], $doc, '');
        $v->areaRules($area, $clean);
        return [$clean, $v->errors];
    }

    private function err(string $path, string $message): void
    {
        $this->errors[] = ['path' => $path, 'message' => $message];
    }

    private static function join(string $base, string|int $key): string
    {
        return $base === '' ? (string) $key : $base . '.' . $key;
    }

    /* ---------------------------------------------------------------- objects */

    private function object(array $fields, mixed $input, string $path): array
    {
        if (!is_array($input) || ($input !== [] && array_is_list($input))) {
            if ($input !== null && $input !== []) {
                $this->err($path, 'Unexpected data here.');
            }
            $input = [];
        }
        $out = $input;
        $arIn = is_array($input['ar'] ?? null) ? $input['ar'] : [];
        $arOut = $arIn; // unknown Arabic keys (e.g. the quiz) pass through

        // Fields are processed in order, but stock depends on the cleaned options — do options first.
        $order = $fields;
        usort($order, static fn ($a, $b) => ($a['type'] === 'stock') <=> ($b['type'] === 'stock'));

        foreach ($order as $f) {
            $key = $f['key'];
            $p = self::join($path, $key);
            $present = array_key_exists($key, $input);
            $value = $this->field($f, $input[$key] ?? null, $p, $out);
            $empty = $value === null || $value === '' || $value === [];
            if ($f['type'] === 'stock') {
                if ($empty) {
                    unset($out[$key]);
                } else {
                    $out[$key] = $value;
                }
            } elseif ($present || !$empty) {
                $out[$key] = $value;
            }

            if (!empty($f['ar'])) {
                $arValue = $this->plain($f, $arIn[$key] ?? null, self::join($path, 'ar.' . $key), false);
                if ($arValue === '' || $arValue === [] || $arValue === null) {
                    unset($arOut[$key]);
                } else {
                    $arOut[$key] = $arValue;
                }
            }
        }

        if ($arOut) {
            $out['ar'] = $arOut;
        } else {
            unset($out['ar']);
        }
        // Put "ar" last, after the fields, so stored documents read naturally.
        if (isset($out['ar'])) {
            $ar = $out['ar'];
            unset($out['ar']);
            $out['ar'] = $ar;
        }
        return $out;
    }

    private function field(array $f, mixed $value, string $path, array $siblings): mixed
    {
        switch ($f['type']) {
            case 'group':
                return $this->object($f['item'], $value, $path);

            case 'collection':
                if ($value === null) {
                    $value = [];
                }
                if (!is_array($value) || !array_is_list($value)) {
                    $this->err($path, 'Unexpected data here.');
                    return [];
                }
                if (count($value) > 500) {
                    $this->err($path, 'Too many entries (500 at most).');
                }
                $out = [];
                $seen = [];
                foreach ($value as $i => $item) {
                    $clean = $this->object($f['item'], $item, self::join($path, $i));
                    $idKey = 'id';
                    foreach ($f['item'] as $sub) {
                        if ($sub['type'] === 'id') {
                            $idKey = $sub['key'];
                        }
                    }
                    if (isset($clean[$idKey]) && $clean[$idKey] !== '') {
                        if (isset($seen[$clean[$idKey]])) {
                            $this->err(self::join($path, $i) . '.' . $idKey, 'Another ' . ($f['noun'] ?? 'entry') . ' already uses this reference.');
                        }
                        $seen[$clean[$idKey]] = true;
                    }
                    $out[] = $clean;
                }
                return $out;

            case 'stock':
                return $this->stock($value, $path, $siblings['options'] ?? []);

            default:
                return $this->plain($f, $value, $path, !empty($f['required']));
        }
    }

    /** Scalar and list types — also used for the Arabic twins (never required). */
    private function plain(array $f, mixed $value, string $path, bool $required): mixed
    {
        $type = $f['type'];
        $label = $f['label'] ?? 'This field';
        $max = (int) ($f['max'] ?? 2000);

        switch ($type) {
            case 'bool':
                return $value === true || $value === 1 || $value === '1' || $value === 'true';

            case 'money':
            case 'int':
                if ($value === null || $value === '') {
                    if ($required) {
                        $this->err($path, $label . ' is required.');
                    }
                    return null;
                }
                if (!is_numeric($value)) {
                    $this->err($path, 'Enter a number.');
                    return null;
                }
                $n = (float) $value;
                $min = (float) ($f['min'] ?? 0);
                $top = (float) ($f['max'] ?? 100000);
                if ($n < $min || $n > $top) {
                    $this->err($path, 'Enter a number between ' . self::num($min) . ' and ' . self::num($top) . '.');
                }
                if ($type === 'int') {
                    if (floor($n) !== $n) {
                        $this->err($path, 'Enter a whole number.');
                    }
                    return (int) $n;
                }
                $n = round($n, 2);
                return floor($n) === $n ? (int) $n : $n;

            case 'list':
                if ($value === null || $value === '') {
                    $value = [];
                }
                if (is_string($value)) {
                    $value = preg_split('/\r?\n/', $value) ?: [];
                }
                if (!is_array($value)) {
                    $this->err($path, 'Unexpected data here.');
                    return [];
                }
                $out = [];
                foreach (array_values($value) as $i => $line) {
                    if (!is_string($line) && !is_numeric($line)) {
                        continue;
                    }
                    $line = self::cleanText((string) $line, false);
                    if ($line === '') {
                        continue;
                    }
                    if (mb_strlen($line) > $max) {
                        $this->err($path, 'Line ' . ($i + 1) . ' is too long (' . $max . ' characters at most).');
                    }
                    $out[] = $line;
                }
                if (count($out) > 100) {
                    $this->err($path, 'Too many lines (100 at most).');
                }
                if ($required && !$out) {
                    $this->err($path, $label . ' needs at least one line.');
                }
                return $out;

            case 'multi':
                $allowed = array_column($f['options'], 0);
                $value = is_array($value) ? $value : [];
                $out = array_values(array_unique(array_filter($value, static fn ($v) => in_array($v, $allowed, true))));
                // Keep the options' own order, e.g. in-person before online.
                $out = array_values(array_filter($allowed, static fn ($v) => in_array($v, $out, true)));
                if ($required && !$out) {
                    $this->err($path, 'Choose at least one.');
                }
                return $out;

            case 'select':
                $value = is_string($value) ? trim($value) : '';
                $allowed = array_column($f['options'], 0);
                if ($value === '' && $required) {
                    $this->err($path, 'Choose one.');
                } elseif ($value !== '' && !in_array($value, $allowed, true)) {
                    $this->err($path, 'Choose one of the options.');
                }
                return $value;
        }

        if ($type === 'richtext') {
            $raw = is_string($value) ? $value : '';
            if (strlen($raw) > $max * 3) {
                $this->err($path, 'This is far too long.');
                return '';
            }
            $clean = Sanitizer::clean($raw);
            if (trim(strip_tags($clean)) === '') {
                if ($required) {
                    $this->err($path, $label . ' can’t be empty.');
                }
                return '';
            }
            if (mb_strlen($clean) > $max) {
                $this->err($path, 'Too long for one article (' . number_format($max) . ' characters at most).');
            }
            return $clean;
        }

        // Text-like types.
        if ($value === null) {
            $value = '';
        }
        if (!is_string($value) && !is_numeric($value)) {
            $this->err($path, 'Unexpected data here.');
            return '';
        }
        $value = self::cleanText((string) $value, $type === 'textarea');
        if ($value === '') {
            if ($required) {
                $this->err($path, $label . ' is required.');
            }
            return '';
        }
        $placeholder = $type === 'digits' && $value === '[[WHATSAPP NUMBER]]'; // "not set yet"
        if (!$placeholder && mb_strlen($value) > $max) {
            $this->err($path, 'Too long — ' . $max . ' characters at most (now ' . mb_strlen($value) . ').');
        }

        switch ($type) {
            case 'id':
                if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $value) || strlen($value) > 60) {
                    $this->err($path, 'Use lowercase letters, numbers and dashes only.');
                }
                break;
            case 'image':
                if (!preg_match('/^[a-z0-9][a-z0-9-]{0,80}$/', $value)) {
                    $this->err($path, 'Choose a photo from the list.');
                }
                break;
            case 'email':
                if (filter_var($value, FILTER_VALIDATE_EMAIL) === false) {
                    $this->err($path, 'Enter a valid email address.');
                }
                break;
            case 'url':
                if (!preg_match('#^https://[^\s<>"]+$#i', $value) || filter_var($value, FILTER_VALIDATE_URL) === false) {
                    $this->err($path, 'Enter a full link starting with https://');
                }
                break;
            case 'digits':
                if (!$placeholder && !preg_match('/^\d{8,15}$/', $value)) {
                    $this->err($path, 'Digits only, 8 to 15 of them — e.g. 96170123456 (no +, no spaces).');
                }
                break;
            case 'date':
                if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $m) || !checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
                    $this->err($path, 'Enter a date.');
                }
                break;
            case 'datetime':
                if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/', $value, $m)
                    || !checkdate((int) $m[2], (int) $m[3], (int) $m[1]) || (int) $m[4] > 23 || (int) $m[5] > 59) {
                    $this->err($path, 'Enter a date and time.');
                }
                break;
        }
        return $value;
    }

    /** Stock per option ({"S": 4, "M": 0}) or one number for one-size products. Null when not tracked. */
    private function stock(mixed $value, string $path, mixed $options): mixed
    {
        $options = is_array($options) ? array_values(array_filter($options, 'is_string')) : [];
        $one = function (mixed $v, string $p): ?int {
            if ($v === null || $v === '') {
                return null;
            }
            if (!is_numeric($v) || (float) $v < 0 || floor((float) $v) !== (float) $v || (float) $v > 100000) {
                $this->err($p, 'Enter a whole number, 0 or more.');
                return null;
            }
            return (int) $v;
        };
        if ($options) {
            if (!is_array($value)) {
                return null;
            }
            $out = [];
            foreach ($options as $i => $opt) {
                if (array_key_exists($opt, $value)) {
                    $n = $one($value[$opt], $path . '.' . $i);
                    if ($n !== null) {
                        $out[$opt] = $n;
                    }
                }
            }
            return $out ?: null;
        }
        if (is_array($value)) {
            return null; // sizes were removed — per-size counts no longer apply
        }
        return $one($value, $path);
    }

    /* ------------------------------------------------------------ area rules */

    private function areaRules(string $area, array $doc): void
    {
        if ($area === 'shop') {
            $seen = [];
            foreach ($doc['categories'] ?? [] as $ci => $cat) {
                foreach ($cat['items'] ?? [] as $ii => $item) {
                    $id = $item['id'] ?? '';
                    if ($id !== '' && isset($seen[$id]) && $seen[$id] !== $ci) {
                        $this->err("categories.$ci.items.$ii.id", 'A product in another category already uses this reference.');
                    }
                    $seen[$id] = $ci;
                }
            }
            $ar = $doc['ar']['governorates'] ?? [];
            if ($ar && count($ar) !== count($doc['governorates'] ?? [])) {
                $this->err('ar.governorates', 'The Arabic list needs exactly one line for each English governorate, in the same order.');
            }
        }

        if ($area === 'runs') {
            foreach ($doc['events'] ?? [] as $i => $e) {
                if (($e['starts'] ?? '') !== '' && ($e['ends'] ?? '') !== '' && $e['ends'] < $e['starts']) {
                    $this->err("events.$i.ends", 'The end is before the start.');
                }
            }
        }

        if ($area === 'posts') {
            foreach ($doc['items'] ?? [] as $i => $p) {
                if (empty($p['draft']) && (($p['image'] ?? '') === '')) {
                    $this->err("items.$i.image", 'Choose a cover photo (or keep this article as a draft).');
                }
            }
        }

        if ($area === 'offer') {
            $ids = [];
            foreach (['services', 'packages'] as $list) {
                foreach ($doc[$list] ?? [] as $i => $x) {
                    $id = $x['id'] ?? '';
                    if ($id !== '' && isset($ids[$id])) {
                        $this->err("$list.$i.id", 'A service or package already uses this reference.');
                    }
                    $ids[$id] = true;
                    $this->subset($x, 'omitOnline', 'includes', "$list.$i");
                }
            }
            // The “Find your fit” quiz recommends services/packages by reference.
            foreach ($doc['fit'] ?? [] as $q) {
                foreach ((is_array($q) ? $q['options'] ?? [] : []) as $opt) {
                    $pick = is_array($opt) ? ($opt['pick'] ?? null) : null;
                    if ($pick !== null && $pick !== 'challenge' && !isset($ids[$pick])) {
                        $this->err('services', 'The “Find your fit” quiz recommends “' . $pick . '”, which no longer exists. Put it back, or ask your developer to update the quiz.');
                    }
                }
            }
        }
    }

    /** Every line in $sub must also appear in $of (checked for English and Arabic separately). */
    private function subset(array $x, string $sub, string $of, string $path): void
    {
        foreach ([[$x, $path], [$x['ar'] ?? [], $path . '.ar']] as [$obj, $base]) {
            $have = $obj[$of] ?? [];
            foreach ($obj[$sub] ?? [] as $line) {
                if (!in_array($line, $have, true)) {
                    $this->err("$base.$sub", '“' . mb_substr($line, 0, 60) . '” isn’t in “What’s included” — copy the line exactly.');
                }
            }
        }
    }

    private static function cleanText(string $s, bool $multiline): string
    {
        $s = str_replace("\r\n", "\n", $s);
        // Drop control characters (keep newlines and tabs in long text).
        $s = preg_replace($multiline ? '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u' : '/[\x00-\x1F\x7F]/u', '', $s) ?? '';
        return trim($s);
    }

    private static function num(float $n): string
    {
        return floor($n) === $n ? (string) (int) $n : (string) $n;
    }
}
