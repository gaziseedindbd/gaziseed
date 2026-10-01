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
  status: 'pending' | 'sent' | 'failed';
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
        'id,order_number,customer_name,customer_phone,country_code,order_status,status,payment_status',
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

    const phone = String(
      order.customer_phone || notification.phone || '',
    ).trim();

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
      console.error(
        'Messenger order status notification profile lookup failed:',
        profileError,
      );
      failed += 1;
      continue;
    }

    if (
      !profiles ||
      profiles.length !== 1 ||
      !profiles[0]?.external_user_id
    ) {
      skipped += 1;
      continue;
    }

    try {
      const sendResult = await sendMessengerText(
        profiles[0].external_user_id,
        buildStatusMessage(order, notification),
      );

      console.info(
        'Messenger order status notification sent:',
        JSON.stringify({
          notificationId: notification.id,
          orderNumber: order.order_number,
          newStatus: notification.new_status,
          recipientId: profiles[0].external_user_id,
          metaMessageId: sendResult.messageId,
        }),
      );

      const { error: updateError } = await supabase
        .from('messenger_order_status_notifications')
        .update({
          page_id: profiles[0].page_id ?? null,
          external_user_id: profiles[0].external_user_id,
          meta_message_id: sendResult.messageId,
          status: 'sent',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_error: null,
          attempts: Number(notification.attempts || 0) + 1,
        })
        .eq('id', notification.id)
        .eq('status', 'pending');

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
          attempts: Number(notification.attempts || 0) + 1,
          last_error: message.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq('id', notification.id)
        .eq('status', 'pending');

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
