-- Public keys/status only, never draft titles, bodies or customer information.
create table public.blog_publication_states (
  locale text not null,
  slug text not null,
  is_published boolean not null,
  primary key (locale, slug)
);
alter table public.blog_publication_states enable row level security;
create policy "public reads journal visibility" on public.blog_publication_states for select to anon, authenticated using (true);
grant select on public.blog_publication_states to anon, authenticated;
revoke insert, update, delete on public.blog_publication_states from anon, authenticated;

create function public.record_blog_publication() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op in ('DELETE','UPDATE') then
    insert into public.blog_publication_states values (old.locale, old.slug, false)
    on conflict (locale,slug) do update set is_published = false;
  end if;
  if tg_op <> 'DELETE' then
    insert into public.blog_publication_states values (new.locale, new.slug, new.status = 'published')
    on conflict (locale,slug) do update set is_published = excluded.is_published;
    return new;
  end if;
  return old;
end $$;
revoke all on function public.record_blog_publication() from public, anon, authenticated;
create trigger blog_publication_changed after insert or update or delete on public.blog_posts
for each row execute function public.record_blog_publication();
insert into public.blog_publication_states select locale,slug,status='published' from public.blog_posts;

create table public.site_pages (
  locale text not null check (locale in ('en','de','fr','it','es')),
  page_key text not null check (page_key in ('home','about','contact','shop','sales','leather-jackets','women-leather-jackets','leather-bags','motorcycle-suits','accessories','blog','faq','size-guide','shipping-policy','returns-policy','privacy-policy','terms-conditions')),
  title text not null default '', description text not null default '', content_html text not null default '',
  status text not null default 'draft' check (status in ('draft','published')),
  updated_at timestamptz not null default now(),
  primary key (locale,page_key)
);
alter table public.site_pages enable row level security;
create policy "public reads published pages" on public.site_pages for select to anon, authenticated using (status='published');
create policy "staff manages pages" on public.site_pages for all to authenticated using (public.is_admin(array['owner','admin','editor'])) with check (public.is_admin(array['owner','admin','editor']));
grant select on public.site_pages to anon;
grant select, insert, update, delete on public.site_pages to authenticated;

-- Private review workspace: never present English copies as completed translations.
alter table public.blog_posts add column translation_source_id uuid references public.blog_posts(id) on delete set null;
create index blog_posts_translation_source_idx on public.blog_posts(translation_source_id);
create table public.blog_translation_drafts (
  source_post_id uuid not null references public.blog_posts(id) on delete cascade,
  locale text not null check (locale in ('de','fr','it','es')),
  source_updated_at timestamptz not null,
  source_snapshot jsonb not null,
  title text not null default '', slug text not null default '', excerpt text not null default '',
  content_markdown text not null default '', seo_title text not null default '', seo_description text not null default '',
  review_required boolean not null default true,
  primary key (source_post_id, locale)
);
alter table public.blog_translation_drafts enable row level security;
create policy "staff manages translation drafts" on public.blog_translation_drafts for all to authenticated
using (public.is_admin(array['owner','admin','editor'])) with check (public.is_admin(array['owner','admin','editor']));
grant select, insert, update, delete on public.blog_translation_drafts to authenticated;

create function public.queue_blog_translation_reviews() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.locale <> 'en' then return new; end if;
  if tg_op = 'UPDATE' and row(new.title,new.excerpt,new.content_markdown,new.seo_title,new.seo_description,new.cover_image_url)
    is not distinct from row(old.title,old.excerpt,old.content_markdown,old.seo_title,old.seo_description,old.cover_image_url)
    and (select count(*) from public.blog_translation_drafts where source_post_id=new.id)=4 then
    update public.blog_translation_drafts set source_updated_at=new.updated_at,source_snapshot=to_jsonb(new) where source_post_id=new.id;
    return new;
  end if;
  insert into public.blog_translation_drafts (source_post_id,locale,source_updated_at,source_snapshot)
    select new.id,language,new.updated_at,to_jsonb(new) from unnest(array['de','fr','it','es']) language
    on conflict (source_post_id,locale) do update set source_updated_at=excluded.source_updated_at,
      source_snapshot=excluded.source_snapshot,review_required=true;
  return new;
end $$;
revoke all on function public.queue_blog_translation_reviews() from public,anon,authenticated;
create trigger queue_translation_reviews after insert or update on public.blog_posts
for each row execute function public.queue_blog_translation_reviews();

create function public.publish_reviewed_blog_translation(p_source uuid, p_locale text, p_source_updated_at timestamptz, p_reviewed boolean)
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare draft public.blog_translation_drafts; source public.blog_posts; result uuid;
begin
  if not public.is_admin(array['owner','admin','editor']) then raise exception 'Article editing permission required'; end if;
  if p_reviewed is not true then raise exception 'Review the translation before publishing'; end if;
  select * into source from public.blog_posts where id=p_source and locale='en' for update;
  if not found then raise exception 'English source article not found'; end if;
  if source.status <> 'published' then raise exception 'Publish the English source before publishing its translations'; end if;
  select * into draft from public.blog_translation_drafts where source_post_id=p_source and locale=p_locale for update;
  if not found then raise exception 'Save a translation draft first'; end if;
  if source.updated_at is distinct from p_source_updated_at or draft.source_updated_at is distinct from p_source_updated_at
    then raise exception 'English article changed. Reload and review its latest version first'; end if;
  if trim(draft.title)='' or trim(draft.content_markdown)='' or draft.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    then raise exception 'Add a translated title, valid URL handle and translated content'; end if;
  insert into public.blog_posts (locale,slug,title,excerpt,content_markdown,category,author,cover_image_url,cover_image_alt,seo_title,seo_description,status,published_at,translation_source_id)
    values (p_locale,draft.slug,draft.title,draft.excerpt,draft.content_markdown,source.category,source.author,source.cover_image_url,
      draft.title,draft.seo_title,draft.seo_description,'published',now(),p_source)
    on conflict (locale,slug) do update set title=excluded.title,excerpt=excluded.excerpt,content_markdown=excluded.content_markdown,
      cover_image_url=excluded.cover_image_url,cover_image_alt=excluded.cover_image_alt,seo_title=excluded.seo_title,
      seo_description=excluded.seo_description,translation_source_id=p_source,status='published',published_at=coalesce(public.blog_posts.published_at,now()),updated_at=now()
    returning id into result;
  update public.blog_translation_drafts set review_required=false where source_post_id=p_source and locale=p_locale;
  return result;
end $$;
revoke all on function public.publish_reviewed_blog_translation(uuid,text,timestamptz,boolean) from public,anon;
grant execute on function public.publish_reviewed_blog_translation(uuid,text,timestamptz,boolean) to authenticated;
