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


export type MessengerAIHistoryEntry = {
  role: string;
  content: string | null;
};

/**
 * Keep a coherent, bounded suffix of the conversation for provider prompts.
 * The latest customer turn is always retained; older history is dropped before
 * the character budget is exceeded.
 */
export function limitMessengerAIHistoryMessages<T extends MessengerAIHistoryEntry>(
  messages: T[],
  options?: { maxMessages?: number; maxCharacters?: number },
): T[] {
  const maxMessages = Math.max(1, Math.floor(options?.maxMessages ?? 30));
  const maxCharacters = Math.max(1, Math.floor(options?.maxCharacters ?? 8_000));
  const selected: T[] = [];
  let characterCount = 0;

  for (
    let index = messages.length - 1;
    index >= 0 && selected.length < maxMessages;
    index -= 1
  ) {
    const message = messages[index];
    const messageCharacters = message.content?.length || 0;

    // Keep the latest message intact even when it alone exceeds the budget.
    if (selected.length > 0 && characterCount + messageCharacters > maxCharacters) {
      break;
    }

    selected.push(message);
    characterCount += messageCharacters;
  }

  return selected.reverse();
}
