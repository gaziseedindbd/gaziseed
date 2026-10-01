import { createClient } from '@supabase/supabase-js';

type CountryCode = 'IN' | 'BD';

type PendingRestock = {
  id: string;
  product_id: string | null;
  phone: string | null;
  country_code: CountryCode;
  products:
    | {
        name_bn: string | null;
        name_en: string | null;
        slug: string | null;
        stock: number | null;
      }
    | null;
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

function productName(product: PendingRestock['products']): string {
  return product?.name_bn || product?.name_en || product?.slug || 'পণ্য';
}

function getProductUrl(slug: string | null): string | null {
  if (!slug) return null;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.gaziseed.com';
  return `${baseUrl.replace(/\\/$/, '')}/product/${encodeURIComponent(slug)}`;
}

async function sendMessengerText(
  recipientId: string,
  text: string,
  url?: string | null,
): Promise<void> {
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
        message: {
          text: text.slice(0, 2000),
        },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Meta Send API error: ${response.status} ${body.slice(0, 500)}`);
  }

  if (url) {
    const buttonResponse = await fetch(
      `https://graph.facebook.com/${graphVersion}/me/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: {
            attachment: {
              type: 'template',
              payload: {
                template_type: 'button',
                text: 'পণ্যটি এখন স্টকে আছে। অর্ডার করতে নিচের বাটনে চাপুন।',
                buttons: [
                  {
                    type: 'web_url',
                    title: 'View Product',
                    url,
                  },
                ],
              },
            },
          },
        }),
      },
    );

    if (!buttonResponse.ok) {
      const body = await buttonResponse.text();
      throw new Error(
        `Meta Send API button error: ${buttonResponse.status} ${body.slice(0, 500)}`,
      );
    }
  }
}

export async function processMessengerRestockNotifications(limit = 50): Promise<{
  scanned: number;
  notified: number;
  skipped: number;
  failed: number;
}> {
  const supabase = adminSupabase();

  const { data, error } = await supabase
    .from('stock_notifications')
    .select(
      'id, product_id, phone, country_code, products(name_bn,name_en,slug,stock)',
    )
    .eq('is_sent', false)
    .not('product_id', 'is', null)
    .limit(Math.max(1, Math.min(limit, 100)));

  if (error) throw error;

  const notifications = (data || []) as PendingRestock[];
  let notified = 0;
  let skipped = 0;
  let failed = 0;

  for (const notification of notifications) {
    const product = notification.products;
    const phone = String(notification.phone || '').trim();
    const stock = Number(product?.stock || 0);

    if (!notification.product_id || !phone || stock <= 0 || !product) {
      skipped += 1;
      continue;
    }

    const { data: profiles, error: profileError } = await supabase
      .from('messenger_customer_profiles')
      .select('page_id, external_user_id')
      .eq('phone', phone)
      .eq('country_code', notification.country_code)
      .limit(2);

    if (profileError) {
      console.error('Messenger restock profile lookup failed:', profileError);
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
        `🌱 সুসংবাদ! ${productName(product)} আবার স্টকে এসেছে।\n\n📦 এখন স্টকে: ${stock} প্যাকেট`,
        getProductUrl(product.slug),
      );

      const { error: updateError } = await supabase
        .from('stock_notifications')
        .update({ is_sent: true })
        .eq('id', notification.id)
        .eq('is_sent', false);

      if (updateError) {
        console.error('Messenger restock subscription update failed:', updateError);
        failed += 1;
        continue;
      }

      notified += 1;
    } catch (error) {
      console.error('Messenger restock message delivery failed:', error);
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
