export type MessengerAIHistoryMessage = {
  action_status?: string | null;
};

/**
 * provider_result rows are internal provider telemetry. They must remain
 * available for monitoring/debugging, but they are not conversation turns
 * and must never be supplied back to the AI as customer history.
 */
export function shouldIncludeMessengerAIHistoryMessage(
  message: MessengerAIHistoryMessage,
): boolean {
  return message.action_status !== 'provider_result';
}
