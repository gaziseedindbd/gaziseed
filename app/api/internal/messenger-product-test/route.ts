import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  searchMessengerProducts,
  serializeMessengerProducts,
} from '@/lib/ai/messenger-product-tool';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.json(
      { success: false, message: 'Preview-only runtime test' },
      { status: 404 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    return NextResponse.json(
      { success: false, message: 'Supabase service configuration is incomplete' },
      { status: 500 },
    );
  }

  const sb = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const products = await searchMessengerProducts(
    sb,
    'BD',
    'Messenger AI',
    12,
  );

  return NextResponse.json({
    success: true,
    runtime: 'messenger-product-tool',
    country: 'BD',
    searchTerm: 'Messenger AI',
    count: products.length,
    products: serializeMessengerProducts(products),
  });
}
