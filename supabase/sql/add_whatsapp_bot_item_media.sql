-- Extra product gallery: up to 3 images + 1 video per whatsapp_bot_items row.
-- Files live in the public storage bucket `whatsapp-bot-item-media`.
-- Run in Supabase Dashboard → SQL Editor.

-- ---------------------------------------------------------------------------
-- Storage bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'whatsapp-bot-item-media',
  'whatsapp-bot-item-media',
  true,
  52428800, -- 50 MB (covers the video; images are smaller)
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read whatsapp bot item media objects" on storage.objects;
create policy "Public can read whatsapp bot item media objects"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'whatsapp-bot-item-media');

-- ---------------------------------------------------------------------------
-- Per-product media rows
-- ---------------------------------------------------------------------------
create table if not exists public.whatsapp_bot_item_media (
  id uuid not null default gen_random_uuid(),
  item_id uuid not null references public.whatsapp_bot_items (id) on delete cascade,
  kind text not null,
  storage_path text not null,
  public_url text not null,
  mime_type text,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  constraint whatsapp_bot_item_media_pkey primary key (id),
  constraint whatsapp_bot_item_media_kind_check check (kind in ('image', 'video')),
  constraint whatsapp_bot_item_media_storage_path_key unique (storage_path)
);

create index if not exists whatsapp_bot_item_media_item_id_idx
  on public.whatsapp_bot_item_media (item_id);

create unique index if not exists whatsapp_bot_item_media_one_video_idx
  on public.whatsapp_bot_item_media (item_id)
  where kind = 'video';

-- ---------------------------------------------------------------------------
-- Max 3 images per product (video uniqueness is the index above)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_whatsapp_bot_item_media_limits()
returns trigger
language plpgsql
as $$
begin
  if new.kind = 'image' then
    if (
      select count(*)
      from public.whatsapp_bot_item_media
      where item_id = new.item_id
        and kind = 'image'
    ) >= 3 then
      raise exception 'A product can have at most 3 extra images.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists whatsapp_bot_item_media_limits on public.whatsapp_bot_item_media;
create trigger whatsapp_bot_item_media_limits
  before insert on public.whatsapp_bot_item_media
  for each row
  execute function public.enforce_whatsapp_bot_item_media_limits();

-- ---------------------------------------------------------------------------
-- Public read (website / dashboard). Writes go through the dashboard API.
-- ---------------------------------------------------------------------------
alter table public.whatsapp_bot_item_media enable row level security;

grant select on table public.whatsapp_bot_item_media to anon, authenticated;

drop policy if exists "Public can read whatsapp bot item media" on public.whatsapp_bot_item_media;
create policy "Public can read whatsapp bot item media"
  on public.whatsapp_bot_item_media
  for select
  to anon, authenticated
  using (true);
