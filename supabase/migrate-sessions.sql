-- Run this in Supabase SQL Editor if you see:
-- "Could not find the 'customer_name' column of 'whatsapp_sessions'"

alter table public.whatsapp_sessions
  add column if not exists customer_name text null,
  add column if not exists total numeric null;

-- Reload PostgREST schema cache (Supabase picks this up automatically within a few seconds)
