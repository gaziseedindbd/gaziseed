import type { SupabaseClient } from '@supabase/supabase-js';
import {
  searchMessengerProducts,
  type MessengerProduct,
} from './messenger-product-tool';

export type MessengerRestockCountry = 'IN' | 'BD';

function productName(product: MessengerProduct): string {
  return product.name_bn || product.name_en || product.slug || 'পণ্য';
}

export function extractMessengerRestockProductQuery(text: string): string {
  return text
    .replace(
      /(?:notify|notification|notify me|let me know|tell me|inform me|when.*back|back in stock|restock|stock এলে|স্টক এলে|আবার স্টকে|স্টকে এলে|স্টক আসলে|স্টক হলে|জানাবেন|জানিয়ে|জানিয়ে)/gi,
      ' ',
    )
    .replace(/(?:please|দয়া করে|দয়া করে|চাই|চাইলে|দিবেন|দাও|করুন|করে)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export async function subscribeMessengerRestockNotification(args: {
  supabase: SupabaseClient;
  pageId: string;
  externalUserId: string;
  country: MessengerRestockCountry;
  text: string;
}): Promise<{
  handled: boolean;
  reply: string;
  product?: MessengerProduct;
  subscribed: boolean;
}> {
  const profileResult = await args.supabase
    .from('messenger_customer_profiles')
    .select('phone')
    .eq('page_id', args.pageId)
    .eq('external_user_id', args.externalUserId)
    .eq('country_code', args.country)
    .maybeSingle();

  if (profileResult.error) throw profileResult.error;

  const phone =
    profileResult.data && typeof profileResult.data.phone === 'string'
      ? profileResult.data.phone.trim()
      : '';

  if (!phone) {
    return {
      handled: true,
      subscribed: false,
      reply:
        '🔔 Back-in-stock notification চালু করতে আগে আপনার Messenger account-এর সাথে একটি mobile number link করতে হবে.\n\n' +
        'উদাহরণ: আপনার Order Number এবং অর্ডারের সময় দেওয়া mobile number একসাথে লিখুন।',
    };
  }

  const query = extractMessengerRestockProductQuery(args.text);
  if (!query) {
    return {
      handled: true,
      subscribed: false,
      reply:
        'কোন পণ্যের stock ফিরে এলে আপনাকে জানাব? পণ্যের নাম লিখুন.\n\n' +
        'উদাহরণ: "গোলাপ ফুলের বীজ stock এলে জানাবেন"',
    };
  }

  const products = await searchMessengerProducts(
    args.supabase,
    args.country,
    query,
    5,
  );

  if (!products.length) {
    return {
      handled: true,
      subscribed: false,
      reply: 'দুঃখিত, এই country-তে matching কোনো product পাওয়া যায়নি।',
    };
  }

  const exactOrStrong = products.filter(
    (product) =>
      product.search_match_type === 'exact' ||
      product.search_match_type === 'strong',
  );

  const candidates = exactOrStrong.length ? exactOrStrong : products;
  if (candidates.length !== 1) {
    return {
      handled: true,
      subscribed: false,
      reply:
        'একাধিক matching product পাওয়া গেছে। পণ্যের পুরো নাম লিখে আবার notification request করুন.\n\n' +
        candidates
          .slice(0, 5)
          .map((product) => '• ' + productName(product))
          .join('\n'),
    };
  }

  const product = candidates[0];
  const stock = Number(product.stock || 0);

  if (stock > 0) {
    return {
      handled: true,
      subscribed: false,
      product,
      reply:
        '✅ ' +
        productName(product) +
        ' এখনই stock-এ আছে.\n\n' +
        'আপনি চাইলে এখন "Order Now" দিয়ে অর্ডার করতে পারেন।',
    };
  }

  const { data: existing, error: existingError } = await args.supabase
    .from('stock_notifications')
    .select('id')
    .eq('product_id', product.id)
    .eq('phone', phone)
    .eq('country_code', args.country)
    .eq('is_sent', false)
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    return {
      handled: true,
      subscribed: false,
      product,
      reply:
        '🔔 ঠিক আছে। ' +
        productName(product) +
        ' আবার stock-এ এলে এই Messenger account-এ আপনাকে জানানো হবে।',
    };
  }

  const { error: insertError } = await args.supabase
    .from('stock_notifications')
    .insert({
      product_id: product.id,
      phone,
      is_sent: false,
      country_code: args.country,
    });

  if (insertError) throw insertError;

  return {
    handled: true,
    subscribed: true,
    product,
    reply:
      '🔔 Notification request save হয়েছে.\n\n' +
      productName(product) +
      ' আবার stock-এ এলে এই Messenger account-এ আপনাকে জানানো হবে।',
  };
}
