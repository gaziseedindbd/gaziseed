alter table public.messenger_order_notifications
  drop constraint if exists messenger_order_notifications_status_check;

alter table public.messenger_order_notifications
  add constraint messenger_order_notifications_status_check
  check (status = any (array['pending'::text, 'sending'::text, 'sent'::text, 'failed'::text]))
  not valid;

alter table public.messenger_order_notifications
  validate constraint messenger_order_notifications_status_check;
