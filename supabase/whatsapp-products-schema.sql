-- WhatsApp Products (ecommerce catalog with color variants)
-- Run in Supabase Dashboard → SQL Editor

-- ---------------------------------------------------------------------------
-- whatsapp_products
-- ---------------------------------------------------------------------------
create table if not exists public.whatsapp_products (
  id uuid not null default gen_random_uuid(),
  name text not null,
  image_base64 text null,
  price numeric not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint whatsapp_products_pkey primary key (id)
);

-- ---------------------------------------------------------------------------
-- whatsapp_product_colors (multiple colors per product)
-- ---------------------------------------------------------------------------
create table if not exists public.whatsapp_product_colors (
  id uuid not null default gen_random_uuid(),
  product_id uuid not null references public.whatsapp_products (id) on delete cascade,
  color_name text not null,
  color_hex text null,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  constraint whatsapp_product_colors_pkey primary key (id),
  constraint whatsapp_product_colors_product_color_unique unique (product_id, color_name)
);

create index if not exists whatsapp_product_colors_product_id_idx
  on public.whatsapp_product_colors (product_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger (reuses set_updated_at if present)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    if not exists (
      select 1 from pg_trigger where tgname = 'set_whatsapp_products_updated_at'
    ) then
      create trigger set_whatsapp_products_updated_at
        before update on public.whatsapp_products
        for each row execute function set_updated_at();
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Public read (required for sodamax-online-order.netlify.app)
-- Dashboard writes still go through /api/whatsapp-products (service role).
-- ---------------------------------------------------------------------------
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
