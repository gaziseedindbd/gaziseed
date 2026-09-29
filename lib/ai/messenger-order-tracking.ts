import type { SupabaseClient } from '@supabase/supabase-js';

export type MessengerTrackingCountry = 'IN' | 'BD';

type TrackingProfile = {
  phone: string | null;
};

const TRACKING_FIELDS =
  'id,order_number,customer_name,customer_phone,status,order_status,payment_status,final_amount,country_code,created_at,updated_at';

function currency(country: MessengerTrackingCountry) {
  return country === 'IN' ? '₹' : '৳';
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

function parseOrderNumber(text: string): string | null {
  const match = text.toUpperCase().match(/\bGS-(?:IN|BD)-[A-Z0-9]{8}\b/);
  return match?.[0] || null;
}

function statusLabel(status: string | null | undefined) {
  const key = (status || '').toLowerCase();
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
  return labels[key] || status || 'Status পাওয়া যায়নি';
}

export function parseMessengerTrackingOrderNumber(text: string) {
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

  const { data: profile, error: profileError } = await args.supabase
    .from('messenger_customer_profiles')
    .select('phone')
    .eq('page_id', args.pageId)
    .eq('external_user_id', args.externalUserId)
    .eq('country_code', args.country)
    .maybeSingle();

  if (profileError) throw profileError;

  const profilePhone =
    profile && typeof profile.phone === 'string' ? normalizePhone(profile.phone) : '';

  const requestedPhone = normalizePhone(
    (args.text.match(/(?:\+?\d[\d\s().-]{8,}\d)/)?.[0] || ''),
  );

  const phone = requestedPhone || profilePhone;

  if (!phone) {
    return {
      handled: true,
      reply:
        'আপনার Messenger-এর সাথে কোনো verified order phone number এখনো linked নেই।\n\n' +
        'নির্দিষ্ট order track করতে Order Number (যেমন GS-BD-XXXXXXXX) এবং অর্ডারের সময় দেওয়া mobile number লিখুন।',
    };
  }

  let query = args.supabase
    .from('orders')
    .select(TRACKING_FIELDS)
    .eq('country_code', args.country)
    .eq('order_source', 'facebook_messenger_ai')
    .eq('customer_phone', phone)
    .order('created_at', { ascending: false })
    .limit(5);

  if (requestedOrderNumber) {
    query = query.eq('order_number', requestedOrderNumber).limit(1);
  }

  const { data: orders, error: ordersError } = await query;
  if (ordersError) throw ordersError;

  if (!orders?.length) {
    return {
      handled: true,
      reply: requestedOrderNumber
        ? 'এই Order Number এবং mobile number-এর সাথে কোনো Messenger order পাওয়া যায়নি। Order Number ও mobile number আবার মিলিয়ে দিন।'
        : 'আপনার দেওয়া mobile number-এর সাথে কোনো Messenger order পাওয়া যায়নি।',
    };
  }

  if (requestedOrderNumber) {
    const order = orders[0] as Record<string, unknown>;
    const status = statusLabel(
      typeof order.order_status === 'string' ? order.order_status : order.status as string,
    );
    const amount = Number(order.final_amount || 0);

    return {
      handled: true,
      orderIds: [String(order.id)],
      reply:
        '📦 আপনার অর্ডারের বর্তমান অবস্থা\n\n' +
        `Order: ${order.order_number}\n` +
        `Status: ${status}\n` +
        `Payment: ${String(order.payment_status || 'unknown')}\n` +
        `Total: ${currency(args.country)}${amount.toFixed(0)}\n` +
        `Order date: ${new Date(String(order.created_at)).toLocaleDateString('en-IN')}\n\n` +
        'Status পরিবর্তন হলে একই Messenger-এ আবার “order status” লিখে জানতে পারবেন।',
    };
  }

  const lines = orders.slice(0, 5).map((order: Record<string, unknown>) => {
    const status = statusLabel(
      typeof order.order_status === 'string' ? order.order_status : order.status as string,
    );
    const amount = Number(order.final_amount || 0);
    return `• ${order.order_number} — ${status} — ${currency(args.country)}${amount.toFixed(0)}`;
  });

  return {
    handled: true,
    orderIds: orders.map((order: Record<string, unknown>) => String(order.id)),
    reply:
      '📦 আপনার সাম্প্রতিক Messenger orders:\n\n' +
      lines.join('\n') +
      '\n\nনির্দিষ্ট order-এর বিস্তারিত status জানতে Order Number লিখুন।',
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
}) {
  const phone = args.phone ? normalizePhone(args.phone) : null;

  const { data: existing, error: existingError } = await args.supabase
    .from('messenger_customer_profiles')
    .select('id,name,phone,total_orders,total_spent,last_order_id,last_order_number,order_numbers')
    .eq('page_id', args.pageId)
    .eq('external_user_id', args.externalUserId)
    .eq('country_code', args.country)
    .maybeSingle();

  if (existingError) throw existingError;

  const orderNumbers = Array.isArray(existing?.order_numbers)
    ? existing.order_numbers.filter((value): value is string => typeof value === 'string')
    : [];

  if (args.orderNumber && !orderNumbers.includes(args.orderNumber)) {
    orderNumbers.unshift(args.orderNumber);
  }

  const update: Record<string, unknown> = {
    page_id: args.pageId,
    external_user_id: args.externalUserId,
    country_code: args.country,
    name: args.name || existing?.name || null,
    phone: phone || existing?.phone || null,
    last_order_id: args.orderId || existing?.last_order_id || null,
    last_order_number: args.orderNumber || existing?.last_order_number || null,
    order_numbers: orderNumbers.slice(0, 20),
  };

  if (args.orderId && args.orderNumber) {
    const { data: order } = await args.supabase
      .from('orders')
      .select('final_amount')
      .eq('id', args.orderId)
      .eq('country_code', args.country)
      .eq('order_source', 'facebook_messenger_ai')
      .maybeSingle();

    update.total_orders = Number(existing?.total_orders || 0) + 1;
    update.total_spent =
      Number(existing?.total_spent || 0) + Number(order?.final_amount || 0);
  } else {
    update.total_orders = Number(existing?.total_orders || 0);
    update.total_spent = Number(existing?.total_spent || 0);
  }

  const { error } = await args.supabase
    .from('messenger_customer_profiles')
    .upsert(update, {
      onConflict: 'page_id,external_user_id,country_code',
    });

  if (error) throw error;
}
