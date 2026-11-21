import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import * as dates from '../../src/lib/blog/date.ts';

test('ISO and legacy publication days display identically in every supported language', () => {
  for (const locale of ['en', 'de', 'fr', 'it', 'es']) {
    assert.equal(dates.formatBlogDate('2026-06-11', locale), dates.formatBlogDate('June 11, 2026', locale));
  }
  assert.equal(dates.formatBlogDate('2026-06-11', 'en'), '11 June 2026');
  assert.equal(dates.blogDateTime('June 11, 2026'), '2026-06-11');
  assert.equal(dates.blogDateTime('2026-02-30'), undefined);
  assert.equal(dates.blogDateTime('2028-02-29'), '2028-02-29');
  assert.equal(dates.formatBlogDate(), '');
  assert.equal(dates.formatBlogDate('2026-11-21T05:32:25.177+00:00'), '21 November 2026');
  assert.equal(dates.formatBlogDate('2026-06-10T19:00:00+00:00'), '10 June 2026');
  assert.equal(dates.blogDateTime('2026-11-21T23:59:00-10:00'), '2026-11-21');
  assert.equal(dates.formatBlogDate('not a date'), '');
});

test('the actual journal cards use consistent labels and valid machine-readable dates', async () => {
  const exports = {};
  const posts = ['2026-06-11', 'June 11, 2026'].map((date, index) => ({ slug: `post-${index}`, title: `Article ${index}`, date, image: '/article.webp' }));
  const modules = {
    'react/jsx-runtime': jsx,
    '@tanstack/react-router': { createFileRoute: () => options => ({ ...options, useParams: () => ({ locale: 'en' }), useLoaderData: () => posts }), Link: ({ children }) => React.createElement('a', null, children) },
    'lucide-react': { Calendar: () => null, Tag: () => null, Clock: () => null },
    '@/lib/blog/date': dates,
    '@/i18n/i18n': { t: key => key, BLOG_SLUG_MAP: { first: { en: 'post-0' }, second: { en: 'post-1' } }, getLocalizedLink: () => ({}) },
    '@/components/site/PageHero': { PageHero: () => null },
    '@/lib/seo': {}, '@/assets': { getProductAsset: value => value },
  };
  const source = await fs.readFile('src/routes/$locale.blog.index.tsx', 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: name => modules[name] });
  const html = renderToStaticMarkup(React.createElement(exports.Route.component));
  assert.equal((html.match(/11 June 2026/g) ?? []).length, 2);
  assert.equal((html.match(/datetime="2026-06-11"/gi) ?? []).length, 2);
});
