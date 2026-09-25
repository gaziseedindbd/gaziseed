import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { searchMessengerProducts, type MessengerProduct } from './messenger-product-tool';

export type MessengerOrderCountry = 'IN' | 'BD';

export type PendingMessengerOrder = {
  step: 'quantity' | 'name' | 'phone' | 'address' | 'confirmation';
  product_id: string;
  product_name: string;
  unit_price: number;
  stock: number;
  quantity?: number;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
};

function getConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error('Supabase service configuration is incomplete');
  }
  return { url, serviceRole };
}

function countryScopedSupabase(country: MessengerOrderCountry) {
  const { url, serviceRole } = getConfig();
  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'x-gazi-country': country,
      },
    },
  });
}

export function normalizeMessengerDigits(value: string) {
  const map: Record<string, string> = {
    '০': '0',
    '১': '1',
    '২': '2',
    '৩': '3',
    '৪': '4',
    '৫': '5',
    '৬': '6',
    '৭': '7',
    '৮': '8',
    '৯': '9',
  };

  return value.replace(/[০-৯]/g, (digit) => map[digit] || digit);
}

export function parseMessengerQuantity(text: string): number | null {
  const normalized = normalizeMessengerDigits(text);
  const match = normalized.match(/\b(\d{1,3})\b/);
  if (!match) return null;

  const quantity = Number(match[1]);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return null;
  return quantity;
}

export function normalizeMessengerPhone(text: string, country: MessengerOrderCountry): string | null {
  const digits = normalizeMessengerDigits(text).replace(/\D/g, '');

  if (country === 'BD') {
    if (/^8801\d{9}$/.test(digits)) return `0${digits.slice(3)}`;
    if (/^01\d{9}$/.test(digits)) return digits;
    return null;
  }

  if (/^91[6-9]\d{9}$/.test(digits)) return digits.slice(2);
  if (/^[6-9]\d{9}$/.test(digits)) return digits;
  return null;
}

export function isMessengerOrderIntent(text: string) {
  return /(অর্ডার|order|কিনতে চাই|কিনবো|নিতে চাই|নেব|কিনতে চাই|buy|purchase|place\s+order)/i.test(
    text,
  );
}

export function isMessengerConfirmation(text: string) {
  return /(হ্যাঁ|হ্যা|yes|confirm|confirmed|নিশ্চিত|ঠিক আছে|করুন|অর্ডার করুন|place it|do it)/i.test(
    text.trim(),
  );
}

export function isMessengerCancellation(text: string) {
  return /(না|no|cancel|বাতিল|থাক|দরকার নেই)/i.test(text.trim());
}

export function parsePendingMessengerOrder(value: unknown): PendingMessengerOrder | null {
  if (!value || typeof value !== 'object') return null;

  const input = value as Record<string, unknown>;
  const steps = new Set(['quantity', 'name', 'phone', 'address', 'confirmation']);
  const step = typeof input.step === 'string' && steps.has(input.step)
    ? (input.step as PendingMessengerOrder['step'])
    : null;

  if (
    !step ||
    typeof input.product_id !== 'string' ||
    typeof input.product_name !== 'string' ||
    typeof input.unit_price !== 'number' ||
    typeof input.stock !== 'number'
  ) {
    return null;
  }

  return {
    step,
    product_id: input.product_id,
    product_name: input.product_name,
    unit_price: input.unit_price,
    stock: input.stock,
    quantity: typeof input.quantity === 'number' ? input.quantity : undefined,
    customer_name:
      typeof input.customer_name === 'string' ? input.customer_name : undefined,
    customer_phone:
      typeof input.customer_phone === 'string' ? input.customer_phone : undefined,
    delivery_address:
      typeof input.delivery_address === 'string'
        ? input.delivery_address
        : undefined,
  };
}

export async function createMessengerProductOrder(args: {
  country: MessengerOrderCountry;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  productId: string;
  quantity: number;
}) {
  const supabase = countryScopedSupabase(args.country);

  const { data, error } = await supabase.rpc('ai_create_product_order', {
    p_customer_name: args.customerName,
    p_customer_phone: args.customerPhone,
    p_delivery_address: args.deliveryAddress,
    p_items: [
      {
        product_id: args.productId,
        quantity: args.quantity,
      },
    ],
    p_coupon_code: null,
    p_delivery_zone_id: null,
    p_special_instructions: 'Order created through Facebook Messenger AI',
    p_confirmed: true,
  });

  if (error) throw error;
  return data as {
    success?: boolean;
    order_id?: string;
    order_number?: string;
    subtotal?: number;
    discount?: number;
    delivery_charge?: number;
    grand_total?: number;
    final_amount?: number;
    country_code?: MessengerOrderCountry;
    error?: string;
    requires_confirmation?: boolean;
  };
}

export function messengerCurrency(country: MessengerOrderCountry) {
  return country === 'IN' ? '₹' : '৳';
}

export function createMessengerOrderClient(
  country: MessengerOrderCountry,
): SupabaseClient {
  return countryScopedSupabase(country);
}


function getEffectiveProductPrice(product: MessengerProduct) {
  return [product.offer_price, product.sale_price, product.price, product.regular_price]
    .find((value): value is number => typeof value === 'number' && value > 0) ?? 0;
}

function productDisplayName(product: MessengerProduct) {
  return product.name_bn || product.name_en || product.slug || 'পণ্য';
}

function productFromMetadata(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  if (
    typeof input.id !== 'string' ||
    typeof input.name !== 'string' ||
    typeof input.price !== 'number' ||
    typeof input.stock !== 'number'
  ) {
    return null;
  }
  return {
    id: input.id,
    name: input.name,
    price: input.price,
    stock: input.stock,
  };
}

export async function handleMessengerOrderFlow(args: {
  supabase: SupabaseClient;
  country: MessengerOrderCountry;
  text: string;
  metadata: Record<string, unknown> | null | undefined;
}) {
  const metadata = args.metadata || {};
  const pending = parsePendingMessengerOrder(metadata.pending_messenger_order);
  const currency = messengerCurrency(args.country);

  if (pending) {
    if (pending.step === 'quantity') {
      const quantity = parseMessengerQuantity(args.text);
      if (!quantity) {
        return {
          handled: true,
          reply: 'কত প্যাকেট অর্ডার করতে চান? সংখ্যাটি লিখুন।',
          pending: pending,
        };
      }

      if (quantity > pending.stock) {
        return {
          handled: true,
          reply: `দুঃখিত, বর্তমানে ${pending.stock}টি প্যাকেটের বেশি স্টক নেই। কতটি নিতে চান?`,
          pending,
        };
      }

      const next: PendingMessengerOrder = {
        ...pending,
        quantity,
        step: 'name',
      };

      return {
        handled: true,
        reply: 'অর্ডারের জন্য আপনার নামটি লিখুন।',
        pending: next,
      };
    }

    if (pending.step === 'name') {
      const customerName = args.text.trim().slice(0, 120);
      if (customerName.length < 2) {
        return {
          handled: true,
          reply: 'দয়া করে আপনার সম্পূর্ণ নামটি লিখুন।',
          pending,
        };
      }

      const next = {
        ...pending,
        customer_name: customerName,
        step: 'phone' as const,
      };

      return {
        handled: true,
        reply:
          args.country === 'BD'
            ? 'আপনার ১১ সংখ্যার Bangladesh mobile number লিখুন।'
            : 'আপনার ১০ সংখ্যার Indian mobile number লিখুন।',
        pending: next,
      };
    }

    if (pending.step === 'phone') {
      const phone = normalizeMessengerPhone(args.text, args.country);
      if (!phone) {
        return {
          handled: true,
          reply:
            args.country === 'BD'
              ? 'সঠিক Bangladesh mobile number দিন, যেমন 01XXXXXXXXX।'
              : 'সঠিক Indian mobile number দিন, যেমন 9XXXXXXXXX।',
          pending,
        };
      }

      const next = {
        ...pending,
        customer_phone: phone,
        step: 'address' as const,
      };

      return {
        handled: true,
        reply: 'আপনার সম্পূর্ণ delivery address লিখুন।',
        pending: next,
      };
    }

    if (pending.step === 'address') {
      const address = args.text.trim().slice(0, 500);
      if (address.length < 8) {
        return {
          handled: true,
          reply: 'দয়া করে সম্পূর্ণ delivery address লিখুন।',
          pending,
        };
      }

      const next = {
        ...pending,
        delivery_address: address,
        step: 'confirmation' as const,
      };

      const subtotal = (pending.quantity || 0) * pending.unit_price;

      return {
        handled: true,
        reply:
          `অর্ডারটি নিশ্চিত করার আগে বিস্তারিত দেখে নিন:\n\n` +
          `পণ্য: ${pending.product_name}\n` +
          `পরিমাণ: ${pending.quantity || 0} প্যাকেট\n` +
          `পণ্যের মূল্য: ${currency}${subtotal.toFixed(0)}\n` +
          `নাম: ${next.customer_name}\n` +
          `মোবাইল: ${next.customer_phone}\n` +
          `ঠিকানা: ${next.delivery_address}\n\n` +
          'সব ঠিক থাকলে “হ্যাঁ” লিখুন; অর্ডার বাতিল করতে “না” লিখুন।',
        pending: next,
      };
    }

    if (pending.step === 'confirmation') {
      if (isMessengerCancellation(args.text)) {
        return {
          handled: true,
          reply: 'ঠিক আছে, অর্ডারটি বাতিল করা হয়েছে।',
          pending: null,
        };
      }

      if (!isMessengerConfirmation(args.text)) {
        return {
          handled: true,
          reply:
            'অর্ডারটি তৈরি করতে “হ্যাঁ” এবং বাতিল করতে “না” লিখুন।',
          pending,
        };
      }

      if (
        !pending.quantity ||
        !pending.customer_name ||
        !pending.customer_phone ||
        !pending.delivery_address
      ) {
        return {
          handled: true,
          reply:
            'অর্ডারের কিছু তথ্য অসম্পূর্ণ আছে। আবার order শুরু করা যাক।',
          pending: null,
        };
      }

      const result = await createMessengerProductOrder({
        country: args.country,
        customerName: pending.customer_name,
        customerPhone: pending.customer_phone,
        deliveryAddress: pending.delivery_address,
        productId: pending.product_id,
        quantity: pending.quantity,
      });

      if (!result?.success) {
        return {
          handled: true,
          reply:
            result?.error
              ? `দুঃখিত, অর্ডার তৈরি করা যায়নি: ${result.error}`
              : 'দুঃখিত, অর্ডার তৈরি করা যায়নি। দয়া করে আবার চেষ্টা করুন।',
          pending: null,
        };
      }

      return {
        handled: true,
        reply:
          `✅ আপনার অর্ডার সফলভাবে তৈরি হয়েছে।\n\n` +
          `অর্ডার নম্বর: ${result.order_number || 'পাওয়া যায়নি'}\n` +
          `পণ্য: ${pending.product_name}\n` +
          `পরিমাণ: ${pending.quantity} প্যাকেট\n` +
          `Subtotal: ${currency}${Number(result.subtotal || 0).toFixed(0)}\n` +
          `Delivery charge: ${currency}${Number(result.delivery_charge || 0).toFixed(0)}\n` +
          `Grand total: ${currency}${Number(result.grand_total || result.final_amount || 0).toFixed(0)}\n\n` +
          'অর্ডারটি GAZI SEED order system-এ যুক্ত হয়েছে।',
        pending: null,
      };
    }
  }

  if (!isMessengerOrderIntent(args.text)) {
    return { handled: false as const };
  }

  const lastProduct = productFromMetadata(metadata.last_messenger_product);
  let product: MessengerProduct | null = null;

  const matches = await searchMessengerProducts(
    args.supabase,
    args.country,
    args.text,
    5,
  );

  if (matches.length === 1) {
    product = matches[0];
  } else if (matches.length > 1) {
    return {
      handled: true,
      reply:
        'আপনি কোন পণ্যটি অর্ডার করতে চান? দয়া করে পণ্যের সঠিক নামটি লিখুন।',
      pending: null,
    };
  } else if (lastProduct) {
    return {
      handled: true,
      reply: `${lastProduct.name} অর্ডার করতে চান। কত প্যাকেট নেবেন?`,
      pending: {
        step: 'quantity',
        product_id: lastProduct.id,
        product_name: lastProduct.name,
        unit_price: lastProduct.price,
        stock: lastProduct.stock,
      },
    };
  } else {
    return {
      handled: true,
      reply: 'অর্ডার করতে চান এমন পণ্যের নাম লিখুন।',
      pending: null,
    };
  }

  const price = getEffectiveProductPrice(product);
  const stock = Number(product.stock || 0);
  if (!price || stock <= 0) {
    return {
      handled: true,
      reply: `দুঃখিত, ${productDisplayName(product)} বর্তমানে অর্ডারযোগ্য নয়।`,
      pending: null,
    };
  }

  const quantity = parseMessengerQuantity(args.text);
  if (quantity && quantity > stock) {
    return {
      handled: true,
      reply: `দুঃখিত, বর্তমানে ${stock}টি প্যাকেটের বেশি স্টক নেই। কতটি নিতে চান?`,
      pending: {
        step: 'quantity',
        product_id: product.id,
        product_name: productDisplayName(product),
        unit_price: price,
        stock,
      },
    };
  }

  const pendingOrder: PendingMessengerOrder = {
    step: quantity ? 'name' : 'quantity',
    product_id: product.id,
    product_name: productDisplayName(product),
    unit_price: price,
    stock,
    quantity: quantity || undefined,
  };

  return {
    handled: true,
    reply: quantity
      ? 'অর্ডারের জন্য আপনার নামটি লিখুন।'
      : `${productDisplayName(product)} — ${currency}${price} প্রতি প্যাকেট। কত প্যাকেট অর্ডার করতে চান?`,
    pending: pendingOrder,
  };
}
