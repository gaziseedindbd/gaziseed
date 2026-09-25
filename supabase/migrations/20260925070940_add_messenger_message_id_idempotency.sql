create unique index if not exists ai_messages_external_message_id_uidx
on public.ai_messages (external_message_id)
where external_message_id is not null;
