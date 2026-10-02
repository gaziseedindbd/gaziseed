-- ai_messages has two identical unique partial indexes on external_message_id.
-- Keep the established idempotency index and remove the redundant duplicate.
DROP INDEX IF EXISTS public.ai_messages_external_message_unique;