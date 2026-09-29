export type MessengerHandoffDbStatus =
  | 'open'
  | 'assigned'
  | 'resolved'
  | 'cancelled';

export type MessengerHumanSupportQueueState = 'pending' | 'open' | 'closed';

export function getMessengerHumanSupportQueueState(
  status: MessengerHandoffDbStatus | string,
): MessengerHumanSupportQueueState {
  if (status === 'assigned') return 'open';
  if (status === 'resolved' || status === 'cancelled') return 'closed';
  return 'pending';
}

export function getBangladeshHumanSupportAcknowledgement(): string {
  return [
    'ঠিক আছে। আপনার অনুরোধটি আমাদের Bangladesh customer support team-এর কাছে পাঠানো হয়েছে।',
    '',
    '👤 একজন support agent আপনার Messenger conversation-এর আগের কথোপকথন দেখে এখান থেকেই বিষয়টি handle করবেন।',
    '⏳ Support team reply না দেওয়া পর্যন্ত AI আর উত্তর দেবে না।',
  ].join('\n');
}

export function getBangladeshHumanSupportWaitingReply(): string {
  return [
    'আপনার support request টি এখনো active আছে।',
    '',
    '👤 একজন human support agent আপনার conversation দেখছেন/দেখবেন।',
    '⏳ Human support শেষ না হওয়া পর্যন্ত AI থেকে নতুন automated reply দেওয়া হবে না।',
  ].join('\n');
}

export function getHumanSupportClosedMetadata() {
  return {
    human_takeover: false,
    human_support_state: 'closed',
  };
}
