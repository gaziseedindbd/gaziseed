export type MessengerAIDeliveryEvent =
  | 'send_success'
  | 'send_failure';

/**
 * Only ordinary AI replies start in `generated` and can transition to a
 * customer-visible delivery state. Deterministic safety/handoff replies keep
 * their semantic action status and are never rewritten as sent/failed.
 */
export function shouldTrackMessengerAIDeliveryStatus(
  actionStatus: string | null | undefined,
): boolean {
  return actionStatus === 'generated';
}

export function getMessengerAIDeliveryActionStatus(
  event: MessengerAIDeliveryEvent,
): 'sent' | 'failed' {
  return event === 'send_success' ? 'sent' : 'failed';
}
