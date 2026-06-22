-- Meta Click-to-WhatsApp ad IDs (referral.source_id) for product matching.
ALTER TABLE public.whatsapp_bot_items
ADD COLUMN IF NOT EXISTS ad_id text,
ADD COLUMN IF NOT EXISTS ad_id_2 text;

CREATE INDEX IF NOT EXISTS whatsapp_bot_items_ad_id_idx
  ON public.whatsapp_bot_items (company, ad_id)
  WHERE ad_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS whatsapp_bot_items_ad_id_2_idx
  ON public.whatsapp_bot_items (company, ad_id_2)
  WHERE ad_id_2 IS NOT NULL;
