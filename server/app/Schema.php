<?php
declare(strict_types=1);

namespace Sotr;

/**
 * What the owner can edit, area by area. One definition drives both the admin forms
 * (sent to the browser as JSON) and the server-side validation, so they can't drift apart.
 *
 * Field keys:  key, type, label, hint, required, ar (has an Arabic twin), max, min, options,
 *              from (id: which field the id is made from), item (collection: its fields),
 *              title/subtitle (collection: what the list shows), noun (collection: "product").
 * Keys a field list doesn't mention (e.g. the quiz in "offer") are carried through untouched.
 */
final class Schema
{
    /** Areas the editor shows, in menu order. */
    public const EDITABLE = ['shop', 'runs', 'offer', 'testimonials', 'settings'];

    /** Every area kept in the database. 'extras' and 'images' have no editor (yet). */
    public const ALL = ['shop', 'runs', 'offer', 'testimonials', 'settings', 'extras', 'images'];

    private static function f(string $key, string $type, string $label, array $extra = []): array
    {
        return ['key' => $key, 'type' => $type, 'label' => $label] + $extra;
    }

    /** @return array<string, array> */
    public static function all(): array
    {
        $f = [self::class, 'f'];

        $product = [
            $f('id', 'id', 'Reference', ['from' => 'name']),
            $f('name', 'text', 'Product name', ['required' => true, 'ar' => true, 'max' => 80]),
            $f('blurb', 'textarea', 'Short description', ['ar' => true, 'max' => 400]),
            $f('price', 'money', 'Price (USD)', ['hint' => 'Leave empty to show “Price confirmed with your order”.']),
            $f('image', 'image', 'Photo', ['hint' => 'Leave on “No photo” to show the designed placeholder. Uploading new photos arrives in phase 2.']),
            $f('options', 'list', 'Sizes or options', ['hint' => 'One per line, e.g. S, M, L, XL. Leave empty for one-size products.', 'max' => 40]),
            $f('stock', 'stock', 'Stock', ['hint' => 'How many are left. Leave a box empty to not track that one. At 0 it shows as sold out.']),
            $f('soldOut', 'bool', 'Sold out', ['hint' => 'Switch on to mark the whole product sold out, whatever the stock says.']),
        ];

        $category = [
            $f('id', 'id', 'Reference', ['from' => 'name']),
            $f('name', 'text', 'Category name', ['required' => true, 'ar' => true, 'max' => 60]),
            $f('blurb', 'textarea', 'Description', ['ar' => true, 'max' => 500]),
            $f('comingSoon', 'bool', 'Coming soon', ['hint' => 'Shows the category as a “Coming soon” panel instead of products.']),
            $f('items', 'collection', 'Products', ['noun' => 'product', 'title' => 'name', 'subtitle' => 'price', 'item' => $product]),
        ];

        $event = [
            $f('id', 'id', 'Reference', ['from' => 'title', 'withDate' => 'starts']),
            $f('kind', 'select', 'Type', ['required' => true, 'options' => [
                ['run', 'Run'], ['class', 'Class'], ['event', 'Event'], ['challenge', 'Challenge'], ['retreat', 'Retreat'],
            ]]),
            $f('title', 'text', 'Title', ['required' => true, 'ar' => true, 'max' => 80]),
            $f('starts', 'datetime', 'Starts (Beirut time)', ['required' => true]),
            $f('ends', 'datetime', 'Ends (Beirut time)', ['required' => true, 'hint' => 'Once this time passes, the event disappears from the site by itself.']),
            $f('place', 'text', 'Place', ['ar' => true, 'max' => 120]),
            $f('detail', 'textarea', 'Details', ['ar' => true, 'max' => 500]),
            $f('note', 'text', 'Small note', ['ar' => true, 'max' => 80, 'hint' => 'Optional, e.g. “Limited to 15 women”.']),
            $f('spots', 'int', 'Places left', ['min' => 0, 'max' => 10000, 'hint' => '0 shows “Fully booked”. Leave empty to show no count.']),
            $f('featured', 'bool', 'Featured', ['hint' => 'Shown large at the top of the calendar.']),
            $f('link', 'text', 'Link', ['max' => 200, 'hint' => 'Optional page to link to, e.g. dietontherun.html#backontherun']),
        ];

        $service = [
            $f('id', 'id', 'Reference', ['from' => 'title']),
            $f('number', 'text', 'Number shown', ['max' => 4, 'hint' => 'e.g. 01']),
            $f('title', 'text', 'Title', ['required' => true, 'ar' => true, 'max' => 80]),
            $f('tagline', 'text', 'Tagline', ['ar' => true, 'max' => 120]),
            $f('bestFor', 'textarea', 'Best for', ['ar' => true, 'max' => 500]),
            $f('includes', 'list', 'What’s included', ['ar' => true, 'max' => 200, 'hint' => 'One per line.']),
            $f('omitOnline', 'list', 'Hide these when “Online” is selected', ['ar' => true, 'max' => 200, 'hint' => 'Copy lines exactly from “What’s included”.']),
            $f('duration', 'text', 'Duration', ['ar' => true, 'max' => 40]),
            $f('price', 'money', 'Price (USD)'),
            $f('modes', 'multi', 'Available', ['required' => true, 'options' => [['in-person', 'In person'], ['online', 'Online']]]),
            $f('cta', 'text', 'Button text', ['ar' => true, 'max' => 60]),
        ];

        $package = [
            $f('id', 'id', 'Reference', ['from' => 'name']),
            $f('name', 'text', 'Package name', ['required' => true, 'max' => 60, 'hint' => 'Package names stay in English on the Arabic site.']),
            $f('length', 'text', 'Length', ['ar' => true, 'max' => 60]),
            $f('line', 'text', 'One-line summary', ['ar' => true, 'max' => 120]),
            $f('includes', 'list', 'What’s included', ['ar' => true, 'max' => 200, 'hint' => 'One per line.']),
            $f('omitOnline', 'list', 'Hide these when “Online” is selected', ['ar' => true, 'max' => 200, 'hint' => 'Copy lines exactly from “What’s included”.']),
            $f('addOnline', 'list', 'Add these when “Online” is selected', ['ar' => true, 'max' => 200]),
            $f('price', 'money', 'Price (USD)'),
            $f('featured', 'bool', 'Highlight this package'),
            $f('badge', 'text', 'Badge', ['ar' => true, 'max' => 30, 'hint' => 'Optional, e.g. “Most chosen”.']),
        ];

        $challenge = [
            $f('name', 'text', 'Name', ['required' => true, 'max' => 60]),
            $f('kicker', 'text', 'Small heading', ['ar' => true, 'max' => 80]),
            $f('dates', 'text', 'Dates', ['ar' => true, 'max' => 80]),
            $f('line', 'text', 'Headline', ['ar' => true, 'max' => 120]),
            $f('body', 'textarea', 'Description', ['ar' => true, 'max' => 600]),
            $f('includes', 'list', 'What’s included', ['ar' => true, 'max' => 200]),
            $f('price', 'money', 'Price (USD)'),
            $f('priceNote', 'text', 'Price note', ['ar' => true, 'max' => 40, 'hint' => 'e.g. “for 6 weeks”.']),
            $f('cta', 'text', 'Button text', ['ar' => true, 'max' => 60]),
        ];

        $email = static fn (string $key, string $label) => $f($key, 'email', $label);

        return [
            'shop' => [
                'label' => 'Shop & products',
                'intro' => 'Products, prices, sizes and stock. Categories appear on the shop in this order.',
                'fields' => [
                    $f('categories', 'collection', 'Categories', ['noun' => 'category', 'title' => 'name', 'subtitle' => 'items', 'item' => $category]),
                    $f('governorates', 'list', 'Delivery governorates', ['ar' => true, 'max' => 60, 'hint' => 'The checkout list. Keep the Arabic in the same order.']),
                ],
            ],
            'runs' => [
                'label' => 'Runs & events',
                'intro' => 'Everything on the SheOnTheRun calendar. Past events hide themselves, so there’s no need to delete them.',
                'fields' => [
                    $f('recurring', 'group', 'Weekly runs (always shown)', ['item' => [
                        $f('title', 'text', 'Title', ['required' => true, 'ar' => true, 'max' => 60]),
                        $f('days', 'text', 'Days', ['ar' => true, 'max' => 60]),
                        $f('time', 'text', 'Time', ['ar' => true, 'max' => 30]),
                        $f('place', 'text', 'Place', ['ar' => true, 'max' => 120]),
                        $f('detail', 'textarea', 'Details', ['ar' => true, 'max' => 400]),
                    ]]),
                    $f('events', 'collection', 'Dated runs, classes & events', ['noun' => 'event', 'title' => 'title', 'subtitle' => 'starts', 'item' => $event]),
                ],
            ],
            'offer' => [
                'label' => 'Services & packages',
                'intro' => 'The DietOnTheRun page: consultations, packages and the BackOnTheRun challenge.',
                'fields' => [
                    $f('services', 'collection', 'Services', ['noun' => 'service', 'title' => 'title', 'subtitle' => 'price', 'item' => $service]),
                    $f('packages', 'collection', 'Packages', ['noun' => 'package', 'title' => 'name', 'subtitle' => 'price', 'item' => $package]),
                    $f('challenge', 'group', 'BackOnTheRun challenge', ['item' => $challenge]),
                ],
            ],
            'testimonials' => [
                'label' => 'Testimonials',
                'intro' => 'Client quotes on the DietOnTheRun page. Only add words a client really said, with their permission.',
                'fields' => [
                    $f('items', 'collection', 'Quotes', ['noun' => 'quote', 'title' => 'name', 'subtitle' => 'detail', 'item' => [
                        $f('quote', 'textarea', 'Quote', ['required' => true, 'max' => 700]),
                        $f('name', 'text', 'Name', ['required' => true, 'max' => 60, 'hint' => 'First name and initial, or initials if they prefer.']),
                        $f('detail', 'text', 'Detail', ['max' => 80, 'hint' => 'e.g. “The Reset · online”.']),
                        $f('sample', 'bool', 'Hide from the live site', ['hint' => 'For layout samples or quotes still waiting for permission. Hidden quotes only show when previewing on your own computer.']),
                    ]]),
                ],
            ],
            'settings' => [
                'label' => 'Site settings',
                'intro' => 'Contact details and switches used across the whole site.',
                'fields' => [
                    $f('whatsapp', 'digits', 'WhatsApp number', ['max' => 15, 'hint' => 'Digits only, full international format, no + or leading 0. Lebanon example: 96170123456. Empty = WhatsApp buttons hidden.']),
                    $f('email', 'email', 'Main email', ['required' => true]),
                    $f('emails', 'group', 'Where each Connect-form subject goes', ['item' => [
                        $email('nutrition', 'Nutrition consultations'),
                        $email('sheontherun', 'SheOnTheRun'),
                        $email('events', 'Events & partnerships'),
                        $email('research', 'Research'),
                        $email('general', 'General'),
                    ]]),
                    $f('instagram', 'url', 'Instagram link'),
                    $f('instagramHandle', 'text', 'Instagram handle', ['max' => 40, 'hint' => 'e.g. @sheontherun.lb']),
                    $f('bookingUrl', 'url', 'Online booking link', ['hint' => 'A Cal.com or Calendly link. Empty = booking happens on WhatsApp.']),
                    $f('formEndpoint', 'url', 'Contact form delivery (Formspree)', ['hint' => 'Empty = the form opens the visitor’s email app.']),
                    $f('orderEndpoint', 'url', 'Shop order delivery (Formspree)', ['hint' => 'Until phase 3 is live. Empty = orders go to WhatsApp or email.']),
                    $f('newsletterEndpoint', 'url', 'Newsletter sign-up link', ['hint' => 'Empty = the sign-up box stays hidden.']),
                    $f('plausibleDomain', 'text', 'Plausible analytics domain', ['max' => 100]),
                    $f('cloudflareToken', 'text', 'Cloudflare analytics token', ['max' => 100]),
                ],
            ],
        ];
    }

    public static function forClient(): array
    {
        $all = self::all();
        $out = [];
        foreach (self::EDITABLE as $area) {
            $out[$area] = $all[$area];
        }
        return $out;
    }
}
