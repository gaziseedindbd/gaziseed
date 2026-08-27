import { getAdapter } from './adapters';
import type { AIChatRequest, AIChatResponse, AIConnectionTestResult, AISettings, AIFeatureFlags, DEFAULT_FEATURE_FLAGS as _ } from './types';
import { DEFAULT_FEATURE_FLAGS } from './types';

export type { AIProvider, AISettings, AIChatMessage, AIChatRequest, AIChatResponse, AIConnectionTestResult, AIFeatureFlags } from './types';
export { AI_PROVIDER_OPTIONS, AI_FEATURE_FLAG_LIST, maskApiKey, isApiKeyMasked, DEFAULT_FEATURE_FLAGS } from './types';

export function isAIDisabled(settings: Pick<AISettings, 'is_enabled'>): boolean {
  return !settings.is_enabled;
}

export function isFeatureEnabled(flags: AIFeatureFlags, key: keyof AIFeatureFlags): boolean {
  return flags[key] === true;
}

export function getAllFeatureFlags(flags: Partial<AIFeatureFlags> | null | undefined): AIFeatureFlags {
  return { ...DEFAULT_FEATURE_FLAGS, ...(flags || {}) };
}

export async function testAIConnection(settings: AISettings): Promise<AIConnectionTestResult> {
  if (!settings.api_key || settings.api_key.includes('•')) {
    return { success: false, message: 'Please enter a valid API key (not masked)' };
  }
  const adapter = getAdapter(settings.provider);
  return adapter.testConnection(settings);
}

export async function aiChat(request: AIChatRequest, settings: AISettings): Promise<AIChatResponse> {
  if (isAIDisabled(settings)) {
    throw new Error('AI is disabled');
  }
  if (!settings.api_key) {
    throw new Error('No API key configured');
  }
  const adapter = getAdapter(settings.provider);
  return adapter.chat(request, settings);
}

export { getAdapter } from './adapters';
