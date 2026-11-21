<?php
declare(strict_types=1);

function tuxar_route_status(string $path, array $routes, callable $published, ?callable $product = null): int {
    if (preg_match('~^/(?:(en|de|fr|it|es)/)?blog/([a-z0-9]+(?:-[a-z0-9]+)*)$~D', $path, $match)) {
        return $published($match[1] ?: 'en', $match[2]);
    }
    if ($product && preg_match('~^/(?:(en|de|fr|it|es)/)?product/([a-z0-9]+(?:-[a-z0-9]+)*)$~D', $path, $match)) {
        return $product($routes['productSlugs'][$match[2]] ?? $match[2]);
    }
    if (in_array($path, $routes['paths'], true)) return 200;
    if (preg_match('~^/(en|de|fr|it|es)/admin/(products|categories|journal|banners)/(new|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|(?:storefront|preview)--[a-z0-9]+(?:-[a-z0-9]+)*)$~D', $path)) return 200;
    return 404;
}

function tuxar_public_rows(string $table, array $query, array $routes): ?array {
    $base = $routes['supabaseUrl'] ?? '';
    $key = $routes['publishableKey'] ?? '';
    if (!preg_match('~^https://[a-z0-9]+\.supabase\.co$~D', $base) || !$key) return null;
    $url = $base . '/rest/v1/' . $table . '?' . http_build_query($query);
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
    if ($status !== 200 || $body === false) return null;
    $rows = json_decode($body, true);
    if (!is_array($rows) || array_keys($rows) !== ($rows ? range(0, count($rows) - 1) : [])) return null;
    return $rows;
}

function tuxar_published_article(string $locale, string $slug, array $routes): int {
    $rows = tuxar_public_rows('blog_publication_states', ['select'=>'is_published', 'locale'=>'eq.'.$locale, 'slug'=>'eq.'.$slug, 'limit'=>'1'], $routes);
    if ($rows === null) return 503;
    if ($rows) return $rows[0]['is_published'] === true ? 200 : 404;
    // An untouched bundled translation may not have been imported into the CMS.
    return in_array('/'.$locale.'/blog/'.$slug, $routes['paths'], true) ? 200 : 404;
}

function tuxar_published_product(string $slug, array $routes): int {
    $rows = tuxar_public_rows('products', ['select'=>'slug', 'slug'=>'eq.'.$slug, 'status'=>'eq.active', 'limit'=>'1'], $routes);
    return $rows === null ? 503 : ($rows ? 200 : 404);
}

/** Generated cards contain no nested article tags. Only matching public keys are removed. */
function tuxar_filter_publication_cards(string $html, callable $lookup): ?string {
    preg_match_all('~<article\b[^>]*data-publication-(product|blog)="([a-z0-9:-]+)"[^>]*>[\s\S]*?</article>~', $html, $cards, PREG_SET_ORDER);
    if (!$cards) return $html;
    $keys = array_values(array_unique(array_map(fn($card) => $card[1].':'.$card[2], $cards)));
    $visible = $lookup($keys);
    if ($visible === null) return null;
    foreach ($cards as $card) {
        if (($visible[$card[1].':'.$card[2]] ?? false) !== true) $html = str_replace($card[0], '', $html);
    }
    return $html;
}

function tuxar_card_visibility(array $keys, array $routes): ?array {
    $visible = []; $products = []; $blogs = [];
    foreach ($keys as $key) {
        $parts = explode(':', $key);
        if ($parts[0] === 'product') { $products[] = $parts[1]; $visible[$key] = false; }
        elseif (count($parts) === 3) { $blogs[$parts[1]][] = $parts[2]; $visible[$key] = true; }
    }
    foreach (array_chunk($products, 100) as $slugs) {
        $rows = tuxar_public_rows('products', ['select'=>'slug','slug'=>'in.('.implode(',', $slugs).')','status'=>'eq.active'], $routes);
        if ($rows === null) return null;
        foreach ($rows as $row) $visible['product:'.$row['slug']] = true;
    }
    foreach ($blogs as $locale => $slugs) foreach (array_chunk($slugs, 100) as $chunk) {
        $rows = tuxar_public_rows('blog_publication_states', ['select'=>'slug,is_published','locale'=>'eq.'.$locale,'slug'=>'in.('.implode(',', $chunk).')'], $routes);
        if ($rows === null) return null;
        foreach ($rows as $row) $visible['blog:'.$locale.':'.$row['slug']] = $row['is_published'] === true;
    }
    return $visible;
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    $routes = json_decode((string)@file_get_contents(__DIR__ . '/server-routes.json'), true);
    $path = preg_replace('~/$~', '', (string)parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH)) ?: '/';
    $status = is_array($routes) && isset($routes['paths'])
        ? tuxar_route_status($path, $routes, fn($locale, $slug) => tuxar_published_article($locale, $slug, $routes), fn($slug) => tuxar_published_product($slug, $routes))
        : 503;
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: private, no-store');
    if ($status === 200) {
        // Use only a manifest-approved path; never read a request-derived arbitrary file.
        $prerender = __DIR__ . '/prerender-pages' . $path . '/index.html';
        if (preg_match('~^/(en|de|fr|it|es)$~D', $path, $home)) $prerender = __DIR__.'/prerender-home/'.$home[1].'.html';
        $html = in_array($path, $routes['paths'], true) && preg_match('~^/(en|de|fr|it|es)(?:/[a-z0-9/-]+)?$~D', $path) && is_file($prerender)
            ? (string)file_get_contents($prerender) : (string)file_get_contents(__DIR__.'/index.html');
        $filtered = tuxar_filter_publication_cards($html, fn($keys) => tuxar_card_visibility($keys, $routes));
        if ($filtered === null) { http_response_code(503); echo '<h1>Availability could not be checked</h1><p>Please try again shortly.</p>'; }
        else echo $filtered;
    }
    elseif ($status === 404) readfile(__DIR__ . '/legacy-not-found.html');
    else echo '<!doctype html><html lang="en"><meta charset="utf-8"><title>Temporarily unavailable | Tuxar</title><h1>Temporarily unavailable</h1><p>Please try again shortly.</p><a href="/en">Home</a></html>';
}
