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
  cerebras: 'llama-3.3-70b',
  openrouter: 'openrouter/free',
};

const DEFAULT_TIMEOUT_MS = 12_000;

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
    const startedAt = Date.now();
    try {
      const response = await withTimeout(callProvider(provider, args.messages, args.temperature, args.max_tokens), timeout);
      attempts.push({ provider, model, ok: true, duration_ms: Date.now() - startedAt });
      return { ...response, provider, attempts };
    } catch (error) {
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
