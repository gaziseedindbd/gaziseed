export type MessengerAIHistoryMessage = {
  action_status?: string | null;
};

/**
 * Internal AI/provider states are never valid conversation turns.
 * They remain in the database for monitoring/debugging, but future AI prompts
 * should only see customer-visible messages.
 */
export function shouldIncludeMessengerAIHistoryMessage(
  message: MessengerAIHistoryMessage,
): boolean {
  return !new Set(['provider_result', 'generated', 'failed']).has(
    message.action_status || '',
  );
}
