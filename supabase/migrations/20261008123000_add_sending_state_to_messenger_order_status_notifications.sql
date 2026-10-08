alter table public.messenger_order_status_notifications
  drop constraint if exists messenger_order_status_notifications_status_check;

alter table public.messenger_order_status_notifications
  add constraint messenger_order_status_notifications_status_check
  check (status = any (array['pending'::text, 'sending'::text, 'sent'::text, 'failed'::text]));
