import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceRole) return null;

  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const accessToken =
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';

    if (!accessToken) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 },
      );
    }

    const sb = adminSupabase();
    if (!sb) {
      return NextResponse.json(
        { success: false, message: 'Server configuration incomplete' },
        { status: 500 },
      );
    }

    const { data: { user }, error: userError } = await sb.auth.getUser(accessToken);
    if (userError || !user) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 },
      );
    }

    const { data: adminRow, error: adminError } = await sb
      .from('admin_users')
      .select('user_id,role,country_code')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (adminError) throw adminError;
    if (!adminRow) {
      return NextResponse.json(
        { success: false, message: 'Admin access required' },
        { status: 403 },
      );
    }

    let allowedCountry: 'BD' | 'IN' =
      String(adminRow.country_code || '').toUpperCase() === 'IN' ? 'IN' : 'BD';

    if (adminRow.role === 'master_admin') {
      const { data: context, error: contextError } = await sb
        .from('admin_branch_context')
        .select('country_code')
        .eq('user_id', user.id)
        .maybeSingle();

      if (contextError) throw contextError;
      allowedCountry =
        String(context?.country_code || '').toUpperCase() === 'IN' ? 'IN' : 'BD';
    }

    const body = await request.json();
    const country =
      String(body.country_code || '').toUpperCase() === 'IN' ? 'IN' : 'BD';
    const apiKey = typeof body.api_key === 'string' ? body.api_key.trim() : '';

    if (country !== allowedCountry) {
      return NextResponse.json(
        { success: false, message: 'Branch access denied' },
        { status: 403 },
      );
    }

    if (apiKey.length < 8) {
      return NextResponse.json(
        { success: false, message: 'A valid API key is required' },
        { status: 400 },
      );
    }

    const { error } = await sb.rpc('ai_store_api_key', {
      p_country_code: country,
      p_api_key: apiKey,
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'AI key save failed',
      },
      { status: 500 },
    );
  }
}
