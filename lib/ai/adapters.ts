import type { AIChatRequest, AIChatResponse, AIConnectionTestResult, AISettings } from './types';

export interface AIAdapter {
  testConnection(settings: AISettings): Promise<AIConnectionTestResult>;
  chat(request: AIChatRequest, settings: AISettings): Promise<AIChatResponse>;
}

export const openaiAdapter: AIAdapter = {
  async testConnection(settings: AISettings): Promise<AIConnectionTestResult> {
    try {
      const baseUrl = settings.base_url || 'https://api.openai.com/v1';
      const res = await fetch(`${baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${settings.api_key}` },
      });
      if (!res.ok) {
        return { success: false, message: `OpenAI API error: ${res.status} ${res.statusText}` };
      }
      return { success: true, message: 'OpenAI connection successful' };
    } catch (err) {
      return { success: false, message: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}` };
    }
  },

  async chat(request: AIChatRequest, settings: AISettings): Promise<AIChatResponse> {
    const baseUrl = settings.base_url || 'https://api.openai.com/v1';
    const model = settings.model || 'gpt-4o-mini';
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.api_key}`,
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? settings.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? settings.max_tokens ?? undefined,
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI API error: ${res.status}`);
    }
    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      model,
      usage: data.usage,
    };
  },
};

export const geminiAdapter: AIAdapter = {
  async testConnection(settings: AISettings): Promise<AIConnectionTestResult> {
    try {
      const model = settings.model || 'gemini-1.5-flash';
      const baseUrl = settings.base_url || 'https://generativelanguage.googleapis.com/v1beta';
      const res = await fetch(`${baseUrl}/models/${model}?key=${settings.api_key}`);
      if (!res.ok) {
        return { success: false, message: `Gemini API error: ${res.status} ${res.statusText}` };
      }
      return { success: true, message: 'Gemini connection successful' };
    } catch (err) {
      return { success: false, message: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}` };
    }
  },

  async chat(request: AIChatRequest, settings: AISettings): Promise<AIChatResponse> {
    const model = settings.model || 'gemini-1.5-flash';
    const baseUrl = settings.base_url || 'https://generativelanguage.googleapis.com/v1beta';
    const systemMsg = request.messages.find((m) => m.role === 'system');
    const userMsgs = request.messages.filter((m) => m.role !== 'system');

    const res = await fetch(`${baseUrl}/models/${model}:generateContent?key=${settings.api_key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
        contents: userMsgs.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          temperature: request.temperature ?? settings.temperature ?? 0.7,
          maxOutputTokens: request.max_tokens ?? settings.max_tokens ?? undefined,
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`Gemini API error: ${res.status}`);
    }
    const data = await res.json();
    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
      model,
    };
  },
};

export const claudeAdapter: AIAdapter = {
  async testConnection(settings: AISettings): Promise<AIConnectionTestResult> {
    try {
      const baseUrl = settings.base_url || 'https://api.anthropic.com/v1';
      const res = await fetch(`${baseUrl}/models`, {
        headers: {
          'x-api-key': settings.api_key,
          'anthropic-version': '2023-06-01',
        },
      });
      if (!res.ok) {
        return { success: false, message: `Claude API error: ${res.status} ${res.statusText}` };
      }
      return { success: true, message: 'Claude connection successful' };
    } catch (err) {
      return { success: false, message: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}` };
    }
  },

  async chat(request: AIChatRequest, settings: AISettings): Promise<AIChatResponse> {
    const baseUrl = settings.base_url || 'https://api.anthropic.com/v1';
    const model = settings.model || 'claude-sonnet-4-20250514';
    const systemMsg = request.messages.find((m) => m.role === 'system');
    const chatMsgs = request.messages.filter((m) => m.role !== 'system');

    const res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.api_key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system: systemMsg?.content,
        messages: chatMsgs.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: request.max_tokens ?? settings.max_tokens ?? 1024,
        temperature: request.temperature ?? settings.temperature ?? 0.7,
      }),
    });
    if (!res.ok) {
      throw new Error(`Claude API error: ${res.status}`);
    }
    const data = await res.json();
    return {
      content: data.content?.[0]?.text || '',
      model,
      usage: data.usage,
    };
  },
};

export const customAdapter: AIAdapter = {
  async testConnection(settings: AISettings): Promise<AIConnectionTestResult> {
    if (!settings.base_url) {
      return { success: false, message: 'Base URL is required for custom providers' };
    }
    try {
      const res = await fetch(`${settings.base_url}/models`, {
        headers: { 'Authorization': `Bearer ${settings.api_key}` },
      });
      if (!res.ok) {
        return { success: false, message: `Custom API error: ${res.status} ${res.statusText}` };
      }
      return { success: true, message: 'Custom provider connection successful' };
    } catch (err) {
      return { success: false, message: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}` };
    }
  },

  async chat(request: AIChatRequest, settings: AISettings): Promise<AIChatResponse> {
    if (!settings.base_url) {
      throw new Error('Base URL is required for custom providers');
    }
    const model = settings.model || 'default';
    const res = await fetch(`${settings.base_url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.api_key}`,
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? settings.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? settings.max_tokens ?? undefined,
      }),
    });
    if (!res.ok) {
      throw new Error(`Custom API error: ${res.status}`);
    }
    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      model,
      usage: data.usage,
    };
  },
};

export function getAdapter(provider: string): AIAdapter {
  switch (provider) {
    case 'openai': return openaiAdapter;
    case 'gemini': return geminiAdapter;
    case 'claude': return claudeAdapter;
    case 'custom': return customAdapter;
    default: return openaiAdapter;
  }
}
