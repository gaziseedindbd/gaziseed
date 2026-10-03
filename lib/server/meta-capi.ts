import { createHash } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type CountryCode = 'BD' | 'IN';

type MetaCapiOrder = {
  id: string;
  order_number: string;
  user_id: string | null;
  customer_phone: string;
  customer_email: string | null;
  customer_name: string;
  district: string | null;
  country_code: CountryCode;
  final_amount: number | null;
  grand_total: number | null;
  delivery_charge: number | null;
  shipping_fee: number | null;
  coupon_code: string | null;
  created_at: string;
};

type MetaCapiOrderItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  variant_id: string | null;
};

type MetaEventContext = {
  sourceUrl?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
};

function getAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase server configuration is incomplete');

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase();
  return email || null;
}

function normalizePhone(value: string | null | undefined, countryCode: CountryCode): string | null {
  const digits = (value || '').replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('00')) return normalizePhone(digits.slice(2), countryCode);
  if (countryCode === 'BD' && digits.startsWith('0')) return '880' + digits.slice(1);
  if (countryCode === 'IN' && digits.startsWith('0')) return '91' + digits.slice(1);
  return digits;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function getMetaPurchaseEventId(
  countryCode: CountryCode,
  orderNumber: string,
): string {
  return 'purchase:' + countryCode + ':' + orderNumber;
}

function getCurrency(countryCode: CountryCode): 'BDT' | 'INR' {
  return countryCode === 'IN' ? 'INR' : 'BDT';
}

async function getOrder(
  admin: SupabaseClient,
  orderNumber: string,
  countryCode: CountryCode,
): Promise<{ order: MetaCapiOrder; items: MetaCapiOrderItem[] } | null> {
  const { data: order, error } = await admin
    .from('orders')
    .select(
      'id, order_number, user_id, customer_phone, customer_email, customer_name, district, country_code, final_amount, grand_total, delivery_charge, shipping_fee, coupon_code, created_at',
    )
    .eq('country_code', countryCode)
    .eq('order_number', orderNumber)
    .eq('order_source', 'website')
    .maybeSingle();

  if (error) throw error;
  if (!order) return null;

  const { data: items, error: itemsError } = await admin
    .from('order_items')
    .select('product_id, product_name, quantity, unit_price, variant_id')
    .eq('country_code', countryCode)
    .eq('order_id', order.id);

  if (itemsError) throw itemsError;

  return {
    order: order as MetaCapiOrder,
    items: (items || []) as MetaCapiOrderItem[],
  };
}

async function getMarketingSettings(
  admin: SupabaseClient,
  countryCode: CountryCode,
): Promise<{ meta_pixel_id: string | null }> {
  const { data, error } = await admin
    .from('marketing_settings')
    .select('meta_pixel_id')
    .eq('id', 1)
    .eq('country_code', countryCode)
    .maybeSingle();

  if (error) throw error;
  return { meta_pixel_id: data?.meta_pixel_id?.trim() || null };
}

async function postPurchaseToMeta(
  order: MetaCapiOrder,
  items: MetaCapiOrderItem[],
  pixelId: string,
  accessToken: string,
  context: MetaEventContext,
): Promise<{ ok: boolean; response: unknown }> {
  const eventId = getMetaPurchaseEventId(order.country_code, order.order_number);
  const currency = getCurrency(order.country_code);
  const eventTime = Math.floor(new Date(order.created_at).getTime() / 1000);
  const value = Number(order.final_amount ?? order.grand_total ?? 0);
  const shipping = Number(order.delivery_charge ?? order.shipping_fee ?? 0);

  const phone = normalizePhone(order.customer_phone, order.country_code);
  const email = normalizeEmail(order.customer_email);
  const externalId = order.user_id ? order.user_id.trim().toLowerCase() : null;

  const userData: Record<string, unknown> = {};
  if (phone) userData.ph = [sha256(phone)];
  if (email) userData.em = [sha256(email)];
  if (externalId) userData.external_id = [sha256(externalId)];
  userData.country = [sha256(order.country_code.toLowerCase())];
  if (order.district?.trim()) {
    userData.ct = [sha256(order.district.trim().toLowerCase())];
  }
  if (context.clientIpAddress) userData.client_ip_address = context.clientIpAddress;
  if (context.clientUserAgent) userData.client_user_agent = context.clientUserAgent;

  const contents = items.map((item) => ({
    id: item.product_id,
    quantity: Number(item.quantity || 0),
    item_price: Number(item.unit_price || 0),
  }));

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: 'Purchase',
        event_time: eventTime,
        event_id: eventId,
        action_source: 'website',
        event_source_url:
          context.sourceUrl ||
          'https://www.gaziseed.com/order-success?number=' +
            encodeURIComponent(order.order_number),
        user_data: userData,
        custom_data: {
          currency,
          value,
          shipping,
          order_id: order.order_number,
          content_type: 'product',
          content_ids: items.map((item) => item.product_id),
          contents,
          ...(order.coupon_code ? { coupon: order.coupon_code } : {}),
        },
      },
    ],
  };

  const testEventCode = process.env.META_CAPI_TEST_EVENT_CODE?.trim();
  if (testEventCode) payload.test_event_code = testEventCode;

  const graphVersion = process.env.META_CAPI_GRAPH_VERSION?.trim() || 'v26.0';
  const endpoint =
    'https://graph.facebook.com/' +
    graphVersion +
    '/' +
    encodeURIComponent(pixelId) +
    '/events';

  const url = new URL(endpoint);
  url.searchParams.set('access_token', accessToken);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-store',
    });

    const responseBody = await response.json().catch(() => null);
    if (!response.ok) {
      return { ok: false, response: responseBody };
    }

    return { ok: true, response: responseBody };
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureEvent(
  admin: SupabaseClient,
  order: MetaCapiOrder,
): Promise<{ id: string; status: string; attempts: number }> {
  const eventId = getMetaPurchaseEventId(order.country_code, order.order_number);

  const { error: insertError } = await admin
    .from('meta_capi_events')
    .insert({
      event_name: 'Purchase',
      event_id: eventId,
      order_id: order.id,
      country_code: order.country_code,
      status: 'pending',
    });

  if (insertError && insertError.code !== '23505') throw insertError;

  const { data, error } = await admin
    .from('meta_capi_events')
    .select('id, status, attempts')
    .eq('event_name', 'Purchase')
    .eq('event_id', eventId)
    .maybeSingle();

  if (error || !data) throw error || new Error('Meta CAPI event record not found');

  return {
    id: data.id,
    status: data.status,
    attempts: Number(data.attempts || 0),
  };
}

export async function sendMetaPurchaseForOrder(
  orderNumber: string,
  countryCode: CountryCode,
  context: MetaEventContext = {},
): Promise<{
  ok: boolean;
  status: 'sent' | 'already_sent' | 'pending' | 'failed' | 'not_found';
  reason?: string;
}> {
  const admin = getAdminClient();
  const record = await getOrder(admin, orderNumber, countryCode);
  if (!record) return { ok: false, status: 'not_found' };

  const event = await ensureEvent(admin, record.order);
  if (event.status === 'sent') return { ok: true, status: 'already_sent' };
  if (event.status === 'processing') {
    return { ok: true, status: 'pending', reason: 'already_processing' };
  }

  const { data: claimed, error: claimError } = await admin
    .from('meta_capi_events')
    .update({
      status: 'processing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', event.id)
    .in('status', ['pending', 'failed'])
    .select('id')
    .maybeSingle();

  if (claimError) throw claimError;
  if (!claimed) return { ok: true, status: 'pending', reason: 'claimed_elsewhere' };

  const attempts = event.attempts + 1;

  try {
    const accessToken = process.env.META_CAPI_ACCESS_TOKEN?.trim();
    if (!accessToken) {
      await admin
        .from('meta_capi_events')
        .update({
          status: 'pending',
          attempts,
          last_error: 'META_CAPI_ACCESS_TOKEN is not configured',
          updated_at: new Date().toISOString(),
        })
        .eq('id', event.id);

      return { ok: false, status: 'pending', reason: 'missing_access_token' };
    }

    const settings = await getMarketingSettings(admin, countryCode);
    if (!settings.meta_pixel_id) {
      await admin
        .from('meta_capi_events')
        .update({
          status: 'pending',
          attempts,
          last_error: 'Meta Pixel ID is not configured for this branch',
          updated_at: new Date().toISOString(),
        })
        .eq('id', event.id);

      return { ok: false, status: 'pending', reason: 'missing_pixel_id' };
    }

    const result = await postPurchaseToMeta(
      record.order,
      record.items,
      settings.meta_pixel_id,
      accessToken,
      context,
    );

    if (!result.ok) {
      await admin
        .from('meta_capi_events')
        .update({
          status: 'failed',
          attempts,
          last_error:
            typeof result.response === 'string'
              ? result.response
              : JSON.stringify(result.response).slice(0, 2000),
          updated_at: new Date().toISOString(),
        })
        .eq('id', event.id);

      return { ok: false, status: 'failed', reason: 'meta_api_error' };
    }

    await admin
      .from('meta_capi_events')
      .update({
        status: 'sent',
        attempts,
        last_error: null,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', event.id);

    return { ok: true, status: 'sent' };
  } catch (error) {
    await admin
      .from('meta_capi_events')
      .update({
        status: 'failed',
        attempts,
        last_error: error instanceof Error ? error.message : 'Unknown CAPI error',
        updated_at: new Date().toISOString(),
      })
      .eq('id', event.id);

    return { ok: false, status: 'failed', reason: 'exception' };
  }
}

export async function processMetaCapiPurchases(limit = 20): Promise<{
  processed: number;
  sent: number;
  alreadySent: number;
  pending: number;
  failed: number;
  notFound: number;
}> {
  const admin = getAdminClient();

  const staleAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  await admin
    .from('meta_capi_events')
    .update({
      status: 'pending',
      updated_at: new Date().toISOString(),
      last_error: 'Recovered stale processing event',
    })
    .eq('status', 'processing')
    .lt('updated_at', staleAt);

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: orders, error } = await admin
    .from('orders')
    .select(
      'id, order_number, user_id, customer_phone, customer_email, customer_name, district, country_code, final_amount, grand_total, delivery_charge, shipping_fee, coupon_code, created_at',
    )
    .eq('order_source', 'website')
    .in('country_code', ['BD', 'IN'])
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const counters = {
    processed: 0,
    sent: 0,
    alreadySent: 0,
    pending: 0,
    failed: 0,
    notFound: 0,
  };

  for (const order of (orders || []) as MetaCapiOrder[]) {
    const result = await sendMetaPurchaseForOrder(
      order.order_number,
      order.country_code,
    );
    counters.processed += 1;

    if (result.status === 'sent') counters.sent += 1;
    else if (result.status === 'already_sent') counters.alreadySent += 1;
    else if (result.status === 'pending') counters.pending += 1;
    else if (result.status === 'failed') counters.failed += 1;
    else if (result.status === 'not_found') counters.notFound += 1;
  }

  return counters;
}
