-- Run in Supabase SQL editor after deploying edge function updates.

-- Draft order status
ALTER TABLE whatsapp_bot_orders
  DROP CONSTRAINT IF EXISTS whatsapp_bot_orders_status_check;

ALTER TABLE whatsapp_bot_orders
  ADD CONSTRAINT whatsapp_bot_orders_status_check
  CHECK (status IN ('draft', 'complete', 'approved', 'rejected'));

-- Session reminder + draft order tracking
ALTER TABLE whatsapp_sessions
  ADD COLUMN IF NOT EXISTS draft_order_id uuid REFERENCES whatsapp_bot_orders(id) ON DELETE SET NULL;

ALTER TABLE whatsapp_sessions
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0;

ALTER TABLE whatsapp_sessions
  ADD COLUMN IF NOT EXISTS last_inbound_at timestamptz;

ALTER TABLE whatsapp_sessions
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz;
