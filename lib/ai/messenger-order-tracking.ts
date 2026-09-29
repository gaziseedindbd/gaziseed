import type { SupabaseClient } from '@supabase/supabase-js';

export type MessengerTrackingCountry = 'IN' | 'BD';

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

  const { data: profile, error: profileError } = await args.supabase
    .from('messenger_customer_profiles')
    .select('phone')
    .eq('page_id', args.pageId)
    .eq('external_user_id', args.externalUserId)
    .eq('country_code', args.country)
    .maybeSingle();

  if (profileError) throw profileError;

  const profilePhone =
    profile && typeof profile.phone === 'string'
      ? normalizePhone(profile.phone)
      : '';

  const phoneMatch = args.text.match(/(?:\+?\d[\d\s().-]{8,}\d)/);
  const requestedPhone = normalizePhone(phoneMatch?.[0] || '');

  if (profilePhone && requestedPhone && profilePhone !== requestedPhone) {
    return {
      handled: true,
      reply:
        'নিরাপত্তার জন্য এই Messenger account-এর সাথে আগে linked mobile number-টাই ব্যবহার করুন।',
    };
  }

  const phone = profilePhone || requestedPhone;

  if (!phone) {
    return {
      handled: true,
      reply:
        'আপনার Messenger-এর সাথে কোনো verified order phone number এখনো linked নেই।\n\n' +
        'নির্দিষ্ট order track করতে Order Number (যেমন GS-BD-XXXXXXXX) এবং অর্ডারের সময় দেওয়া mobile number লিখুন।',
    };
  }

  if (!profilePhone && !requestedOrderNumber) {
    return {
      handled: true,
      reply:
        'নিরাপত্তার জন্য প্রথমবার order tracking করতে Order Number (যেমন GS-BD-XXXXXXXX) এবং অর্ডারের সময় দেওয়া mobile number একসাথে লিখুন।',
    };
  }

  const baseOrdersQuery = args.supabase
    .from('orders')
    .select(TRACKING_FIELDS)
    .eq('country_code', args.country)
    .eq('order_source', 'facebook_messenger_ai')
    .eq('customer_phone', phone);

  const ordersQuery = requestedOrderNumber
    ? baseOrdersQuery.eq('order_number', requestedOrderNumber).limit(1)
    : baseOrdersQuery.order('created_at', { ascending: false }).limit(5);

  const { data: orders, error: ordersError } = await ordersQuery;
  if (ordersError) throw ordersError;

  const rows = (orders || []) as Array<Record<string, unknown>>;

  if (!rows.length) {
    return {
      handled: true,
      reply: requestedOrderNumber
        ? 'এই Order Number এবং mobile number-এর সাথে কোনো Messenger order পাওয়া যায়নি। Order Number ও mobile number আবার মিলিয়ে দিন।'
        : 'আপনার দেওয়া mobile number-এর সাথে কোনো Messenger order পাওয়া যায়নি।',
    };
  }

  if (requestedOrderNumber) {
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
        'Status পরিবর্তন হলে একই Messenger-এ আবার “order status” লিখে জানতে পারবেন।',
    };
  }

  const lines = rows.map((order) => {
    const amount = Number(order.final_amount || 0);
    return `• ${String(order.order_number || 'Unknown')} — ${statusLabel(order.order_status ?? order.status)} — ${currency(args.country)}${amount.toFixed(0)}`;
  });

  return {
    handled: true,
    orderIds: rows.map((order) => String(order.id)),
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
}): Promise<void> {
  const phone = args.phone ? normalizePhone(args.phone) : null;

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
