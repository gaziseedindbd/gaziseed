import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(request: Request) {
  let stage = 'request_start';
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
    if (!token) return NextResponse.json({ ok: false, message: 'Authentication required' }, { status: 401 });

    stage = 'supabase_configuration';
    const db = adminSupabase();
    if (!db) return NextResponse.json({ ok: false, message: 'Server configuration incomplete' }, { status: 500 });

    stage = 'auth_get_user';
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ ok: false, message: 'Authentication required' }, { status: 401 });

    stage = 'admin_users_lookup';
    const { data: admin, error: adminError } = await db
      .from('admin_users')
      .select('user_id,role,country_code')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    if (adminError) throw adminError;
    if (!admin) return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });

    let branch = String(admin.country_code || '').toUpperCase();
    if (admin.role === 'master_admin') {
      stage = 'admin_branch_context_lookup';
      const { data: context, error } = await db
        .from('admin_branch_context')
        .select('country_code')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      branch = String(context?.country_code || '').toUpperCase();
    }
    if (!['BD', 'IN'].includes(branch)) {
      return NextResponse.json({ ok: false, message: 'Unable to verify admin branch' }, { status: 403 });
    }

    stage = 'request_validation';
    const body = await request.json();
    const target = body?.target;
    const texts = body?.texts;
    if (!['bn', 'hi'].includes(target) || !Array.isArray(texts) || texts.length < 1 || texts.length > 30) {
      return NextResponse.json({ ok: false, message: 'Invalid translation request' }, { status: 400 });
    }
    if (target === 'hi' && branch !== 'IN') {
      return NextResponse.json({ ok: false, message: 'Hindi translation is available for India branch only' }, { status: 400 });
    }

    const cleanTexts = texts.map((value: unknown) => typeof value === 'string' ? value : '');
    const totalLength = cleanTexts.reduce((sum: number, value: string) => sum + value.length, 0);
    if (totalLength > 12000 || cleanTexts.some((value: string) => value.length > 4000)) {
      return NextResponse.json({ ok: false, message: 'Translation text is too long' }, { status: 413 });
    }
    if (cleanTexts.some((value: string) => !value.trim())) {
      return NextResponse.json({ ok: false, message: 'Empty text is not allowed in a translation batch' }, { status: 400 });
    }

    const configuredEndpoints = [
      ...(process.env.LIBRETRANSLATE_URLS || '').split(','),
      process.env.LIBRETRANSLATE_URL || '',
    ].map((value) => value.trim()).filter(Boolean);
    const defaultEndpoints = [
      'https://translate.cutie.dating/translate',
      'https://translate.fedilab.app/translate',
    ];
    const normalizeEndpoint = (value: string) => {
      const url = new URL(value);
      url.search = '';
      url.hash = '';
      while (url.pathname.length > 1 && url.pathname.endsWith('/')) {
        url.pathname = url.pathname.slice(0, -1);
      }
      if (!url.pathname.endsWith('/translate')) {
        url.pathname = `${url.pathname}/translate`;
      }
      return url.toString();
    };
    const configured = configuredEndpoints.map(normalizeEndpoint);
    const endpoints = configured.concat(defaultEndpoints).filter((endpoint, index, all) => all.indexOf(endpoint) === index);
    const payload: Record<string, unknown> = {
      q: cleanTexts,
      source: 'en',
      target,
      format: 'text',
    };
    const providerFailures: Array<{ host: string; reason: string }> = [];

    stage = 'libretranslate_fetch';
    const attempts = await Promise.all(endpoints.map(async (endpoint) => {
      const host = new URL(endpoint).host;
      const requestPayload = { ...payload };
      // Only attach a configured key to the explicitly configured primary URL.
      const primaryUrl = process.env.LIBRETRANSLATE_URL
        ? normalizeEndpoint(process.env.LIBRETRANSLATE_URL.trim())
        : '';
      if (primaryUrl && endpoint === primaryUrl && process.env.LIBRETRANSLATE_API_KEY) {
        requestPayload.api_key = process.env.LIBRETRANSLATE_API_KEY;
      }

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(requestPayload),
          signal: AbortSignal.timeout(4500),
          cache: 'no-store',
        });
        if (!response.ok) {
          return { host, reason: `http_${response.status}`, translations: null as string[] | null };
        }

        const result = await response.json();
        const values = Array.isArray(result?.translatedText)
          ? result.translatedText
          : [result?.translatedText];
        if (values.length !== cleanTexts.length || values.some((value: unknown) => typeof value !== 'string' || !value.trim())) {
          return { host, reason: 'invalid_response', translations: null as string[] | null };
        }
        return { host, reason: 'ok', translations: values as string[] };
      } catch (providerError) {
        const reason = providerError instanceof Error
          ? providerError.name === 'TimeoutError' || providerError.name === 'AbortError'
            ? 'timeout'
            : providerError.name || 'fetch_error'
          : 'unknown_error';
        return { host, reason, translations: null as string[] | null };
      }
    }));

    const successful = attempts.find((attempt) => attempt.translations !== null);
    attempts.filter((attempt) => attempt.translations === null).forEach(({ host, reason }) => {
      providerFailures.push({ host, reason });
    });
    let translations = successful?.translations || null;

    // MyMemory is a separate fallback API. Its GET endpoint accepts at most
    // 500 UTF-8 bytes per query, so split long text at word boundaries.
    if (!translations) {
      stage = 'mymemory_fallback';
      const splitUtf8 = (value: string, maxBytes: number): string[] => {
        const words = value.split(/(\\s+)/);
        const chunks: string[] = [];
        let current = '';
        for (const word of words) {
          if (new TextEncoder().encode(current + word).length > maxBytes && current) {
            chunks.push(current);
            current = word.trimStart();
          } else {
            current += word;
          }
        }
        if (current) chunks.push(current);
        return chunks;
      };

      try {
        const fallbackTranslations: string[] = [];
        for (const textValue of cleanTexts) {
          const chunks = splitUtf8(textValue, 450);
          const translatedChunks: string[] = [];
          for (const chunk of chunks) {
            const params = new URLSearchParams({
              q: chunk,
              langpair: `en|${target}`,
              mt: '1',
            });
            const response = await fetch(`https://api.mymemory.translated.net/get?${params.toString()}`, {
              method: 'GET',
              headers: { Accept: 'application/json' },
              signal: AbortSignal.timeout(5000),
              cache: 'no-store',
            });
            if (!response.ok) throw new Error(`MyMemory HTTP ${response.status}`);
            const result = await response.json();
            if (Number(result?.responseStatus) !== 200 || typeof result?.responseData?.translatedText !== 'string') {
              throw new Error('MyMemory returned no translation');
            }
            translatedChunks.push(result.responseData.translatedText);
          }
          fallbackTranslations.push(translatedChunks.join(''));
        }
        if (fallbackTranslations.length === cleanTexts.length && fallbackTranslations.every((value) => value.trim())) {
          translations = fallbackTranslations;
        }
      } catch (fallbackError) {
        const reason = fallbackError instanceof Error ? fallbackError.message : 'unknown_error';
        providerFailures.push({ host: 'api.mymemory.translated.net', reason });
      }
    }

    if (!translations) {
      console.error('[translate-product-content] All translation providers failed', {
        stage,
        providers: providerFailures,
      });
      return NextResponse.json({
        ok: false,
        code: 'translation_providers_unavailable',
        message: 'All free translation servers are temporarily unavailable. Please try again later.',
        providerDiagnostics: providerFailures,
      }, { status: 502 });
    }

    stage = 'complete';
    return NextResponse.json({ ok: true, translations });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[translate-product-content]', { stage, errorName, errorMessage });
    return NextResponse.json({
      ok: false,
      code: stage,
      message: timedOut ? 'Translation server timed out. Please try again.' : 'Translation request failed. Please try again.',
    }, { status: 500 });
  }
}
