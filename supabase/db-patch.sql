-- WhatsApp Bot — full DB patch (safe to re-run)
-- Run in Supabase Dashboard → SQL Editor

-- ---------------------------------------------------------------------------
-- whatsapp_bot_items (products catalog)
-- ---------------------------------------------------------------------------
create table if not exists public.whatsapp_bot_items (
  id uuid not null default gen_random_uuid(),
  ad_link text not null,
  product_name text null,
  image_base64 text null,
  description text not null default '',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint whatsapp_bot_items_pkey primary key (id)
);

alter table public.whatsapp_bot_items
  add column if not exists product_name text null,
  add column if not exists price numeric null;

-- ---------------------------------------------------------------------------
-- whatsapp_sessions (chatbot state per phone)
-- ---------------------------------------------------------------------------
create table if not exists public.whatsapp_sessions (
  phone text not null,
  state text not null default 'idle',
  selected_item_id uuid null references public.whatsapp_bot_items (id) on delete set null,
  quantity integer null,
  city text null,
  address text null,
  customer_name text null,
  total numeric null,
  updated_at timestamp with time zone not null default now(),
  constraint whatsapp_sessions_pkey primary key (phone)
);

alter table public.whatsapp_sessions
  add column if not exists customer_name text null,
  add column if not exists total numeric null;

-- ---------------------------------------------------------------------------
-- whatsapp_bot_orders (saved orders)
-- ---------------------------------------------------------------------------
create table if not exists public.whatsapp_bot_orders (
  id uuid not null default gen_random_uuid(),
  order_ref text not null,
  customer_name text not null,
  customer_phone_number text not null,
  product_name text not null,
  quantity integer not null,
  city text not null,
  address text not null,
  total numeric not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint whatsapp_bot_orders_pkey primary key (id)
);

alter table public.whatsapp_bot_orders
  add column if not exists order_ref text null,
  add column if not exists customer_phone_number text null;

create unique index if not exists whatsapp_bot_orders_order_ref_key
  on public.whatsapp_bot_orders (order_ref);

-- updated_at trigger (requires set_updated_at() — skip if function missing)
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_updated_at'
  ) then
    if not exists (
      select 1 from pg_trigger where tgname = 'set_whatsapp_bot_orders_updated_at'
    ) then
      create trigger set_whatsapp_bot_orders_updated_at
        before update on public.whatsapp_bot_orders
        for each row
        execute function set_updated_at();
    end if;

    if not exists (
      select 1 from pg_trigger where tgname = 'set_whatsapp_bot_items_updated_at'
    ) then
      create trigger set_whatsapp_bot_items_updated_at
        before update on public.whatsapp_bot_items
        for each row
        execute function set_updated_at();
    end if;
  end if;
end $$;
