import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { searchMessengerProducts, type MessengerProduct } from './messenger-product-tool';
import { isMessengerChangeDetailsRequest } from './messenger-intents';
import { detectMessengerReplyLanguage } from './messenger-language';

export type MessengerOrderCountry = 'IN' | 'BD';

export type PendingMessengerOrder = {
  step:
    | 'quantity'
    | 'name'
    | 'phone'
    | 'address'
    | 'india_pincode'
    | 'india_address'
    | 'india_city'
    | 'india_thana'
    | 'india_state'
    | 'confirmation'
    | 'saved_details_confirmation';
  product_id: string;
  product_name: string;
  unit_price: number;
  stock: number;
  quantity?: number;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
  india_pincode?: string;
  india_address?: string;
  india_city?: string;
  india_thana?: string;
  india_state?: string;
};
export type MessengerCustomerPrefill = {
  name: string | null;
  phone: string | null;
  address: string | null;
};

export type MessengerCartItem = {
  product_id: string;
  product_name: string;
  unit_price: number;
  stock: number;
  quantity: number;
};

export function parseMessengerCartItems(value: unknown): MessengerCartItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const input = item as Record<string, unknown>;
      if (
        typeof input.product_id !== 'string' ||
        typeof input.product_name !== 'string' ||
        typeof input.unit_price !== 'number' ||
        typeof input.stock !== 'number' ||
        typeof input.quantity !== 'number' ||
        !Number.isInteger(input.quantity) ||
        input.quantity < 1 ||
        input.quantity > 99
      ) {
        return null;
      }

      return {
        product_id: input.product_id,
        product_name: input.product_name,
        unit_price: input.unit_price,
        stock: input.stock,
        quantity: input.quantity,
      };
    })
    .filter((item): item is MessengerCartItem => item !== null)
    .slice(0, 20);
}

export function addPendingMessengerOrderToCart(
  cartItems: MessengerCartItem[],
  pending: PendingMessengerOrder,
): MessengerCartItem[] {
  if (!pending.quantity) return cartItems;
  const existing = cartItems.find((item) => item.product_id === pending.product_id);

  if (existing) {
    return cartItems.map((item) =>
      item.product_id === pending.product_id
        ? {
            ...item,
            quantity: Math.min(99, item.quantity + pending.quantity!),
            stock: pending.stock,
            unit_price: pending.unit_price,
            product_name: pending.product_name,
          }
        : item,
    );
  }

  return [
    ...cartItems,
    {
      product_id: pending.product_id,
      product_name: pending.product_name,
      unit_price: pending.unit_price,
      stock: pending.stock,
      quantity: pending.quantity,
    },
  ].slice(0, 20);
}

export function formatMessengerCartSummary(
  items: MessengerCartItem[],
  currency: string,
): string {
  if (!items.length) return '🛒 কার্টে এখনো কোনো পণ্য নেই।';

  const lines = items.map(
    (item) =>
      `• ${item.product_name} × ${item.quantity} = ${currency}${(
        item.unit_price * item.quantity
      ).toFixed(0)}`,
  );
  const subtotal = items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0,
  );

  return ['🛒 Cart:', ...lines, '', `Subtotal: ${currency}${subtotal.toFixed(0)}`].join(
    '\n',
  );
}


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
  const normalized = text.toLocaleLowerCase().replace(/\s+/g, ' ').trim();

  return /(?:অর্ডার|order|কিনতে চাই|কিনবো|নিতে চাই|নেব|buy|purchase|place\s+order|কিনতে\s+(?:চাই|চায়|চাইলে)|নিতে\s+(?:চাই|চায়|চাইলে)|\bkinte\s+cha(?:i|ie|y)\b|\bnite\s+cha(?:i|ie|y)\b|\bnibo\b|\bnebo\b|\bkharidna\b|\bkharidne\b|\bkharidna\s+(?:hai|hain)\b|\bkharid\s+kar(?:na|ne|ni)\b|\blena\b|\blena\s+(?:hai|hain)\b|\bmujhe\s+(?:kharidna|lena)\b|\bchahiye\b|\blunga\b|\blungi\b|\blenge\b|\border\s+kor(?:te|bo|ben|b)\b)/i.test(
    normalized,
  );
}

export function isMessengerConfirmation(text: string) {
  return /(হ্যাঁ|হ্যা|हाँ|haan|han|yes|confirm|confirmed|निश्चित|ठीक है|theek hai|theek|নিশ্চিত|ঠিক আছে|করুন|অর্ডার করুন|place it|do it|kar do|karo)/i.test(
    text.trim(),
  );
}

export function isMessengerCancellation(text: string) {
  return /(না|no|cancel|बातिल|नहीं|नही|nahin|nahi|বাতিল|থাক|দরকার নেই)/i.test(text.trim());
}

export function parsePendingMessengerOrder(value: unknown): PendingMessengerOrder | null {
  if (!value || typeof value !== 'object') return null;

  const input = value as Record<string, unknown>;
  const steps = new Set([
    'quantity',
    'name',
    'phone',
    'address',
    'india_pincode',
    'india_address',
    'india_city',
    'india_thana',
    'india_state',
    'confirmation',
    'saved_details_confirmation',
  ]);
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
    india_pincode:
      typeof input.india_pincode === 'string' ? input.india_pincode : undefined,
    india_address:
      typeof input.india_address === 'string' ? input.india_address : undefined,
    india_city:
      typeof input.india_city === 'string' ? input.india_city : undefined,
    india_thana:
      typeof input.india_thana === 'string' ? input.india_thana : undefined,
    india_state:
      typeof input.india_state === 'string' ? input.india_state : undefined,
  };
}

export function applyMessengerCustomerProfileToPending(
  pending: PendingMessengerOrder,
  profile: MessengerCustomerPrefill | null | undefined,
): PendingMessengerOrder {
  if (
    pending.step !== 'name' ||
    !profile?.name ||
    !profile.phone ||
    !profile.address
  ) {
    return pending;
  }

  return {
    ...pending,
    customer_name: profile.name,
    customer_phone: profile.phone,
    delivery_address: profile.address,
    india_pincode: undefined,
    india_address: undefined,
    india_city: undefined,
    india_thana: undefined,
    india_state: undefined,
    step: 'saved_details_confirmation',
  };
}


function messengerOrderText(
  language: ReturnType<typeof detectMessengerReplyLanguage>,
  key:
    | 'name' | 'invalid_name' | 'phone_bd' | 'phone_in'
    | 'invalid_phone_bd' | 'invalid_phone_in' | 'address' | 'invalid_address'
    | 'pincode' | 'invalid_pincode' | 'india_address' | 'invalid_india_address'
    | 'city' | 'invalid_city' | 'thana' | 'invalid_thana' | 'state' | 'invalid_state'
    | 'confirmation' | 'invalid_confirmation' | 'cancel' | 'saved_details'
    | 'saved_change' | 'saved_invalid' | 'incomplete' | 'payment' | 'payment_failed'
    | 'order_failed' | 'order_success' | 'quantity' | 'invalid_quantity',
): string {
  const text = {
    English: {
      name: 'Please enter your name for the order.',
      invalid_name: 'Please enter your full name.',
      phone_bd: 'Please enter your 11-digit Bangladesh mobile number.',
      phone_in: 'Please enter your 10-digit Indian mobile number.',
      invalid_phone_bd: 'Please enter a valid Bangladesh mobile number, e.g. 01XXXXXXXXX.',
      invalid_phone_in: 'Please enter a valid Indian mobile number, e.g. 9XXXXXXXXX.',
      address: 'Please enter your complete delivery address.',
      invalid_address: 'Please enter your complete delivery address.',
      pincode: 'Please enter your 6-digit PIN code.',
      invalid_pincode: 'Please enter a valid 6-digit PIN code.',
      india_address: 'Please enter your detailed delivery address and nearby landmark.',
      invalid_india_address: 'Please enter a detailed address and landmark.',
      city: 'Please enter your city.',
      invalid_city: 'Please enter a valid city name.',
      thana: 'Please enter your thana / police station.',
      invalid_thana: 'Please enter a valid thana / police station.',
      state: 'Please enter your state.',
      invalid_state: 'Please enter a valid state name.',
      confirmation: 'Please review the order details and type “yes” to confirm or “no” to cancel.',
      invalid_confirmation: 'Type “yes” to confirm the order or “no” to cancel.',
      cancel: 'Okay, the order has been cancelled.',
      saved_details: 'Your saved customer details were found. If everything is correct, type “yes”. To change them, type “change details”.',
      saved_change: 'Okay. Please enter your name.',
      saved_invalid: 'If everything is correct, type “yes”. To change the details, type “change details”.',
      incomplete: 'Some order information is incomplete. Let’s start the order again.',
      payment: '🇮🇳 Your India COD payment step is ready.',
      payment_failed: 'Sorry, the COD advance payment link could not be created. Please try again later.',
      order_failed: 'Sorry, the order could not be created. Please try again.',
      order_success: '✅ Your order has been created successfully.',
      quantity: 'How many packets would you like to order? Enter the quantity.',
      invalid_quantity: 'How many packets would you like to order? Enter a valid quantity.',
    },
    Hindi: {
      name: 'Order के लिए अपना नाम लिखें।',
      invalid_name: 'कृपया अपना पूरा नाम लिखें।',
      phone_bd: 'अपना 11 अंकों का Bangladesh mobile number लिखें।',
      phone_in: 'अपना 10 अंकों का Indian mobile number लिखें।',
      invalid_phone_bd: 'सही Bangladesh mobile number दें, जैसे 01XXXXXXXXX।',
      invalid_phone_in: 'सही Indian mobile number दें, जैसे 9XXXXXXXXX।',
      address: 'अपना पूरा delivery address लिखें।',
      invalid_address: 'कृपया अपना पूरा delivery address लिखें।',
      pincode: 'अपना 6 अंकों का PIN code लिखें।',
      invalid_pincode: 'कृपया सही 6 अंकों का PIN code लिखें।',
      india_address: 'अपना पूरा delivery address और पास का landmark लिखें।',
      invalid_india_address: 'कृपया पूरा address और landmark लिखें।',
      city: 'अपने City का नाम लिखें।',
      invalid_city: 'कृपया सही City का नाम लिखें।',
      thana: 'अपने Thana / Police Station का नाम लिखें।',
      invalid_thana: 'कृपया सही Thana / Police Station का नाम लिखें।',
      state: 'अपने State का नाम लिखें।',
      invalid_state: 'कृपया सही State का नाम लिखें।',
      confirmation: 'Order details check करें और confirm करने के लिए “हाँ”, cancel करने के लिए “ना” लिखें।',
      invalid_confirmation: 'Order confirm करने के लिए “हाँ” और cancel करने के लिए “ना” लिखें।',
      cancel: 'ठीक है, order cancel कर दिया गया है।',
      saved_details: 'आपके saved customer details मिल गए हैं। सब सही है तो “हाँ” लिखें। बदलने के लिए “details change” लिखें।',
      saved_change: 'ठीक है। अपना नाम लिखें।',
      saved_invalid: 'सब सही है तो “हाँ” लिखें। Details बदलने के लिए “details change” लिखें।',
      incomplete: 'Order की कुछ जानकारी अधूरी है। Order फिर से शुरू करते हैं।',
      payment: '🇮🇳 आपका India COD payment step तैयार है।',
      payment_failed: 'माफ़ कीजिए, COD advance payment link नहीं बन पाया। थोड़ी देर बाद फिर कोशिश करें।',
      order_failed: 'माफ़ कीजिए, order नहीं बन पाया। कृपया फिर कोशिश करें।',
      order_success: '✅ आपका order सफलतापूर्वक बन गया है।',
      quantity: 'कितने packet order करने हैं? संख्या लिखें।',
      invalid_quantity: 'कितने packet order करने हैं? सही संख्या लिखें।',
    },
    Bengali: {
      name: 'অর্ডারের জন্য আপনার নামটি লিখুন।',
      invalid_name: 'দয়া করে আপনার সম্পূর্ণ নামটি লিখুন।',
      phone_bd: 'আপনার ১১ সংখ্যার Bangladesh mobile number লিখুন।',
      phone_in: 'আপনার ১০ সংখ্যার Indian mobile number লিখুন।',
      invalid_phone_bd: 'সঠিক Bangladesh mobile number দিন, যেমন 01XXXXXXXXX।',
      invalid_phone_in: 'সঠিক Indian mobile number দিন, যেমন 9XXXXXXXXX।',
      address: 'আপনার সম্পূর্ণ delivery address লিখুন।',
      invalid_address: 'দয়া করে সম্পূর্ণ delivery address লিখুন।',
      pincode: 'আপনার ৬ সংখ্যার PIN Code লিখুন।',
      invalid_pincode: 'দয়া করে সঠিক ৬ সংখ্যার PIN Code লিখুন।',
      india_address: 'আপনার বিস্তারিত delivery address ও কাছাকাছি landmark একসাথে লিখুন।',
      invalid_india_address: 'দয়া করে বিস্তারিত address ও landmark লিখুন।',
      city: 'আপনার City-এর নাম লিখুন।',
      invalid_city: 'দয়া করে সঠিক City-এর নাম লিখুন।',
      thana: 'আপনার Thana / Police Station-এর নাম লিখুন।',
      invalid_thana: 'দয়া করে সঠিক Thana / Police Station-এর নাম লিখুন।',
      state: 'আপনার State-এর নাম লিখুন।',
      invalid_state: 'দয়া করে সঠিক State-এর নাম লিখুন।',
      confirmation: 'অর্ডারটি নিশ্চিত করার আগে বিস্তারিত দেখে নিন। সব ঠিক থাকলে “হ্যাঁ” লিখুন; অর্ডার বাতিল করতে “না” লিখুন।',
      invalid_confirmation: 'অর্ডারটি তৈরি করতে “হ্যাঁ” এবং বাতিল করতে “না” লিখুন।',
      cancel: 'ঠিক আছে, অর্ডারটি বাতিল করা হয়েছে।',
      saved_details: 'আপনার আগের Messenger order-এর saved details পাওয়া গেছে। সব ঠিক থাকলে “হ্যাঁ” লিখুন। তথ্য বদলাতে “তথ্য পরিবর্তন” লিখুন।',
      saved_change: 'ঠিক আছে। আপনার নামটি লিখুন।',
      saved_invalid: 'সব ঠিক থাকলে “হ্যাঁ” লিখুন; তথ্য বদলাতে “তথ্য পরিবর্তন” লিখুন।',
      incomplete: 'অর্ডারের কিছু তথ্য অসম্পূর্ণ আছে। আবার order শুরু করা যাক।',
      payment: '🇮🇳 আপনার India COD order-এর payment step প্রস্তুত।',
      payment_failed: 'দুঃখিত, COD advance payment link তৈরি করা যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।',
      order_failed: 'দুঃখিত, অর্ডার তৈরি করা যায়নি। দয়া করে আবার চেষ্টা করুন।',
      order_success: '✅ আপনার অর্ডার সফলভাবে তৈরি হয়েছে।',
      quantity: 'কত প্যাকেট অর্ডার করতে চান? সংখ্যাটি লিখুন।',
      invalid_quantity: 'কত প্যাকেট অর্ডার করতে চান? সঠিক সংখ্যাটি লিখুন।',
    },
  } as const;
  return text[language][key];
}

function formatMessengerOrderCartSummary(
  items: MessengerCartItem[],
  currency: string,
  language: ReturnType<typeof detectMessengerReplyLanguage>,
): string {
  if (!items.length) {
    return language === 'Hindi'
      ? '🛒 Cart में अभी कोई product नहीं है।'
      : language === 'English'
        ? '🛒 There are no products in the cart yet.'
        : '🛒 কার্টে এখনো কোনো পণ্য নেই।';
  }
  const lines = items.map(
    (item) =>
      \`• \${item.product_name} × \${item.quantity} = \${currency}\${(item.unit_price * item.quantity).toFixed(0)}\`,
  );
  const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const subtotalLabel = language === 'Hindi' ? 'Subtotal' : language === 'English' ? 'Subtotal' : 'সাবটোটাল';
  const cartLabel = language === 'Hindi' || language === 'English' ? '🛒 Cart:' : '🛒 কার্ট:';
  return [cartLabel, ...lines, '', \`\${subtotalLabel}: \${currency}\${subtotal.toFixed(0)}\`].join('\\n');
}

function getMessengerSavedDetailsReply(
  pending: PendingMessengerOrder,
  cart: MessengerCartItem[],
  currency: string,
  language: ReturnType<typeof detectMessengerReplyLanguage>,
): string {
  const orderItems = pending.quantity
    ? addPendingMessengerOrderToCart(cart, pending)
    : cart;
  const summary = formatMessengerOrderCartSummary(orderItems, currency, language);
  if (language === 'Hindi') {
    return [
      '✅ आपके saved Messenger order details मिल गए हैं।',
      '',
      summary,
      '',
      'नाम: ' + (pending.customer_name || 'saved नहीं है'),
      'मोबाइल: ' + (pending.customer_phone || 'saved नहीं है'),
      'पता: ' + (pending.delivery_address || 'saved नहीं है'),
      '',
      messengerOrderText(language, 'saved_details'),
    ].join('\n');
  }
  if (language === 'English') {
    return [
      '✅ Your saved Messenger order details were found.',
      '',
      summary,
      '',
      'Name: ' + (pending.customer_name || 'Not saved'),
      'Mobile: ' + (pending.customer_phone || 'Not saved'),
      'Address: ' + (pending.delivery_address || 'Not saved'),
      '',
      messengerOrderText(language, 'saved_details'),
    ].join('\n');
  }
  return [
    '✅ আপনার আগের Messenger order-এর saved details পাওয়া গেছে।',
    '',
    summary,
    '',
    'নাম: ' + (pending.customer_name || 'সংরক্ষিত নেই'),
    'মোবাইল: ' + (pending.customer_phone || 'সংরক্ষিত নেই'),
    'ঠিকানা: ' + (pending.delivery_address || 'সংরক্ষিত নেই'),
    '',
    messengerOrderText(language, 'saved_details'),
  ].join('\n');
}
export function getMessengerOrderResumeReply(pending: PendingMessengerOrder): string {
  const prefix = `আগের অর্ডারটি আবার চালু করেছি। ${pending.product_name}-এর অর্ডারটি যেখানে থেমেছিল, সেখান থেকেই চলছি।`;
  switch (pending.step) {
    case 'quantity':
      return prefix + '\n\nকত প্যাকেট অর্ডার করতে চান? সংখ্যা লিখুন।';
    case 'name':
      return prefix + '\n\nআপনার নামটি লিখুন।';
    case 'phone':
      return prefix + '\n\nআপনার ফোন নম্বরটি লিখুন।';
    case 'address':
      return prefix + '\n\nআপনার সম্পূর্ণ ডেলিভারি ঠিকানাটি লিখুন।';
    case 'india_pincode':
      return prefix + '\n\nআপনার ৬ সংখ্যার PIN code লিখুন।';
    case 'india_address':
      return prefix + '\n\nআপনার সম্পূর্ণ ঠিকানা ও কাছাকাছি landmark লিখুন।';
    case 'india_city':
      return prefix + '\n\nআপনার City লিখুন।';
    case 'india_thana':
      return prefix + '\n\nআপনার Thana লিখুন।';
    case 'india_state':
      return prefix + '\n\nআপনার State লিখুন।';
    case 'saved_details_confirmation':
      return prefix + '\n\nআপনার saved customer details পাওয়া গেছে। সব ঠিক থাকলে “হ্যাঁ” লিখুন; তথ্য বদলাতে “তথ্য পরিবর্তন” লিখুন।';
    case 'confirmation':
      return prefix + '\n\nঅর্ডারের তথ্য নিশ্চিত করতে হ্যাঁ বা না লিখুন।';
  }
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


export async function createMessengerCartOrder(args: {
  country: MessengerOrderCountry;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  items: MessengerCartItem[];
}) {
  const supabase = countryScopedSupabase(args.country);

  const { data, error } = await supabase.rpc('ai_create_product_order', {
    p_customer_name: args.customerName,
    p_customer_phone: args.customerPhone,
    p_delivery_address: args.deliveryAddress,
    p_items: args.items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
    })),
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

export async function createMessengerIndiaCodPayment(args: {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  items: MessengerCartItem[];
}) {
  const supabase = countryScopedSupabase('IN');
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.gaziseed.com').replace(/\/$/, '');
  const returnUrl = siteUrl + '/messenger-payment?return=1';
  const { data, error } = await supabase.functions.invoke('cashfree-payment-session', {
    body: {
      customer_name: args.customerName,
      customer_phone: args.customerPhone,
      customer_email: '',
      delivery_address: args.deliveryAddress,
      special_instructions: 'Order created through Facebook Messenger AI',
      items: args.items.map((item) => ({ product_id: item.product_id, quantity: item.quantity, variant_id: null, bundle_id: null })),
      coupon_code: null,
      use_referral_wallet: false,
      payment_method: 'cod',
      order_source: 'facebook_messenger_ai',
      return_url: returnUrl,
    },
  });
  if (error) throw error;
  if (!data?.ok || !data.payment_session_id || !data.order_id) throw new Error(data?.error || 'Unable to start Cashfree COD advance payment');
  return {
    paymentUrl: siteUrl + '/messenger-payment?order_id=' + encodeURIComponent(data.order_id as string),
    advanceAmount: Number(data.quote?.advance_amount || data.order_amount || 0),
    finalAmount: Number(data.quote?.final_amount || 0),
    deliveryCharge: Number(data.quote?.delivery_charge || 0),
    dueAmount: Math.max(0, Number(data.quote?.final_amount || 0) - Number(data.quote?.advance_amount || data.order_amount || 0)),
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
  customerProfile?: MessengerCustomerPrefill | null;
}) {
  const metadata = args.metadata || {};
  const pending = parsePendingMessengerOrder(metadata.pending_messenger_order);
  const cartItems = parseMessengerCartItems(metadata.messenger_cart_items);
  const currency = messengerCurrency(args.country);
  const replyLanguage = detectMessengerReplyLanguage(args.text);

  if (pending) {
    if (pending.step === 'quantity') {
      const quantity = parseMessengerQuantity(args.text);
      if (!quantity) {
        return {
          handled: true,
          reply: messengerOrderText(replyLanguage, 'quantity'),
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

      const next = applyMessengerCustomerProfileToPending(
        {
          ...pending,
          quantity,
          step: 'name',
        },
        args.customerProfile,
      );

      return {
        handled: true,
        reply:
          next.step === 'saved_details_confirmation'
            ? getMessengerSavedDetailsReply(next, cartItems, currency, replyLanguage)
            : messengerOrderText(replyLanguage, 'name'),
        pending: next,
      };
    }

    if (pending.step === 'name') {
      const customerName = args.text.trim().slice(0, 120);
      if (customerName.length < 2) {
        return {
          handled: true,
          reply:
            replyLanguage === 'Hindi'
              ? 'कृपया अपना पूरा नाम लिखें।'
              : replyLanguage === 'English'
                ? 'Please enter your full name.'
                : 'দয়া করে আপনার সম্পূর্ণ নামটি লিখুন।',
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
          reply: messengerOrderText(
            replyLanguage,
            args.country === 'BD' ? 'invalid_phone_bd' : 'invalid_phone_in',
          ),
          pending,
        };
      }

      const next = {
        ...pending,
        customer_phone: phone,
        step: args.country === 'IN' ? ('india_pincode' as const) : ('address' as const),
      };

      return {
        handled: true,
        reply:
          args.country === 'IN'
            ? 'আপনার ৬ সংখ্যার PIN Code লিখুন।'
            : 'আপনার সম্পূর্ণ delivery address লিখুন।',
        pending: next,
      };
    }

    if (pending.step === 'india_pincode') {
      const pincode = normalizeMessengerDigits(args.text).replace(/\D/g, '');
      if (!/^\d{6}$/.test(pincode)) {
        return {
          handled: true,
          reply: messengerOrderText(replyLanguage, 'invalid_pincode'),
          pending,
        };
      }

      return {
        handled: true,
        reply: messengerOrderText(replyLanguage, 'india_address'),
        pending: {
          ...pending,
          india_pincode: pincode,
          step: 'india_address' as const,
        },
      };
    }

    if (pending.step === 'india_address') {
      const address = args.text.trim().slice(0, 500);
      if (address.length < 8) {
        return {
          handled: true,
          reply: messengerOrderText(replyLanguage, 'invalid_india_address'),
          pending,
        };
      }

      return {
        handled: true,
        reply: messengerOrderText(replyLanguage, 'city'),
        pending: {
          ...pending,
          india_address: address,
          step: 'india_city' as const,
        },
      };
    }

    if (pending.step === 'india_city') {
      const city = args.text.trim().slice(0, 120);
      if (city.length < 2) {
        return {
          handled: true,
          reply: messengerOrderText(replyLanguage, 'invalid_city'),
          pending,
        };
      }

      return {
        handled: true,
        reply: messengerOrderText(replyLanguage, 'thana'),
        pending: {
          ...pending,
          india_city: city,
          step: 'india_thana' as const,
        },
      };
    }

    if (pending.step === 'india_thana') {
      const thana = args.text.trim().slice(0, 120);
      if (thana.length < 2) {
        return {
          handled: true,
          reply: messengerOrderText(replyLanguage, 'invalid_thana'),
          pending,
        };
      }

      return {
        handled: true,
        reply: messengerOrderText(replyLanguage, 'state'),
        pending: {
          ...pending,
          india_thana: thana,
          step: 'india_state' as const,
        },
      };
    }

    if (pending.step === 'india_state') {
      const state = args.text.trim().slice(0, 120);
      if (state.length < 2) {
        return {
          handled: true,
          reply: messengerOrderText(replyLanguage, 'invalid_state'),
          pending,
        };
      }

      const deliveryAddress = [
        `PIN Code: ${pending.india_pincode || ''}`,
        `Detailed Address + Landmark: ${pending.india_address || ''}`,
        `City: ${pending.india_city || ''}`,
        `Thana: ${pending.india_thana || ''}`,
        `State: ${state}`,
      ].join('\n');

      const next = {
        ...pending,
        india_state: state,
        delivery_address: deliveryAddress,
        step: 'confirmation' as const,
      };

      const orderItems = pending.quantity
        ? addPendingMessengerOrderToCart(cartItems, pending)
        : cartItems;
      const cartSummary = formatMessengerOrderCartSummary(orderItems, currency, replyLanguage);

      return {
        handled: true,
        reply:
          (replyLanguage === 'Hindi'
            ? 'Order details:\n\n' + cartSummary + '\n\n' +
              'नाम: ' + next.customer_name + '\n' +
              'मोबाइल: ' + next.customer_phone + '\n' +
              'PIN Code: ' + next.india_pincode + '\n' +
              'Detailed Address + Landmark: ' + next.india_address + '\n' +
              'City: ' + next.india_city + '\n' +
              'Thana: ' + next.india_thana + '\n' +
              'State: ' + next.india_state + '\n\n' +
              'सब सही है तो “हाँ” लिखें; cancel करने के लिए “ना” लिखें।'
            : replyLanguage === 'English'
              ? 'Order details:\n\n' + cartSummary + '\n\n' +
                'Name: ' + next.customer_name + '\n' +
                'Mobile: ' + next.customer_phone + '\n' +
                'PIN Code: ' + next.india_pincode + '\n' +
                'Detailed Address + Landmark: ' + next.india_address + '\n' +
                'City: ' + next.india_city + '\n' +
                'Thana: ' + next.india_thana + '\n' +
                'State: ' + next.india_state + '\n\n' +
                'Type “yes” to confirm; “no” to cancel.'
              : 'অর্ডারটি নিশ্চিত করার আগে বিস্তারিত দেখে নিন:\n\n' + cartSummary + '\n\n' +
                'নাম: ' + next.customer_name + '\n' +
                'মোবাইল: ' + next.customer_phone + '\n' +
                'PIN Code: ' + next.india_pincode + '\n' +
                'Detailed Address + Landmark: ' + next.india_address + '\n' +
                'City: ' + next.india_city + '\n' +
                'Thana: ' + next.india_thana + '\n' +
                'State: ' + next.india_state + '\n\n' +
                'সব ঠিক থাকলে “হ্যাঁ” লিখুন; অর্ডার বাতিল করতে “না” লিখুন।'),
        pending: next,
      };
    }

    if (pending.step === 'saved_details_confirmation') {
      if (isMessengerCancellation(args.text)) {
        return {
          handled: true,
          reply: messengerOrderText(replyLanguage, 'cancel'),
          pending: null,
        };
      }

      if (isMessengerChangeDetailsRequest(args.text)) {
        const next: PendingMessengerOrder = {
          ...pending,
          step: 'name',
          customer_name: undefined,
          customer_phone: undefined,
          delivery_address: undefined,
          india_pincode: undefined,
          india_address: undefined,
          india_city: undefined,
          india_thana: undefined,
          india_state: undefined,
        };

        return {
          handled: true,
          reply: messengerOrderText(replyLanguage, 'saved_change'),
          pending: next,
        };
      }

      if (!isMessengerConfirmation(args.text)) {
        return {
          handled: true,
          reply: messengerOrderText(replyLanguage, 'saved_invalid'),
          pending,
        };
      }

      const next: PendingMessengerOrder = {
        ...pending,
        step: 'confirmation',
      };
      const orderItems = pending.quantity
        ? addPendingMessengerOrderToCart(cartItems, pending)
        : cartItems;
      const cartSummary = formatMessengerOrderCartSummary(orderItems, currency, replyLanguage);

      return {
        handled: true,
        reply:
          replyLanguage === 'Hindi'
            ? 'Order details:\n\n' + cartSummary + '\n\nनाम: ' + (next.customer_name || 'saved नहीं है') +
              '\nमोबाइल: ' + (next.customer_phone || 'saved नहीं है') + '\nपता: ' + (next.delivery_address || 'saved नहीं है') +
              '\n\nसब सही है तो “हाँ” लिखें; cancel करने के लिए “ना” लिखें।'
            : replyLanguage === 'English'
              ? 'Order details:\n\n' + cartSummary + '\n\nName: ' + (next.customer_name || 'Not saved') +
                '\nMobile: ' + (next.customer_phone || 'Not saved') + '\nAddress: ' + (next.delivery_address || 'Not saved') +
                '\n\nType “yes” to confirm; “no” to cancel.'
              : 'অর্ডারের বিস্তারিত:\n\n' + cartSummary + '\n\nনাম: ' + (next.customer_name || 'সংরক্ষিত নেই') +
                '\nমোবাইল: ' + (next.customer_phone || 'সংরক্ষিত নেই') + '\nঠিকানা: ' + (next.delivery_address || 'সংরক্ষিত নেই') +
                '\n\nসব ঠিক থাকলে “হ্যাঁ” লিখুন; অর্ডার বাতিল করতে “না” লিখুন।',
        pending: next,
      };
    }
    if (pending.step === 'address') {
      const address = args.text.trim().slice(0, 500);
      if (address.length < 8) {
        return {
          handled: true,
          reply: messengerOrderText(replyLanguage, 'invalid_address'),
          pending,
        };
      }

      const next = {
        ...pending,
        delivery_address: address,
        step: 'confirmation' as const,
      };

      const orderItems = pending.quantity
        ? addPendingMessengerOrderToCart(cartItems, pending)
        : cartItems;
      const cartSummary = formatMessengerOrderCartSummary(orderItems, currency, replyLanguage);

      return {
        handled: true,
        reply:
          replyLanguage === 'Hindi'
            ? 'Order details:\n\n' + cartSummary + '\n\nनाम: ' + next.customer_name +
              '\nमोबाइल: ' + next.customer_phone + '\nपता: ' + next.delivery_address +
              '\n\nसब सही है तो “हाँ” लिखें; cancel करने के लिए “ना” लिखें।'
            : replyLanguage === 'English'
              ? 'Order details:\n\n' + cartSummary + '\n\nName: ' + next.customer_name +
                '\nMobile: ' + next.customer_phone + '\nAddress: ' + next.delivery_address +
                '\n\nType “yes” to confirm; “no” to cancel.'
              : 'অর্ডারটি নিশ্চিত করার আগে বিস্তারিত দেখে নিন:\n\n' + cartSummary +
                '\n\nনাম: ' + next.customer_name + '\nমোবাইল: ' + next.customer_phone +
                '\nঠিকানা: ' + next.delivery_address + '\n\nসব ঠিক থাকলে “হ্যাঁ” লিখুন; অর্ডার বাতিল করতে “না” লিখুন।',
        pending: next,
      };
    }

    if (pending.step === 'confirmation') {
      if (isMessengerCancellation(args.text)) {
        return {
          handled: true,
          reply: messengerOrderText(replyLanguage, 'cancel'),
          pending: null,
        };
      }

      if (!isMessengerConfirmation(args.text)) {
        return {
          handled: true,
          reply: messengerOrderText(replyLanguage, 'invalid_confirmation'),
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
          reply: messengerOrderText(replyLanguage, 'incomplete'),
          pending: null,
        };
      }

      const orderItems = addPendingMessengerOrderToCart(cartItems, pending);
      if (args.country === 'IN') {
        try {
          const payment = await createMessengerIndiaCodPayment({
            customerName: pending.customer_name,
            customerPhone: pending.customer_phone,
            deliveryAddress: pending.delivery_address,
            items: orderItems,
          });
          const cartSummary = formatMessengerOrderCartSummary(orderItems, currency, replyLanguage);
          return {
            handled: true,
            reply:
              replyLanguage === 'Hindi'
                ? '🇮🇳 आपका India COD payment step तैयार है।\n\n' + cartSummary + '\n' +
                  `Delivery charge: ${currency}${payment.deliveryCharge.toFixed(0)}\n` +
                  `COD advance: ${currency}${payment.advanceAmount.toFixed(0)}\n` +
                  `Delivery पर बाकी: ${currency}${payment.dueAmount.toFixed(0)}\n\n` +
                  '🔐 पहले COD advance payment पूरा करें। Payment successful होने के बाद आपका COD order automatically confirm होगा।\n\n' +
                  '🔐 Payment button नीचे दिया गया है।'
                : replyLanguage === 'English'
                  ? '🇮🇳 Your India COD payment step is ready.\n\n' + cartSummary + '\n' +
                    `Delivery charge: ${currency}${payment.deliveryCharge.toFixed(0)}\n` +
                    `COD advance: ${currency}${payment.advanceAmount.toFixed(0)}\n` +
                    `Remaining on delivery: ${currency}${payment.dueAmount.toFixed(0)}\n\n` +
                    '🔐 Complete the COD advance payment first. Your COD order will be confirmed automatically after successful payment.\n\n' +
                    '🔐 The payment button is below.'
                  : '🇮🇳 আপনার India COD order-এর payment step প্রস্তুত।\n\n' + cartSummary + '\n' +
                    `Delivery charge: ${currency}${payment.deliveryCharge.toFixed(0)}\n` +
                    `COD advance এখন: ${currency}${payment.advanceAmount.toFixed(0)}\n` +
                    `Delivery-এর সময় বাকি: ${currency}${payment.dueAmount.toFixed(0)}\n\n` +
                    '🔐 আগে COD advance payment সম্পন্ন করুন। Payment সফল হলে আপনার COD order automatically confirm হবে।\n\n' +
                    '🔐 Payment button নিচে দেওয়া হলো।',
            paymentButton: {
              title: `Pay ${currency}${payment.advanceAmount.toFixed(0)} Now`,
              url: payment.paymentUrl,
            },
            pending: null,
          };
        } catch (paymentError) {
          console.error('Messenger India COD payment start failed', paymentError);
          return {
            handled: true,
            reply: messengerOrderText(replyLanguage, 'payment_failed'),
            pending,
          };
        }
      }

      const result =
        cartItems.length > 0
          ? await createMessengerCartOrder({
              country: args.country,
              customerName: pending.customer_name,
              customerPhone: pending.customer_phone,
              deliveryAddress: pending.delivery_address,
              items: orderItems,
            })
          : await createMessengerProductOrder({
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

      const cartSummary = formatMessengerOrderCartSummary(orderItems, currency, replyLanguage);

      return {
        handled: true,
        reply:
          `✅ আপনার অর্ডার সফলভাবে তৈরি হয়েছে।\n\n` +
          `অর্ডার নম্বর: ${result.order_number || 'পাওয়া যায়নি'}\n` +
          `${cartSummary}\n` +
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
        replyLanguage === 'English'
          ? 'Which product would you like to order? Please enter the exact product name.'
          : replyLanguage === 'Hindi'
            ? 'आप कौन सा product order करना चाहते हैं? Product का सही नाम लिखें।'
            : 'আপনি কোন পণ্যটি অর্ডার করতে চান? দয়া করে পণ্যের সঠিক নামটি লিখুন.',
      pending: null,
    };
  } else if (lastProduct) {
    return {
      handled: true,
      reply:
        replyLanguage === 'English'
          ? `You want to order ${lastProduct.name}. How many packets would you like?`
          : replyLanguage === 'Hindi'
            ? `${lastProduct.name} order करना है। कितने packet लेने हैं?`
            : `${lastProduct.name} অর্ডার করতে চান। কত প্যাকেট নেবেন?`,
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
      reply:
        replyLanguage === 'English'
          ? 'Enter the name of the product you want to order.'
          : replyLanguage === 'Hindi'
            ? 'जिस product को order करना है उसका नाम लिखें।'
            : 'অর্ডার করতে চান এমন পণ্যের নাম লিখুন.',
      pending: null,
    };
  }

  const price = getEffectiveProductPrice(product);
  const stock = Number(product.stock || 0);
  if (!price || stock <= 0) {
    return {
      handled: true,
      reply:
        replyLanguage === 'English'
          ? `Sorry, ${productDisplayName(product)} is currently unavailable for ordering.`
          : replyLanguage === 'Hindi'
            ? `माफ़ कीजिए, ${productDisplayName(product)} अभी order करने के लिए उपलब्ध नहीं है।`
            : `দুঃখিত, ${productDisplayName(product)} বর্তমানে অর্ডারযোগ্য নয়।`,
      pending: null,
    };
  }

  const quantity = parseMessengerQuantity(args.text);
  if (quantity && quantity > stock) {
    return {
      handled: true,
      reply:
        replyLanguage === 'English'
          ? `Sorry, only ${stock} packets are currently in stock. How many would you like?`
          : replyLanguage === 'Hindi'
            ? `माफ़ कीजिए, अभी ${stock} packet ही stock में हैं। कितने लेना है?`
            : `দুঃখিত, বর্তমানে ${stock}টি প্যাকেটের বেশি স্টক নেই। কতটি নিতে চান?`,
      pending: {
        step: 'quantity',
        product_id: product.id,
        product_name: productDisplayName(product),
        unit_price: price,
        stock,
      },
    };
  }

  const pendingOrder = applyMessengerCustomerProfileToPending(
    {
      step: quantity ? 'name' : 'quantity',
      product_id: product.id,
      product_name: productDisplayName(product),
      unit_price: price,
      stock,
      quantity: quantity || undefined,
    },
    args.customerProfile,
  );

  return {
    handled: true,
    reply:
      pendingOrder.step === 'saved_details_confirmation'
        ? getMessengerSavedDetailsReply(pendingOrder, cartItems, currency, replyLanguage)
        : quantity
          ? replyLanguage === 'English'
            ? 'Please enter your name for the order.'
            : replyLanguage === 'Hindi'
              ? 'Order के लिए अपना नाम लिखें।'
              : 'অর্ডারের জন্য আপনার নামটি লিখুন।'
          : replyLanguage === 'English'
            ? `${productDisplayName(product)} — ${currency}${price} per packet. How many packets would you like to order?`
            : replyLanguage === 'Hindi'
              ? `${productDisplayName(product)} — ${currency}${price} प्रति packet। कितने packet order करने हैं?`
              : `${productDisplayName(product)} — ${currency}${price} প্রতি প্যাকেট। কত প্যাকেট অর্ডার করতে চান?`,
    pending: pendingOrder,
  };
}
