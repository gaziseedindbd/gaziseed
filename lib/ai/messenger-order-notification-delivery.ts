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
  status: 'pending' | 'sending' | 'sent' | 'failed';
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
  order_source: string | null;
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
  orderId?: string,
): Promise<{
  scanned: number;
  notified: number;
  skipped: number;
  failed: number;
}> {
  const supabase = adminSupabase();
  const safeLimit = Math.max(1, Math.min(limit, 100));

  const staleSendingBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  let recoveryQuery = supabase
    .from('messenger_order_notifications')
    .update({ status: 'pending', updated_at: new Date().toISOString() })
    .eq('status', 'sending')
    .lt('updated_at', staleSendingBefore);
  if (orderId) recoveryQuery = recoveryQuery.eq('order_id', orderId);
  const { error: recoveryError } = await recoveryQuery;
  if (recoveryError) throw recoveryError;

  let queueQuery = supabase
    .from('messenger_order_notifications')
    .select(
      'id,order_id,country_code,event_type,phone,page_id,external_user_id,status,attempts,last_error',
    )
    .eq('status', 'pending')
    .eq('event_type', 'order_confirmed');
  if (orderId) queueQuery = queueQuery.eq('order_id', orderId);
  const { data, error } = await queueQuery.limit(safeLimit);

  if (error) throw error;

  const notifications = (data || []) as OrderNotification[];
  let notified = 0;
  let skipped = 0;
  let failed = 0;

  for (const notification of notifications) {
    const claimedAt = new Date().toISOString();
    const { data: claim, error: claimError } = await supabase
      .from('messenger_order_notifications')
      .update({
        status: 'sending',
        attempts: Number(notification.attempts || 0) + 1,
        updated_at: claimedAt,
      })
      .eq('id', notification.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (claimError) {
      console.error('Messenger order notification claim failed:', claimError);
      failed += 1;
      continue;
    }
    if (!claim) continue;

    const releaseClaim = async (lastError: string | null = null) => {
      await supabase
        .from('messenger_order_notifications')
        .update({ status: 'pending', last_error: lastError, updated_at: new Date().toISOString() })
        .eq('id', notification.id)
        .eq('status', 'sending');
    };

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(
        'id,order_number,customer_name,customer_phone,grand_total,final_amount,total_amount,payment_method,payment_status,order_status,status,country_code,order_source',
      )
      .eq('id', notification.order_id)
      .maybeSingle();

    if (orderError) {
      await releaseClaim('Order lookup failed');
      console.error('Messenger order notification order lookup failed:', orderError);
      failed += 1;
      continue;
    }

    const order = orderData as OrderRow | null;

    if (!order) {
      await releaseClaim('Order not found');
      skipped += 1;
      continue;
    }

    const effectiveStatus = String(order.order_status || order.status || '').toLowerCase();

    if (
      order.order_number === '' ||
      effectiveStatus === 'cancelled' ||
      effectiveStatus === 'rejected'
    ) {
      await releaseClaim('Order is cancelled or missing order number');
      skipped += 1;
      continue;
    }

    if (
      order.country_code === 'IN' &&
      !['paid', 'partially_paid'].includes(
        String(order.payment_status || '').toLowerCase(),
      )
    ) {
      await releaseClaim('Payment is not confirmed');
      skipped += 1;
      continue;
    }

    const phone = String(order.customer_phone || notification.phone || '').trim();

    let recipient = notification.external_user_id && notification.page_id
      ? { page_id: notification.page_id, external_user_id: notification.external_user_id }
      : null;

    // India Messenger COD orders are created only after Cashfree returns. Use the
    // payment intent's Cashfree ID to find the exact conversation that opened checkout.
    if (!recipient && order.country_code === 'IN' && order.order_source === 'facebook_messenger_ai') {
      const { data: intent, error: intentError } = await supabase
        .from('cashfree_payment_intents')
        .select('cashfree_order_id,metadata')
        .eq('completed_order_id', order.id)
        .eq('country_code', 'IN')
        .maybeSingle();
      if (intentError) {
        await releaseClaim('Payment intent lookup failed');
        console.error('Messenger order notification payment lookup failed:', intentError);
        failed += 1;
        continue;
      }
      const cashfreeOrderId = typeof intent?.cashfree_order_id === 'string'
        ? intent.cashfree_order_id
        : '';
      if (cashfreeOrderId && intent?.metadata?.order_source === 'facebook_messenger_ai') {
        let conversationQuery = supabase
          .from('ai_conversations')
          .select('page_id,external_user_id')
          .eq('channel', 'facebook_messenger')
          .eq('country_code', 'IN')
          .eq('metadata->messenger_payment->>cashfree_order_id', cashfreeOrderId);
        const expectedPageId = process.env.META_PAGE_ID;
        if (expectedPageId) conversationQuery = conversationQuery.eq('page_id', expectedPageId);
        const { data: conversations, error: conversationError } = await conversationQuery.limit(2);
        if (conversationError) {
          await releaseClaim('Messenger conversation lookup failed');
          console.error('Messenger order notification conversation lookup failed:', conversationError);
          failed += 1;
          continue;
        }
        if (conversations?.length === 1 && conversations[0]?.page_id && conversations[0]?.external_user_id) {
          recipient = {
            page_id: conversations[0].page_id,
            external_user_id: conversations[0].external_user_id,
          };
        }
      }
    }

    const phone = String(order.customer_phone || notification.phone || '').trim();
    if (!recipient && phone) {
      const { data: profiles, error: profileError } = await supabase
        .from('messenger_customer_profiles')
        .select('page_id,external_user_id')
        .eq('phone', phone)
        .eq('country_code', order.country_code)
        .limit(2);

      if (profileError) {
        await releaseClaim('Customer profile lookup failed');
        console.error('Messenger order notification profile lookup failed:', profileError);
        failed += 1;
        continue;
      }

      if (profiles?.length === 1 && profiles[0]?.external_user_id && profiles[0]?.page_id) {
        recipient = {
          page_id: profiles[0].page_id,
          external_user_id: profiles[0].external_user_id,
        };
      }
    }

    if (!recipient) {
      await releaseClaim('No unique Messenger recipient found');
      skipped += 1;
      continue;
    }

    try {
      await sendMessengerText(
        recipient.external_user_id,
        buildMessage(order),
      );

      const { error: updateError } = await supabase
        .from('messenger_order_notifications')
        .update({
          page_id: recipient.page_id,
          external_user_id: recipient.external_user_id,
          status: 'sent',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_error: null,
          attempts: Number(notification.attempts || 0) + 1,
        })
        .eq('id', notification.id)
        .eq('status', 'sending');

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
          last_error: message.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq('id', notification.id)
        .eq('status', 'sending');

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
