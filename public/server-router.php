<?php
declare(strict_types=1);

function tuxar_route_status(string $path, array $routes, callable $published): int {
    if (in_array($path, $routes['paths'], true)) return 200;
    if (preg_match('~^/(en|de|fr|it|es)/admin/(products|categories|journal|banners)/(new|[a-f0-9-]{36})$~D', $path)) return 200;
    if (preg_match('~^/(?:(en|de|fr|it|es)/)?blog/([a-z0-9]+(?:-[a-z0-9]+)*)$~D', $path, $match)) {
        return $published($match[1] ?: 'en', $match[2]);
    }
    return 404;
}

function tuxar_published_article(string $locale, string $slug, array $routes): int {
    $base = $routes['supabaseUrl'] ?? '';
    $key = $routes['publishableKey'] ?? '';
    if (!preg_match('~^https://[a-z0-9]+\.supabase\.co$~D', $base) || !$key) return 503;
    $url = $base . '/rest/v1/blog_posts?' . http_build_query([
        'select' => 'slug', 'locale' => 'eq.' . $locale, 'slug' => 'eq.' . $slug,
        'status' => 'eq.published', 'limit' => '1',
    ]);
    $headers = ['apikey: ' . $key, 'Accept: application/json'];
    if (function_exists('curl_init')) {
        $request = curl_init($url);
        curl_setopt_array($request, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $headers,
            CURLOPT_CONNECTTIMEOUT => 3, CURLOPT_TIMEOUT => 8, CURLOPT_FOLLOWLOCATION => false]);
        $body = curl_exec($request);
        $status = curl_getinfo($request, CURLINFO_HTTP_CODE);
        curl_close($request);
    } else {
        $context = stream_context_create(['http' => ['header' => implode("\r\n", $headers), 'timeout' => 8,
            'ignore_errors' => true, 'follow_location' => 0]]);
        $body = @file_get_contents($url, false, $context);
        $status = preg_match('~^HTTP/\S+ (\d+)~', $http_response_header[0] ?? '', $match) ? (int)$match[1] : 0;
    }
    if ($status !== 200 || $body === false) return 503;
    $rows = json_decode($body, true);
    if (!is_array($rows) || array_keys($rows) !== ($rows ? range(0, count($rows) - 1) : [])) return 503;
    return count($rows) > 0 ? 200 : 404;
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    $routes = json_decode((string)@file_get_contents(__DIR__ . '/server-routes.json'), true);
    $path = preg_replace('~/$~', '', (string)parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH)) ?: '/';
    $status = is_array($routes) && isset($routes['paths'])
        ? tuxar_route_status($path, $routes, fn($locale, $slug) => tuxar_published_article($locale, $slug, $routes))
        : 503;
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: private, no-store');
    if ($status === 200) readfile(__DIR__ . '/index.html');
    elseif ($status === 404) readfile(__DIR__ . '/legacy-not-found.html');
    else echo '<!doctype html><html lang="en"><meta charset="utf-8"><title>Temporarily unavailable | Tuxar</title><h1>Temporarily unavailable</h1><p>Please try again shortly.</p><a href="/en">Home</a></html>';
}
