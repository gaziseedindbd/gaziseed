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

    const endpoint = (process.env.LIBRETRANSLATE_URL || 'https://translate.astian.org/translate').trim();
    const payload: Record<string, unknown> = {
      q: cleanTexts,
      source: 'en',
      target,
      format: 'text',
    };
    if (process.env.LIBRETRANSLATE_API_KEY) payload.api_key = process.env.LIBRETRANSLATE_API_KEY;

    stage = 'libretranslate_fetch';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    });
    if (!response.ok) {
      return NextResponse.json({ ok: false, message: 'Free translation server is temporarily unavailable. Please try again.' }, { status: 502 });
    }

    stage = 'libretranslate_response_parse';
    const result = await response.json();
    const translated = Array.isArray(result)
      ? result.map((item: any) => item?.translatedText)
      : Array.isArray(result?.translatedText)
        ? result.translatedText
        : [result?.translatedText];
    if (translated.length !== cleanTexts.length || translated.some((value: unknown) => typeof value !== 'string' || !value.trim())) {
      return NextResponse.json({ ok: false, message: 'Translation server returned an incomplete result' }, { status: 502 });
    }

    stage = 'complete';
    return NextResponse.json({ ok: true, translations: translated });
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
