-- Add order approval status (pending | approved | rejected)

alter table public.whatsapp_bot_orders
  add column if not exists status text not null default 'pending';

alter table public.whatsapp_bot_orders
  drop constraint if exists whatsapp_bot_orders_status_check;

alter table public.whatsapp_bot_orders
  add constraint whatsapp_bot_orders_status_check
  check (status in ('pending', 'approved', 'rejected'));

update public.whatsapp_bot_orders
set status = 'pending'
where status is null or status = '';
