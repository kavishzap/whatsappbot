-- Log Click-to-WhatsApp ad referrals (one row per ad-initiated inbound message).
CREATE TABLE IF NOT EXISTS public.whatsapp_ad_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL CHECK (company IN ('spark', 'sodamax')),
  phone text NOT NULL,
  source_id text,
  source_url text,
  source_type text,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_ad_referrals_company_received_idx
  ON public.whatsapp_ad_referrals (company, received_at DESC);

CREATE INDEX IF NOT EXISTS whatsapp_ad_referrals_phone_idx
  ON public.whatsapp_ad_referrals (company, phone);
