-- Admin follow-up status and move-to-order on phone call logs.

ALTER TABLE public.call_logs
  ADD COLUMN IF NOT EXISTS follow_up_status public.whatsapp_message_status,
  ADD COLUMN IF NOT EXISTS follow_up_notes text,
  ADD COLUMN IF NOT EXISTS converted_order_id uuid,
  ADD COLUMN IF NOT EXISTS converted_order_ref text,
  ADD COLUMN IF NOT EXISTS order_company text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'call_logs_converted_order_id_fkey'
  ) THEN
    ALTER TABLE public.call_logs
      ADD CONSTRAINT call_logs_converted_order_id_fkey
      FOREIGN KEY (converted_order_id) REFERENCES public.whatsapp_bot_orders(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'call_logs_order_company_check'
  ) THEN
    ALTER TABLE public.call_logs
      ADD CONSTRAINT call_logs_order_company_check
      CHECK (order_company IS NULL OR order_company IN ('spark', 'sodamax'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS call_logs_follow_up_status_idx
  ON public.call_logs (follow_up_status);

NOTIFY pgrst, 'reload schema';
