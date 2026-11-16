create table if not exists public.marketing_templates (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 template_type text not null check(template_type in ('coupon','sale')),
 subject text not null,
 headline text not null,
 message text not null,
 button_label text not null default 'Shop now',
 button_url text not null default 'https://tuxar.co.uk/en/shop',
 banner_url text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.marketing_campaigns (
 id uuid primary key default gen_random_uuid(),
 template_id uuid references public.marketing_templates(id) on delete set null,
 campaign_type text not null check(campaign_type in ('coupon','sale')),
 subject text not null,
 recipient_mode text not null check(recipient_mode in ('all','specific')),
 recipient_count integer not null default 0,
 coupon_code text,
 status text not null default 'sent' check(status in ('sent','failed')),
 sent_by uuid references auth.users(id),
 sent_at timestamptz not null default now()
);
alter table public.marketing_templates enable row level security;
alter table public.marketing_campaigns enable row level security;
create policy "marketing staff manage templates" on public.marketing_templates for all to authenticated using(public.is_admin(array['owner','admin','editor'])) with check(public.is_admin(array['owner','admin','editor']));
create policy "marketing staff read campaigns" on public.marketing_campaigns for select to authenticated using(public.is_admin(array['owner','admin','editor']));
