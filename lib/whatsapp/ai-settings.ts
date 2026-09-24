import type { AISettings, AIFeatureFlags, AIProvider } from '@/lib/ai/types';
import { createWhatsAppSupabase } from '@/lib/whatsapp/server';

export function isWhatsAppAIEnvironmentEnabled(): boolean {
  return process.env.WHATSAPP_AI_ENABLED === 'true';
}

const DEFAULT_FLAGS: AIFeatureFlags = {
  business_analysis: false,
  sales_analysis: false,
  inventory_assistant: false,
  marketing_assistant: false,
  ads_assistant: false,
  customer_support_ai: false,
  seed_expert: false,
  seo_aeo_assistant: false,
};

export async function getWhatsAppAISettings(): Promise<AISettings> {
  const supabase = createWhatsAppSupabase();
  const { data, error } = await supabase
    .from('ai_settings')
    .select('is_enabled,provider,api_key,model,model_name,base_url,temperature,max_tokens,feature_flags')
    .eq('id', 1)
    .maybeSingle();

  if (error) throw new Error(`AI settings lookup failed: ${error.message}`);
  if (!data) throw new Error('AI settings are not configured.');

  const provider = String(data.provider || 'openai') as AIProvider;
  const providerEnvKey =
    provider === 'gemini' ? process.env.GEMINI_API_KEY :
    provider === 'groq' ? process.env.GROQ_API_KEY :
    provider === 'cerebras' ? process.env.CEREBRAS_API_KEY :
    provider === 'openrouter' ? process.env.OPENROUTER_API_KEY :
    provider === 'claude' ? process.env.ANTHROPIC_API_KEY :
    provider === 'openai' ? process.env.OPENAI_API_KEY :
    undefined;
  const modelEnvKey =
    provider === 'gemini' ? process.env.GEMINI_MODEL :
    provider === 'groq' ? process.env.GROQ_MODEL :
    provider === 'cerebras' ? process.env.CEREBRAS_MODEL :
    provider === 'openrouter' ? process.env.OPENROUTER_MODEL :
    undefined;
  const model = String(data.model || data.model_name || modelEnvKey || '').trim();
  const featureFlags = {
    ...DEFAULT_FLAGS,
    ...(data.feature_flags && typeof data.feature_flags === 'object' ? data.feature_flags : {}),
  } as AIFeatureFlags;

  const settings: AISettings = {
    is_enabled: Boolean(data.is_enabled),
    provider,
    api_key: String(data.api_key || providerEnvKey || ''),
    model,
    base_url: String(data.base_url || ''),
    temperature: data.temperature == null ? null : Number(data.temperature),
    max_tokens: data.max_tokens == null ? null : Number(data.max_tokens),
    feature_flags: featureFlags,
  };

  if (!settings.is_enabled || !featureFlags.customer_support_ai) {
    return settings;
  }

  if (!settings.api_key) throw new Error('WhatsApp AI API key is not configured.');
  if (!settings.model) throw new Error('WhatsApp AI model is not configured.');

  return settings;
}
