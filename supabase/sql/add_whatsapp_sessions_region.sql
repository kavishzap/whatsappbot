-- Store selected delivery region (North/East/South/West/Center) during WhatsApp checkout.
ALTER TABLE public.whatsapp_sessions
  ADD COLUMN IF NOT EXISTS region text;
