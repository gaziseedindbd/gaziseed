import type { AIChatMessage, AIChatResponse } from './types';

export type MessengerProvider = 'gemini' | 'groq' | 'cerebras' | 'openrouter';

export type MessengerProviderAttempt = {
  provider: MessengerProvider;
  model: string;
  ok: boolean;
  status?: number;
  error?: string;
  duration_ms: number;
};

export type MessengerProviderResult = AIChatResponse & {
  provider: MessengerProvider;
  attempts: MessengerProviderAttempt[];
};

export class MessengerAIProviderError extends Error {
  readonly attempts: MessengerProviderAttempt[];

  constructor(message: string, attempts: MessengerProviderAttempt[]) {
    super(message);
    this.name = 'MessengerAIProviderError';
    this.attempts = attempts;
  }
}

const PROVIDER_ORDER: MessengerProvider[] = ['gemini', 'groq', 'cerebras', 'openrouter'];

const DEFAULT_MODELS: Record<MessengerProvider, string> = {
  gemini: 'gemini-3.8-flash',
  groq: 'openai/gpt-oss-120b',
  cerebras: 'qwen-3.8-27b',
  openrouter: 'nvidia/nemotron-3-ultra-550b-a55b:free',
};

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_PROVIDER_COOLDOWN_MS = 5 * 60 * 1000;
const providerCooldownUntil = new Map<MessengerProvider, number>();

function providerCooldownMs(): number {
  const raw = Number(
    process.env.MESSENGER_AI_PROVIDER_COOLDOWN_MS ||
      DEFAULT_PROVIDER_COOLDOWN_MS,
  );
  if (!Number.isFinite(raw)) return DEFAULT_PROVIDER_COOLDOWN_MS;
  return Math.max(15_000, Math.min(raw, 60 * 60 * 1000));
}

function isProviderInCooldown(provider: MessengerProvider): boolean {
  const until = providerCooldownUntil.get(provider) || 0;
  if (until <= Date.now()) {
    providerCooldownUntil.delete(provider);
    return false;
  }
  return true;
}

function markProviderCooldown(provider: MessengerProvider, error: unknown): void {
  const message = error instanceof Error ? error.message : '';
  const retryMatch = message.match(/retry in ([0-9]+(?:\\.[0-9]+)?)s/i);
  const retryMs = retryMatch ? Math.ceil(Number(retryMatch[1]) * 1000) + 1000 : 0;
  const duration = Math.max(retryMs, providerCooldownMs());
  providerCooldownUntil.set(provider, Date.now() + duration);
}

function isProviderRateLimited(error: unknown): boolean {
  if (error instanceof ProviderHTTPError && error.status === 429) return true;
  const message = error instanceof Error ? error.message : '';
  return /(429|rate[ -]?limit|quota exceeded|too many requests|resource exhausted|requests per minute|requests per day)/i.test(
    message,
  );
}

function modelFor(provider: MessengerProvider): string {
  const envName = provider.toUpperCase() + '_MODEL';
  return process.env[envName] || DEFAULT_MODELS[provider];
}

function keyFor(provider: MessengerProvider): string {
  const envName = provider.toUpperCase() + '_API_KEY';
  return process.env[envName] || '';
}

function isConfigured(provider: MessengerProvider): boolean {
  return Boolean(keyFor(provider));
}

function timeoutMs(): number {
  const raw = Number(process.env.MESSENGER_AI_PROVIDER_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(raw)) return DEFAULT_TIMEOUT_MS;
  return Math.max(3_000, Math.min(raw, 30_000));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Provider request timed out')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

function normaliseContent(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value.map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object' && 'text' in part) {
        return typeof part.text === 'string' ? part.text : '';
      }
      return '';
    }).join('').trim();
  }
  return '';
}

function cleanMessengerAnswer(content: string): string {
  let cleaned = content.trim();

  while (true) {
    const lower = cleaned.toLowerCase();
    const open = lower.indexOf('<think>');
    if (open < 0) break;

    const close = lower.indexOf('</think>', open + 7);
    if (close < 0) {
      cleaned = cleaned.slice(0, open).trim();
      break;
    }

    cleaned = (cleaned.slice(0, open) + cleaned.slice(close + 8)).trim();
  }

  const lower = cleaned.toLowerCase();
  const thinkingPrefixes = [
    "thinking process:",
    "reasoning:",
    "analysis:",
    "here's a thinking process:",
    "here’s a thinking process:",
  ];

  const hasThinkingPrefix = thinkingPrefixes.some((prefix) =>
    lower.startsWith(prefix),
  );

  if (hasThinkingPrefix) {
    const markers = ["draft response", "final answer"];
    let markerIndex = -1;
    let markerLength = 0;

    for (const marker of markers) {
      const index = lower.indexOf(marker);
      if (index >= 0 && (markerIndex < 0 || index < markerIndex)) {
        markerIndex = index;
        markerLength = marker.length;
      }
    }

    if (markerIndex >= 0) {
      cleaned = cleaned.slice(markerIndex + markerLength).replace(/^\s*[:\-]\s*/, '').trim();
    } else {
      return 'দুঃখিত, এই মুহূর্তে উত্তর দিতে সমস্যা হচ্ছে।';
    }
  }

  return cleaned || 'দুঃখিত, এই মুহূর্তে উত্তর দিতে সমস্যা হচ্ছে।';
}

class ProviderHTTPError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ProviderHTTPError';
    this.status = status;
  }
}

async function callGemini(
  messages: AIChatMessage[],
  model: string,
  apiKey: string,
  temperature?: number,
  maxTokens?: number,
): Promise<AIChatResponse> {
  const systemMsg = messages.find((message) => message.role === 'system');
  const conversation = messages.filter((message) => message.role !== 'system').map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }));

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(apiKey);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
      contents: conversation,
      generationConfig: {
        temperature: temperature ?? 0.2,
        maxOutputTokens: maxTokens ?? 900,
      },
    }),
  });

  const raw = await response.text();
  let data: any = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch {
    // Keep the status-only error below if the provider did not return JSON.
  }

  if (!response.ok) {
    const providerMessage = data?.error?.message || 'Gemini API error: ' + response.status + ' ' + response.statusText;
    throw new ProviderHTTPError(providerMessage, response.status);
  }

  const content = normaliseContent(
    data?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join(''),
  );
  if (!content) throw new ProviderHTTPError('Gemini returned an empty response', response.status);

  return {
    content,
    model,
    usage: data?.usageMetadata ? {
      prompt_tokens: data.usageMetadata.promptTokenCount,
      completion_tokens: data.usageMetadata.candidatesTokenCount,
      total_tokens: data.usageMetadata.totalTokenCount,
    } : undefined,
  };
}

async function callOpenAICompatible(
  provider: Exclude<MessengerProvider, 'gemini'>,
  messages: AIChatMessage[],
  model: string,
  apiKey: string,
  temperature?: number,
  maxTokens?: number,
): Promise<AIChatResponse> {
  const baseUrl = {
    groq: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    cerebras: process.env.CEREBRAS_BASE_URL || 'https://api.cerebras.ai/v1',
    openrouter: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  }[provider];

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + apiKey,
  };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = process.env.OPENROUTER_HTTP_REFERER || 'https://www.gaziseed.com';
    headers['X-Title'] = process.env.OPENROUTER_X_TITLE || 'GAZI SEED Messenger AI';
  }

  const response = await fetch(baseUrl + '/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature: temperature ?? 0.2,
      max_tokens: maxTokens ?? 900,
    }),
  });

  const raw = await response.text();
  let data: any = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch {
    // Keep the status-only error below if the provider did not return JSON.
  }

  if (!response.ok) {
    const providerMessage = data?.error?.message || provider + ' API error: ' + response.status + ' ' + response.statusText;
    throw new ProviderHTTPError(providerMessage, response.status);
  }

  const content = normaliseContent(data?.choices?.[0]?.message?.content);
  if (!content) throw new ProviderHTTPError(provider + ' returned an empty response', response.status);

  return {
    content,
    model: data?.model || model,
    usage: data?.usage ? {
      prompt_tokens: data.usage.prompt_tokens,
      completion_tokens: data.usage.completion_tokens,
      total_tokens: data.usage.total_tokens,
    } : undefined,
  };
}

async function callProvider(
  provider: MessengerProvider,
  messages: AIChatMessage[],
  temperature?: number,
  maxTokens?: number,
): Promise<AIChatResponse> {
  // Safety-gated failover test: only active on Vercel Preview when explicitly enabled.
// Preview-only test rebuild marker: 2026-09-25.
  // Production deployments can never be forced into this path.
  if (
    process.env.VERCEL_ENV === 'preview' &&
    process.env.AI_MESSENGER_FORCE_ALL_FAIL === 'true'
  ) {
    throw new Error('Preview-only forced provider failure test');
  }

  const apiKey = keyFor(provider);
  const model = modelFor(provider);
  if (!apiKey) throw new Error('Provider API key is not configured');
  if (provider === 'gemini') return callGemini(messages, model, apiKey, temperature, maxTokens);
  return callOpenAICompatible(provider, messages, model, apiKey, temperature, maxTokens);
}

export function isMessengerAIEnabled(): boolean {
  return process.env.AI_MESSENGER_ENABLED === 'true';
}

export function getConfiguredMessengerProviders(): MessengerProvider[] {
  return PROVIDER_ORDER.filter(isConfigured);
}

/**
 * Execute providers in strict priority order:
 * Gemini -> Groq -> Cerebras -> OpenRouter.
 * A caller must enable AI_MESSENGER_ENABLED before invoking this.
 * If every configured provider fails, the caller can create a human handoff
 * and stop automatic replies.
 */
export async function messengerAIChat(args: {
  messages: AIChatMessage[];
  temperature?: number;
  max_tokens?: number;
}): Promise<MessengerProviderResult> {
  if (!isMessengerAIEnabled()) throw new MessengerAIProviderError('Messenger AI is disabled', []);

  const providers = getConfiguredMessengerProviders();
  if (providers.length === 0) throw new MessengerAIProviderError('No Messenger AI providers are configured', []);

  const attempts: MessengerProviderAttempt[] = [];
  const timeout = timeoutMs();

  for (const provider of providers) {
    const model = modelFor(provider);

    if (isProviderInCooldown(provider)) {
      attempts.push({
        provider,
        model,
        ok: false,
        status: 429,
        error: 'Provider temporarily skipped after a recent rate-limit/quota failure',
        duration_ms: 0,
      });
      continue;
    }

    const startedAt = Date.now();
    try {
      const response = await withTimeout(callProvider(provider, args.messages, args.temperature, args.max_tokens), timeout);
      attempts.push({ provider, model, ok: true, duration_ms: Date.now() - startedAt });
      return { ...response, content: cleanMessengerAnswer(response.content), provider, attempts };
    } catch (error) {
      if (isProviderRateLimited(error)) {
        markProviderCooldown(provider, error);
      }

      attempts.push({
        provider,
        model,
        ok: false,
        status: error instanceof ProviderHTTPError ? error.status : undefined,
        error: error instanceof Error ? error.message : 'Unknown provider error',
        duration_ms: Date.now() - startedAt,
      });
    }
  }

  throw new MessengerAIProviderError('All configured Messenger AI providers failed', attempts);
}

export function getMessengerProviderOrder(): MessengerProvider[] {
  return [...PROVIDER_ORDER];
}
