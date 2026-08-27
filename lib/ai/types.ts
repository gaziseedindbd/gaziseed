export type AIProvider = 'openai' | 'gemini' | 'claude' | 'custom';

export interface AISettings {
  is_enabled: boolean;
  provider: AIProvider;
  api_key: string;
  model: string;
  base_url: string;
  temperature: number | null;
  max_tokens: number | null;
  feature_flags: AIFeatureFlags;
}

export interface AIFeatureFlags {
  business_analysis: boolean;
  sales_analysis: boolean;
  inventory_assistant: boolean;
  marketing_assistant: boolean;
  ads_assistant: boolean;
  customer_support_ai: boolean;
  seed_expert: boolean;
  seo_aeo_assistant: boolean;
}

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIChatRequest {
  messages: AIChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

export interface AIChatResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface AIConnectionTestResult {
  success: boolean;
  message: string;
}

export const DEFAULT_FEATURE_FLAGS: AIFeatureFlags = {
  business_analysis: false,
  sales_analysis: false,
  inventory_assistant: false,
  marketing_assistant: false,
  ads_assistant: false,
  customer_support_ai: false,
  seed_expert: false,
  seo_aeo_assistant: false,
};

export const AI_PROVIDER_OPTIONS: { value: AIProvider; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'claude', label: 'Claude' },
  { value: 'custom', label: 'Custom/Other' },
];

export const AI_FEATURE_FLAG_LIST: { key: keyof AIFeatureFlags; label: string }[] = [
  { key: 'business_analysis', label: 'Business Analysis' },
  { key: 'sales_analysis', label: 'Sales Analysis' },
  { key: 'inventory_assistant', label: 'Inventory Assistant' },
  { key: 'marketing_assistant', label: 'Marketing Assistant' },
  { key: 'ads_assistant', label: 'Facebook/Instagram Ads Assistant' },
  { key: 'customer_support_ai', label: 'Customer Support AI' },
  { key: 'seed_expert', label: 'Seed Expert' },
  { key: 'seo_aeo_assistant', label: 'SEO/AEO Assistant' },
];

export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return key ? '••••' : '';
  return key.slice(0, 4) + '••••••' + key.slice(-4);
}

export function isApiKeyMasked(key: string): boolean {
  return key.includes('•');
}
