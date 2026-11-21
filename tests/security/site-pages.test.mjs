import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { sanitizeRichHtml } from '../../src/lib/sanitize.ts';

async function setup({data=null,error=null}={}) {
  const calls=[];
  const chain={select(){return chain},eq(key,value){calls.push([key,value]);return chain},abortSignal(){return chain},maybeSingle(){return Promise.resolve({data,error})}};
  const exports={};
  const source=await fs.readFile('src/lib/site-pages.ts','utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports,require:()=>({publicSupabase:{from:()=>chain},isSupabaseConfigured:()=>true}),AbortSignal,Set,Object,
  });
  return {...exports,calls};
}

test('page content reads only the requested locale and published record, never private or unknown routes',async()=>{
  const api=await setup({data:{page_key:'about',locale:'de',title:'Über uns'}});
  assert.equal((await api.getSitePage('/de/about','de')).title,'Über uns');
  assert.deepEqual(api.calls,[['page_key','about'],['locale','de'],['status','published']]);
  const count=api.calls.length;
  assert.equal(await api.getSitePage('/en/admin','en'),null);
  assert.equal(await api.getSitePage('/en/checkout','en'),null);
  assert.equal(api.calls.length,count);
});

test('missing translations preserve existing localized pages and read failures are visible',async()=>{
  assert.equal(await (await setup()).getSitePage('/fr/about','fr'),null);
  await assert.rejects((await setup({error:{message:'offline'}})).getSitePage('/en/about','en'),/could not be loaded/);
});

test('managed editorial content replaces only editorial bodies and strips executable HTML',async()=>{
  const api=await setup();
  const exports={};
  const source=await fs.readFile('src/components/site/ManagedPageContent.tsx','utf8');
  const modules={'react/jsx-runtime':jsx,'@/lib/site-pages':api,'@/lib/sanitize':{sanitizeRichHtml}};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>modules[name]});
  const render=page_key=>renderToStaticMarkup(React.createElement(exports.ManagedPageContent,{page:{page_key,title:'Saved title',description:'First\nSecond',content_html:'<h2>Heading</h2><p>Copy</p><script>alert(1)</script><img src="x" onerror="alert(1)" />'}},React.createElement('button',null,'Existing controls')));
  const editorial=render('about');
  assert.match(editorial,/<h1[^>]*>Saved title/);
  assert.match(editorial,/<h2>Heading/);
  assert.doesNotMatch(editorial,/Existing controls|<script|onerror=/);
  assert.match(render('contact'),/Existing controls/);
  assert.match(render('contact'),/<h2[^>]*>Saved title/);
});

test('translation drafts stay private and publishing requires current English source and explicit staff review',async()=>{
  const sql=await fs.readFile('supabase/migrations/202611210002_content_publication.sql','utf8');
  assert.match(sql,/blog_translation_drafts enable row level security/);
  assert.match(sql,/staff manages translation drafts[^;]+to authenticated/s);
  assert.match(sql,/p_reviewed is not true/);
  assert.match(sql,/source.updated_at is distinct from p_source_updated_at/);
  assert.match(sql,/if not public.is_admin/);
  assert.match(sql,/record_blog_publication[\s\S]+tg_op in \('DELETE','UPDATE'\)/);
  assert.doesNotMatch(sql,/update public\.(products|product_variants|orders|customers)/);
});
