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
  const model = String(data.model || data.model_name || '').trim();
  const featureFlags = {
    ...DEFAULT_FLAGS,
    ...(data.feature_flags && typeof data.feature_flags === 'object' ? data.feature_flags : {}),
  } as AIFeatureFlags;

  if (!data.api_key) {
    throw new Error('WhatsApp AI API key is not configured.');
  }
  if (!model) {
    throw new Error('WhatsApp AI model is not configured.');
  }
  if (!featureFlags.customer_support_ai) {
    throw new Error('Customer Support AI is disabled.');
  }

  return {
    is_enabled: Boolean(data.is_enabled),
    provider,
    api_key: String(data.api_key || ''),
    model,
    base_url: String(data.base_url || ''),
    temperature: data.temperature == null ? null : Number(data.temperature),
    max_tokens: data.max_tokens == null ? null : Number(data.max_tokens),
    feature_flags: featureFlags,
  };
}
