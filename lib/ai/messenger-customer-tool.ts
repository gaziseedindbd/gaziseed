import type { SupabaseClient } from '@supabase/supabase-js';
import { extractMessengerPhone, normalizeMessengerPhone } from './messenger-phone';

export type MessengerCustomerCountry = 'IN' | 'BD';

type MessengerCustomerProfile = {
  id: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  total_orders: number;
  total_spent: number | string;
  last_order_number: string | null;
  order_numbers: unknown;
};

type MessengerHistoryOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  status: string | null;
  order_status: string | null;
  payment_status: string | null;
  final_amount: number | string | null;
  created_at: string | null;
};

type MessengerHistoryItem = {
  order_id: string;
  product_name: string;
  quantity: number;
  unit_price: number | string;
  total_price: number | string;
};

function currency(country: MessengerCustomerCountry) {
  return country === 'IN' ? '₹' : '৳';
}

function parseOrderNumber(text: string): string | null {
  const match = text.toUpperCase().match(/\bGS-(?:IN|BD)-[A-Z0-9]{8}\b/);
  return match?.[0] || null;
}

function statusLabel(status: string | null | undefined) {
  const key = (status || '').toLowerCase();
  const labels: Record<string, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    processing: 'Processing',
    packed: 'Packed',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    canceled: 'Cancelled',
    returned: 'Returned',
  };
  return labels[key] || status || 'Status পাওয়া যায়নি';
}

function formatDate(value: string | null) {
  if (!value) return 'তারিখ পাওয়া যায়নি';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'তারিখ পাওয়া যায়নি'
    : date.toLocaleDateString('en-IN');
}

export function formatMessengerCustomerProfile(
  profile: MessengerCustomerProfile,
  country: MessengerCustomerCountry,
): string {
  const totalSpent = Number(profile.total_spent || 0);
  const orderNumbers = Array.isArray(profile.order_numbers)
    ? profile.order_numbers.filter((value): value is string => typeof value === 'string')
    : [];

  return [
    '👤 আপনার GAZI SEED Messenger Profile',
    '',
    `নাম: ${profile.name || 'সংরক্ষিত নেই'}`,
    `মোবাইল: ${profile.phone || 'সংরক্ষিত নেই'}`,
    `ঠিকানা: ${profile.address || 'সংরক্ষিত নেই'}`,
    `মোট Messenger orders: ${profile.total_orders}`,
    `মোট order value: ${currency(country)}${totalSpent.toFixed(0)}`,
    `সর্বশেষ Order: ${profile.last_order_number || 'নেই'}`,
    orderNumbers.length
      ? `Recent Order Numbers: ${orderNumbers.slice(0, 5).join(', ')}`
      : 'Recent Order Numbers: নেই',
  ].join('\n');
}

export function formatMessengerOrderHistory(
  orders: MessengerHistoryOrder[],
  items: MessengerHistoryItem[],
  country: MessengerCustomerCountry,
): string {
  if (!orders.length) {
    return '📦 আপনার Messenger account-এর সাথে কোনো previous order পাওয়া যায়নি।';
  }

  const itemMap = new Map<string, MessengerHistoryItem[]>();
  for (const item of items) {
    const current = itemMap.get(item.order_id) || [];
    current.push(item);
    itemMap.set(item.order_id, current);
  }

  const blocks = orders.map((order) => {
    const orderItems = itemMap.get(order.id) || [];
    const itemText = orderItems.length
      ? orderItems
          .map(
            (item) =>
              `  • ${item.product_name} × ${item.quantity} = ${currency(country)}${Number(item.total_price || 0).toFixed(0)}`,
          )
          .join('\n')
      : '  • Product details পাওয়া যায়নি';

    return [
      `📦 ${order.order_number}`,
      `Status: ${statusLabel(order.order_status || order.status)}`,
      `Payment: ${order.payment_status || 'unknown'}`,
      `Total: ${currency(country)}${Number(order.final_amount || 0).toFixed(0)}`,
      `Date: ${formatDate(order.created_at)}`,
      itemText,
    ].join('\n');
  });

  return [
    '📚 আপনার Previous Messenger Orders',
    '',
    blocks.join('\n\n'),
    '',
    'কোনো নির্দিষ্ট order-এর live status জানতে Order Number লিখুন।',
  ].join('\n');
}

async function getProfile(
  supabase: SupabaseClient,
  pageId: string,
  externalUserId: string,
  country: MessengerCustomerCountry,
) {
  const { data, error } = await supabase
    .from('messenger_customer_profiles')
    .select(
      'id,name,phone,address,total_orders,total_spent,last_order_number,order_numbers',
    )
    .eq('page_id', pageId)
    .eq('external_user_id', externalUserId)
    .eq('country_code', country)
    .maybeSingle();

  if (error) throw error;
  return (data || null) as MessengerCustomerProfile | null;
}

export type MessengerOrderCustomerProfile = {
  name: string | null;
  phone: string | null;
  address: string | null;
};

export async function getMessengerOrderCustomerProfile(args: {
  supabase: SupabaseClient;
  pageId: string;
  externalUserId: string;
  country: MessengerCustomerCountry;
}): Promise<MessengerOrderCustomerProfile | null> {
  const profile = await getProfile(
    args.supabase,
    args.pageId,
    args.externalUserId,
    args.country,
  );

  if (!profile) return null;

  return {
    name: profile.name,
    phone: profile.phone,
    address: profile.address,
  };
}

async function verifyAndLinkByOrder(
  supabase: SupabaseClient,
  args: {
    pageId: string;
    externalUserId: string;
    country: MessengerCustomerCountry;
    text: string;
  },
) {
  const orderNumber = parseOrderNumber(args.text);
  const phone = extractMessengerPhone(args.text);

  if (!orderNumber || !phone) return null;

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(
      'id,order_number,customer_name,customer_phone,delivery_address,final_amount,country_code,order_source,created_at',
    )
    .eq('order_number', orderNumber)
    .eq('country_code', args.country)
    .eq('order_source', 'facebook_messenger_ai')
    .eq('customer_phone', phone)
    .maybeSingle();

  if (orderError) throw orderError;
  if (!order) return null;

  await upsertMessengerCustomerProfile({
    supabase,
    pageId: args.pageId,
    externalUserId: args.externalUserId,
    country: args.country,
    name: order.customer_name,
    phone: order.customer_phone,
    address: order.delivery_address,
    orderId: order.id,
    orderNumber: order.order_number,
  });

  return order;
}

export async function getMessengerCustomerProfileReply(args: {
  supabase: SupabaseClient;
  pageId: string;
  externalUserId: string;
  country: MessengerCustomerCountry;
  text: string;
}): Promise<{ reply: string; linked: boolean }> {
  let profile = await getProfile(
    args.supabase,
    args.pageId,
    args.externalUserId,
    args.country,
  );

  if (!profile) {
    const linked = await verifyAndLinkByOrder(args.supabase, args);
    if (linked) {
      profile = await getProfile(
        args.supabase,
        args.pageId,
        args.externalUserId,
        args.country,
      );
    }
  }

  if (!profile) {
    return {
      linked: false,
      reply:
        '👤 আপনার Messenger profile এখনো linked নয়।\n\n' +
        'নিরাপত্তার জন্য প্রথমবার profile link করতে আপনার Order Number এবং অর্ডারের সময় দেওয়া mobile number একসাথে লিখুন।\n\n' +
        'উদাহরণ: GS-BD-XXXXXXXX 01XXXXXXXXX',
    };
  }

  return {
    linked: true,
    reply: formatMessengerCustomerProfile(profile, args.country),
  };
}

export async function getMessengerOrderHistoryReply(args: {
  supabase: SupabaseClient;
  pageId: string;
  externalUserId: string;
  country: MessengerCustomerCountry;
  text: string;
}): Promise<{ reply: string; orderIds: string[]; linked: boolean }> {
  let profile = await getProfile(
    args.supabase,
    args.pageId,
    args.externalUserId,
    args.country,
  );

  if (!profile) {
    const linked = await verifyAndLinkByOrder(args.supabase, args);
    if (linked) {
      profile = await getProfile(
        args.supabase,
        args.pageId,
        args.externalUserId,
        args.country,
      );
    }
  }

  const profilePhone =
    profile && typeof profile.phone === 'string'
      ? normalizeMessengerPhone(profile.phone)
      : '';

  if (!profilePhone) {
    return {
      linked: false,
      orderIds: [],
      reply:
        '📚 Previous orders দেখতে আগে Messenger account-এর সাথে একটি order link করতে হবে।\n\n' +
        'Order Number + mobile number দিন। উদাহরণ: GS-BD-XXXXXXXX 01XXXXXXXXX',
    };
  }

  const { data: orders, error: orderError } = await args.supabase
    .from('orders')
    .select(
      'id,order_number,customer_name,status,order_status,payment_status,final_amount,created_at',
    )
    .eq('country_code', args.country)
    .eq('order_source', 'facebook_messenger_ai')
    .eq('customer_phone', profilePhone)
    .order('created_at', { ascending: false })
    .limit(5);

  if (orderError) throw orderError;

  const rows = (orders || []) as MessengerHistoryOrder[];
  if (!rows.length) {
    return {
      linked: true,
      orderIds: [],
      reply: '📦 আপনার Messenger profile linked আছে, কিন্তু কোনো previous Messenger order পাওয়া যায়নি।',
    };
  }

  const orderIds = rows.map((order) => order.id);
  const { data: itemRows, error: itemError } = await args.supabase
    .from('order_items')
    .select('order_id,product_name,quantity,unit_price,total_price')
    .in('order_id', orderIds);

  if (itemError) throw itemError;

  const items = (itemRows || []) as MessengerHistoryItem[];

  return {
    linked: true,
    orderIds,
    reply: formatMessengerOrderHistory(rows, items, args.country),
  };
}

export async function upsertMessengerCustomerProfile(args: {
  supabase: SupabaseClient;
  pageId: string;
  externalUserId: string;
  country: MessengerCustomerCountry;
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  orderId?: string | null;
  orderNumber?: string | null;
}) {
  const phone = args.phone ? normalizeMessengerPhone(args.phone) : null;

  let orderRows: Array<{
    id: string;
    order_number: string;
    customer_name: string;
    customer_phone: string;
    delivery_address: string | null;
    final_amount: number | string | null;
    created_at: string | null;
  }> = [];

  if (phone) {
    const { data, error } = await args.supabase
      .from('orders')
      .select(
        'id,order_number,customer_name,customer_phone,delivery_address,final_amount,created_at',
      )
      .eq('country_code', args.country)
      .eq('order_source', 'facebook_messenger_ai')
      .eq('customer_phone', phone)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    orderRows = (data || []) as typeof orderRows;
  }

  const latestOrder =
    args.orderId
      ? orderRows.find((order) => order.id === args.orderId)
      : orderRows[0];

  const orderNumbers = orderRows
    .map((order) => order.order_number)
    .filter(Boolean)
    .slice(0, 20);

  const { error } = await args.supabase
    .from('messenger_customer_profiles')
    .upsert(
      {
        page_id: args.pageId,
        external_user_id: args.externalUserId,
        country_code: args.country,
        name: args.name || latestOrder?.customer_name || null,
        phone: phone || latestOrder?.customer_phone || null,
        address: args.address || latestOrder?.delivery_address || null,
        total_orders: orderRows.length,
        total_spent: orderRows.reduce(
          (sum, order) => sum + Number(order.final_amount || 0),
          0,
        ),
        last_order_id: latestOrder?.id || null,
        last_order_number: latestOrder?.order_number || null,
        order_numbers: orderNumbers,
      },
      { onConflict: 'page_id,external_user_id,country_code' },
    );

  if (error) throw error;
}
