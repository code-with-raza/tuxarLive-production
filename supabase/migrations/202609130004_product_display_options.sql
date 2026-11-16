alter table public.products
  add column if not exists show_color_selector boolean not null default true;
