-- Move the order-notification trigger away from a secret embedded in trigger
-- arguments. Provision both named values in Supabase Vault before applying.

create extension if not exists pg_net;
create schema if not exists private;

do $preflight$
begin
  if not exists (
    select 1 from vault.decrypted_secrets
    where name = 'supabase_db_webhook_secret_next'
      and length(decrypted_secret) >= 32
  ) then
    raise exception 'Required Vault secret supabase_db_webhook_secret_next is missing or too short';
  end if;

  if not exists (
    select 1 from vault.decrypted_secrets
    where name = 'supabase_order_notification_url'
      and decrypted_secret like 'https://%/api/webhooks/order-notification'
  ) then
    raise exception 'Required Vault URL supabase_order_notification_url is missing or invalid';
  end if;

  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    raise exception 'pg_net http_post function is unavailable';
  end if;
end;
$preflight$;

create or replace function private.dispatch_messenger_order_notification_webhook()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private, vault, net, pg_temp
as $function$
declare
  v_secret text;
  v_url text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'supabase_db_webhook_secret_next'
  limit 1;

  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'supabase_order_notification_url'
  limit 1;

  if v_secret is null or v_url is null then
    raise warning 'Order notification webhook configuration is unavailable';
    return new;
  end if;

  begin
    perform net.http_post(
      url := v_url,
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-supabase-webhook-secret', v_secret
      ),
      timeout_milliseconds := 3000
    );
  exception when others then
    -- Notification delivery must not make order writes fail. The queue remains
    -- durable and can be drained by its normal worker/cron path.
    raise warning 'Order notification webhook could not be queued (SQLSTATE %)', SQLSTATE;
  end;

  return new;
end;
$function$;

revoke all on function private.dispatch_messenger_order_notification_webhook()
  from public, anon, authenticated, service_role;

drop trigger if exists messenger_order_notification on public.orders;
create trigger messenger_order_notification
after insert or update on public.orders
for each row
execute function private.dispatch_messenger_order_notification_webhook();

comment on function private.dispatch_messenger_order_notification_webhook() is
  'Dispatches the Messenger order notification worker using a Vault-managed secret.';
