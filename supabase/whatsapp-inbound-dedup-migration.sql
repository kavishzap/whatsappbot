-- Idempotent inbound webhook dedup (Meta may POST the same wamid more than once).
CREATE TABLE IF NOT EXISTS whatsapp_inbound_dedup (
  message_id text PRIMARY KEY,
  phone text NOT NULL,
  company text NOT NULL DEFAULT 'spark',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_inbound_dedup_created_at_idx
  ON whatsapp_inbound_dedup (created_at);
