-- Visibility flags for whatsapp_bot_items (website catalog vs WhatsApp bot)
ALTER TABLE public.whatsapp_bot_items
  ADD COLUMN IF NOT EXISTS is_website boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_whatsapp boolean NOT NULL DEFAULT true;
