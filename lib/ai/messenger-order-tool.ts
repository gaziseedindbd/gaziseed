import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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
