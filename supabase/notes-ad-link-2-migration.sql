-- Optional reference migration (apply in Supabase if not already run)

ALTER TABLE public.whatsapp_bot_orders
ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.whatsapp_bot_items
ADD COLUMN IF NOT EXISTS ad_link_2 text;
