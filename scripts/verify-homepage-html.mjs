import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function verifyHomepageHtml(html, locale) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
  const canonicals = [...head.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"[^>]*>/gi)];
  if (canonicals.length !== 1 || canonicals[0][1] !== `https://tuxar.co.uk/${locale}`) throw Error(`Incorrect initial canonical: ${locale}`);
  if (!new RegExp(`<html lang="${locale}">`).test(html)) throw Error(`Incorrect document language: ${locale}`);
  if (!/<h1\b/.test(html) || !/<h2\b/.test(html)) throw Error(`Missing homepage headings: ${locale}`);
  const links = [...html.matchAll(/<a\b[^>]*href="([^"#]+)"/gi)].map(match => match[1]).filter(href => href.startsWith(`/${locale}/`));
  if (links.length < 5) throw Error(`Missing crawlable internal navigation: ${locale}`);
  if (!/<script\b[^>]*type="module"[^>]*src="\/assets\//.test(html)) throw Error(`Missing interactive app: ${locale}`);
  if (html.includes('/src/assets/') || html.includes('Local catalogue preview')) throw Error(`Draft/source content in production: ${locale}`);
  return { locale, canonical: canonicals[0][1], internalLinks: links.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const locale of ['en', 'it', 'de', 'fr', 'es']) console.log(JSON.stringify(verifyHomepageHtml(await fs.readFile(`dist/prerender-home/${locale}.html`, 'utf8'), locale)));
}
