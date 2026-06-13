-- Allow the public ordering site (anon key) to read products.
-- Run in Supabase Dashboard → SQL Editor

alter table public.whatsapp_products enable row level security;
alter table public.whatsapp_product_colors enable row level security;

drop policy if exists "Public can read whatsapp products" on public.whatsapp_products;
create policy "Public can read whatsapp products"
  on public.whatsapp_products
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can read whatsapp product colors" on public.whatsapp_product_colors;
create policy "Public can read whatsapp product colors"
  on public.whatsapp_product_colors
  for select
  to anon, authenticated
  using (true);
