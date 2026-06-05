-- Run in Supabase SQL Editor if order save fails with missing column errors

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
  status text not null default 'pending',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint whatsapp_bot_orders_pkey primary key (id)
);

alter table public.whatsapp_bot_orders
  add column if not exists order_ref text null,
  add column if not exists customer_phone_number text null;

create unique index if not exists whatsapp_bot_orders_order_ref_key
  on public.whatsapp_bot_orders (order_ref);
