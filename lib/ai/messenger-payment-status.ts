import { detectMessengerReplyLanguage, type MessengerReplyLanguage } from './messenger-language';

import type { SupabaseClient } from '@supabase/supabase-js';
import { extractMessengerPhone, normalizeMessengerPhone } from './messenger-phone';

export type MessengerPaymentStatusCountry = 'IN' | 'BD';

const ORDER_FIELDS =
  'id,order_number,customer_phone,payment_status,payment_method,payment_advance_amount,payment_due_amount,final_amount,country_code,created_at';

function parseOrderNumber(text: string): string | null {
  const match = text.toUpperCase().match(/\bGS-(?:IN|BD)-[A-Z0-9]{8}\b/);
  return match?.[0] || null;
}

function parseCashfreeOrderId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return /^GS-CF-[0-9a-f-]{36}$/i.test(normalized) ? normalized : null;
}

function currency(country: MessengerPaymentStatusCountry) {
  return country === 'IN' ? '₹' : '৳';
}

export function isMessengerPaymentRetryableStatus(status: unknown): boolean {
  const key = typeof status === 'string' ? status.toLowerCase() : '';
  return ['created', 'pending', 'failed', 'cancelled', 'canceled', 'expired'].includes(key);
}

function getMessengerPaymentRetryUrl(cashfreeOrderId: string | null): string | null {
  if (!cashfreeOrderId) return null;
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || 'https://www.gaziseed.com'
  ).replace(/\/$/, '');
  return siteUrl + '/messenger-payment?order_id=' + encodeURIComponent(cashfreeOrderId);
}

export function formatMessengerPaymentIntentStatus(
  status: unknown,
  language: MessengerReplyLanguage = 'Bengali',
): string {
  const key = typeof status === 'string' ? status.toLowerCase() : '';

  const labels =
    language === 'English'
      ? {
          completed: '✅ Advance payment completed successfully',
          processing: '⏳ Advance payment is being verified',
          created: '🕒 Advance payment has not been completed yet',
          pending: '🕒 Advance payment is still pending',
          failed: '❌ Advance payment failed',
          cancelled: '❌ Advance payment was cancelled',
          canceled: '❌ Advance payment was cancelled',
          expired: '❌ Advance payment session expired',
        }
      : language === 'Hindi'
        ? {
            completed: '✅ अग्रिम भुगतान सफलतापूर्वक पूरा हो गया है',
            processing: '⏳ अग्रिम भुगतान सत्यापित किया जा रहा है',
            created: '🕒 अग्रिम भुगतान अभी पूरा नहीं हुआ है',
            pending: '🕒 अग्रिम भुगतान अभी लंबित है',
            failed: '❌ अग्रिम भुगतान विफल हुआ',
            cancelled: '❌ अग्रिम भुगतान रद्द किया गया',
            canceled: '❌ अग्रिम भुगतान रद्द किया गया',
            expired: '❌ अग्रिम भुगतान सत्र समाप्त हो गया',
          }
        : {
            completed: '✅ অগ্রিম payment সফলভাবে সম্পন্ন হয়েছে',
            processing: '⏳ অগ্রিম payment যাচাই হচ্ছে',
            created: '🕒 অগ্রিম payment এখনো সম্পন্ন হয়নি',
            pending: '🕒 অগ্রিম payment এখনো pending',
            failed: '❌ অগ্রিম payment failed হয়েছে',
            cancelled: '❌ অগ্রিম payment বাতিল হয়েছে',
            canceled: '❌ অগ্রিম payment বাতিল হয়েছে',
            expired: '❌ অগ্রিম payment session expired হয়েছে',
          };

  const fallback =
    language === 'English'
      ? 'ℹ️ The current advance payment status could not be confirmed.'
      : language === 'Hindi'
        ? 'ℹ️ वर्तमान अग्रिम भुगतान स्थिति की पुष्टि नहीं हो सकी।'
        : 'ℹ️ অগ্রিম payment-এর বর্তমান status নিশ্চিতভাবে পাওয়া যায়নি';

  return labels[key as keyof typeof labels] || fallback;
}

function formatOrderPaymentStatus(
  order: Record<string, unknown>,
  paymentIntentStatus: unknown,
  country: MessengerPaymentStatusCountry,
  language: MessengerReplyLanguage,
): string {
  const paymentMethod =
    typeof order.payment_method === 'string' ? order.payment_method.toLowerCase() : '';
  const paymentStatus =
    typeof order.payment_status === 'string' ? order.payment_status.toLowerCase() : '';

  const isEnglish = language === 'English';
  const isHindi = language === 'Hindi';

  if (paymentIntentStatus) {
    const intentReply = formatMessengerPaymentIntentStatus(paymentIntentStatus, language);
    const advance = Number(order.payment_advance_amount || 0);
    const due = Number(order.payment_due_amount || 0);
    const lines = [
      isEnglish
        ? '💳 Your payment status'
        : isHindi
          ? '💳 आपका payment status'
          : '💳 আপনার payment status',
      '',
      `Order: ${String(order.order_number || 'Unknown')}`,
      intentReply,
    ];

    if (advance > 0) {
      lines.push(
        isEnglish
          ? `Advance: ${currency(country)}${advance.toFixed(0)}`
          : isHindi
            ? `Advance: ${currency(country)}${advance.toFixed(0)}`
            : `Advance: ${currency(country)}${advance.toFixed(0)}`,
      );
    }

    if (due > 0) {
      lines.push(
        isEnglish
          ? `Due at delivery: ${currency(country)}${due.toFixed(0)}`
          : isHindi
            ? `डिलीवरी के समय बाकी: ${currency(country)}${due.toFixed(0)}`
            : `Delivery-এর সময় বাকি: ${currency(country)}${due.toFixed(0)}`,
      );
    }

    lines.push(
      '',
      isEnglish
        ? 'Type “order status” to check the order status.'
        : isHindi
          ? 'Order status देखने के लिए “order status” लिखें।'
          : 'Order status জানতে “order status” লিখুন।',
    );
    return lines.join('\n');
  }

  if (paymentMethod === 'cod' && paymentStatus !== 'paid') {
    const due = Number(order.payment_due_amount || order.final_amount || 0);
    return [
      isEnglish
        ? '💳 Your payment status'
        : isHindi
          ? '💳 आपका payment status'
          : '💳 আপনার payment status',
      '',
      `Order: ${String(order.order_number || 'Unknown')}`,
      '✅ Payment method: Cash on Delivery (COD)',
      isEnglish
        ? '💰 Payment is due at delivery.'
        : isHindi
          ? '💰 भुगतान डिलीवरी के समय करना है।'
          : '💰 Delivery-এর সময় payment করতে হবে।',
      `Due: ${currency(country)}${due.toFixed(0)}`,
      '',
      isEnglish
        ? 'Type “order status” to check the order status.'
        : isHindi
          ? 'Order status देखने के लिए “order status” लिखें।'
          : 'Order status জানতে “order status” লিখুন।',
    ].join('\n');
  }

  return [
    isEnglish
      ? '💳 Your payment status'
      : isHindi
        ? '💳 आपका payment status'
        : '💳 আপনার payment status',
    '',
    `Order: ${String(order.order_number || 'Unknown')}`,
    `Payment: ${paymentStatus || 'unknown'}`,
    `Total: ${currency(country)}${Number(order.final_amount || 0).toFixed(0)}`,
    '',
    isEnglish
      ? 'Type “order status” to check the order status.'
      : isHindi
        ? 'Order status देखने के लिए “order status” लिखें।'
        : 'Order status জানতে “order status” লিখুন।',
  ].join('\n');
}

export async function getMessengerPaymentStatusReply(args: {
  supabase: SupabaseClient;
  pageId: string;
  externalUserId: string;
  country: MessengerPaymentStatusCountry;
  text: string;
  language?: MessengerReplyLanguage;
  metadata?: Record<string, unknown> | null;
}): Promise<{
  handled: boolean;
  reply: string;
  orderIds?: string[];
  cashfreeOrderId?: string | null;
  paymentRetryButton?: { title: string; url: string };
}> {
  const replyLanguage = args.language || detectMessengerReplyLanguage(args.text);
  const requestedOrderNumber = parseOrderNumber(args.text);
  const metadataPayment = args.metadata?.messenger_payment;
  const metadataPaymentCountry =
    metadataPayment && typeof metadataPayment === 'object'
      ? (metadataPayment as Record<string, unknown>).country
      : null;
  const cashfreeOrderId =
    (metadataPaymentCountry === args.country || !metadataPaymentCountry)
      ? parseCashfreeOrderId(
          metadataPayment && typeof metadataPayment === 'object'
            ? (metadataPayment as Record<string, unknown>).cashfree_order_id
            : null,
        )
      : null;

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
      ? normalizeMessengerPhone(profile.phone)
      : '';
  const requestedPhone = extractMessengerPhone(args.text) || '';

  if (profilePhone && requestedPhone && profilePhone !== requestedPhone) {
    return {
      handled: true,
      reply:
        replyLanguage === 'English'
          ? 'For security, please use the mobile number already linked to this Messenger account.'
          : 'নিরাপত্তার জন্য এই Messenger account-এর সাথে আগে linked mobile number-টাই ব্যবহার করুন।',
      cashfreeOrderId,
    };
  }

  const phone = profilePhone || requestedPhone;

  if (cashfreeOrderId) {
    const { data: intent, error: intentError } = await args.supabase
      .from('cashfree_payment_intents')
      .select('id,cashfree_order_id,status,completed_order_id,updated_at')
      .eq('cashfree_order_id', cashfreeOrderId)
      .maybeSingle();

    if (intentError) throw intentError;

    if (intent) {
      const completedOrderId =
        typeof intent.completed_order_id === 'string' ? intent.completed_order_id : '';

      if (completedOrderId) {
        const { data: linkedOrder, error: linkedOrderError } = await args.supabase
          .from('orders')
          .select(ORDER_FIELDS)
          .eq('id', completedOrderId)
          .eq('country_code', args.country)
          .eq('order_source', 'facebook_messenger_ai')
          .maybeSingle();

        if (linkedOrderError) throw linkedOrderError;
        if (linkedOrder) {
          const retryUrl = isMessengerPaymentRetryableStatus(intent.status)
            ? getMessengerPaymentRetryUrl(cashfreeOrderId)
            : null;
          return {
            handled: true,
            reply: formatOrderPaymentStatus(
              linkedOrder as Record<string, unknown>,
              intent.status,
              args.country,
              replyLanguage,
            ),
            orderIds: [String(linkedOrder.id)],
            cashfreeOrderId,
            ...(retryUrl
              ? { paymentRetryButton: { title: '🔄 Retry Payment', url: retryUrl } }
              : {}),
          };
        }
      }

      const retryUrl = isMessengerPaymentRetryableStatus(intent.status)
        ? getMessengerPaymentRetryUrl(cashfreeOrderId)
        : null;
      return {
        handled: true,
        reply:
          (replyLanguage === 'English'
            ? '💳 Your payment status\n\n'
            : '💳 আপনার payment status\n\n') +
          formatMessengerPaymentIntentStatus(intent.status, replyLanguage) +
          (replyLanguage === 'English'
            ? '\n\nAfter completing payment, type “payment status” again in the same Messenger.'
            : '\n\nPayment complete হলে একই Messenger-এ “payment status” আবার লিখতে পারেন।'),
        cashfreeOrderId,
        ...(retryUrl
          ? { paymentRetryButton: { title: '🔄 Retry Payment', url: retryUrl } }
          : {}),
      };
    }
  }

  if (!phone) {
    return {
      handled: true,
      reply:
        replyLanguage === 'English'
          ? 'Your linked mobile number will be used to find the payment status. For a specific order, provide the Order Number (for example, GS-IN-XXXXXXXX) and the mobile number used when placing the order.'
          : 'Payment status দেখতে আপনার linked mobile number ব্যবহার করা হবে। নির্দিষ্ট order-এর জন্য Order Number (যেমন GS-IN-XXXXXXXX) এবং অর্ডারের সময় দেওয়া mobile number লিখুন।',
      cashfreeOrderId,
    };
  }

  if (!requestedOrderNumber && !profilePhone) {
    return {
      handled: true,
      reply:
        replyLanguage === 'English'
          ? 'For security, on the first payment-status check, provide the Order Number (for example, GS-IN-XXXXXXXX) together with the mobile number used for the order.'
          : 'নিরাপত্তার জন্য প্রথমবার payment status দেখতে Order Number (যেমন GS-IN-XXXXXXXX) এবং অর্ডারের সময় দেওয়া mobile number একসাথে লিখুন।',
      cashfreeOrderId,
    };
  }

  let ordersQuery = args.supabase
    .from('orders')
    .select(ORDER_FIELDS)
    .eq('country_code', args.country)
    .eq('order_source', 'facebook_messenger_ai')
    .eq('customer_phone', phone);

  ordersQuery = requestedOrderNumber
    ? ordersQuery.eq('order_number', requestedOrderNumber).limit(1)
    : ordersQuery.order('created_at', { ascending: false }).limit(1);

  const { data: orders, error: ordersError } = await ordersQuery;
  if (ordersError) throw ordersError;

  const order = (orders || [])[0] as Record<string, unknown> | undefined;

  if (!order) {
    return {
      handled: true,
      reply: requestedOrderNumber
        ? replyLanguage === 'English'
          ? 'No Messenger order was found for this Order Number and mobile number.'
          : replyLanguage === 'Hindi'
            ? 'इस Order Number और mobile number से कोई Messenger order नहीं मिला।'
            : 'এই Order Number এবং mobile number-এর সাথে কোনো Messenger order পাওয়া যায়নি।'
        : replyLanguage === 'English'
          ? 'No Messenger order was found for your linked mobile number.'
          : replyLanguage === 'Hindi'
            ? 'आपके linked mobile number से कोई Messenger order नहीं मिला।'
            : 'আপনার linked mobile number-এর সাথে কোনো Messenger order পাওয়া যায়নি।',
      cashfreeOrderId,
    };
  }

  let paymentIntentStatus: unknown = null;

  const { data: intent, error: intentError } = await args.supabase
    .from('cashfree_payment_intents')
    .select('status,cashfree_order_id')
    .eq('completed_order_id', String(order.id))
    .maybeSingle();

  if (intentError) throw intentError;
  if (intent) paymentIntentStatus = intent.status;

  const resolvedCashfreeOrderId = intent?.cashfree_order_id || cashfreeOrderId;
  const retryUrl = isMessengerPaymentRetryableStatus(paymentIntentStatus)
    ? getMessengerPaymentRetryUrl(resolvedCashfreeOrderId)
    : null;

  return {
    handled: true,
    reply: formatOrderPaymentStatus(
      order,
      paymentIntentStatus,
      args.country,
      replyLanguage,
    ),
    orderIds: [String(order.id)],
    cashfreeOrderId: resolvedCashfreeOrderId,
    ...(retryUrl
      ? { paymentRetryButton: { title: '🔄 Retry Payment', url: retryUrl } }
      : {}),
  };
}
