// Messenger webhook runtime: deterministic database-first replies only.
import { createClient } from '@supabase/supabase-js';
import { after, NextRequest, NextResponse } from 'next/server';
import {
  enrichMessengerProductsWithKnowledge,
  getMessengerProductSelectionQuickReplies,
  isTrustedMessengerProductMatch,
  searchMessengerProducts,
  listMessengerProducts,
  serializeMessengerProducts,
} from '@/lib/ai/messenger-product-tool';
import {
  formatMessengerDeliveryPolicyReply,
  getMessengerDeliveryPolicy,
  isMessengerDeliveryChargeQuestion,
  isMessengerDeliveryPolicyQuestion,
  isMessengerDeliveryTimeQuestion,
} from '@/lib/ai/messenger-delivery-tool';
import {
  addPendingMessengerOrderToCart,
  formatMessengerCartSummary,
  getMessengerOrderResumeReply,
  handleMessengerOrderFlow,
  isMessengerOrderIntent,
  parseMessengerCartItems,
  parsePendingMessengerOrder,
} from '@/lib/ai/messenger-order-tool';
import {
  getMessengerOrderTrackingReply,
  parseMessengerTrackingOrderNumber,
} from '@/lib/ai/messenger-order-tracking';
import {
  getMessengerCustomerProfileReply,
  getMessengerOrderCustomerProfile,
  getMessengerOrderHistoryReply,
  linkMessengerCustomerProfileByPhone,
  upsertMessengerCustomerProfile,
} from '@/lib/ai/messenger-customer-tool';
import {
  isMessengerAddAnotherProductRequest,
  isMessengerCheckoutRequest,
  isMessengerPaymentStatusRequest,
  isMessengerCartViewRequest,
  isMessengerCartRemoveRequest,
  isMessengerCartQuantityChangeRequest,
  isMessengerAddToCartRequest,
  isMessengerProductComparisonRequest,
  isMessengerRecommendationRequest,
  isMessengerRestockNotificationRequest,
  isMessengerPhoneOnlyMessage,
  isMessengerCustomerProfileRequest,
  isMessengerOrderHistoryRequest,
  isMessengerOrderLinkRequest,
  isMessengerOrderInterruptRequest,
  isMessengerOrderResumeRequest,
  isMessengerOrderTrackingRequest,
  isOtherProductRequest,
  isProductCatalogRequest,
  isProductListRequest,
} from '@/lib/ai/messenger-intents';
import {
  getMessengerWebsiteKnowledgeAnswer,
  isBangladeshPaymentMethodQuestion,
} from '@/lib/ai/messenger-knowledge-tool';
import {
  getMessengerPublishedContentAnswer,
  isMessengerWebsitePolicyQuestion,
} from '@/lib/ai/messenger-cms-knowledge-tool';
import { getMessengerCustomerRecommendations } from '@/lib/ai/messenger-recommendation-tool';
import { extractMessengerPhone } from '@/lib/ai/messenger-phone';
import { subscribeMessengerRestockNotification } from '@/lib/ai/messenger-restock-tool';
import {
  consumeMessengerRateLimit,
  getMessengerRateLimitReply,
  hashMessengerMessage,
  resolveMessengerRateLimitCountry,
} from '@/lib/ai/messenger-rate-limit';
import {
  getBangladeshHumanSupportAcknowledgement,
  getBangladeshHumanSupportWaitingReply,
  getMessengerHumanSupportContactReply,
} from '@/lib/ai/messenger-human-support';
import {
  getMessengerPaymentStatusReply,
} from '@/lib/ai/messenger-payment-status';
import {
  detectMessengerReplyLanguage,
  type MessengerReplyLanguage,
} from '@/lib/ai/messenger-language';

import { detectExplicitMessengerCountry } from '@/lib/ai/messenger-country';
import {
  safeEqual,
  verifyMessengerWebhookSignature,
} from '@/lib/ai/messenger-webhook-security';

export const dynamic = 'force-dynamic';

const WEBHOOK_VERIFY_TOKEN =
  process.env.META_VERIFY_TOKEN ||
  process.env.META_WEBHOOK_VERIFY_TOKEN ||
  '';

const META_APP_SECRET = process.env.META_APP_SECRET || '';
const META_PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN || '';
const META_PAGE_ID = process.env.META_PAGE_ID || '';
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v26.0';

type CountryCode = 'IN' | 'BD';

type ConversationRecord = {
  id: string;
  status: 'active' | 'handoff' | 'closed';
  metadata?: Record<string, unknown> | null;
};

function detectExplicitCountry(text: string): CountryCode | null {
  return detectExplicitMessengerCountry(text);
}

function getVerifiedCountry(conversation: ConversationRecord): CountryCode | null {
  const metadata = conversation.metadata || {};
  if (metadata.country_verified !== true) return null;

  return metadata.country_code === 'IN' || metadata.country_code === 'BD'
    ? metadata.country_code
    : null;
}

function isHumanSupportRequest(text: string): boolean {
  const normalized = text.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  return /(human|agent|support|representative|talk to (a )?person|speak to (a )?person|customer care|customer service|মানুষের সাথে|মানুষের সঙ্গে|মানুষের সাথে কথা|কথা বলতে চাই|কথা বলতে চান|কাস্টমার কেয়ার|কাস্টমার কেয়ার|কাস্টমার সার্ভিস|সাপোর্টে কথা)/i.test(
    normalized,
  );
}

function formatMessengerCurrency(country: CountryCode): string {
  return country === 'IN' ? '₹' : '৳';
}

function messengerProductReplyTitle(product: Record<string, unknown>): string {
  const name = formatMessengerProductName(product).replace(/\s+/g, ' ').trim();
  return name.length > 20 ? name.slice(0, 19) + '…' : name;
}

function parseMessengerProductSelection(payload: string): string | null {
  const match = payload.match(/^PRODUCT_SELECT:([0-9a-f-]{36})$/i);
  return match?.[1] || null;
}

function normalizeMessengerCartText(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

function parseMessengerCartQuantity(text: string): number | null {
  const normalized = text.replace(/[০-৯]/g, (digit) => String('০১২৩৪৫৬৭৮৯'.indexOf(digit)));
  const match = normalized.match(/\b(\d{1,2})\b/);
  if (!match) return null;
  const quantity = Number(match[1]);
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= 99 ? quantity : null;
}

function findMessengerCartItem(
  items: ReturnType<typeof parseMessengerCartItems>,
  text: string,
) {
  if (items.length === 1) return items[0];
  const normalized = normalizeMessengerCartText(text);
  return items.find((item) => {
    const name = normalizeMessengerCartText(item.product_name);
    if (name && normalized.includes(name)) return true;
    const tokens = name.split(/[^a-z0-9\u0980-\u09FF]+/i).filter((token) => token.length >= 3);
    return tokens.some((token) => normalized.includes(token));
  }) || null;
}

function getMessengerComparisonQueries(text: string): string[] {
  const cleaned = normalizeMessengerCartText(text)
    .replace(/(?:compare|comparison|তুলনা|কোনটা|which|better)/gi, ' ')
    .replace(/(?:please|দয়া করে|দয়া করে|করো|করুন|করে|দেখাও|দেখান)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const parts = cleaned.split(/\s+(?:and|&|ও|এবং|আর|vs|versus)\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.slice(0, 2);
}

function formatMessengerProductName(product: Record<string, unknown>): string {
  return (
    (typeof product.name_bn === 'string' && product.name_bn) ||
    (typeof product.name_en === 'string' && product.name_en) ||
    (typeof product.slug === 'string' && product.slug) ||
    'পণ্য'
  );
}

function formatMessengerCatalogReply(
  text: string,
  products: Array<Record<string, unknown>>,
  country: CountryCode,
  language: MessengerReplyLanguage = detectMessengerReplyLanguage(text),
): string {
  const currency = formatMessengerCurrency(country);
  const english = language === 'English';
  const hindi = language === 'Hindi';

  const displayName = (product: Record<string, unknown>) =>
    english || hindi
      ? ((typeof product.name_en === 'string' && product.name_en) ||
          (typeof product.name_bn === 'string' && product.name_bn) ||
          (typeof product.slug === 'string' && product.slug) ||
          (hindi ? 'उत्पाद' : 'Product'))
      : formatMessengerProductName(product);

  if (!products.length) {
    if (english) return 'Sorry, no matching active product was found in this country.';
    if (hindi) return 'माफ़ कीजिए, इस देश में कोई उपलब्ध उत्पाद नहीं मिला।';
    return 'দুঃখিত, এই country-তে matching কোনো active product পাওয়া যায়নি।';
  }

  if (!isProductListRequest(text) && products.length === 1) {
    const product = products[0];
    const name = displayName(product);
    const trusted = isTrustedMessengerProductMatch(product);

    if (!trusted) {
      const prefix = english
        ? '🔎 You may be looking for:'
        : hindi
          ? '🔎 शायद आप यह उत्पाद खोज रहे हैं:'
          : '🔎 আপনি সম্ভবত এই পণ্যটি খুঁজছেন:';
      return english
        ? prefix + ' ' + name + '\n\nPlease enter the exact product name to verify the current price and stock before ordering.'
        : hindi
          ? prefix + ' ' + name + '\n\nऑर्डर से पहले सही उत्पाद का नाम लिखें, ताकि मौजूदा कीमत और स्टॉक की पुष्टि हो सके।'
          : prefix + ' ' + name + '\n\nঅর্ডার বা বর্তমান দাম/স্টক জানতে সঠিক product name লিখুন।';
    }

    const price =
      typeof product.effective_price === 'number'
        ? product.effective_price
        : 0;
    const stock =
      typeof product.stock === 'number'
        ? product.stock
        : 0;

    if (english) {
      return '🌱 ' + name + '\n\n💰 Price: ' + currency + price + ' per packet\n📦 Stock: ' + stock + ' packets';
    }

    if (hindi) {
      return '🌱 ' + name + '\n\n💰 कीमत: ' + currency + price + ' प्रति पैकेट\n📦 स्टॉक: ' + stock + ' पैकेट';
    }

    return '🌱 ' + name + '\n\n💰 দাম: ' + currency + price + ' প্রতি প্যাকেট\n📦 স্টক: ' + stock + ' প্যাকেট';
  }

  const primaryProducts = products.filter(isTrustedMessengerProductMatch);
  const similarProducts = products.filter(
    (product) => !isTrustedMessengerProductMatch(product),
  );

  const formatPrimaryLine = (product: Record<string, unknown>) => {
    const name = displayName(product);
    const price =
      typeof product.effective_price === 'number'
        ? currency + product.effective_price
        : english
          ? 'Price unavailable'
          : hindi
            ? 'कीमत उपलब्ध नहीं'
            : 'দাম জানা নেই';
    const stock =
      typeof product.stock === 'number'
        ? english
          ? product.stock + ' packets'
          : hindi
            ? product.stock + ' पैकेट'
            : product.stock + ' প্যাকেট'
        : english
          ? 'Stock unavailable'
          : hindi
            ? 'स्टॉक उपलब्ध नहीं'
            : 'স্টক তথ্য নেই';

    return english
      ? '• ' + name + ' — ' + price + ' — Stock: ' + stock
      : hindi
        ? '• ' + name + ' — ' + price + ' — स्टॉक: ' + stock
        : '• ' + name + ' — ' + price + ' — স্টক: ' + stock;
  };

  const formatSimilarLine = (product: Record<string, unknown>) => {
    const name = displayName(product);
    return english
      ? '• ' + name + ' — potential similar match; price/stock not verified'
      : hindi
        ? '• ' + name + ' — संभावित मिलता-जुलता उत्पाद; कीमत और स्टॉक की पुष्टि नहीं हुई है'
        : '• ' + name + ' — সম্ভাব্য similar match; দাম/স্টক যাচাই করা হয়নি';
  };

  const sections: string[] = [];
  if (primaryProducts.length) {
    sections.push(primaryProducts.slice(0, 12).map(formatPrimaryLine).join('\n'));
  }

  if (similarProducts.length) {
    sections.push(
      (english
        ? '🔎 Potential similar products:'
        : hindi
          ? '🔎 संभावित मिलते-जुलते उत्पाद:'
          : '🔎 সম্ভাব্য similar products:') +
      '\n' +
      similarProducts.slice(0, 6).map(formatSimilarLine).join('\n'),
    );
  }

  if (english) {
    return (
      '🌱 Matching GAZI SEED products:\n\n' +
      sections.join('\n\n') +
      (products.length
        ? '\n\nChoose a product option below to verify its current price and stock or place an order.'
        : '\n\nFor price, stock, or ordering information, type the exact product name.')
    );
  }

  if (hindi) {
    return (
      '🌱 GAZI SEED के उपलब्ध उत्पाद:\n\n' +
      sections.join('\n\n') +
      (products.length
        ? '\n\nनीचे दिए गए विकल्पों में से उत्पाद चुनें। उसके बाद मौजूदा कीमत और स्टॉक की पुष्टि होगी।'
        : '\n\nकीमत, स्टॉक या ऑर्डर की जानकारी के लिए उत्पाद का सही नाम लिखें।')
    );
  }

  return (
    '🌱 GAZI SEED-এর matching products:\n\n' +
    sections.join('\n\n') +
    (products.length
      ? '\n\nনিচের option থেকে পণ্য বেছে নিন—তারপর database থেকে বর্তমান দাম ও stock যাচাই হবে।'
      : '\n\nকোনো পণ্য সম্পর্কে দাম, স্টক বা অর্ডার জানতে সঠিক product name লিখুন।')
  );
}

function getCountryQuestion() {
  return (
    'আপনাকে সঠিক পণ্য, দাম, স্টক ও ডেলিভারি তথ্য দিতে আগে জানাবেন—' +
    'আপনি India থেকে নাকি Bangladesh থেকে? 🇮🇳 🇧🇩'
  );
}

type MetaProfileSignal = {
  locale: string | null;
  countryHint: CountryCode | null;
};

function inferCountryFromLocale(locale: string | null): CountryCode | null {
  if (!locale) return null;
  const normalized = locale.toLowerCase().replace('-', '_');

  const inLocale = normalized.endsWith('_in');
  const bdLocale = normalized.endsWith('_bd');

  if (inLocale === bdLocale) return null;
  return inLocale ? 'IN' : 'BD';
}

async function getMetaProfileSignal(senderId: string): Promise<MetaProfileSignal> {
  if (!META_PAGE_ACCESS_TOKEN) {
    return { locale: null, countryHint: null };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(senderId)}?fields=locale`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${META_PAGE_ACCESS_TOKEN}`,
        },
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      return { locale: null, countryHint: null };
    }

    const body = (await response.json()) as { locale?: unknown };
    const locale = typeof body.locale === 'string' ? body.locale : null;

    return {
      locale,
      countryHint: inferCountryFromLocale(locale),
    };
  } catch {
    return { locale: null, countryHint: null };
  }
}

async function hasSavedMessengerMessage(
  sb: ReturnType<typeof adminSupabase>,
  externalMessageId: string,
): Promise<boolean> {
  if (!sb) return false;

  const { data, error } = await sb
    .from('ai_messages')
    .select('id')
    .eq('external_message_id', externalMessageId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

function buildMessengerRateLimitInput(
  normalizedActionText: string,
  quickReplyPayload: string,
  postbackTitle: string,
): string {
  return [
    normalizedActionText,
    quickReplyPayload,
    postbackTitle,
  ]
    .join('|')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) return null;

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

type MessengerEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;    quick_reply?: {
      payload?: string;
    };
  };
  postback?: {
    mid?: string;
    title?: string;
    payload?: string;
  };
};

type MessengerPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    messaging?: MessengerEvent[];
  }>;
};

async function sendMessengerText(
  recipientId: string,
  text: string,
  quickReplies?: Array<{ title: string; payload: string }>,
  urlButton?: { title: string; url: string },
  productCards?: Array<{
    title: string;
    subtitle?: string;
    imageUrl?: string;
    productId: string;
    productUrl?: string;
    viewProductTitle?: string;
    orderNowTitle?: string;
  }>,
) {
  if (!META_PAGE_ACCESS_TOKEN) {
    throw new Error('META_PAGE_ACCESS_TOKEN is not configured');
  }

  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/me/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${META_PAGE_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: {
          text: text.slice(0, 2000),
          ...(quickReplies?.length
            ? {
                quick_replies: quickReplies.map((reply) => ({
                  content_type: 'text',
                  title: reply.title,
                  payload: reply.payload,
                })),
              }
            : {}),
        },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Meta Send API error: ${response.status} ${body.slice(0, 500)}`);
  }

  if (urlButton?.url) {
    const buttonResponse = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/me/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${META_PAGE_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: {
            attachment: {
              type: 'template',
              payload: {
                template_type: 'button',
                text: 'Secure Cashfree payment',
                buttons: [
                  {
                    type: 'web_url',
                    title: urlButton.title.slice(0, 20),
                    url: urlButton.url,
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
      throw new Error(`Meta Send API button error: ${buttonResponse.status} ${body.slice(0, 500)}`);
    }
  }

  const validProductCards = (productCards || []).filter(
    (card) => card.imageUrl && /^https?:\/\//i.test(card.imageUrl),
  ).slice(0, 10);

  if (validProductCards.length) {
    const cardResponse = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/me/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${META_PAGE_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: {
            attachment: {
              type: 'template',
              payload: {
                template_type: 'generic',
                elements: validProductCards.map((card) => ({
                  title: card.title.slice(0, 80),
                  ...(card.subtitle ? { subtitle: card.subtitle.slice(0, 80) } : {}),
                  image_url: card.imageUrl,
                  buttons: [
                    ...(card.productUrl
                      ? [{ type: 'web_url', title: (card.viewProductTitle || 'View Product').slice(0, 20), url: card.productUrl }]
                      : []),
                    {
                      type: 'postback',
                      title: (card.orderNowTitle || 'Order Now').slice(0, 20),
                      payload: `PRODUCT_SELECT:${card.productId}`,
                    },
                  ].slice(0, 3),
                })),
              },
            },
          },
        }),
      },
    );

    if (!cardResponse.ok) {
      const body = await cardResponse.text();
      throw new Error(`Meta Send API product card error: ${cardResponse.status} ${body.slice(0, 500)}`);
    }
  }

}

async function getConversation(sb: ReturnType<typeof adminSupabase>, externalUserId: string) {
  if (!sb) return null;

  const { data, error } = await sb
    .from('ai_conversations')
    .select('id,status,metadata')
    .eq('channel', 'facebook_messenger')
    .eq('external_user_id', externalUserId)
    .eq('page_id', META_PAGE_ID)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function ensureConversation(
  sb: ReturnType<typeof adminSupabase>,
  externalUserId: string,
) {
  if (!sb) throw new Error('Supabase service configuration is incomplete');

  const existing = await getConversation(sb, externalUserId);
  if (existing) return existing;

  const { data, error } = await sb
    .from('ai_conversations')
    .insert({
      channel: 'facebook_messenger',
      external_user_id: externalUserId,
      page_id: META_PAGE_ID || null,
      status: 'active',
      metadata: {
        source: 'facebook_messenger',
        country_verified: false,
      },
      // ai_conversations.country_code is currently non-null; keep the
      // legacy default but do not treat it as verified at runtime.
      country_code: 'BD',
    })
    .select('id,status,metadata')
    .single();

  if (!error && data) return data;

  // Meta can deliver the first events for a new sender concurrently.
  // The unique conversation key is authoritative; reuse the row that won
  // the race instead of failing the second webhook request.
  if (error?.code === '23505') {
    const concurrent = await getConversation(sb, externalUserId);
    if (concurrent) return concurrent;
  }

  if (error) throw error;
  throw new Error('Could not create Messenger conversation');
}


async function saveMessage(
  sb: ReturnType<typeof adminSupabase>,
  conversationId: string,
  args: {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    externalMessageId?: string | null;
    provider?: string | null;
    model?: string | null;
    actionStatus?: string | null;
    sourceContext?: Record<string, unknown> | null;
    countryCode?: CountryCode | null;
  },
): Promise<{ id: string; duplicate: boolean }> {
  if (!sb) throw new Error('Supabase service configuration is incomplete');

  const { data, error } = await sb
    .from('ai_messages')
    .insert({
      conversation_id: conversationId,
      role: args.role,
      content: args.content,
      provider: args.provider || null,
      model: args.model || null,
      external_message_id: args.externalMessageId || null,
      action_status: args.actionStatus || null,
      requires_confirmation: false,
      source_context: args.sourceContext || null,
      country_code: args.countryCode || 'BD',
    })
    .select('id')
    .single();

  if (!error && data) {
    return { id: data.id, duplicate: false };
  }

  if (error?.code === '23505' && args.externalMessageId) {
    const { data: existing, error: existingError } = await sb
      .from('ai_messages')
      .select('id')
      .eq('external_message_id', args.externalMessageId)
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) {
      return { id: existing.id, duplicate: true };
    }
  }

  if (error) throw error;
  throw new Error('Messenger message insert returned no row');
}

async function markConversation(
  sb: ReturnType<typeof adminSupabase>,
  conversationId: string,
  status: 'active' | 'handoff' | 'closed',
  metadata?: Record<string, unknown>,
  countryCode?: CountryCode,
) {
  if (!sb) return;

  // Concurrent Messenger events can update the same conversation. Merge the
  // newest metadata snapshot using optimistic concurrency so one webhook
  // cannot silently overwrite another webhook's state.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data: current, error: readError } = await sb
      .from('ai_conversations')
      .select('metadata,updated_at')
      .eq('id', conversationId)
      .maybeSingle();

    if (readError) throw readError;
    if (!current) throw new Error('Messenger conversation not found');

    const mergedMetadata = {
      ...(current.metadata || {}),
      ...(metadata || {}),
    };

    const updatePayload: Record<string, unknown> = {
      status,
      metadata: mergedMetadata,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (countryCode) {
      updatePayload.country_code = countryCode;
    }

    const { data: updatedRows, error: updateError } = await sb
      .from('ai_conversations')
      .update(updatePayload)
      .eq('id', conversationId)
      .eq('updated_at', current.updated_at)
      .select('id');

    if (updateError) throw updateError;
    if (updatedRows && updatedRows.length > 0) return;

    // Another webhook won the update race. Re-read the latest state and
    // merge again instead of overwriting it.
  }

  throw new Error('Concurrent Messenger conversation update could not be committed safely');
}


async function createHumanHandoff(
  sb: ReturnType<typeof adminSupabase>,
  conversationId: string,
  reason: string,
  countryCode: CountryCode,
) {
  if (!sb) throw new Error('Supabase service configuration is incomplete');

  await markConversation(sb, conversationId, 'handoff', {
    handoff_reason: reason,
    handoff_at: new Date().toISOString(),
  }, countryCode);

  const { data: existing, error: existingError } = await sb
    .from('ai_handoffs')
    .select('id,status,reason,assigned_to,created_at')
    .eq('conversation_id', conversationId)
    .in('status', ['open', 'assigned'])
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;

  const notes =
    reason === 'customer_requested_human_support'
      ? 'Customer requested human support. AI replies are blocked until an admin closes the handoff.'
      : 'Automatic AI failover exhausted. Automatic replies may resume on a new customer message.';

  if (existing) {
    // Reuse the existing active handoff, but make an explicit customer request
    // visible as a real human-support queue item instead of leaving it labeled
    // as an older provider-failure/disabled-AI handoff.
    if (
      reason === 'customer_requested_human_support' &&
      existing.reason !== 'customer_requested_human_support'
    ) {
      const { data: updated, error: updateError } = await sb
        .from('ai_handoffs')
        .update({
          reason,
          notes,
          country_code: countryCode,
        })
        .eq('id', existing.id)
        .select('id,status,assigned_to,created_at')
        .single();

      if (updateError) throw updateError;
      return updated;
    }

    return existing;
  }

  const { data, error } = await sb
    .from('ai_handoffs')
    .insert({
      conversation_id: conversationId,
      reason,
      status: 'open',
      notes,
      country_code: countryCode,
    })
    .select('id,status,assigned_to,created_at')
    .single();

  if (error) throw error;
  return data;
}

async function getProductContext(
  sb: ReturnType<typeof adminSupabase>,
  country: CountryCode,
  searchTerm: string,
) {
  if (!sb) return [];

  const products = await searchMessengerProducts(sb, country, searchTerm, 12);
  const enrichedProducts = await enrichMessengerProductsWithKnowledge(
    sb,
    country,
    products,
  );
  return serializeMessengerProducts(enrichedProducts);
}

async function processMessengerEvent(event: MessengerEvent) {
  const senderId = event.sender?.id;
  const messageId = event.message?.mid || event.postback?.mid;
  const quickReplyPayload = event.message?.quick_reply?.payload || event.postback?.payload || '';
  const text =
    event.message?.text?.trim() ||    (event.postback
      ? event.postback.title || event.postback.payload || ''
      : '');

  const normalizedActionText =
    quickReplyPayload === 'ORDER_CONFIRM' || quickReplyPayload === 'ORDER_CONFIRM_YES'
      ? 'হ্যাঁ'
      : quickReplyPayload === 'ORDER_CANCEL' || quickReplyPayload === 'ORDER_CANCEL_NO'
        ? 'না'
        : quickReplyPayload === 'CART_ADD_PRODUCT'
          ? 'add another product'
          : quickReplyPayload === 'CART_CHECKOUT'
            ? 'checkout'
            : quickReplyPayload === 'ORDER_USE_SAVED_DETAILS'
              ? 'হ্যাঁ'
              : quickReplyPayload === 'ORDER_CHANGE_DETAILS'
                ? 'তথ্য পরিবর্তন'
                : quickReplyPayload === 'ORDER_STATUS'
                  ? 'order status'
                  : quickReplyPayload === 'PAYMENT_STATUS'
                    ? 'payment status'
                    : text;

  const quickReplyCountry =
    event.message?.quick_reply?.payload === 'COUNTRY_IN'
      ? 'IN'
      : event.message?.quick_reply?.payload === 'COUNTRY_BD'
        ? 'BD'
        : null;

  if (!senderId || senderId === META_PAGE_ID || !messageId || !text) {
    return;
  }

  const sb = adminSupabase();
  if (!sb) throw new Error('Supabase service configuration is incomplete');

  const conversation = await ensureConversation(sb, senderId);
  if (!conversation) throw new Error('Could not create Messenger conversation');

  // Meta can retry the same event. Check idempotency before consuming a rate-limit token.
  if (await hasSavedMessengerMessage(sb, messageId)) {
    return;
  }

  const currentCountry = getVerifiedCountry(conversation);
  const detectedCountry = quickReplyCountry || detectExplicitCountry(normalizedActionText);
  const rateLimitCountry = resolveMessengerRateLimitCountry({
    quickReplyCountry,
    detectedCountry,
    verifiedCountry: currentCountry,
  });

  const rateLimitInput = buildMessengerRateLimitInput(
    normalizedActionText,
    quickReplyPayload,
    event.postback?.title || '',
  );

  const messageRateLimit = await consumeMessengerRateLimit(sb, {
    pageId: META_PAGE_ID,
    externalUserId: senderId,
    countryCode: rateLimitCountry,
    messageHash: hashMessengerMessage(rateLimitInput),
    mode: 'message',
  });

  if (!messageRateLimit.allowed) {
    if (messageRateLimit.notify_customer) {
      const rateLimitReply = getMessengerRateLimitReply(messageRateLimit);
      try {
        await sendMessengerText(senderId, rateLimitReply);
      } catch (error) {
        console.error(
          'Messenger rate-limit notice failed:',
          error instanceof Error ? error.message : 'Unknown rate-limit notice error',
        );
      }
    }
    return;
  }

  await markConversation(sb, conversation.id, conversation.status, {
    last_sender_id: senderId,
    last_event_at: new Date().toISOString(),
  });

  const resolvedCountry = detectedCountry || currentCountry;


  const savedUserMessage = await saveMessage(sb, conversation.id, {
    role: 'user',
    content: normalizedActionText,
    externalMessageId: messageId,
    countryCode: resolvedCountry,
    sourceContext: {
      timestamp: event.timestamp || null,
      postback: event.postback || null,
      country_detected: detectedCountry,
      country_verified: Boolean(resolvedCountry),
      country_source: detectedCountry
        ? 'customer_message'
        : currentCountry
          ? 'conversation'
          : 'unknown',
    },
  });

  if (savedUserMessage.duplicate) return;

  const conversationMetadata = conversation.metadata || {};
  let humanTakeoverActive = conversationMetadata.human_takeover === true;
  let conversationStatus = conversation.status;
  let humanSupportClosed = conversationMetadata.human_support_state === 'closed';

  // Reconcile stale human-support state before applying the hard AI stop.
  // Admin close marks the handoff resolved and the conversation closed-state
  // metadata. If an older webhook snapshot still says takeover=true/handoff,
  // the resolved handoff must win so AI can resume.
  if (
    (humanTakeoverActive && conversationStatus === 'handoff') ||
    conversationMetadata.human_support_state === 'closed'
  ) {
    const configuredHandoffId =
      typeof conversationMetadata.human_support_handoff_id === 'string'
        ? conversationMetadata.human_support_handoff_id
        : null;

    const { data: explicitHandoff, error: explicitHandoffError } =
      configuredHandoffId
        ? await sb
            .from('ai_handoffs')
            .select('id,status,reason')
            .eq('id', configuredHandoffId)
            .eq('conversation_id', conversation.id)
            .maybeSingle()
        : await sb
            .from('ai_handoffs')
            .select('id,status,reason')
            .eq('conversation_id', conversation.id)
            .eq('reason', 'customer_requested_human_support')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

    if (explicitHandoffError) throw explicitHandoffError;

    const handoffIsClosed =
      explicitHandoff?.reason === 'customer_requested_human_support' &&
      (explicitHandoff.status === 'resolved' || explicitHandoff.status === 'cancelled');
    const metadataSaysClosed = conversationMetadata.human_support_state === 'closed';

    if (handoffIsClosed || metadataSaysClosed) {
      conversationStatus = 'active';
      humanTakeoverActive = false;
      humanSupportClosed = true;

      await markConversation(
        sb,
        conversation.id,
        'active',
        {
          human_takeover: false,
          human_support_state: 'closed',
          human_support_resume_reconciled_at: new Date().toISOString(),
        },
        resolvedCountry || undefined,
      );
    }
  }

  // A Bangladesh human-support takeover is a hard AI stop. Customer messages
  // are still stored for the agent, but the automated router must not resume.
  if (humanTakeoverActive && conversationStatus === 'handoff') {
    await markConversation(
      sb,
      conversation.id,
      'handoff',
      {
        human_support_last_customer_message_at: new Date().toISOString(),
      },
      resolvedCountry || undefined,
    );

    const waitingReply = getBangladeshHumanSupportWaitingReply();
    await saveMessage(sb, conversation.id, {
      role: 'assistant',
      content: waitingReply,
      actionStatus: 'human_support_queue_waiting',
      countryCode: resolvedCountry || 'BD',
      sourceContext: {
        human_takeover_block: true,
        ai_call_skipped: true,
      },
    });
    await sendMessengerText(senderId, waitingReply);
    return;
  }

  // Existing provider-failure handoffs can still resume automatically, preserving
  // the Phase 1 fallback behavior. Only explicit human takeover is sticky.
  if (conversation.status === 'handoff') {
    await markConversation(
      sb,
      conversation.id,
      'active',
      {
        handoff_resumed_at: new Date().toISOString(),
        handoff_resume_reason: 'new_customer_message',
      },
      resolvedCountry || undefined,
    );
  }

  // Human-support requests are handled deterministically, before AI or order logic.
  // Bangladesh requests create a real support-queue handoff and hard-stop the AI.
  if (resolvedCountry === 'BD' && isHumanSupportRequest(normalizedActionText)) {
    const handoff = await createHumanHandoff(
      sb,
      conversation.id,
      'customer_requested_human_support',
      'BD',
    );

    await markConversation(
      sb,
      conversation.id,
      'handoff',
      {
        human_takeover: true,
        human_support_state: 'pending',
        human_support_handoff_id: handoff.id,
        human_support_requested_at: new Date().toISOString(),
        human_support_last_customer_message_at: new Date().toISOString(),
        human_support_request_text: normalizedActionText.slice(0, 500),
        handoff_reason: 'customer_requested_human_support',
        handoff_at: new Date().toISOString(),
      },
      'BD',
    );

    const supportMessage = getBangladeshHumanSupportAcknowledgement();
    await saveMessage(sb, conversation.id, {
      role: 'assistant',
      content: supportMessage,
      actionStatus: 'human_support_queue_created',
      countryCode: 'BD',
      sourceContext: {
        human_takeover: true,
        ai_call_skipped: true,
        handoff_id: handoff.id,
        queue_state: 'pending',
      },
    });
    await sendMessengerText(senderId, supportMessage);
    return;
  }

  // India customers retain the existing external WhatsApp/direct-call support flow.
  if (resolvedCountry === 'IN' && isHumanSupportRequest(normalizedActionText)) {
    const supportMessage = getMessengerHumanSupportContactReply(
      'IN',
      detectMessengerReplyLanguage(normalizedActionText),
    );
    await markConversation(sb, conversation.id, 'handoff', {
      handoff_reason: 'customer_requested_human_support',
      handoff_at: new Date().toISOString(),
      support_contact: '+91 6002786881',
    }, 'IN');
    await saveMessage(sb, conversation.id, {
      role: 'assistant',
      content: supportMessage,
      actionStatus: 'human_support_contact',
      countryCode: 'IN',
    });
    await sendMessengerText(senderId, supportMessage);
    return;
  }

  const profileSignal = await getMetaProfileSignal(senderId);

  if (profileSignal.locale || profileSignal.countryHint) {
    await markConversation(
      sb,
      conversation.id,
      conversation.status,
      {        meta_profile_locale: profileSignal.locale,
        meta_country_hint: profileSignal.countryHint,
        meta_country_hint_source: 'messenger_profile_locale',
        meta_country_hint_checked_at: new Date().toISOString(),
      },
    );
  }

  let activeCountry = resolvedCountry;

  if (detectedCountry) {
    await markConversation(
      sb,
      conversation.id,
      'active',
      {
        country_code: detectedCountry,
        country_verified: true,
        country_source: 'customer_message',
        country_confirmed_at: new Date().toISOString(),
      },
      detectedCountry,
    );
    activeCountry = detectedCountry;

    const countrySelection = normalizedActionText.toLocaleLowerCase().trim();
    if (countrySelection === 'india' || countrySelection === 'bangladesh') {
      const confirmation =
        activeCountry === 'IN'
          ? 'ঠিক আছে। আপনার জন্য India 🇮🇳 সাপোর্ট তথ্য ব্যবহার করা হবে। এখন আপনার প্রশ্নটি লিখুন।'
          : 'ঠিক আছে। আপনার জন্য Bangladesh 🇧🇩 সাপোর্ট তথ্য ব্যবহার করা হবে। এখন আপনার প্রশ্নটি লিখুন।';
      const products = await listMessengerProducts(sb, activeCountry, 12);
      const serializedProducts = serializeMessengerProducts(products);
      const catalogReply = formatMessengerCatalogReply(
        'কি কি product ase?',
        serializedProducts as Array<Record<string, unknown>>,
        activeCountry,
      );
      const productQuickReplies = serializedProducts
        .slice(0, 13)
        .map((product) => ({
          title: messengerProductReplyTitle(product),
          payload: `PRODUCT_SELECT:${String(product.id)}`,
        }));
      const messengerCountry: CountryCode = activeCountry;
      const productCards = (serializedProducts as Array<Record<string, unknown>>)
        .filter((product) => typeof product.image === 'string' && product.image.trim())
        .map((product) => ({
          title: formatMessengerProductName(product),
          subtitle:
            (typeof product.effective_price === 'number'
              ? formatMessengerCurrency(messengerCountry) + product.effective_price
              : 'দাম জানা নেই') +
            ' • Stock: ' +
            (typeof product.stock === 'number' ? product.stock : 0),
          imageUrl: String(product.image),
          productId: String(product.id),
          productUrl:
            typeof product.slug === 'string' && product.slug
              ? 'https://www.gaziseed.com/product/' + encodeURIComponent(product.slug)
              : undefined,
        }));
      const reply = `${confirmation}\n\n${catalogReply}`;
      await saveMessage(sb, conversation.id, {
        role: 'assistant',
        content: reply,
        actionStatus: 'country_confirmed',
        countryCode: activeCountry,
        sourceContext: {
          country_confirmed_with_catalog: true,
          product_count: products.length,
        },
      });
      await sendMessengerText(
        senderId,
        reply,
        productQuickReplies,
        undefined,
        productCards,
      );
      return;
    }
  }

  if (!activeCountry) {
    const hintText =
      profileSignal.countryHint
        ? 'আপনার Messenger profile থেকে একটি country/language signal পাওয়া গেছে, তবে নিশ্চিত করার জন্য '
        : '';
    const countryQuestion = hintText + getCountryQuestion();
    await saveMessage(sb, conversation.id, {
      role: 'assistant',
      content: countryQuestion,
      actionStatus: 'country_selection_required',
      sourceContext: {
        country_required: true,
      },
    });
    await sendMessengerText(senderId, countryQuestion, [
      { title: '🇮🇳 India', payload: 'COUNTRY_IN' },
      { title: '🇧🇩 Bangladesh', payload: 'COUNTRY_BD' },
    ]);
    return;
  }

  const selectedProductId = parseMessengerProductSelection(quickReplyPayload);
  if (selectedProductId) {
    const { data: selectedProduct, error: selectedProductError } = await sb
      .from('products')
      .select(
        'id,name_bn,name_en,slug,regular_price,sale_price,offer_price,price,stock,is_active,country_code',
      )
      .eq('id', selectedProductId)
      .eq('country_code', activeCountry)
      .eq('is_active', true)
      .maybeSingle();

    if (selectedProductError) throw selectedProductError;
    if (!selectedProduct) {
      const unavailableLanguage = detectMessengerReplyLanguage(normalizedActionText);
      const unavailableMessage =
        unavailableLanguage === 'English'
          ? 'Sorry, this product is no longer available. Ask me to show the product list again.'
          : unavailableLanguage === 'Hindi'
            ? 'माफ़ कीजिए, यह product अब उपलब्ध नहीं है। Product list फिर से देखने के लिए कहें।'
            : 'দুঃখিত, এই পণ্যটি এখন আর পাওয়া যাচ্ছে না। আবার পণ্যের তালিকা দেখতে বলুন।';
      await saveMessage(sb, conversation.id, {
        role: 'assistant',
        content: unavailableMessage,
        actionStatus: 'product_selection_unavailable',
        countryCode: activeCountry,
      });
      await sendMessengerText(senderId, unavailableMessage);
      return;
    }

    const selectedPrice = [
      selectedProduct.offer_price,
      selectedProduct.sale_price,
      selectedProduct.price,
      selectedProduct.regular_price,
    ].find((value): value is number => typeof value === 'number' && value > 0) ?? 0;

    const selectedStock = Number(selectedProduct.stock || 0);
    const selectionLanguage = detectMessengerReplyLanguage(normalizedActionText);
    const selectedName =
      selectionLanguage === 'English' || selectionLanguage === 'Hindi'
        ? selectedProduct.name_en || selectedProduct.name_bn || selectedProduct.slug || 'Product'
        : selectedProduct.name_bn || selectedProduct.name_en || selectedProduct.slug || 'পণ্য';

    const selectedMessage =
      selectedStock > 0 && selectedPrice > 0
        ? selectionLanguage === 'English'
          ? `✅ Selected: ${selectedName}\n💰 Price: ${formatMessengerCurrency(activeCountry)}${selectedPrice} per packet\n📦 Stock: ${selectedStock} packets\n\nHow many packets would you like to order?`
          : selectionLanguage === 'Hindi'
            ? `✅ आपने चुना: ${selectedName}\n💰 कीमत: ${formatMessengerCurrency(activeCountry)}${selectedPrice} प्रति पैकेट\n📦 स्टॉक: ${selectedStock} पैकेट\n\nआप कितने पैकेट ऑर्डर करना चाहते हैं?`
            : `✅ আপনি বেছে নিয়েছেন: ${selectedName}\n💰 দাম: ${formatMessengerCurrency(activeCountry)}${selectedPrice} প্রতি প্যাকেট\n📦 স্টক: ${selectedStock} প্যাকেট\n\nকত প্যাকেট অর্ডার করতে চান?`
        : selectionLanguage === 'English'
          ? `Sorry, ${selectedName} is not currently available to order.`
          : selectionLanguage === 'Hindi'
            ? `माफ़ कीजिए, ${selectedName} अभी ऑर्डर के लिए उपलब्ध नहीं है।`
            : `দুঃখিত, ${selectedName} এখন অর্ডার করা যাচ্ছে না।`;

    await markConversation(
      sb,
      conversation.id,
      'active',
      {
        last_messenger_product: {
          id: selectedProduct.id,
          name: selectedName,
          price: selectedPrice,
          stock: selectedStock,
        },
        pending_messenger_order:
          selectedStock > 0 && selectedPrice > 0
            ? {
                step: 'quantity',
                product_id: selectedProduct.id,
                product_name: selectedName,
                unit_price: selectedPrice,
                stock: selectedStock,
              }
            : null,
        suspended_messenger_order: null,
        suspended_messenger_product: null,
        product_selection_at: new Date().toISOString(),
      },
      activeCountry,
    );

    await saveMessage(sb, conversation.id, {
      role: 'assistant',
      content: selectedMessage,
      actionStatus: 'product_selected',
      countryCode: activeCountry,
      sourceContext: {
        deterministic_product_selection: true,
        product_id: selectedProduct.id,
      },
    });
    await sendMessengerText(senderId, selectedMessage);
    return;
  }

  // Resume a previously suspended order before the new intent router runs.
  const suspendedOrder = parsePendingMessengerOrder(
    conversation.metadata?.suspended_messenger_order,
  );
  if (
    suspendedOrder &&
    !conversation.metadata?.pending_messenger_order &&
    isMessengerOrderResumeRequest(normalizedActionText) &&
    !isMessengerOrderTrackingRequest(normalizedActionText)
  ) {
    const suspendedProduct = conversation.metadata?.suspended_messenger_product;
    const resumeMetadata: Record<string, unknown> = {
      pending_messenger_order: suspendedOrder,
      suspended_messenger_order: null,
      suspended_messenger_product: null,
      last_messenger_product:
        suspendedProduct && typeof suspendedProduct === 'object'
          ? suspendedProduct
          : {
              id: suspendedOrder.product_id,
              name: suspendedOrder.product_name,
              price: suspendedOrder.unit_price,
              stock: suspendedOrder.stock,
            },
      order_resumed_at: new Date().toISOString(),
      order_resume_reason: 'customer_requested_resume',
    };

    await markConversation(
      sb,
      conversation.id,
      'active',
      resumeMetadata,
      activeCountry,
    );
    conversation.metadata = {
      ...(conversation.metadata || {}),
      ...resumeMetadata,
    };

    const resumeReply = getMessengerOrderResumeReply(suspendedOrder, detectMessengerReplyLanguage(normalizedActionText));
    await saveMessage(sb, conversation.id, {
      role: 'assistant',
      content: resumeReply,
      actionStatus: 'order_flow_resume',
      countryCode: activeCountry,
      sourceContext: {
        order_flow: true,
        pending_step: suspendedOrder.step,
        resumed_order: true,
      },
    });
    await sendMessengerText(senderId, resumeReply);
    return;
  }

  const messengerCartItems = parseMessengerCartItems(
    conversation.metadata?.messenger_cart_items,
  );


  // Phase 1 cart controls: only Messenger cart metadata is changed here.
  if (isMessengerCartViewRequest(normalizedActionText)) {
    const reply =
      formatMessengerCartSummary(messengerCartItems, formatMessengerCurrency(activeCountry)) +
      (messengerCartItems.length
        ? '\n\n🛒 Cart options: Checkout / Add more product'
        : '\n\nএকটি product select করে quantity দিলে cart তৈরি হবে।');

    await saveMessage(sb, conversation.id, {
      role: 'assistant',
      content: reply,
      actionStatus: 'cart_view',
      countryCode: activeCountry,
      sourceContext: { deterministic_cart_action: true },
    });
    await sendMessengerText(
      senderId,
      reply,
      messengerCartItems.length
        ? [
            { title: '✅ Checkout', payload: 'CART_CHECKOUT' },
            { title: '➕ Add product', payload: 'CART_ADD_PRODUCT' },
          ]
        : undefined,
    );
    return;
  }

  if (isMessengerCartRemoveRequest(normalizedActionText) && messengerCartItems.length > 0) {
    const target = findMessengerCartItem(messengerCartItems, normalizedActionText);

    if (!target) {
      const reply =
        formatMessengerCartSummary(messengerCartItems, formatMessengerCurrency(activeCountry)) +
        '\n\nকোন productটি remove করতে চান, নামটি লিখুন।';
      await sendMessengerText(senderId, reply);
      return;
    }

    const nextItems = messengerCartItems.filter((item) => item.product_id !== target.product_id);
    await markConversation(
      sb,
      conversation.id,
      'active',
      { messenger_cart_items: nextItems, cart_updated_at: new Date().toISOString() },
      activeCountry,
    );
    conversation.metadata = { ...(conversation.metadata || {}), messenger_cart_items: nextItems };

    const reply =
      '🗑️ ' + target.product_name + ' cart থেকে remove করা হয়েছে.\n\n' +
      formatMessengerCartSummary(nextItems, formatMessengerCurrency(activeCountry));

    await saveMessage(sb, conversation.id, {
      role: 'assistant',
      content: reply,
      actionStatus: 'cart_remove',
      countryCode: activeCountry,
      sourceContext: { product_id: target.product_id },
    });
    await sendMessengerText(senderId, reply);
    return;
  }

  if (isMessengerCartQuantityChangeRequest(normalizedActionText) && messengerCartItems.length > 0) {
    const target = findMessengerCartItem(messengerCartItems, normalizedActionText);
    const quantity = parseMessengerCartQuantity(normalizedActionText);

    if (!target || !quantity) {
      await sendMessengerText(senderId, 'কোন product-এর quantity কত করতে চান সেটি লিখুন। উদাহরণ: “মরিচ 3টা”।');
      return;
    }

    const { data: liveProduct, error: liveProductError } = await sb
      .from('products')
      .select('id,name_bn,name_en,stock,regular_price,sale_price,offer_price,price,country_code,is_active')
      .eq('id', target.product_id)
      .eq('country_code', activeCountry)
      .eq('is_active', true)
      .maybeSingle();

    if (liveProductError) throw liveProductError;

    if (!liveProduct) {
      await sendMessengerText(senderId, target.product_name + ' এখন আর available নেই।');
      return;
    }

    const liveStock = typeof liveProduct.stock === 'number' ? liveProduct.stock : 0;
    if (quantity > liveStock) {
      await sendMessengerText(
        senderId,
        '📦 ' + (liveProduct.name_bn || liveProduct.name_en || target.product_name) +
          '-এর বর্তমান stock ' + liveStock + ' প্যাকেট। ' + quantity + 'টি দেওয়া সম্ভব নয়।',
      );
      return;
    }

    const livePrice =
      [liveProduct.offer_price, liveProduct.sale_price, liveProduct.price, liveProduct.regular_price]
        .find((value) => typeof value === 'number' && value > 0) ?? target.unit_price;

    const nextItems = messengerCartItems.map((item) =>
      item.product_id === target.product_id
        ? {
            ...item,
            quantity,
            stock: liveStock,
            unit_price: livePrice,
            product_name: liveProduct.name_bn || liveProduct.name_en || item.product_name,
          }
        : item,
    );

    await markConversation(
      sb,
      conversation.id,
      'active',
      { messenger_cart_items: nextItems, cart_updated_at: new Date().toISOString() },
      activeCountry,
    );
    conversation.metadata = { ...(conversation.metadata || {}), messenger_cart_items: nextItems };

    const reply =
      '✅ ' + (liveProduct.name_bn || liveProduct.name_en || target.product_name) +
      '-এর quantity ' + quantity + ' করা হয়েছে.\n\n' +
      formatMessengerCartSummary(nextItems, formatMessengerCurrency(activeCountry));

    await saveMessage(sb, conversation.id, {
      role: 'assistant',
      content: reply,
      actionStatus: 'cart_quantity_update',
      countryCode: activeCountry,
      sourceContext: { product_id: target.product_id, quantity },
    });
    await sendMessengerText(senderId, reply);
    return;
  }

  if (isMessengerAddToCartRequest(normalizedActionText)) {
    const pending = parsePendingMessengerOrder(conversation.metadata?.pending_messenger_order);

    if (!pending) {
      await sendMessengerText(senderId, 'কোন productটি cart-এ যোগ করতে চান আগে product select করুন।');
      return;
    }

    if (!pending.quantity) {
      await sendMessengerText(
        senderId,
        pending.product_name + '-এর quantity আগে দিন। তারপর “cart-এ যোগ করুন” লিখুন।',
      );
      return;
    }

    const nextItems = addPendingMessengerOrderToCart(messengerCartItems, pending);

    await markConversation(
      sb,
      conversation.id,
      'active',
      {
        messenger_cart_items: nextItems,
        pending_messenger_order: null,
        last_messenger_product: null,
        cart_updated_at: new Date().toISOString(),
      },
      activeCountry,
    );
    conversation.metadata = {
      ...(conversation.metadata || {}),
      messenger_cart_items: nextItems,
      pending_messenger_order: null,
      last_messenger_product: null,
    };

    const reply =
      '🛒 ' + pending.product_name + ' cart-এ যোগ করা হয়েছে.\n\n' +
      formatMessengerCartSummary(nextItems, formatMessengerCurrency(activeCountry));

    await saveMessage(sb, conversation.id, {
      role: 'assistant',
      content: reply,
      actionStatus: 'cart_add',
      countryCode: activeCountry,
      sourceContext: { product_id: pending.product_id },
    });
    await sendMessengerText(
      senderId,
      reply,
      [
        { title: '✅ Checkout', payload: 'CART_CHECKOUT' },
        { title: '➕ Add product', payload: 'CART_ADD_PRODUCT' },
      ],
    );
    return;
  }


  if (isMessengerProductComparisonRequest(normalizedActionText)) {
    const queries = getMessengerComparisonQueries(normalizedActionText);
    if (queries.length < 2) {
      await sendMessengerText(senderId, 'দুটি product-এর নাম লিখুন। উদাহরণ: “টমেটো আর মরিচ তুলনা করো”।');
      return;
    }

    const messengerCountry = activeCountry;
    const matches = await Promise.all(
      queries.map((query) => searchMessengerProducts(sb, messengerCountry, query, 3)),
    );
    const selected = matches.map(
      (items) => items.find(isTrustedMessengerProductMatch) || null,
    );

    if (selected.some((item) => !item)) {
      await sendMessengerText(senderId, 'দুঃখিত, তুলনা করার জন্য দুটি matching active product পাওয়া যায়নি।');
      return;
    }

    const [left, right] = selected;
    if (!left || !right) {
      await sendMessengerText(senderId, 'দুঃখিত, তুলনা করার জন্য দুটি matching active product পাওয়া যায়নি।');
      return;
    }

    const leftPrice = [left.offer_price, left.sale_price, left.price, left.regular_price].find((v) => typeof v === 'number' && v > 0) ?? 0;
    const rightPrice = [right.offer_price, right.sale_price, right.price, right.regular_price].find((v) => typeof v === 'number' && v > 0) ?? 0;
    const currency = formatMessengerCurrency(activeCountry);

    const reply = [
      '⚖️ Product Comparison',
      '',
      '🌱 ' + (left.name_bn || left.name_en || left.slug || 'Product'),
      '💰 দাম: ' + currency + leftPrice,
      '📦 স্টক: ' + (left.stock ?? 0),
      '🌾 ধরন: ' + (left.seed_type || 'তথ্য নেই'),
      '🗓️ মৌসুম: ' + (left.season || 'তথ্য নেই'),
      '',
      '🌱 ' + (right.name_bn || right.name_en || right.slug || 'Product'),
      '💰 দাম: ' + currency + rightPrice,
      '📦 স্টক: ' + (right.stock ?? 0),
      '🌾 ধরন: ' + (right.seed_type || 'তথ্য নেই'),
      '🗓️ মৌসুম: ' + (right.season || 'তথ্য নেই'),
    ].join('\n');

    await saveMessage(sb, conversation.id, {
      role: 'assistant',
      content: reply,
      actionStatus: 'product_comparison',
      countryCode: activeCountry,
      sourceContext: { deterministic_product_comparison: true },
    });
    await sendMessengerText(
      senderId,
      reply,
      getMessengerProductSelectionQuickReplies([left, right]),
    );
    return;
  }

  // Multi-product cart: after selecting at least one product, the customer can
  // explicitly add another product without disturbing the existing checkout flow.
  if (isMessengerAddAnotherProductRequest(normalizedActionText)) {
    const pendingCartOrder = parsePendingMessengerOrder(
      conversation.metadata?.pending_messenger_order,
    );

    if (pendingCartOrder) {
      if (!pendingCartOrder.quantity) {
        const reply =
          `${pendingCartOrder.product_name}-এর কত প্যাকেট নিতে চান? আগে quantity দিন, তারপর আরও product যোগ করতে পারবেন।`;
        await saveMessage(sb, conversation.id, {
          role: 'assistant',
          content: reply,
          actionStatus: 'cart_quantity_required',
          countryCode: activeCountry,
        });
        await sendMessengerText(senderId, reply);
        return;
      }

      if (pendingCartOrder.step !== 'name' && pendingCartOrder.step !== 'quantity') {
        const reply =
          'আপনার customer details নেওয়া শুরু হয়ে গেছে। আগে এই cart/order-টি complete করুন; তারপর নতুন order করতে পারবেন।';
        await saveMessage(sb, conversation.id, {
          role: 'assistant',
          content: reply,
          actionStatus: 'cart_add_blocked_during_checkout',
          countryCode: activeCountry,
        });
        await sendMessengerText(senderId, reply);
        return;
      }

      const nextCartItems = addPendingMessengerOrderToCart(
        messengerCartItems,
        pendingCartOrder,
      );

      await markConversation(
        sb,
        conversation.id,
        'active',
        {
          messenger_cart_items: nextCartItems,
          pending_messenger_order: null,
          last_messenger_product: null,
          cart_updated_at: new Date().toISOString(),
        },
        activeCountry,
      );
      conversation.metadata = {
        ...(conversation.metadata || {}),
        messenger_cart_items: nextCartItems,
        pending_messenger_order: null,
        last_messenger_product: null,
      };

      const products = await listMessengerProducts(sb, activeCountry, 12);
      const serializedProducts = serializeMessengerProducts(products);
      const cartReply =
        formatMessengerCartSummary(nextCartItems, formatMessengerCurrency(activeCountry)) +
        '\n\n➕ আরেকটি product select করুন:';

      const productQuickReplies = serializedProducts
        .slice(0, 13)
        .map((product) => ({
          title: messengerProductReplyTitle(product),
          payload: `PRODUCT_SELECT:${String(product.id)}`,
        }));

      await saveMessage(sb, conversation.id, {
        role: 'assistant',
        content: cartReply,
        actionStatus: 'cart_add_product',
        countryCode: activeCountry,
        sourceContext: {
          cart_item_count: nextCartItems.length,
          deterministic_cart_action: true,
        },
      });
      await sendMessengerText(senderId, cartReply, productQuickReplies);
      return;
    }

    if (messengerCartItems.length > 0) {
      const products = await listMessengerProducts(sb, activeCountry, 12);
      const serializedProducts = serializeMessengerProducts(products);
      const cartReply =
        formatMessengerCartSummary(
          messengerCartItems,
          formatMessengerCurrency(activeCountry),
        ) +
        '\n\n➕ আরেকটি product select করুন:';

      const productQuickReplies = serializedProducts
        .slice(0, 13)
        .map((product) => ({
          title: messengerProductReplyTitle(product),
          payload: `PRODUCT_SELECT:${String(product.id)}`,
        }));

      await saveMessage(sb, conversation.id, {
        role: 'assistant',
        content: cartReply,
        actionStatus: 'cart_add_product',
        countryCode: activeCountry,
        sourceContext: {
          cart_item_count: messengerCartItems.length,
          deterministic_cart_action: true,
        },
      });
      await sendMessengerText(senderId, cartReply, productQuickReplies);
      return;
    }
  }

  // With an existing cart, "checkout" moves the customer into the existing
  // name/phone/address collection without creating an order early.
  if (
    isMessengerCheckoutRequest(normalizedActionText) &&
    messengerCartItems.length > 0
  ) {
    const checkoutPending = parsePendingMessengerOrder(
      conversation.metadata?.pending_messenger_order,
    );

    if (checkoutPending?.step === 'quantity' && !checkoutPending.quantity) {
      const reply = `${checkoutPending.product_name}-এর quantity আগে দিন।`;
      await saveMessage(sb, conversation.id, {
        role: 'assistant',
        content: reply,
        actionStatus: 'cart_checkout_quantity_required',
        countryCode: activeCountry,
      });
      await sendMessengerText(senderId, reply);
      return;
    }

    if (checkoutPending?.step === 'name') {
      const reply =
        'ঠিক আছে। এই cart-এর সব product একসাথে order হবে।\n\nআপনার নামটি লিখুন।';
      await saveMessage(sb, conversation.id, {
        role: 'assistant',
        content: reply,
        actionStatus: 'cart_checkout',
        countryCode: activeCountry,
      });
      await sendMessengerText(senderId, reply);
      return;
    }

    if (!checkoutPending) {
      const reply =
        formatMessengerCartSummary(
          messengerCartItems,
          formatMessengerCurrency(activeCountry),
        ) +
        '\n\nCart checkout করতে কোনো একটি product select করে quantity দিন।';
      await saveMessage(sb, conversation.id, {
        role: 'assistant',
        content: reply,
        actionStatus: 'cart_checkout',
        countryCode: activeCountry,
      });
      await sendMessengerText(senderId, reply);
      return;
    }
  }

  // A new product/catalog request starts a new intent. Never let an older
  // quantity/name/address order step hijack a fresh product question.
  // Catalog/list requests must bypass website/CMS knowledge lookups: those lookups can fail and prematurely return a support fallback before the live products query runs.
  const freshProductBrowseIntent =
    isOtherProductRequest(normalizedActionText) ||
    isProductListRequest(normalizedActionText);
  const startsNewProductIntent = isProductCatalogRequest(normalizedActionText);
  const pendingOrderBeforeInterrupt = parsePendingMessengerOrder(
    conversation.metadata?.pending_messenger_order,
  );
  const shouldSuspendPendingOrder =
    Boolean(pendingOrderBeforeInterrupt) &&
    isMessengerOrderInterruptRequest(normalizedActionText);

  if (shouldSuspendPendingOrder && pendingOrderBeforeInterrupt) {
    const suspensionMetadata: Record<string, unknown> = {
      pending_messenger_order: null,
      suspended_messenger_order: pendingOrderBeforeInterrupt,
      suspended_messenger_product:
        conversation.metadata?.last_messenger_product || {
          id: pendingOrderBeforeInterrupt.product_id,
          name: pendingOrderBeforeInterrupt.product_name,
          price: pendingOrderBeforeInterrupt.unit_price,
          stock: pendingOrderBeforeInterrupt.stock,
        },
      order_suspended_at: new Date().toISOString(),
      order_suspend_reason: isMessengerOrderResumeRequest(normalizedActionText)
        ? 'resume_guard'
        : 'customer_intent_interrupt',
    };

    if (freshProductBrowseIntent) {
      suspensionMetadata.last_messenger_product = null;
    }

    await markConversation(
      sb,
      conversation.id,
      'active',
      suspensionMetadata,
      activeCountry,
    );
    conversation.metadata = {
      ...(conversation.metadata || {}),
      ...suspensionMetadata,
    };
  }

  if (
    startsNewProductIntent &&
    (Boolean(conversation.metadata?.pending_messenger_order) ||
      (freshProductBrowseIntent && Boolean(conversation.metadata?.last_messenger_product)))
  ) {
    const resetMetadata = freshProductBrowseIntent
      ? {
          pending_messenger_order: null,
          last_messenger_product: null,
        }
      : {
          pending_messenger_order: null,
        };

    await markConversation(
      sb,
      conversation.id,
      'active',
      resetMetadata,
      activeCountry,
    );
    conversation.metadata = {
      ...(conversation.metadata || {}),
      ...resetMetadata,
    };
  }

  // A pending restock request can be completed with only a mobile number.
  // No Order Number and no OTP are required for this flow.
  const pendingRestock =
    conversation.metadata &&
    typeof conversation.metadata.pending_restock_notification === 'object' &&
    conversation.metadata.pending_restock_notification !== null
      ? (conversation.metadata.pending_restock_notification as { text?: unknown })
      : null;

  if (pendingRestock && isMessengerPhoneOnlyMessage(normalizedActionText)) {
    try {
      const phone = extractMessengerPhone(normalizedActionText);
      if (!phone) return;

      const linked = await linkMessengerCustomerProfileByPhone({
        supabase: sb,
        pageId: META_PAGE_ID,
        externalUserId: senderId,
        country: activeCountry,
        phone,
      });

      if (!linked.linked) {
        const reply =
          '📱 এই mobile number-এর সঙ্গে কোনো customer record পাওয়া যায়নি।\n\n' +
          'আপনার GAZI SEED order-এ দেওয়া mobile numberটি পাঠান।';
        await saveMessage(sb, conversation.id, {
          role: 'assistant',
          content: reply,
          actionStatus: 'restock_mobile_link_failed',
          countryCode: activeCountry,
          sourceContext: { restock_notification: true },
        });
        await sendMessengerText(senderId, reply);
        return;
      }

      const pendingText =
        typeof pendingRestock.text === 'string' ? pendingRestock.text : '';

      const restock = await subscribeMessengerRestockNotification({
        supabase: sb,
        pageId: META_PAGE_ID,
        externalUserId: senderId,
        country: activeCountry,
        text: pendingText,
      });

      await markConversation(
        sb,
        conversation.id,
        'active',
        { pending_restock_notification: null },
        activeCountry,
      );

      await saveMessage(sb, conversation.id, {
        role: 'assistant',
        content: restock.reply,
        actionStatus: 'restock_notification',
        countryCode: activeCountry,
        sourceContext: {
          restock_notification: true,
          subscribed: restock.subscribed,
          product_id: restock.product?.id || null,
          mobile_linked: true,
        },
      });
      await sendMessengerText(senderId, restock.reply);
      return;
    } catch (error) {
      console.error(
        'Messenger restock mobile linking failed:',
        error instanceof Error ? error.message : 'Unknown restock mobile linking error',
      );
    }
  }

  // Messenger payment status is deterministic and isolated from AI/order creation.
  if (isMessengerPaymentStatusRequest(normalizedActionText)) {
    try {
      const paymentStatus = await getMessengerPaymentStatusReply({
        supabase: sb,
        pageId: META_PAGE_ID,
        externalUserId: senderId,
        country: activeCountry,
        text,
        language: detectMessengerReplyLanguage(normalizedActionText),
        metadata: conversation.metadata,
      });

      await saveMessage(sb, conversation.id, {
        role: 'assistant',
        content: paymentStatus.reply,
        actionStatus: 'payment_status',
        countryCode: activeCountry,
        sourceContext: {
          payment_status: true,
          order_ids: paymentStatus.orderIds || [],
          cashfree_order_id: paymentStatus.cashfreeOrderId || null,
        },
      });
      await sendMessengerText(
        senderId,
        paymentStatus.reply,
        undefined,
        paymentStatus.paymentRetryButton,
      );
      return;
    } catch (error) {
      console.error(
        'Messenger payment status failed:',
        error instanceof Error ? error.message : 'Unknown payment status error',
      );
    }
  }

  // Messenger order tracking is deterministic and isolated from checkout.
  if (isMessengerOrderTrackingRequest(normalizedActionText)) {
    try {
      const tracking = await getMessengerOrderTrackingReply({
        supabase: sb,
        pageId: META_PAGE_ID,
        externalUserId: senderId,
        country: activeCountry,
        text,
      });

      await saveMessage(sb, conversation.id, {
        role: 'assistant',
        content: tracking.reply,
        actionStatus: 'order_tracking',
        countryCode: activeCountry,
        sourceContext: {
          order_tracking: true,
          requested_order_number: parseMessengerTrackingOrderNumber(text),
          order_ids: tracking.orderIds || [],
        },
      });
      await sendMessengerText(senderId, tracking.reply);
      return;
    } catch (error) {
      console.error(
        'Messenger order tracking failed:',
        error instanceof Error ? error.message : 'Unknown order tracking error',
      );
    }
  }

  // Customer profile and previous-order history are deterministic and isolated
  // from order creation. They use only the Messenger identity for the verified country,
  // or require Order Number + phone once to securely link the account.
  if (
    isMessengerCustomerProfileRequest(normalizedActionText) ||
    isMessengerOrderHistoryRequest(normalizedActionText) ||
    isMessengerOrderLinkRequest(normalizedActionText)
  ) {
    try {
      if (isMessengerOrderHistoryRequest(normalizedActionText)) {
        const history = await getMessengerOrderHistoryReply({
          supabase: sb,
          pageId: META_PAGE_ID,
          externalUserId: senderId,
          country: activeCountry,
          text,
        });

        await saveMessage(sb, conversation.id, {
          role: 'assistant',
          content: history.reply,
          actionStatus: 'customer_order_history',
          countryCode: activeCountry,
          sourceContext: {
            customer_profile: true,
            order_history: true,
            order_ids: history.orderIds,
            linked: history.linked,
          },
        });
        await sendMessengerText(senderId, history.reply);
        return;
      }

      const profile = await getMessengerCustomerProfileReply({
        supabase: sb,
        pageId: META_PAGE_ID,
        externalUserId: senderId,
        country: activeCountry,
        text,
      });

      await saveMessage(sb, conversation.id, {
        role: 'assistant',
        content: profile.reply,
        actionStatus: 'customer_profile',
        countryCode: activeCountry,
        sourceContext: {
          customer_profile: true,
          linked: profile.linked,
        },
      });
      await sendMessengerText(senderId, profile.reply);
      return;
    } catch (error) {
      console.error(
        'Messenger customer profile/history failed:',
        error instanceof Error ? error.message : 'Unknown customer profile error',
      );
    }
  }

  // Restock subscriptions are deterministic and write only to the existing
  // stock_notifications queue. No order, payment, or inventory mutation occurs.
  if (isMessengerRestockNotificationRequest(normalizedActionText)) {
    try {
      const restock = await subscribeMessengerRestockNotification({
        supabase: sb,
        pageId: META_PAGE_ID,
        externalUserId: senderId,
        country: activeCountry,
        text,
      });

      await saveMessage(sb, conversation.id, {
        role: 'assistant',
        content: restock.reply,
        actionStatus: 'restock_notification',
        countryCode: activeCountry,
        sourceContext: {
          restock_notification: true,
          subscribed: restock.subscribed,
          product_id: restock.product?.id || null,
        },
      });

      if (restock.needsPhone) {
        await markConversation(
          sb,
          conversation.id,
          'active',
          {
            pending_restock_notification: {
              text,
              created_at: new Date().toISOString(),
            },
          },
          activeCountry,
        );
      }

      await sendMessengerText(senderId, restock.reply);
      return;
    } catch (error) {
      console.error(
        'Messenger restock notification failed:',
        error instanceof Error ? error.message : 'Unknown restock notification error',
      );
    }
  }

  // Customer recommendations are deterministic and read-only. They never create
  // or modify an order; the existing product-card Order Now action remains the
  // only entry point into the secure order flow.
  if (isMessengerRecommendationRequest(normalizedActionText)) {
    try {
      const recommendations = await getMessengerCustomerRecommendations({
        supabase: sb,
        pageId: META_PAGE_ID,
        externalUserId: senderId,
        country: activeCountry,
        limit: 3,
      });

      const currency = formatMessengerCurrency(activeCountry);
      const productCards = recommendations.products.map((product) => {
        const productRecord = product as Record<string, unknown>;
        const name = formatMessengerProductName(productRecord);
        const priceValue =
          typeof productRecord.offer_price === 'number'
            ? productRecord.offer_price
            : typeof productRecord.sale_price === 'number'
              ? productRecord.sale_price
              : typeof productRecord.price === 'number'
                ? productRecord.price
                : typeof productRecord.regular_price === 'number'
                  ? productRecord.regular_price
                  : 0;
        const stock =
          typeof product.stock === 'number' ? product.stock : 0;

        return {
          title: name,
          subtitle:
            currency +
            String(priceValue) +
            ' • Stock: ' +
            String(stock) +
            ' pack' +
            (stock === 1 ? '' : 's'),
          imageUrl: product.image || undefined,
          productId: product.id,
          productUrl: product.slug
            ? 'https://www.gaziseed.com/product/' + encodeURIComponent(product.slug)
            : undefined,
        };
      });

      await saveMessage(sb, conversation.id, {
        role: 'assistant',
        content: recommendations.reply,
        actionStatus: 'customer_recommendation',
        countryCode: activeCountry,
        sourceContext: {
          customer_recommendation: true,
          personalized: recommendations.personalized,
          product_ids: recommendations.products.map((product) => product.id),
        },
      });

      await sendMessengerText(
        senderId,
        recommendations.reply,
        undefined,
        undefined,
        productCards,
      );
      return;
    } catch (error) {
      console.error(
        'Messenger recommendation failed:',
        error instanceof Error ? error.message : 'Unknown recommendation error',
      );
    }
  }

  // General agricultural questions remain AI-capable for both countries.
  // Product/catalog questions with a seed-advice intent continue through the AI path
  // so multi-intent requests such as “দাম কত এবং কীভাবে বপন করব?” can be answered together.

  // A delivery-policy question is a fresh information request, not an
  // order quantity/name answer. Route it before the pending-order handler so
  // wording such as "ভারতে ₹৫০০ টাকার অর্ডারে ডেলিভারি চার্জ কত?" cannot
  // be hijacked by the previously selected product's checkout flow.
  if (
    !startsNewProductIntent &&
    !isMessengerDeliveryPolicyQuestion(normalizedActionText)
  ) {
    try {
      const pendingOrderBeforeFlow = parsePendingMessengerOrder(
        conversation.metadata?.pending_messenger_order,
      );
      const shouldLoadCustomerProfile =
        Boolean(pendingOrderBeforeFlow) || isMessengerOrderIntent(normalizedActionText);
      const repeatCustomerProfile = shouldLoadCustomerProfile
        ? await getMessengerOrderCustomerProfile({
            supabase: sb,
            pageId: META_PAGE_ID,
            externalUserId: senderId,
            country: activeCountry,
          })
        : null;
      const orderFlow = await handleMessengerOrderFlow({
        supabase: sb,
        country: activeCountry,
        text: quickReplyPayload ? normalizedActionText : text,
        metadata: conversation.metadata,
        customerProfile: repeatCustomerProfile,
      });
      const nextPendingOrder = parsePendingMessengerOrder(orderFlow.pending);

    if (orderFlow.handled) {
      const orderNumberMatch =
        orderFlow.reply.match(/GS-(?:IN|BD)-[A-Z0-9]{8}/i)?.[0] || null;

      if (
        orderNumberMatch &&
        (
          pendingOrderBeforeFlow?.customer_phone ||
          pendingOrderBeforeFlow?.customer_name ||
          nextPendingOrder?.customer_phone ||
          nextPendingOrder?.customer_name
        )
      ) {
        try {
          await upsertMessengerCustomerProfile({
            supabase: sb,
            pageId: META_PAGE_ID,
            externalUserId: senderId,
            country: activeCountry,
            name:
              nextPendingOrder?.customer_name ||
              pendingOrderBeforeFlow?.customer_name ||
              null,
            phone:
              nextPendingOrder?.customer_phone ||
              pendingOrderBeforeFlow?.customer_phone ||
              null,
            address:
              nextPendingOrder?.delivery_address ||
              pendingOrderBeforeFlow?.delivery_address ||
              null,
            orderNumber: orderNumberMatch,
          });
        } catch (profileError) {
          console.error(
            'Messenger customer profile sync failed:',
            profileError instanceof Error
              ? profileError.message
              : 'Unknown profile error',
          );
        }
      }

      const nextCartMetadata =
        nextPendingOrder && messengerCartItems.length
          ? messengerCartItems
          : nextPendingOrder
            ? conversation.metadata?.messenger_cart_items || null
            : null;

      const paymentButtonUrl =
        'paymentButton' in orderFlow && orderFlow.paymentButton?.url
          ? orderFlow.paymentButton.url
          : '';
      const cashfreeOrderIdMatch = paymentButtonUrl.match(/(?:[?&])order_id=(GS-CF-[0-9a-f-]{36})\b/i);
      const paymentMetadata = cashfreeOrderIdMatch?.[1]
        ? {
            messenger_payment: {
              cashfree_order_id: cashfreeOrderIdMatch[1],
              country: activeCountry,
              started_at: new Date().toISOString(),
            },
          }
        : {};

      await markConversation(
        sb,
        conversation.id,
        'active',
        {
          pending_messenger_order: orderFlow.pending || null,
          messenger_cart_items: nextCartMetadata,
          ...paymentMetadata,
        },
        activeCountry,
      );

      await saveMessage(sb, conversation.id, {
        role: 'assistant',
        content: orderFlow.reply,
        actionStatus: 'order_flow',
        countryCode: activeCountry,
        sourceContext: {
          order_flow: true,
          pending_step: orderFlow.pending?.step || null,
        },
      });

      const confirmationQuickReplies =
        orderFlow.pending?.step === 'saved_details_confirmation'
          ? [
              { title: '✅ Saved details ব্যবহার করুন', payload: 'ORDER_USE_SAVED_DETAILS' },
              { title: '✏️ তথ্য পরিবর্তন করুন', payload: 'ORDER_CHANGE_DETAILS' },
            ]
          : orderFlow.pending?.step === 'confirmation'
            ? [
                { title: '✅ হ্যাঁ, অর্ডার নিশ্চিত করুন', payload: 'ORDER_CONFIRM' },
                { title: '❌ না, অর্ডার বাতিল করুন', payload: 'ORDER_CANCEL' },
              ]
            : orderFlow.pending?.step === 'name'
              ? [
                  { title: '➕ আরও product', payload: 'CART_ADD_PRODUCT' },
                  { title: '✅ Checkout', payload: 'CART_CHECKOUT' },
                ]
              : 'paymentButton' in orderFlow && orderFlow.paymentButton
                ? [{ title: '💳 Payment Status', payload: 'PAYMENT_STATUS' }]
                : orderNumberMatch
                  ? [{ title: '📦 Order Status', payload: 'ORDER_STATUS' }]
                  : undefined;

      await sendMessengerText(
        senderId,
        orderFlow.reply,
        confirmationQuickReplies,
        'paymentButton' in orderFlow ? orderFlow.paymentButton : undefined,
      );
      return;
      }
    } catch (error) {
      console.error(
        'Messenger order flow failed:',
      error instanceof Error ? error.message : 'Unknown order flow error',
    );

    const orderErrorMessage =
      'দুঃখিত, অর্ডার সিস্টেমে সাময়িক সমস্যা হচ্ছে। একটু পরে আবার চেষ্টা করুন।';

    await saveMessage(sb, conversation.id, {
      role: 'assistant',
      content: orderErrorMessage,
      actionStatus: 'order_error',
      countryCode: activeCountry,
    });

      await sendMessengerText(senderId, orderErrorMessage);
      return;
    }
  }

  // Handle delivery fees and timelines deterministically from the same tables
  // used by checkout; never ask generative AI to calculate a live delivery fee.
  const deliveryChargeQuestion = isMessengerDeliveryChargeQuestion(normalizedActionText);
  const deliveryTimeQuestion = isMessengerDeliveryTimeQuestion(normalizedActionText);
  const shouldUseExistingBangladeshPaymentReply =
    activeCountry === 'BD' &&
    isBangladeshPaymentMethodQuestion(normalizedActionText) &&
    !deliveryChargeQuestion &&
    !deliveryTimeQuestion;

  if (
    isMessengerDeliveryPolicyQuestion(normalizedActionText) &&
    !shouldUseExistingBangladeshPaymentReply
  ) {
    const deliveryLanguage = detectMessengerReplyLanguage(normalizedActionText);
    let deliveryReply: string | null = null;
    let deliveryLookupFailed = false;

    try {
      const verifiedPolicy = await getMessengerDeliveryPolicy(sb, activeCountry);
      deliveryReply = formatMessengerDeliveryPolicyReply(
        verifiedPolicy,
        activeCountry,
        normalizedActionText,
        deliveryLanguage,
      );
    } catch (error) {
      deliveryLookupFailed = true;
      console.error(
        'Messenger delivery policy lookup failed:',
        error instanceof Error ? error.message : 'Unknown delivery policy lookup error',
      );
    }

    if (!deliveryReply) {
      deliveryReply = getMessengerHumanSupportContactReply(
        activeCountry,
        deliveryLanguage,
        'unverified',
      );
    }

    await saveMessage(sb, conversation.id, {
      role: 'assistant',
      content: deliveryReply,
      actionStatus: deliveryLookupFailed ? 'delivery_policy_lookup_failed' : 'database_delivery_policy',
      countryCode: activeCountry,
      sourceContext: {
        database_first: true,
        ai_call_skipped: true,
        database_lookup_failed: deliveryLookupFailed,
        source_tables: ['delivery_country_settings', 'delivery_charge_rules'],
      },
    });
    await sendMessengerText(senderId, deliveryReply);
    return;
  }

  // Prefer verified website/catalog knowledge before generic agriculture AI.
  // A fresh "other product" browse request must go directly to the catalog so
  // stale last_messenger_product context cannot answer for the previous item.
  if (!freshProductBrowseIntent) {
    try {
      const knowledgeResult = await getMessengerWebsiteKnowledgeAnswer({
      supabase: sb,
      country: activeCountry,
      text: normalizedActionText,
      metadata: conversation.metadata,
    });

    if (knowledgeResult.handled && knowledgeResult.reply) {
      await saveMessage(sb, conversation.id, {
        role: 'assistant',
        content: knowledgeResult.reply,
        actionStatus: 'website_knowledge',
        countryCode: activeCountry,
        sourceContext: {
          deterministic_website_knowledge: true,
          ai_call_skipped: true,
          product_id: knowledgeResult.productId || null,
        },
      });

      await markConversation(sb, conversation.id, 'active', {
        last_knowledge_source: 'products/product_faqs',
        last_knowledge_product_id: knowledgeResult.productId || null,
      }, activeCountry);

      const productSelectionOptions = knowledgeResult.productId
        ? [{
            title: '🛒 এই পণ্য নিন',
            payload: `PRODUCT_SELECT:${knowledgeResult.productId}`,
          }]
        : undefined;
      await sendMessengerText(
        senderId,
        knowledgeResult.reply,
        productSelectionOptions,
      );
      return;
    }
  } catch (error) {
    console.error(
      'Messenger website knowledge lookup failed:',
      error instanceof Error ? error.message : 'Unknown knowledge lookup error',
    );

    // A database failure is not the same as a legitimate "no answer" result.
    // Do not ask AI to guess when the authoritative lookup itself failed.
    const lookupFailureReply = getMessengerHumanSupportContactReply(
      activeCountry,
      detectMessengerReplyLanguage(normalizedActionText),
      'unverified',
    );
    await saveMessage(sb, conversation.id, {
      role: 'assistant',
      content: lookupFailureReply,
      actionStatus: 'knowledge_lookup_failed',
      countryCode: activeCountry,
      sourceContext: {
        database_lookup_failed: true,
        ai_call_skipped: true,
      },
    });
    await sendMessengerText(senderId, lookupFailureReply);
    return;
  }

  // Search published CMS FAQs/pages/blogs before allowing a generative answer.
  // Only high-confidence, country-scoped matches are sent as deterministic replies.
  try {
    const cmsKnowledge = await getMessengerPublishedContentAnswer({
      supabase: sb,
      country: activeCountry,
      text: normalizedActionText,
    });

    // Only call AI when the database lookup completed successfully but found
    // no trusted match. A failed lookup must never be treated as "no answer".
    if (cmsKnowledge.lookupFailed && !cmsKnowledge.handled) {
      const lookupFailureReply = getMessengerHumanSupportContactReply(
        activeCountry,
        detectMessengerReplyLanguage(normalizedActionText),
        'unverified',
      );
      await saveMessage(sb, conversation.id, {
        role: 'assistant',
        content: lookupFailureReply,
        actionStatus: 'database_lookup_failed',
        countryCode: activeCountry,
        sourceContext: {
          database_lookup_failed: true,
          ai_call_skipped: true,
        },
      });
      await sendMessengerText(senderId, lookupFailureReply);
      return;
    }

    if (cmsKnowledge.handled && cmsKnowledge.reply) {
      await saveMessage(sb, conversation.id, {
        role: 'assistant',
        content: cmsKnowledge.reply,
        actionStatus: 'database_knowledge',
        countryCode: activeCountry,
        sourceContext: {
          database_first: true,
          ai_call_skipped: true,
          source_table: cmsKnowledge.source || null,
          source_slug: cmsKnowledge.sourceSlug || null,
          confidence_score: cmsKnowledge.confidence || null,
        },
      });

      await markConversation(sb, conversation.id, 'active', {
        last_knowledge_source: cmsKnowledge.source || 'published_content',
        last_knowledge_slug: cmsKnowledge.sourceSlug || null,
        last_knowledge_confidence: cmsKnowledge.confidence || null,
      }, activeCountry);

      await sendMessengerText(senderId, cmsKnowledge.reply);
      return;
    }

    // Website policies must come from verified, country-scoped CMS content.
    // If no matching published answer exists, do not let generative AI guess.
    if (isMessengerWebsitePolicyQuestion(normalizedActionText)) {
      const policySupportReply = getMessengerHumanSupportContactReply(
        activeCountry,
        detectMessengerReplyLanguage(normalizedActionText),
        'unverified',
      );
      await saveMessage(sb, conversation.id, {
        role: 'assistant',
        content: policySupportReply,
        actionStatus: 'website_policy_unverified',
        countryCode: activeCountry,
        sourceContext: {
          database_first: true,
          verified_cms_answer_found: false,
          ai_call_skipped: true,
          source_tables: ['landing_faqs', 'pages', 'blogs'],
        },
      });
      await sendMessengerText(senderId, policySupportReply);
      return;
    }
  } catch (error) {
    console.error(
      'Messenger published-content database lookup failed:',
      error instanceof Error ? error.message : 'Unknown CMS knowledge lookup error',
    );
    const lookupFailureReply = getMessengerHumanSupportContactReply(
      activeCountry,
      detectMessengerReplyLanguage(normalizedActionText),
      'unverified',
    );
    await saveMessage(sb, conversation.id, {
      role: 'assistant',
      content: lookupFailureReply,
      actionStatus: 'database_lookup_failed',
      countryCode: activeCountry,
      sourceContext: {
        database_lookup_failed: true,
        ai_call_skipped: true,
      },
    });
    await sendMessengerText(senderId, lookupFailureReply);
    return;
  }
  }

  const products = isProductListRequest(normalizedActionText)
    ? await listMessengerProducts(sb, activeCountry, 12).then(serializeMessengerProducts)
    : isProductCatalogRequest(normalizedActionText)
      ? await getProductContext(sb, activeCountry, normalizedActionText)
      : [];


  if (
    isProductCatalogRequest(normalizedActionText) &&
    !isMessengerDeliveryPolicyQuestion(normalizedActionText)
  ) {
    const catalogReply = formatMessengerCatalogReply(
      normalizedActionText,
      products as Array<Record<string, unknown>>,
      activeCountry,
      detectMessengerReplyLanguage(normalizedActionText),
    );

    const trustedProducts = (products as Array<Record<string, unknown>>).filter(
      isTrustedMessengerProductMatch,
    );

    if (trustedProducts.length === 1 && products.length === 1) {
      const product = trustedProducts[0];
      await markConversation(sb, conversation.id, 'active', {
        last_messenger_product: {
          id: typeof product.id === 'string' ? product.id : null,
          name: formatMessengerProductName(product),
          price:
            typeof product.effective_price === 'number'
              ? product.effective_price
              : 0,
          stock: typeof product.stock === 'number' ? product.stock : 0,
        },
      }, activeCountry);
    }

    const selectionOptions = getMessengerProductSelectionQuickReplies(
      products,
      detectMessengerReplyLanguage(normalizedActionText),
    );
    const productQuickReplies = selectionOptions.length ? selectionOptions : undefined;

    await saveMessage(sb, conversation.id, {
      role: 'assistant',
      content: catalogReply,
      actionStatus: 'product_catalog',
      countryCode: activeCountry,
      sourceContext: {
        deterministic_catalog_reply: true,
        product_count: products.length,
        selectable_product_count: productQuickReplies?.length || 0,
      },
    });
    const messengerCountry: CountryCode = activeCountry;
    const catalogLanguage = detectMessengerReplyLanguage(normalizedActionText);
    const productCards = (products as Array<Record<string, unknown>>)
      .filter(
        (product) =>
          isTrustedMessengerProductMatch(product) &&
          typeof product.stock === 'number' &&
          product.stock > 0 &&
          typeof product.image === 'string' &&
          /^https?:\/\//i.test(product.image.trim()),
      )
      .map((product) => {
        const cardName = catalogLanguage === 'English'
          ? ((typeof product.name_en === 'string' && product.name_en) || formatMessengerProductName(product))
          : catalogLanguage === 'Hindi'
            ? ((typeof product.name_en === 'string' && product.name_en) || formatMessengerProductName(product))
            : formatMessengerProductName(product);
        const priceLabel = typeof product.effective_price === 'number'
          ? formatMessengerCurrency(messengerCountry) + product.effective_price
          : catalogLanguage === 'English'
            ? 'Price unavailable'
            : catalogLanguage === 'Hindi'
              ? 'कीमत उपलब्ध नहीं'
              : 'দাম জানা নেই';
        const stockLabel = catalogLanguage === 'English'
          ? 'Stock: '
          : catalogLanguage === 'Hindi'
            ? 'स्टॉक: '
            : 'স্টক: ';
        const packetLabel = catalogLanguage === 'English'
          ? (product.stock === 1 ? ' packet' : ' packets')
          : catalogLanguage === 'Hindi'
            ? ' पैकेट'
            : ' প্যাকেট';
        return {
          title: cardName,
          subtitle: priceLabel + ' • ' + stockLabel + String(product.stock) + packetLabel,
          imageUrl: String(product.image).trim(),
          productId: String(product.id),
          viewProductTitle: catalogLanguage === 'English' ? 'View Product' : catalogLanguage === 'Hindi' ? 'उत्पाद देखें' : 'পণ্য দেখুন',
          orderNowTitle: catalogLanguage === 'English' ? 'Order Now' : catalogLanguage === 'Hindi' ? 'ऑर्डर करें' : 'অর্ডার করুন',
          productUrl:
            typeof product.slug === 'string' && product.slug
              ? 'https://www.gaziseed.com/product/' + encodeURIComponent(product.slug)
              : undefined,
        };
      });

    await sendMessengerText(senderId, catalogReply, productQuickReplies, undefined, productCards);
    return;
  }


  if (
    products.length === 1 &&
    isTrustedMessengerProductMatch(products[0] as Record<string, unknown>)
  ) {
    const product = products[0] as Record<string, unknown>;
    await markConversation(sb, conversation.id, 'active', {
      last_messenger_product: {
        id: typeof product.id === 'string' ? product.id : null,
        name:
          typeof product.name_bn === 'string' && product.name_bn
            ? product.name_bn
            : typeof product.name_en === 'string'
              ? product.name_en
              : typeof product.slug === 'string'
                ? product.slug
                : null,
        price:
          typeof product.effective_price === 'number'
            ? product.effective_price
            : 0,
        stock: typeof product.stock === 'number' ? product.stock : 0,
      },
    }, activeCountry);
  }
  // Strict website-only mode: deterministic transactional/product handlers and verified
  // product FAQ + published CMS lookups have already run. Never call generative AI.
  // If no verified database answer matched, route to the correct branch support contact.
  const unsupportedQuestionReply = getMessengerHumanSupportContactReply(
    activeCountry,
    detectMessengerReplyLanguage(normalizedActionText),
    'unverified',
  );
  await saveMessage(sb, conversation.id, {
    role: 'assistant',
    content: unsupportedQuestionReply,
    actionStatus: 'website_knowledge_unavailable',
    countryCode: activeCountry,
    sourceContext: {
      database_first: true,
      verified_answer_found: false,
      ai_call_skipped: true,
      generative_ai_disabled_for_unmatched_questions: true,
      source_tables: ['products', 'product_faqs', 'landing_faqs', 'pages', 'blogs'],
    },
  });
  await sendMessengerText(senderId, unsupportedQuestionReply);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const verifyToken = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (
    mode === 'subscribe' &&
    challenge &&
    WEBHOOK_VERIFY_TOKEN &&
    verifyToken &&
    safeEqual(WEBHOOK_VERIFY_TOKEN, verifyToken)
  ) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json(
    { success: false, message: 'Webhook verification failed' },
    { status: 403 },
  );
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');

  if (!verifyMessengerWebhookSignature(rawBody, signature, META_APP_SECRET)) {
    return NextResponse.json(
      { success: false, message: 'Invalid webhook signature' },
      { status: 401 },
    );
  }

  try {
    const payload = JSON.parse(rawBody) as MessengerPayload;

    if (payload.object !== 'page') {
      return NextResponse.json({ success: true });
    }

    const events = (payload.entry || []).flatMap((entry) => entry.messaging || []);

    after(async () => {
      for (const event of events) {
        try {
          await processMessengerEvent(event);
        } catch (error) {
          console.error(
            'Messenger event processing failed:',
            error instanceof Error ? error.message : 'Unknown error',
          );
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      'Messenger webhook processing failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );

    return NextResponse.json(      { success: false, message: 'Webhook processing failed' },
      { status: 500 },
    );
  }
}
