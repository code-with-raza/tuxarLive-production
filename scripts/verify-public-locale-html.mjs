export function inspectPublicHtml(html, url) {
  const locale = new URL(url).pathname.split('/')[1];
  const tags = [...html.matchAll(/<link\b[^>]*>/gi)].map(([tag]) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key.toLowerCase(), value.replaceAll('&amp;', '&')])));
  const canonicals = tags.filter(tag => tag.rel === 'canonical');
  if (canonicals.length !== 1 || canonicals[0].href !== url) throw Error(`Wrong canonical: ${url}`);
  if (!new RegExp(`<html lang="${locale}">`).test(html)) throw Error(`Wrong HTML language: ${url}`);
  if (/<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/i.test(html)) throw Error(`Indexable page marked noindex: ${url}`);
  const alternates = tags.filter(tag => tag.rel === 'alternate' && tag.hreflang);
  const article = /^\/(en|de|es|fr|it)\/blog\/[^/]+$/.test(new URL(url).pathname);
  const languages = ['en','de','es','fr','it'];
  for (const alternate of alternates) {
    const target = new URL(alternate.href);
    if (![...languages,'x-default'].includes(alternate.hreflang) || target.origin !== 'https://tuxar.co.uk' || (alternate.hreflang !== 'x-default' && target.pathname.split('/')[1] !== alternate.hreflang)) throw Error(`Wrong-language alternate: ${url}`);
    if (article && !/^\/(en|de|es|fr|it)\/blog\/[^/]+$/.test(target.pathname)) throw Error(`Wrong article alternate: ${url}`);
  }
  const required = article ? [locale,'x-default'] : [...languages,'x-default'];
  if (required.some(language => alternates.filter(tag => tag.hreflang === language).length !== 1) || new Set(alternates.map(tag => tag.hreflang)).size !== alternates.length) throw Error(`Incomplete hreflang: ${url}`);
  if (alternates.find(tag => tag.hreflang === locale)?.href !== url) throw Error(`Missing self alternate: ${url}`);
  const defaultHref = alternates.find(tag => tag.hreflang === 'x-default')?.href;
  if (article ? !alternates.some(tag => tag.hreflang !== 'x-default' && tag.href === defaultHref) : defaultHref !== alternates.find(tag => tag.hreflang === 'en')?.href) throw Error(`Wrong default alternate: ${url}`);
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  if (h1s.length !== 1) throw Error(`Expected one H1 (${h1s.length}): ${url}`);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (!title || !/<meta\b[^>]*name="description"[^>]*content="[^"]+"/i.test(html)) throw Error(`Missing localized metadata: ${url}`);
  return { url, locale, canonical: canonicals[0].href, title, h1: h1s[0][1].replace(/<[^>]*>/g,''), alternates: Object.fromEntries(alternates.map(tag => [tag.hreflang, tag.href])) };
}
