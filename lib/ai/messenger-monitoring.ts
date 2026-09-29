export type MessengerMonitoringAttempt = {
  provider: string;
  model: string;
  ok: boolean;
  status?: number;
  duration_ms?: number;
};

export type MessengerMonitoringMessage = {
  role: string;
  provider: string | null;
  action_status: string | null;
  source_context?: unknown;
};

export type MessengerProviderMonitoring = {
  provider: string;
  attempts: number;
  successes: number;
  failures: number;
  fallback_hits: number;
  average_latency_ms: number | null;
};

function parseAttempts(sourceContext: unknown): MessengerMonitoringAttempt[] {
  if (!sourceContext || typeof sourceContext !== 'object') return [];
  const attempts = (sourceContext as Record<string, unknown>).attempts;
  if (!Array.isArray(attempts)) return [];

  return attempts.filter((value): value is MessengerMonitoringAttempt => {
    if (!value || typeof value !== 'object') return false;
    const row = value as Record<string, unknown>;
    return (
      typeof row.provider === 'string' &&
      typeof row.model === 'string' &&
      typeof row.ok === 'boolean'
    );
  });
}

export function buildMessengerMonitoringSummary(
  messages: MessengerMonitoringMessage[],
) {
  const providerMap = new Map<string, {
    attempts: number;
    successes: number;
    failures: number;
    fallback_hits: number;
    latency_total: number;
    latency_count: number;
  }>();

  let responses = 0;
  let successfulResponses = 0;
  let fallbackResponses = 0;
  let providerFailureResponses = 0;
  let totalTokens = 0;

  for (const message of messages) {
    if (message.role !== 'assistant' || message.action_status !== 'sent') {
      continue;
    }

    const sourceContext =
      message.source_context && typeof message.source_context === 'object'
        ? (message.source_context as Record<string, unknown>)
        : {};

    const attempts = parseAttempts(sourceContext);
    if (!attempts.length) continue;

    responses += 1;
    successfulResponses += attempts.some((attempt) => attempt.ok) ? 1 : 0;
    if (attempts.length > 1) fallbackResponses += 1;
    if (!attempts.some((attempt) => attempt.ok)) providerFailureResponses += 1;

    const usage = sourceContext.usage;
    if (usage && typeof usage === 'object') {
      const reported = (usage as Record<string, unknown>).total_tokens;
      if (typeof reported === 'number' && Number.isFinite(reported)) {
        totalTokens += reported;
      }
    }

    attempts.forEach((attempt, index) => {
      const current = providerMap.get(attempt.provider) || {
        attempts: 0,
        successes: 0,
        failures: 0,
        fallback_hits: 0,
        latency_total: 0,
        latency_count: 0,
      };

      current.attempts += 1;
      if (attempt.ok) {
        current.successes += 1;
      } else {
        current.failures += 1;
      }
      if (index < attempts.length - 1 && !attempt.ok) {
        current.fallback_hits += 1;
      }
      if (typeof attempt.duration_ms === 'number' && Number.isFinite(attempt.duration_ms)) {
        current.latency_total += attempt.duration_ms;
        current.latency_count += 1;
      }

      providerMap.set(attempt.provider, current);
    });
  }

  const provider_stats: MessengerProviderMonitoring[] = Array.from(providerMap.entries())
    .map(([provider, value]) => ({
      provider,
      attempts: value.attempts,
      successes: value.successes,
      failures: value.failures,
      fallback_hits: value.fallback_hits,
      average_latency_ms:
        value.latency_count > 0
          ? Math.round(value.latency_total / value.latency_count)
          : null,
    }))
    .sort((a, b) => b.attempts - a.attempts);

  return {
    responses,
    successful_responses: successfulResponses,
    fallback_responses: fallbackResponses,
    fallback_rate_percent:
      responses > 0 ? Math.round((fallbackResponses / responses) * 1000) / 10 : 0,
    provider_failure_responses: providerFailureResponses,
    total_tokens: totalTokens,
    provider_stats,
    average_success_latency_ms: (() => {
      const successfulAttempts = provider_stats.reduce(
        (sum, provider) => sum + provider.successes,
        0,
      );
      if (!successfulAttempts) return null;
      const weightedLatency = provider_stats.reduce(
        (sum, provider) =>
          sum +
          (provider.average_latency_ms || 0) * provider.successes,
        0,
      );
      return Math.round(weightedLatency / successfulAttempts);
    })(),
  };
}
