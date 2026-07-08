-- Message lead tracking on WhatsApp sessions (Messages dashboard).

DO $$ BEGIN
  CREATE TYPE public.whatsapp_message_status AS ENUM (
    'called',
    'message_sent',
    'call_later',
    'rejected',
    'complete'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.whatsapp_sessions
  ADD COLUMN IF NOT EXISTS message_status public.whatsapp_message_status,
  ADD COLUMN IF NOT EXISTS message_notes text,
  ADD COLUMN IF NOT EXISTS converted_order_id uuid REFERENCES public.whatsapp_bot_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS whatsapp_sessions_message_status_idx
  ON public.whatsapp_sessions (company, message_status);
