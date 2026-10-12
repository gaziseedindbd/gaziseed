import type { SupabaseClient } from '@supabase/supabase-js';
import { extractMessengerPhone, normalizeMessengerPhone } from './messenger-phone';

export type MessengerTrackingCountry = 'IN' | 'BD';

const TRACKING_FIELDS =
  'id,order_number,customer_name,customer_phone,status,order_status,payment_status,final_amount,country_code,created_at,updated_at';

function currency(country: MessengerTrackingCountry) {
  return country === 'IN' ? '₹' : '৳';
}

function parseOrderNumber(text: string): string | null {
  const match = text.toUpperCase().match(/\bGS-(?:IN|BD)-[A-Z0-9]{8}\b/);
  return match?.[0] || null;
}

function statusLabel(status: unknown) {
  const key = typeof status === 'string' ? status.toLowerCase() : '';
  const labels: Record<string, string> = {
    pending: 'অর্ডার গ্রহণ করা হয়েছে / Pending',
    confirmed: 'অর্ডার Confirmed',
    processing: 'অর্ডার Processing হচ্ছে',
    packed: 'অর্ডার Packed হয়েছে',
    shipped: 'অর্ডার Shipped হয়েছে',
    delivered: 'অর্ডার Delivered হয়েছে',
    cancelled: 'অর্ডার Cancelled হয়েছে',
    canceled: 'অর্ডার Cancelled হয়েছে',
    returned: 'অর্ডার Returned হয়েছে',
  };
  return labels[key] || (typeof status === 'string' && status) || 'Status পাওয়া যায়নি';
}

export function parseMessengerTrackingOrderNumber(text: string): string | null {
  return parseOrderNumber(text);
}

export async function getMessengerOrderTrackingReply(args: {
  supabase: SupabaseClient;
  pageId: string;
  externalUserId: string;
  country: MessengerTrackingCountry;
  text: string;
}): Promise<{ handled: boolean; reply: string; orderIds?: string[] }> {
  const requestedOrderNumber = parseOrderNumber(args.text);
  const requestedPhoneRaw = extractMessengerPhone(args.text) || '';
  const requestedPhone = requestedPhoneRaw ? normalizeMessengerPhone(requestedPhoneRaw) : '';

  const fallbackReply =
    'নিরাপত্তার কারণে এই মুহূর্তে order যাচাই করা যাচ্ছে না। অনুগ্রহ করে পরে আবার চেষ্টা করুন অথবা official WhatsApp support-এ যোগাযোগ করুন।';

  async function callVerificationGate(action: 'check' | 'fail' | 'success') {
    try {
      const { data, error } = await args.supabase.rpc(
        'consume_messenger_tracking_verification',
        {
          p_page_id: args.pageId,
          p_external_user_id: args.externalUserId,
          p_country_code: args.country,
          p_action: action,
        },
      );
      if (error || !data) return null;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || typeof row.allowed !== 'boolean') return null;
      return {
        allowed: row.allowed as boolean,
        failedAttempts: Number(row.failed_attempts || 0),
        retryAfterSeconds: Math.max(0, Number(row.retry_after_seconds || 0)),
      };
    } catch {
      return null;
    }
  }

  const gate = await callVerificationGate('check');
  if (!gate) {
    return { handled: true, reply: fallbackReply };
  }
  if (!gate.allowed) {
    const remainingMinutes = Math.max(1, Math.ceil(gate.retryAfterSeconds / 60));
    return {
      handled: true,
      reply:
        'নিরাপত্তার কারণে order verification সাময়িকভাবে বন্ধ আছে। অনুগ্রহ করে ' +
        remainingMinutes +
        ' মিনিট পরে আবার চেষ্টা করুন।',
    };
  }

  // An existing Messenger profile must never replace the two-factor requirement:
  // every tracking request must contain both the order number and its registered phone.
  if (!requestedOrderNumber || !requestedPhone) {
    return {
      handled: true,
      reply:
        'নিরাপত্তার জন্য order track করতে Order Number (যেমন GS-BD-XXXXXXXX) এবং অর্ডারের সময় দেওয়া registered mobile number—দুটো একসঙ্গে লিখুন।',
    };
  }

  const { data: profile, error: profileError } = await args.supabase
    .from('messenger_customer_profiles')
    .select('phone')
    .eq('page_id', args.pageId)
    .eq('external_user_id', args.externalUserId)
    .eq('country_code', args.country)
    .maybeSingle();

  if (profileError) {
    return { handled: true, reply: fallbackReply };
  }

  const profilePhone =
    profile && typeof profile.phone === 'string'
      ? normalizeMessengerPhone(profile.phone)
      : '';

  async function verificationFailed() {
    const failed = await callVerificationGate('fail');
    if (!failed) return { handled: true as const, reply: fallbackReply };
    if (!failed.allowed) {
      const remainingMinutes = Math.max(1, Math.ceil(failed.retryAfterSeconds / 60));
      return {
        handled: true as const,
        reply:
          'নিরাপত্তার কারণে order verification সাময়িকভাবে বন্ধ আছে। অনুগ্রহ করে ' +
          remainingMinutes +
          ' মিনিট পরে আবার চেষ্টা করুন।',
      };
    }
    return {
      handled: true as const,
      reply:
        'Order Number ও registered mobile number যাচাই করা যায়নি। তথ্য দুটি মিলিয়ে আবার চেষ্টা করুন।',
    };
  }

  // A conflicting previously linked phone is a failed verification, not an
  // opportunity to reveal whether an order exists.
  if (profilePhone && profilePhone !== requestedPhone) {
    return await verificationFailed();
  }

  const { data: orders, error: ordersError } = await args.supabase
    .from('orders')
    .select('id,order_number,status,order_status,payment_status,final_amount,country_code,created_at,updated_at')
    .eq('country_code', args.country)
    .eq('order_source', 'facebook_messenger_ai')
    .eq('customer_phone', requestedPhone)
    .eq('order_number', requestedOrderNumber)
    .limit(1);

  if (ordersError) {
    return { handled: true, reply: fallbackReply };
  }

  const rows = (orders || []) as Array<Record<string, unknown>>;
  if (!rows.length) {
    return await verificationFailed();
  }

  // Clear accumulated failures before disclosing any order details. If the
  // limiter store is unavailable, fail closed and disclose nothing.
  const verified = await callVerificationGate('success');
  if (!verified) {
    return { handled: true, reply: fallbackReply };
  }

  const order = rows[0];
  const amount = Number(order.final_amount || 0);
  return {
    handled: true,
    orderIds: [String(order.id)],
    reply:
      '📦 আপনার অর্ডারের বর্তমান অবস্থা\n\n' +
      `Order: ${String(order.order_number || requestedOrderNumber)}\n` +
      `Status: ${statusLabel(order.order_status ?? order.status)}\n` +
      `Payment: ${String(order.payment_status || 'unknown')}\n` +
      `Total: ${currency(args.country)}${amount.toFixed(0)}\n` +
      `Order date: ${new Date(String(order.created_at)).toLocaleDateString('en-IN')}\n\n` +
      'Status পরিবর্তন হলে আবার Order Number ও registered mobile number দিয়ে জানতে পারবেন।',
  };
}

export async function upsertMessengerCustomerProfile(args: {
  supabase: SupabaseClient;
  pageId: string;
  externalUserId: string;
  country: MessengerTrackingCountry;
  name?: string | null;
  phone?: string | null;
  orderId?: string | null;
  orderNumber?: string | null;
}): Promise<void> {
  const phone = args.phone ? normalizeMessengerPhone(args.phone) : null;

  const { data: existing, error: existingError } = await args.supabase
    .from('messenger_customer_profiles')
    .select(
      'id,name,phone,total_orders,total_spent,last_order_id,last_order_number,order_numbers',
    )
    .eq('page_id', args.pageId)
    .eq('external_user_id', args.externalUserId)
    .eq('country_code', args.country)
    .maybeSingle();

  if (existingError) throw existingError;

  const existingOrderNumbers = existing?.order_numbers;
  const previousOrderNumbers = Array.isArray(existingOrderNumbers)
    ? existingOrderNumbers.filter(
        (value: unknown): value is string => typeof value === 'string',
      )
    : [];

  const orderNumbers = args.orderNumber
    ? [args.orderNumber, ...previousOrderNumbers.filter((value) => value !== args.orderNumber)].slice(
        0,
        20,
      )
    : previousOrderNumbers.slice(0, 20);

  let totalOrders = Number(existing?.total_orders || 0);
  let totalSpent = Number(existing?.total_spent || 0);
  let lastOrderId = args.orderId || existing?.last_order_id || null;

  if (args.orderNumber) {
    let orderQuery = args.supabase
      .from('orders')
      .select('id,final_amount')
      .eq('order_number', args.orderNumber)
      .eq('country_code', args.country)
      .eq('order_source', 'facebook_messenger_ai')
      .limit(1);

    if (args.orderId) {
      orderQuery = orderQuery.eq('id', args.orderId);
    }

    const { data: order } = await orderQuery.maybeSingle();

    if (order) {
      totalOrders += 1;
      totalSpent += Number(order.final_amount || 0);
      lastOrderId = order.id;
    }
  }

  const { error: upsertError } = await args.supabase
    .from('messenger_customer_profiles')
    .upsert(
      {
        page_id: args.pageId,
        external_user_id: args.externalUserId,
        country_code: args.country,
        name: args.name || existing?.name || null,
        phone: phone || existing?.phone || null,
        total_orders: totalOrders,
        total_spent: totalSpent,
        last_order_id: lastOrderId,
        last_order_number:
          args.orderNumber || existing?.last_order_number || null,
        order_numbers: orderNumbers,
      },
      { onConflict: 'page_id,external_user_id,country_code' },
    );

  if (upsertError) throw upsertError;
}
