-- Run this ONLY if unify_whatsapp_bot_schema.sql failed at the sessions step
-- with: duplicate key value violates unique constraint "whatsapp_sessions_pkey"
--
-- Steps 1–3 (company columns, colors table, product migration) may already be done.

-- Tag sodamax sessions (prefix still on phone)
UPDATE public.whatsapp_sessions
SET company = 'sodamax'
WHERE phone LIKE 'sodamax:%';

-- Replace single-phone PK with (phone, company)
ALTER TABLE public.whatsapp_sessions DROP CONSTRAINT IF EXISTS whatsapp_sessions_pkey;
ALTER TABLE public.whatsapp_sessions ADD PRIMARY KEY (phone, company);

-- Strip sodamax: prefix now that both brands can share a phone number
UPDATE public.whatsapp_sessions
SET phone = substring(phone FROM 9)
WHERE phone LIKE 'sodamax:%';

-- Drop legacy tables if not already dropped
DROP TABLE IF EXISTS public.whatsapp_product_colors;
DROP TABLE IF EXISTS public.whatsapp_products;
