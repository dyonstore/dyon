<?php
/* DYON configuration defaults. Copy to config/config.php (git-ignored) or put overrides in
   config/config.local.php; any key can also be set with an env var DYON_<UPPER_KEY>.
   NEVER commit secrets. */
return [
    'env'            => 'prod',                 // 'dev' enables /dev/* harness pages
    'base_url'       => 'https://dyon.store',
    'data_dir'       => dirname(__DIR__) . '/data',
    'secret_key'     => '',                     // 32+ random bytes, base64 (php -r 'echo base64_encode(random_bytes(32));')
    'cookie_secure'  => true,                   // false only for http://localhost dev
    'trusted_proxy_header' => '',               // e.g. 'CF-Connecting-IP' behind Cloudflare; empty = REMOTE_ADDR only
    'country_header' => 'CF-IPCountry',
    'geoip_db'       => '',                     // optional path to a GeoLite2-Country .mmdb

    'oauth' => [
        'google'    => ['client_id' => '', 'client_secret' => ''],
        'microsoft' => ['client_id' => '', 'client_secret' => '', 'tenant' => 'common'],
        'apple'     => ['client_id' => '', 'team_id' => '', 'key_id' => '', 'private_key' => ''],
    ],

    'smtp' => ['host' => '', 'port' => 587, 'user' => '', 'pass' => '', 'secure' => 'tls',
               'from' => 'hello@dyon.store', 'from_name' => 'DYON', 'bounce' => 'bounce@dyon.store'],

    'admin_sub_hashes' => [],                   // sha256(provider+sub) of allowed admins
    'admin_totp_secret' => '',                  // base32
];
