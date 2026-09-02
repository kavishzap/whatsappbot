-- Promo flag for whatsapp_bot_items
ALTER TABLE public.whatsapp_bot_items
  ADD COLUMN IF NOT EXISTS promo boolean NOT NULL DEFAULT false;
