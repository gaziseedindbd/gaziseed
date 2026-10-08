import { createClient } from '@supabase/supabase-js';

type CountryCode = 'IN' | 'BD';

type StatusNotification = {
  id: string;
  order_id: string;
  country_code: CountryCode;
  event_type: 'order_status_changed';
  old_status: string | null;
  new_status: string;
  phone: string;
  page_id: string | null;
  external_user_id: string | null;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  attempts: number;
  last_error: string | null;
  meta_message_id: string | null;
};

type OrderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  country_code: CountryCode;
  order_status: string | null;
  status: string | null;
  payment_status: string | null;
  order_source: string | null;
};

type MessengerSendResult = {
  messageId: string;
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

const STATUS_LABELS: Record<string, { bn: string; emoji: string }> = {
  pending: { bn: 'অর্ডার গ্রহণ করা হয়েছে', emoji: '📦' },
  processing: { bn: 'অর্ডার প্রস্তুত করা হচ্ছে', emoji: '⚙️' },
  packed: { bn: 'অর্ডার প্যাক করা হয়েছে', emoji: '📦' },
  shipped: { bn: 'অর্ডার পাঠানো হয়েছে', emoji: '🚚' },
  delivered: { bn: 'অর্ডার ডেলিভারি সম্পন্ন হয়েছে', emoji: '✅' },
  cancelled: { bn: 'অর্ডার বাতিল করা হয়েছে', emoji: '❌' },
  rejected: { bn: 'অর্ডার বাতিল করা হয়েছে', emoji: '❌' },
};

function buildStatusMessage(
  order: OrderRow,
  notification: StatusNotification,
): string {
  const label =
    STATUS_LABELS[notification.new_status]?.bn ||
    notification.new_status;

  const emoji =
    STATUS_LABELS[notification.new_status]?.emoji ||
    '🔔';

  return (
    emoji + ' আপনার GAZI SEED অর্ডারের status update হয়েছে।\n\n' +
    '🧾 Order: ' + order.order_number + '\n' +
    '📌 বর্তমান status: ' + label + '\n\n' +
    'Status পরিবর্তন হলে এই Messenger-এ আপনাকে আবার জানানো হবে।'
  );
}

async function sendMessengerText(
  recipientId: string,
  text: string,
): Promise<MessengerSendResult> {
  const token = process.env.META_PAGE_ACCESS_TOKEN || '';
  const graphVersion = process.env.META_GRAPH_VERSION || 'v26.0';

  if (!token) {
    throw new Error('META_PAGE_ACCESS_TOKEN is not configured');
  }

  const response = await fetch(
    'https://graph.facebook.com/' + graphVersion + '/me/messages',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: text.slice(0, 2000) },
      }),
    },
  );

  const responseBody = await response.text();

  if (!response.ok) {
    throw new Error(
      'Meta Send API error: ' +
        response.status +
        ' ' +
        responseBody.slice(0, 500),
    );
  }

  let payload: { message_id?: string } = {};
  try {
    payload = JSON.parse(responseBody) as { message_id?: string };
  } catch {
    throw new Error(
      'Meta Send API returned a non-JSON success response: ' +
        responseBody.slice(0, 500),
    );
  }

  const messageId = String(payload.message_id || '').trim();

  if (!messageId) {
    throw new Error(
      'Meta Send API returned success without message_id: ' +
        responseBody.slice(0, 500),
    );
  }

  return { messageId };
}

export async function processMessengerOrderStatusNotifications(
  limit = 50,
): Promise<{
  scanned: number;
  notified: number;
  skipped: number;
  failed: number;
}> {
  const supabase = adminSupabase();
  const safeLimit = Math.max(1, Math.min(limit, 100));

  const staleSendingBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { error: recoveryError } = await supabase
    .from('messenger_order_status_notifications')
    .update({ status: 'pending', updated_at: new Date().toISOString() })
    .eq('status', 'sending')
    .lt('updated_at', staleSendingBefore);

  if (recoveryError) throw recoveryError;

  const { data, error } = await supabase
    .from('messenger_order_status_notifications')
    .select(
      'id,order_id,country_code,event_type,old_status,new_status,phone,page_id,external_user_id,status,attempts,last_error,meta_message_id',
    )
    .eq('status', 'pending')
    .eq('event_type', 'order_status_changed')
    .limit(safeLimit);

  if (error) throw error;

  const notifications = (data || []) as StatusNotification[];
  let notified = 0;
  let skipped = 0;
  let failed = 0;

  for (const notification of notifications) {
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(
        'id,order_number,customer_name,customer_phone,country_code,order_status,status,payment_status,order_source',
      )
      .eq('id', notification.order_id)
      .maybeSingle();

    if (orderError) {
      console.error(
        'Messenger order status notification order lookup failed:',
        orderError,
      );
      failed += 1;
      continue;
    }

    const order = orderData as OrderRow | null;

    if (!order || !order.order_number) {
      skipped += 1;
      continue;
    }

    const { data: claim, error: claimError } = await supabase
      .from('messenger_order_status_notifications')
      .update({
        status: 'sending',
        attempts: Number(notification.attempts || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', notification.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (claimError) {
      console.error('Messenger order status notification claim failed:', claimError);
      failed += 1;
      continue;
    }

    if (!claim) continue;

    const releaseClaim = async (lastError: string | null = null) => {
      await supabase
        .from('messenger_order_status_notifications')
        .update({
          status: 'pending',
          last_error: lastError,
          updated_at: new Date().toISOString(),
        })
        .eq('id', notification.id)
        .eq('status', 'sending');
    };

    let recipient = notification.page_id && notification.external_user_id
      ? { page_id: notification.page_id, external_user_id: notification.external_user_id }
      : null;

    if (
      !recipient &&
      order.country_code === 'IN' &&
      order.order_source === 'facebook_messenger_ai'
    ) {
      const { data: intent, error: intentError } = await supabase
        .from('cashfree_payment_intents')
        .select('cashfree_order_id,metadata')
        .eq('completed_order_id', order.id)
        .eq('country_code', 'IN')
        .maybeSingle();

      if (intentError) {
        await releaseClaim('Payment intent lookup failed');
        console.error('Messenger order status payment lookup failed:', intentError);
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
          console.error('Messenger order status conversation lookup failed:', conversationError);
          failed += 1;
          continue;
        }

        if (
          conversations?.length === 1 &&
          conversations[0]?.page_id &&
          conversations[0]?.external_user_id
        ) {
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
        console.error(
          'Messenger order status notification profile lookup failed:',
          profileError,
        );
        failed += 1;
        continue;
      }

      if (
        profiles?.length === 1 &&
        profiles[0]?.page_id &&
        profiles[0]?.external_user_id
      ) {
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
      const sendResult = await sendMessengerText(
        recipient.external_user_id,
        buildStatusMessage(order, notification),
      );

      console.info(
        'Messenger order status notification sent:',
        JSON.stringify({
          notificationId: notification.id,
          orderNumber: order.order_number,
          newStatus: notification.new_status,
          recipientId: recipient.external_user_id,
          metaMessageId: sendResult.messageId,
        }),
      );

      const { error: updateError } = await supabase
        .from('messenger_order_status_notifications')
        .update({
          page_id: recipient.page_id,
          external_user_id: recipient.external_user_id,
          meta_message_id: sendResult.messageId,
          status: 'sent',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_error: null,
          attempts: Number(notification.attempts || 0) + 1,
        })
        .eq('id', notification.id)
        .eq('status', 'sending');

      if (updateError) {
        console.error(
          'Messenger order status notification update failed:',
          updateError,
        );
        failed += 1;
        continue;
      }

      notified += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await supabase
        .from('messenger_order_status_notifications')
        .update({
          status: 'pending',
          last_error: message.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq('id', notification.id)
        .eq('status', 'sending');

      console.error(
        'Messenger order status notification delivery failed:',
        error,
      );
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
