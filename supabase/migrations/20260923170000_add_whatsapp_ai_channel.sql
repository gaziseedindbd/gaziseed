-- WhatsApp AI integration foundation
-- Additive change: preserve existing web and Facebook Messenger channels.

alter table public.ai_conversations
drop constraint if exists ai_conversations_channel_check;

alter table public.ai_conversations
add constraint ai_conversations_channel_check
check (
  channel = any (
    array[
      'facebook_messenger'::text,
      'web'::text,
      'whatsapp'::text
    ]
  )
);
