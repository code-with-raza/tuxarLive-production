import fs from 'node:fs/promises';

// Offline preparation only. Never connects to Supabase or changes remote data.
const inventory = JSON.parse(await fs.readFile('src/data/womens-inventory.json', 'utf8'));
if (!inventory.pricesApproved || inventory.publicationStatus !== 'approved') throw Error('Prices and release must be approved before production preparation');
const plan = JSON.parse(await fs.readFile('output/supabase-womens-release/review-plan.json', 'utf8'));
if (plan.products.length !== 94 || plan.variants.length !== 752 || plan.stockPerSizePerColour !== 15) throw Error('Unexpected staged release');
const products = plan.products.map(product => ({ ...product, audience: 'women', inStock: true }));
const payload = JSON.stringify({ products, variants: plan.variants });
if (payload.includes('$release$') || payload.includes('$activate$')) throw Error('SQL delimiter collision');
const folder = 'output/womens-production';
await fs.mkdir(folder, { recursive: true });
await fs.copyFile('supabase/migrations/202610260001_disable_cash_on_delivery.sql', `${folder}/00-DISABLE-NEW-COD.sql`);
await fs.writeFile(`${folder}/DEPLOY-EDGE-FUNCTIONS.ps1`, String.raw`$ErrorActionPreference = 'Stop'
$tuxarSource = $PSScriptRoot
while (-not (Test-Path -LiteralPath (Join-Path $tuxarSource 'supabase/config.toml'))) {
  $tuxarParent = Split-Path -Parent $tuxarSource
  if ([string]::IsNullOrEmpty($tuxarParent) -or $tuxarParent -eq $tuxarSource) { throw 'Run this file from the prepared release folder inside the original project.' }
  $tuxarSource = $tuxarParent
}
Push-Location -LiteralPath $tuxarSource
try {
  foreach ($tuxarFunction in @('create-cod-order','create-checkout-session','stripe-webhook','dispatch-order')) {
    Write-Host ('Deploying ' + $tuxarFunction + ' to Tuxar Production / ncgxljatjajgcvnlrncm')
    & npx.cmd --yes supabase@2.121.0 functions deploy $tuxarFunction --project-ref ncgxljatjajgcvnlrncm --use-api
    if ($LASTEXITCODE -ne 0) { throw ('Deployment failed: ' + $tuxarFunction + '. Stop and review the error.') }
  }
} finally { Pop-Location }
`);
await fs.writeFile(`${folder}/approved-womens-catalogue.json`, JSON.stringify({ products }, null, 2) + '\n');
await fs.writeFile(`${folder}/04-ACTIVATE-94-WOMENS-PRODUCTS.sql`, `-- Run only after uploading the matching frontend package.
-- Activates exactly the staged 94 women products. Never inserts products or resets stock/prices.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $activate$
declare data jsonb := $release$${payload}$release$::jsonb;
expected jsonb; actual record; v jsonb; expected_id uuid;
begin
perform p.id from public.products p join jsonb_array_elements(data->'products') n on p.slug=n->>'slug' order by p.id for update of p;
perform v.id from public.product_variants v join public.products p on p.id=v.product_id join jsonb_array_elements(data->'products') n on p.slug=n->>'slug' order by v.id for update of v;
if (select count(*) from public.products p join jsonb_array_elements(data->'products') n on p.slug=n->>'slug')<>94 then
raise exception 'Expected all 94 staged products. No products activated.'; end if;
for expected in select * from jsonb_array_elements(data->'products') loop
select * into actual from public.products where slug=expected->>'slug';
if actual.status not in ('draft','active') then raise exception 'A target product is archived. Review before activation.'; end if;
if actual.category<>'leather-jackets' then raise exception 'Unexpected women category. No products activated.'; end if;
if actual.status='draft' and actual.price_pence<>round((expected->>'priceGBP')::numeric*100)::integer then
raise exception 'A staged price differs from the approved price. Review before activation.'; end if;
if (select count(*) from public.product_variants where product_id=actual.id)<>8 then raise exception 'Expected eight size variants per colourway.'; end if;
for v in select * from jsonb_array_elements(data->'variants') where value->>'productSlug'=expected->>'slug' loop
if not exists(select 1 from public.product_variants where product_id=actual.id and sku=v->>'sku' and size=v->>'size' and color=v->>'color' and active) then
raise exception 'Missing or mismatched size/colour variant. No products activated.'; end if;
if actual.status='draft' and not exists(select 1 from public.product_variants where product_id=actual.id and sku=v->>'sku' and stock=15 and price_pence=round((expected->>'priceGBP')::numeric*100)::integer) then
raise exception 'Staged inventory or variant price differs from the approved release. No stock is overwritten.'; end if;
end loop;
if (select count(*) from public.product_images where product_id=actual.id)<>jsonb_array_length(expected->'gallery') then raise exception 'Product gallery count differs from the verified release.'; end if;
if exists(select 1 from jsonb_array_elements_text(expected->'gallery') image_url where not exists(select 1 from public.product_images where product_id=actual.id and url=image_url)) then raise exception 'Missing verified product photo.'; end if;
if exists(select 1 from jsonb_array_elements_text(expected->'collections') c where not exists(select 1 from public.product_collections where product_id=actual.id and collection_slug=c)) then raise exception 'Missing women category assignment.'; end if;
end loop;
update public.products p set status='active',updated_at=now() where status='draft' and exists(select 1 from jsonb_array_elements(data->'products') n where p.slug=n->>'slug');
end $activate$;
commit;
select count(*) as active_womens_products from public.products where status='active' and slug in (${products.map(product => `'${product.slug.replaceAll("'", "''")}'`).join(',')});
`);
await fs.writeFile(`${folder}/DEPLOYMENT-ORDER.md`, `# Women’s catalogue release — approved 28 October 2026

The 94 women’s products are already staged in Supabase. Do not rerun the staging/import SQL.

1. In Tuxar Production's SQL Editor, run 00-DISABLE-NEW-COD.sql. This completes the previously prepared online-only database change. It stops new COD calls without deleting existing orders or changing their stock/payment history.
2. In PowerShell run DEPLOY-EDGE-FUNCTIONS.ps1 from this folder. It uses your existing Supabase CLI login and deploys only create-cod-order (retired endpoint), create-checkout-session, stripe-webhook and dispatch-order, including their shared delivery helper. This makes the backend delivery estimates and emails match the 7–10 working day website copy. It does not change project secrets or create orders.
3. Keep a copy of the current cPanel website files, then upload/extract the matching frontend package into the domain document root. Include .htaccess, assets, prerender-home, size-charts and llms.txt. Do not upload SQL, source code or environment files.
4. Run 04-ACTIVATE-94-WOMENS-PRODUCTS.sql in the same Tuxar Production project where the 94 drafts were staged. Expected result: active_womens_products = 94. It validates approved prices, all 752 variants, 15 per size/colour, images and category assignments before changing status. It never resets stock or prices; rerunning it preserves stock sold since activation.
5. Refresh the storefront and check the women’s category pages and one product from each category. Confirm S–5XL sizes, the correct colour, the approved price and the women’s chart as the final gallery image. Check the repaired men’s quilted jacket and its men’s chart too. Check that only online payment is offered and delivery says 7–10 working days. Do not place fake paid orders.

The package also preserves the existing men’s catalogue, online-only checkout, 7–10 working day delivery copy, category URL redirects and initial homepage HTML. A hosting upload or activation has not been performed by these preparation scripts.

If activation rejects a mismatch, stop and inspect its message. Do not rerun the original import or reset stock. The existing men’s catalogue remains independent of this women-only activation.
`);
console.log(JSON.stringify({ products: products.length, variants: plan.variants.length, stockPerSizePerColour: 15, remoteWrites: 0, folder }));
