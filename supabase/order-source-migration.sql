-- Order source (e.g. whatsapp, website, dashboard).

ALTER TABLE public.whatsapp_bot_orders
  ADD COLUMN IF NOT EXISTS source text;

CREATE INDEX IF NOT EXISTS whatsapp_bot_orders_source_idx
  ON public.whatsapp_bot_orders (company, source);
