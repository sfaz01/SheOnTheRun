<?php
/* Local development only — used by `node server/dev/serve.mjs`. Contains no real secrets. */
return [
    'env' => 'dev',
    'app_url' => 'http://localhost:8092',
    'setup_token' => 'dev-setup-token',
    'db' => ['driver' => 'sqlite', 'path' => dirname(__DIR__) . '/storage/dev.sqlite'],
    // Publish writes here locally, never over the hand-written files in data/ (the router serves these copies).
    'site_root' => dirname(__DIR__) . '/storage/dev-site',
];
