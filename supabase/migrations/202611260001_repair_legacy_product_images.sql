-- Repair only legacy source-file gallery URLs for the affected products.
-- Preserve current images uploaded by staff, gallery positions and all commerce data.
begin;
update public.product_images as image
set url = replacement.cloudinary_url
from public.products as product,
(values
  ('aviator-g1-flight-jacket', '/src/assets/products/flight_jacket/flight_jacket.webp', 'https://res.cloudinary.com/rllwk4bi/image/upload/v1789994666/tuxar/website/product/flight-jacket-flight-jacket.webp'),
  ('aviator-g1-flight-jacket', '/src/assets/products/flight_jacket/flight_jacket1.webp', 'https://res.cloudinary.com/rllwk4bi/image/upload/v1789994668/tuxar/website/product/flight-jacket-flight-jacket1.webp'),
  ('aviator-g1-flight-jacket', '/src/assets/products/flight_jacket/flight_jacket2.webp', 'https://res.cloudinary.com/rllwk4bi/image/upload/v1789994670/tuxar/website/product/flight-jacket-flight-jacket2.webp'),
  ('aviator-g1-flight-jacket', '/src/assets/products/flight_jacket/flight_jacket3.webp', 'https://res.cloudinary.com/rllwk4bi/image/upload/v1789994673/tuxar/website/product/flight-jacket-flight-jacket3.webp'),
  ('rider-gloves-carbon-noir', '/src/assets/products/glove/Carbon_Knuckle_front.webp', 'https://res.cloudinary.com/rllwk4bi/image/upload/v1789994678/tuxar/website/product/glove-carbon-knuckle-front.webp'),
  ('rider-gloves-carbon-noir', '/src/assets/products/glove/Carbon_Knuckle_back.webp', 'https://res.cloudinary.com/rllwk4bi/image/upload/v1789994675/tuxar/website/product/glove-carbon-knuckle-back.webp'),
  ('rider-gloves-carbon-noir', '/src/assets/products/glove/Carbon_Knuckle_side.webp', 'https://res.cloudinary.com/rllwk4bi/image/upload/v1789994680/tuxar/website/product/glove-carbon-knuckle-side.webp'),
  ('rider-gloves-carbon-white', '/src/assets/products/glove/Carbon_Knuckle_white_front.webp', 'https://res.cloudinary.com/rllwk4bi/image/upload/v1789994685/tuxar/website/product/glove-carbon-knuckle-white-front.webp'),
  ('rider-gloves-carbon-white', '/src/assets/products/glove/Carbon_Knuckle_white_back.webp', 'https://res.cloudinary.com/rllwk4bi/image/upload/v1789994683/tuxar/website/product/glove-carbon-knuckle-white-back.webp'),
  ('rider-gloves-carbon-white', '/src/assets/products/glove/Carbon_Knuckle_white_side.webp', 'https://res.cloudinary.com/rllwk4bi/image/upload/v1789994687/tuxar/website/product/glove-carbon-knuckle-white-side.webp')
) as replacement(slug, legacy_url, cloudinary_url)
where image.product_id = product.id
  and product.slug = replacement.slug
  and image.url = replacement.legacy_url;
commit;
