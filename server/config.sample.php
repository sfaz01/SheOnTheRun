<?php
/* =============================================================================
   SECRETS & SETTINGS  —  copy this file, fill it in, and NEVER commit the copy.

   Best place on Hostinger (outside the public web folder):
       domains/sheontherun.com/sotr-config.php        ← one level above public_html
   Fallback (still blocked from the web by .htaccess):
       public_html/server/config.php

   Anything you leave out uses the default shown in server/app/Config.php.
   ========================================================================== */

return [

    'env' => 'production',
    'app_url' => 'https://sheontherun.com',

    /* One-time key that lets you create the FIRST admin account at /admin.
       Make it long and random (e.g. 40 characters). Once the first admin exists
       the setup screen switches itself off; you can then delete this line. */
    'setup_token' => 'PASTE-A-LONG-RANDOM-STRING-HERE',

    /* hPanel → Databases → MySQL Databases. Create a database and a user, then copy the three values. */
    'db' => [
        'driver' => 'mysql',
        'host'   => 'localhost',
        'name'   => 'u123456789_sotr',
        'user'   => 'u123456789_sotr',
        'pass'   => 'THE-DATABASE-PASSWORD',
    ],

    /* Needed in phase 3 (order alerts). hPanel → Emails → create an address, then use its details. */
    'mail' => [
        'from'      => 'orders@sheontherun.com',
        'smtp_host' => 'smtp.hostinger.com',
        'smtp_port' => 465,
        'smtp_user' => 'orders@sheontherun.com',
        'smtp_pass' => 'THE-MAILBOX-PASSWORD',
    ],

];
