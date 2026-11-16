create extension if not exists pgcrypto;
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(), name text not null, email text not null,
  subject text not null, message text not null, locale text not null default 'en',
  status text not null default 'new', notification_status text not null default 'pending',
  notification_id text, notification_error text, notified_at timestamptz,
  created_at timestamptz not null default now(),
  check (char_length(name) between 1 and 100), check (char_length(email) between 3 and 255),
  check (char_length(subject) between 1 and 150), check (char_length(message) between 10 and 2000),
  check (locale in ('en','de','fr','it','es')), check (status in ('new','read','replied','closed')),
  check (notification_status in ('pending','sent','failed'))
);
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(), email text not null unique,
  locale text not null default 'en', status text not null default 'active',
  consented_at timestamptz not null default now(), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), check (locale in ('en','de','fr','it','es')),
  check (status in ('active','unsubscribed'))
);
alter table public.contact_messages enable row level security;
alter table public.newsletter_subscribers enable row level security;
