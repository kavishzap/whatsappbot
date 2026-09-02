-- Front cover image for each product (1 per item).
-- Uses the existing public bucket `whatsapp-bot-item-media`.
-- Run in Supabase Dashboard → SQL Editor after add_whatsapp_bot_item_media.sql.

alter table public.whatsapp_bot_item_media
  drop constraint if exists whatsapp_bot_item_media_kind_check;

alter table public.whatsapp_bot_item_media
  add constraint whatsapp_bot_item_media_kind_check
  check (kind in ('image', 'video', 'cover'));

create unique index if not exists whatsapp_bot_item_media_one_cover_idx
  on public.whatsapp_bot_item_media (item_id)
  where kind = 'cover';
