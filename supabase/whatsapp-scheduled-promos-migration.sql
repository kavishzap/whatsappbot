-- Delayed SodaMax post-order promos (MONIN campaign 60s after thank-you).
CREATE TABLE IF NOT EXISTS public.whatsapp_scheduled_promos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  company text NOT NULL CHECK (company IN ('spark', 'sodamax')),
  kind text NOT NULL DEFAULT 'flavour_promo',
  send_at timestamptz NOT NULL,
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_scheduled_promos_due_idx
  ON public.whatsapp_scheduled_promos (send_at)
  WHERE sent_at IS NULL;
