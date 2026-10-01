<?php
/* Local development only — used by `node server/dev/serve.mjs`. Contains no real secrets. */
return [
    'env' => 'dev',
    'app_url' => 'http://localhost:8092',
    'setup_token' => 'dev-setup-token',
    'db' => ['driver' => 'sqlite', 'path' => dirname(__DIR__) . '/storage/dev.sqlite'],
];
