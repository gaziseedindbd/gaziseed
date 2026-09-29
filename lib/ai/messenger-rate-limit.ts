import type { SupabaseClient } from '@supabase/supabase-js';

export type MessengerRateLimitMode = 'message' | 'ai';

export type MessengerRateLimitResult = {
  allowed: boolean;
  reason: string | null;
  retry_after_seconds: number;
  notify_customer: boolean;
  minute_count: number;
  hour_count: number;
  day_count: number;
  ai_minute_count: number;
  ai_hour_count: number;
  duplicate_count: number;
  blocked_until: string | null;
};

const FALLBACK_ALLOWED: MessengerRateLimitResult = {
  allowed: true,
  reason: null,
  retry_after_seconds: 0,
  notify_customer: false,
  minute_count: 0,
  hour_count: 0,
  day_count: 0,
  ai_minute_count: 0,
  ai_hour_count: 0,
  duplicate_count: 0,
  blocked_until: null,
};

export function hashMessengerMessage(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function getMessengerRateLimitReply(result: MessengerRateLimitResult): string {
  const seconds = Math.max(1, result.retry_after_seconds || 60);
  const roundedMinutes = Math.max(1, Math.ceil(seconds / 60));

  if (result.reason === 'duplicate_burst') {
    return 'আপনার একই ধরনের message খুব দ্রুত বারবার এসেছে। অনুগ্রহ করে একটু পরে আবার চেষ্টা করুন।';
  }

  if (result.reason === 'minute_limit' || result.reason === 'ai_minute_limit') {
    return 'আপনি অল্প সময়ে অনেকগুলো request পাঠিয়েছেন। অনুগ্রহ করে ' + roundedMinutes + ' মিনিট পরে আবার চেষ্টা করুন।';
  }

  if (result.reason === 'hour_limit' || result.reason === 'ai_hour_limit') {
    return 'এই মুহূর্তে request limit পূর্ণ হয়েছে। অনুগ্রহ করে পরে আবার চেষ্টা করুন।';
  }

  if (result.reason === 'day_limit') {
    return 'আজকের request limit পূর্ণ হয়েছে। অনুগ্রহ করে আগামীকাল আবার চেষ্টা করুন।';
  }

  if (result.reason === 'limiter_unavailable') {
    return 'সাময়িকভাবে AI সহায়তা সীমিত করা হয়েছে। অনুগ্রহ করে ১ মিনিট পরে আবার চেষ্টা করুন।';
  }

  return 'সাময়িকভাবে request সীমিত করা হয়েছে। ' + roundedMinutes + ' মিনিট পরে আবার চেষ্টা করুন।';
}

export async function consumeMessengerRateLimit(
  supabase: SupabaseClient,
  args: {
    pageId: string;
    externalUserId: string;
    countryCode: 'IN' | 'BD';
    messageHash?: string | null;
    mode?: MessengerRateLimitMode;
  },
): Promise<MessengerRateLimitResult> {
  try {
    const { data, error } = await supabase.rpc('consume_messenger_rate_limit', {
      p_page_id: args.pageId,
      p_external_user_id: args.externalUserId,
      p_country_code: args.countryCode,
      p_message_hash: args.messageHash || null,
      p_mode: args.mode || 'message',
    });

    if (error) {
      console.error('Messenger rate limiter failed:', error.message);
      if ((args.mode || 'message') === 'ai') {
        return {
          ...FALLBACK_ALLOWED,
          allowed: false,
          reason: 'limiter_unavailable',
          retry_after_seconds: 30,
          notify_customer: true,
        };
      }
      return FALLBACK_ALLOWED;
    }

    if (!data) return FALLBACK_ALLOWED;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return FALLBACK_ALLOWED;

    return {
      allowed: Boolean(row.allowed),
      reason: typeof row.reason === 'string' ? row.reason : null,
      retry_after_seconds: typeof row.retry_after_seconds === 'number' ? row.retry_after_seconds : 0,
      notify_customer: Boolean(row.notify_customer),
      minute_count: Number(row.minute_count || 0),
      hour_count: Number(row.hour_count || 0),
      day_count: Number(row.day_count || 0),
      ai_minute_count: Number(row.ai_minute_count || 0),
      ai_hour_count: Number(row.ai_hour_count || 0),
      duplicate_count: Number(row.duplicate_count || 0),
      blocked_until: typeof row.blocked_until === 'string' ? row.blocked_until : null,
    };
  } catch (error) {
    console.error('Messenger rate limiter exception:', error instanceof Error ? error.message : 'Unknown rate limiter error');
    if ((args.mode || 'message') === 'ai') {
      return {
        ...FALLBACK_ALLOWED,
        allowed: false,
        reason: 'limiter_unavailable',
        retry_after_seconds: 30,
        notify_customer: true,
      };
    }
    return FALLBACK_ALLOWED;
  }
}