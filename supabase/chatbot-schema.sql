-- Run in Supabase SQL Editor

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
) tablespace pg_default;

alter table public.whatsapp_sessions
  add column if not exists customer_name text null,
  add column if not exists total numeric null;

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
  constraint whatsapp_bot_orders_pkey primary key (id),
  constraint whatsapp_bot_orders_order_ref_key unique (order_ref)
) tablespace pg_default;

alter table public.whatsapp_bot_orders
  add column if not exists customer_phone_number text,
  add column if not exists order_ref text null;

create unique index if not exists whatsapp_bot_orders_order_ref_key
  on public.whatsapp_bot_orders (order_ref);

create trigger set_whatsapp_bot_orders_updated_at
  before update on public.whatsapp_bot_orders
  for each row
  execute function set_updated_at();
