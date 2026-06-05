-- Run in Supabase SQL Editor: add price to whatsapp_bot_items

alter table public.whatsapp_bot_items
  add column if not exists price numeric null;
