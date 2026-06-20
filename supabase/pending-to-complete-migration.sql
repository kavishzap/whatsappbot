-- Rename order status pending -> complete

UPDATE public.whatsapp_bot_orders
SET status = 'complete'
WHERE status = 'pending';

ALTER TABLE public.whatsapp_bot_orders
DROP CONSTRAINT IF EXISTS whatsapp_bot_orders_status_check;

ALTER TABLE public.whatsapp_bot_orders
ADD CONSTRAINT whatsapp_bot_orders_status_check
CHECK (status IN ('draft', 'complete', 'approved', 'rejected'));
