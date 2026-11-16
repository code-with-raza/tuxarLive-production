-- Local release prerequisite. Existing historical orders remain GBP.
begin;
alter table public.orders drop constraint if exists orders_currency_check;
alter table public.orders add constraint orders_currency_check check (currency in ('GBP','EUR'));
commit;
