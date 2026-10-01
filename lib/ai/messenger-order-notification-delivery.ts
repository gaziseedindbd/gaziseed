import { createClient } from '@supabase/supabase-js';

type CountryCode = 'IN' | 'BD';

type OrderNotification = {
  id: string;
  order_id: string;
  country_code: CountryCode;
  event_type: 'order_confirmed';
  phone: string;
  page_id: string | null;
  external_user_id: string | null;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  last_error: string | null;
};

type OrderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  grand_total: number | null;
  final_amount: number | null;
  total_amount: number | null;
  payment_method: string | null;
  payment_status: string | null;
  order_status: string | null;
  status: string | null;
  country_code: CountryCode;
};

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error('Supabase service-role configuration is missing');
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function formatAmount(order: OrderRow): string {
  const amount =
    Number(order.final_amount ?? 0) ||
    Number(order.grand_total ?? 0) ||
    Number(order.total_amount ?? 0);

  return new Intl.NumberFormat(order.country_code === 'IN' ? 'en-IN' : 'bn-BD', {
    maximumFractionDigits: 2,
  }).format(amount);
}

function buildMessage(order: OrderRow): string {
  const currency = order.country_code === 'IN' ? '₹' : '৳';

  if (order.country_code === 'IN') {
    return (
      '✅ আপনার GAZI SEED অর্ডারটি নিশ্চিত হয়েছে।\n\n' +
      `🧾 Order: ${order.order_number}\n` +
      `💰 মোট: ${currency}${formatAmount(order)}\n\n` +
      'আপনার অর্ডারের status পরিবর্তন হলে এই Messenger-এ আপনাকে জানানো হবে।'
    );
  }

  return (
    '✅ আপনার GAZI SEED অর্ডারটি গ্রহণ করা হয়েছে।\n\n' +
    `🧾 Order: ${order.order_number}\n` +
    `💰 মোট: ${currency}${formatAmount(order)}\n\n` +
    'আপনার অর্ডারের status পরিবর্তন হলে এই Messenger-এ আপনাকে জানানো হবে।'
  );
}

async function sendMessengerText(recipientId: string, text: string): Promise<void> {
  const token = process.env.META_PAGE_ACCESS_TOKEN || '';
  const graphVersion = process.env.META_GRAPH_VERSION || 'v26.0';

  if (!token) {
    throw new Error('META_PAGE_ACCESS_TOKEN is not configured');
  }

  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/me/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: text.slice(0, 2000) },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Meta Send API error: ${response.status} ${body.slice(0, 500)}`,
    );
  }
}

export async function processMessengerOrderConfirmationNotifications(
  limit = 50,
): Promise<{
  scanned: number;
  notified: number;
  skipped: number;
  failed: number;
}> {
  const supabase = adminSupabase();
  const safeLimit = Math.max(1, Math.min(limit, 100));

  const { data, error } = await supabase
    .from('messenger_order_notifications')
    .select(
      'id,order_id,country_code,event_type,phone,page_id,external_user_id,status,attempts,last_error',
    )
    .eq('status', 'pending')
    .eq('event_type', 'order_confirmed')
    .limit(safeLimit);

  if (error) throw error;

  const notifications = (data || []) as OrderNotification[];
  let notified = 0;
  let skipped = 0;
  let failed = 0;

  for (const notification of notifications) {
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(
        'id,order_number,customer_name,customer_phone,grand_total,final_amount,total_amount,payment_method,payment_status,order_status,status,country_code',
      )
      .eq('id', notification.order_id)
      .maybeSingle();

    if (orderError) {
      console.error('Messenger order notification order lookup failed:', orderError);
      failed += 1;
      continue;
    }

    const order = orderData as OrderRow | null;

    if (!order) {
      skipped += 1;
      continue;
    }

    const effectiveStatus = String(order.order_status || order.status || '').toLowerCase();

    if (
      order.order_number === '' ||
      effectiveStatus === 'cancelled' ||
      effectiveStatus === 'rejected'
    ) {
      skipped += 1;
      continue;
    }

    if (
      order.country_code === 'IN' &&
      !['paid', 'partially_paid'].includes(
        String(order.payment_status || '').toLowerCase(),
      )
    ) {
      skipped += 1;
      continue;
    }

    const phone = String(order.customer_phone || notification.phone || '').trim();

    if (!phone) {
      skipped += 1;
      continue;
    }

    const { data: profiles, error: profileError } = await supabase
      .from('messenger_customer_profiles')
      .select('page_id,external_user_id')
      .eq('phone', phone)
      .eq('country_code', order.country_code)
      .limit(2);

    if (profileError) {
      console.error('Messenger order notification profile lookup failed:', profileError);
      failed += 1;
      continue;
    }

    if (!profiles || profiles.length !== 1 || !profiles[0]?.external_user_id) {
      skipped += 1;
      continue;
    }

    try {
      await sendMessengerText(
        profiles[0].external_user_id,
        buildMessage(order),
      );

      const { error: updateError } = await supabase
        .from('messenger_order_notifications')
        .update({
          page_id: profiles[0].page_id ?? null,
          external_user_id: profiles[0].external_user_id,
          status: 'sent',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_error: null,
          attempts: Number(notification.attempts || 0) + 1,
        })
        .eq('id', notification.id)
        .eq('status', 'pending');

      if (updateError) {
        console.error('Messenger order notification update failed:', updateError);
        failed += 1;
        continue;
      }

      notified += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await supabase
        .from('messenger_order_notifications')
        .update({
          status: 'pending',
          attempts: Number(notification.attempts || 0) + 1,
          last_error: message.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq('id', notification.id)
        .eq('status', 'pending');

      console.error('Messenger order confirmation delivery failed:', error);
      failed += 1;
    }
  }

  return {
    scanned: notifications.length,
    notified,
    skipped,
    failed,
  };
}
