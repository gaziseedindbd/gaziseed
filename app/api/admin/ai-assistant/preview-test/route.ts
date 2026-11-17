import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { messengerAIChat } from '@/lib/ai/messenger-provider-router';
import {
  isTrustedMessengerProductMatch,
  searchMessengerProducts,
  type MessengerCountry,
} from '@/lib/ai/messenger-product-tool';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.MESSENGER_PREVIEW_TEST_SECRET || '';
  const supplied = request.headers.get('x-preview-test-secret') || '';

  if (!expected || !supplied) return false;

  const expectedBuffer = Buffer.from(expected, 'utf8');
  const suppliedBuffer = Buffer.from(supplied, 'utf8');

  return expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
  // This endpoint must never run against Production, even if accidentally
  // deployed there or called with a valid test secret.
  if (process.env.VERCEL_ENV !== 'preview') {
    return jsonError('Preview-only endpoint', 404);
  }

  if (!isAuthorized(request)) {
    return jsonError('Unauthorized', 401);
  }

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 4096) return jsonError('Request too large', 413);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  if (!body || typeof body !== 'object') {
    return jsonError('Invalid request body', 400);
  }

  const input = body as { country?: unknown; message?: unknown };
  const country = input.country;
  const message = typeof input.message === 'string' ? input.message.trim() : '';

  if (country !== 'IN' && country !== 'BD') {
    return jsonError('country must be IN or BD', 400);
  }
  if (!message || message.length > 500) {
    return jsonError('message must contain 1–500 characters', 400);
  }

  // Match the real Messenger webhook: product search must use the server-only
  // service role so RLS does not silently hide the customer catalog. Never use
  // a public/anon key for this privileged server-side test route.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRole) {
    return jsonError('Preview server-side Supabase configuration is missing', 503);
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let products;
  try {
    products = await searchMessengerProducts(
      supabase,
      country as MessengerCountry,
      message,
      8,
    );
  } catch (error) {
    console.error(
      '[Messenger Preview Test] database lookup failed:',
      error instanceof Error ? error.message : 'Unknown database error',
    );
    // A database failure is not a database miss. Never send it to AI fallback.
    return jsonError('Database lookup failed; AI fallback was not called', 503);
  }

  const trustedProducts = products.filter(isTrustedMessengerProductMatch);

  if (trustedProducts.length > 0) {
    return NextResponse.json({
      ok: true,
      source: 'database',
      country,
      normalized_query: message,
      products: trustedProducts.slice(0, 5).map((product) => ({
        id: product.id,
        name_bn: product.name_bn,
        name_en: product.name_en,
        match_type: product.search_match_type,
        price:
          (typeof product.offer_price === 'number' && product.offer_price > 0
            ? product.offer_price
            : null) ??
          (typeof product.sale_price === 'number' && product.sale_price > 0
            ? product.sale_price
            : null) ??
          (typeof product.price === 'number' && product.price > 0
            ? product.price
            : null) ??
          (typeof product.regular_price === 'number' && product.regular_price > 0
            ? product.regular_price
            : null),
        stock: product.stock,
      })),
      ai_fallback_called: false,
    });
  }

  try {
    const result = await messengerAIChat({
      messages: [
        {
          role: 'system',
          content:
            'You are a test-only GAZI SEED Messenger assistant. Answer general seed-growing questions briefly in the customer’s language. No verified catalog match was found. Never guess or state GAZI SEED product names, prices, stock, offers, delivery, payment, or order facts. If the question asks for those facts, say they could not be verified from the database and direct the customer to official support. Do not claim an order or payment was created.',
        },
        { role: 'user', content: message },
      ],
    });

    return NextResponse.json({
      ok: true,
      source: 'ai_fallback',
      country,
      ai_fallback_called: true,
      provider: result.provider,
      reply: result.content,
      similar_products_not_trusted: products.length,
    });
  } catch (error) {
    console.error(
      '[Messenger Preview Test] AI fallback failed:',
      error instanceof Error ? error.message : 'Unknown AI error',
    );
    return NextResponse.json({
      ok: true,
      source: 'support_fallback',
      country,
      ai_fallback_called: true,
      reply: 'No verified database answer was found and the AI provider could not respond.',
    });
  }
}
