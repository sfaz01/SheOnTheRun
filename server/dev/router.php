<?php
/* Local router for PHP's built-in server: does what the root .htaccess does on Hostinger. */
$path = rawurldecode((string) parse_url((string) $_SERVER['REQUEST_URI'], PHP_URL_PATH));
$root = dirname(__DIR__, 2);

if (preg_match('#^/api(/|$)#', $path)) {
    require $root . '/api/index.php';
    return true;
}
if (preg_match('#^/(server|docs|tools|\.git|\.github|\.claude)(/|$)#', $path) || preg_match('#/\.[^/]#', $path) || preg_match('#\.(md|py|exe|sqlite|sql|log)$#', $path)) {
    http_response_code(403);
    echo 'Forbidden';
    return true;
}
if (preg_match('#^/admin(/|$)#', $path)) {
    // Same policy as admin/.htaccess, so a violation shows up locally instead of on the live site.
    header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    header('Cache-Control: no-store');
    $target = $root . $path;
    if (is_dir($target)) {
        $target = rtrim($target, '/') . '/index.html';
    }
    if (is_file($target)) {
        // The built-in server drops headers when a router returns false, so send admin files ourselves.
        $types = ['html' => 'text/html; charset=utf-8', 'js' => 'text/javascript', 'css' => 'text/css', 'txt' => 'text/plain'];
        header('Content-Type: ' . ($types[pathinfo($target, PATHINFO_EXTENSION)] ?? 'application/octet-stream'));
        readfile($target);
        return true;
    }
}
$file = $root . $path;
if (is_file($file)) {
    return false; // let the built-in server send it
}
if (is_dir($file) && is_file(rtrim($file, '/') . '/index.html')) {
    return false;
}
http_response_code(404);
readfile($root . '/404.html');
return true;
