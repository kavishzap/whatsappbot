-- Manual display order per company (spark / sodamax).
-- Run in Supabase SQL editor.

ALTER TABLE public.whatsapp_bot_items
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY company
      ORDER BY created_at ASC
    ) AS rn
  FROM public.whatsapp_bot_items
)
UPDATE public.whatsapp_bot_items i
SET sort_order = ranked.rn
FROM ranked
WHERE i.id = ranked.id;

CREATE INDEX IF NOT EXISTS whatsapp_bot_items_company_sort_idx
  ON public.whatsapp_bot_items (company, sort_order);
