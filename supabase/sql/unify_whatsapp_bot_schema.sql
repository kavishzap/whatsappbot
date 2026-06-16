-- Unify Spark + SodaMax onto whatsapp_bot_items / whatsapp_bot_orders / whatsapp_sessions.
-- Run in the Supabase SQL editor (review on staging first).

-- 1) Company column on shared bot tables
ALTER TABLE public.whatsapp_bot_items
  ADD COLUMN IF NOT EXISTS company text NOT NULL DEFAULT 'spark'
  CHECK (company = ANY (ARRAY['spark'::text, 'sodamax'::text]));

ALTER TABLE public.whatsapp_bot_orders
  ADD COLUMN IF NOT EXISTS company text NOT NULL DEFAULT 'spark'
  CHECK (company = ANY (ARRAY['spark'::text, 'sodamax'::text]));

-- 2) Color variants for bot items (replaces whatsapp_product_colors)
CREATE TABLE IF NOT EXISTS public.whatsapp_bot_item_colors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  color_name text NOT NULL,
  color_hex text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_bot_item_colors_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_bot_item_colors_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES public.whatsapp_bot_items(id) ON DELETE CASCADE
);

-- 3) Migrate SodaMax products (if legacy tables exist)
INSERT INTO public.whatsapp_bot_items (
  id, product_name, price, image_base64, description, company, created_at, updated_at
)
SELECT
  p.id,
  p.name,
  p.price::text,
  p.image_base64,
  '',
  'sodamax',
  p.created_at,
  p.updated_at
FROM public.whatsapp_products p
ON CONFLICT (id) DO UPDATE SET
  product_name = EXCLUDED.product_name,
  price = EXCLUDED.price,
  image_base64 = EXCLUDED.image_base64,
  company = 'sodamax',
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.whatsapp_bot_item_colors (item_id, color_name, color_hex, sort_order, created_at)
SELECT
  c.product_id,
  c.color_name,
  c.color_hex,
  c.sort_order,
  c.created_at
FROM public.whatsapp_product_colors c
WHERE EXISTS (
  SELECT 1 FROM public.whatsapp_bot_items i WHERE i.id = c.product_id AND i.company = 'sodamax'
)
AND NOT EXISTS (
  SELECT 1 FROM public.whatsapp_bot_item_colors existing
  WHERE existing.item_id = c.product_id
    AND existing.color_name = c.color_name
    AND existing.sort_order = c.sort_order
);

-- 4) Sessions: company column + composite primary key (phone, company)
ALTER TABLE public.whatsapp_sessions
  ADD COLUMN IF NOT EXISTS company text NOT NULL DEFAULT 'spark'
  CHECK (company = ANY (ARRAY['spark'::text, 'sodamax'::text]));

-- Tag sodamax rows by prefix FIRST (phone still unique while PK is on phone alone)
UPDATE public.whatsapp_sessions
SET company = 'sodamax'
WHERE phone LIKE 'sodamax:%';

-- Switch to composite PK before stripping the prefix (spark + sodamax can share a phone)
ALTER TABLE public.whatsapp_sessions DROP CONSTRAINT IF EXISTS whatsapp_sessions_pkey;
ALTER TABLE public.whatsapp_sessions ADD PRIMARY KEY (phone, company);

-- Now safe: sodamax:230… and 230… are different (phone, company) pairs
UPDATE public.whatsapp_sessions
SET phone = substring(phone FROM 9)
WHERE phone LIKE 'sodamax:%';

-- 5) Drop legacy SodaMax product tables
DROP TABLE IF EXISTS public.whatsapp_product_colors;
DROP TABLE IF EXISTS public.whatsapp_products;
