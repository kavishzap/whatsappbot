-- Product status flags for whatsapp_bot_items
ALTER TABLE public.whatsapp_bot_items
  ADD COLUMN IF NOT EXISTS pre_order boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sold_out boolean NOT NULL DEFAULT false;
