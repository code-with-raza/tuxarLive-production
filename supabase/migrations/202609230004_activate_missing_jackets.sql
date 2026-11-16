-- These two slugs were present as draft catalog records, so the insert-only
-- migration did not make them visible. The owner approved 10 per size.
update public.products
set status = 'active', updated_at = now()
where slug in ('monaco-leather-racer', 'aviator-g1-shearling');

update public.product_variants v
set stock = 10, active = true, updated_at = now()
from public.products p
where v.product_id = p.id
  and p.slug in ('monaco-leather-racer', 'aviator-g1-shearling')
  and v.size in ('S', 'M', 'L', 'XL', 'XXL');
