-- Tie SodaMax flavour promos to a confirmed order (prevents stray sends).
ALTER TABLE public.whatsapp_scheduled_promos
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.whatsapp_bot_orders(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS whatsapp_scheduled_promos_pending_idx
  ON public.whatsapp_scheduled_promos (send_at)
  WHERE sent_at IS NULL AND order_id IS NOT NULL;
