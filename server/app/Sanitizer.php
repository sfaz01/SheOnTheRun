<?php
declare(strict_types=1);

namespace Sotr;

/**
 * Journal article bodies are written in the admin's rich-text box, but the server never trusts
 * what the browser sends: every body is rebuilt here from an allow-list before it is stored.
 * Anything not listed is dropped (scripts, styles, frames, event handlers, odd attributes);
 * unknown-but-harmless tags are unwrapped so their text survives.
 */
final class Sanitizer
{
    /** Tag => attributes allowed on it. */
    private const ALLOWED = [
        'p' => ['class'], 'h2' => [], 'h3' => [], 'ul' => [], 'ol' => [], 'li' => [],
        'blockquote' => [], 'strong' => [], 'em' => [], 'a' => ['href'], 'br' => [],
    ];
    /** Tags removed together with everything inside them. */
    private const DROP = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'svg', 'math', 'noscript', 'template', 'link', 'meta', 'head', 'title'];
    /** Only these exact class values survive on <p> (the site's own "small print" style). */
    private const CLASSES = ['measured mt-l'];
    private const RENAME = ['b' => 'strong', 'i' => 'em', 'h1' => 'h2', 'h4' => 'h3', 'h5' => 'h3', 'h6' => 'h3', 'div' => 'p'];

    public static function clean(string $html): string
    {
        $html = trim(str_replace(["\r\n", "\r"], "\n", $html));
        if ($html === '') {
            return '';
        }
        $doc = new \DOMDocument('1.0', 'UTF-8');
        $prev = libxml_use_internal_errors(true);
        $doc->loadHTML('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' . $html . '</body></html>', LIBXML_NONET);
        libxml_clear_errors();
        libxml_use_internal_errors($prev);

        $body = $doc->getElementsByTagName('body')->item(0);
        if ($body === null) {
            return '';
        }
        $blocks = [];
        $loose = '';
        $flushLoose = static function () use (&$blocks, &$loose): void {
            if (trim($loose) !== '') {
                $blocks[] = '<p>' . trim($loose) . '</p>';
            }
            $loose = '';
        };
        foreach (iterator_to_array($body->childNodes) as $node) {
            $out = self::node($node, $doc);
            if ($node instanceof \DOMElement && in_array(self::name($node), ['p', 'h2', 'h3', 'ul', 'ol', 'blockquote'], true)) {
                $flushLoose();
                if ($out !== '') {
                    $blocks[] = $out;
                }
            } else {
                $loose .= $out;
            }
        }
        $flushLoose();
        return implode("\n\n", array_filter($blocks, static fn ($b) => trim(strip_tags($b)) !== '' || str_contains($b, '<br')));
    }

    private static function name(\DOMElement $el): string
    {
        $n = strtolower($el->tagName);
        return self::RENAME[$n] ?? $n;
    }

    private static function node(\DOMNode $node, \DOMDocument $doc): string
    {
        if ($node instanceof \DOMText) {
            return htmlspecialchars($node->nodeValue ?? '', ENT_NOQUOTES | ENT_SUBSTITUTE, 'UTF-8');
        }
        if (!$node instanceof \DOMElement) {
            return ''; // comments, processing instructions
        }
        $raw = strtolower($node->tagName);
        if (in_array($raw, self::DROP, true)) {
            return '';
        }
        $name = self::name($node);
        $inner = '';
        foreach ($node->childNodes as $child) {
            $inner .= self::node($child, $doc);
        }
        if (!isset(self::ALLOWED[$name])) {
            return $inner; // unknown tag: keep its text
        }
        if ($name === 'br') {
            return '<br>';
        }
        $attrs = '';
        foreach (self::ALLOWED[$name] as $attr) {
            if (!$node->hasAttribute($attr)) {
                continue;
            }
            $value = trim($node->getAttribute($attr));
            if ($attr === 'class') {
                $value = preg_replace('/\s+/', ' ', $value) ?? '';
                if (in_array($value, self::CLASSES, true)) {
                    $attrs .= ' class="' . $value . '"';
                }
            } elseif ($attr === 'href') {
                $href = self::safeHref($value);
                if ($href === null) {
                    return $inner; // a link we won't keep: keep the words
                }
                $attrs .= ' href="' . htmlspecialchars($href, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '"';
                if (preg_match('#^https?://#i', $href)) {
                    $attrs .= ' rel="noopener noreferrer"';
                }
            }
        }
        if ($name === 'a' && $attrs === '') {
            return $inner;
        }
        if (trim(strip_tags($inner)) === '' && !str_contains($inner, '<br') && in_array($name, ['strong', 'em', 'a'], true)) {
            return $inner;
        }
        return "<$name$attrs>$inner</$name>";
    }

    /** http(s), mailto, tel, same-site paths and #anchors only — never javascript:, data: and friends. */
    private static function safeHref(string $href): ?string
    {
        $href = preg_replace('/[\x00-\x1F\x7F\s]+/', '', $href) ?? '';
        if ($href === '' || strlen($href) > 500) {
            return null;
        }
        if (preg_match('#^(https?://[^\s<>"]+|mailto:[^\s<>"]+|tel:\+?[0-9]+|/[^/\\\\][^\s<>"]*|\#[A-Za-z0-9_-]+|[A-Za-z0-9_.-]+\.html(\#[A-Za-z0-9_-]+)?)$#i', $href)) {
            return $href;
        }
        return null;
    }
}
