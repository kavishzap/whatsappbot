-- Daily Meta ad click stats synced from Marketing API (includes opens without a WhatsApp reply).
CREATE TABLE IF NOT EXISTS public.whatsapp_ad_click_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL CHECK (company IN ('spark', 'sodamax')),
  ad_id text NOT NULL,
  stat_date date NOT NULL,
  meta_clicks integer NOT NULL DEFAULT 0,
  meta_conversations_started integer NOT NULL DEFAULT 0,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company, ad_id, stat_date)
);

CREATE INDEX IF NOT EXISTS whatsapp_ad_click_stats_company_date_idx
  ON public.whatsapp_ad_click_stats (company, stat_date DESC);

-- One row per ad-initiated WhatsApp message (when user actually sends text).
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
