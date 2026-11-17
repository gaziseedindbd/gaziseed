const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const route = fs.readFileSync(
  path.join(root, 'app/api/webhooks/messenger/route.ts'),
  'utf8',
);
const knowledgeTool = fs.readFileSync(
  path.join(root, 'lib/ai/messenger-knowledge-tool.ts'),
  'utf8',
);
const cmsTool = fs.readFileSync(
  path.join(root, 'lib/ai/messenger-cms-knowledge-tool.ts'),
  'utf8',
);
const supportTool = fs.readFileSync(
  path.join(root, 'lib/ai/messenger-human-support.ts'),
  'utf8',
);

test('verified website/product knowledge and published CMS lookup run before generative AI', () => {
  const productLookup = route.indexOf('getMessengerWebsiteKnowledgeAnswer({');
  const cmsLookup = route.indexOf('getMessengerPublishedContentAnswer({');
  const aiCall = route.indexOf('const result = await messengerAIChat({');

  assert.ok(productLookup > 0, 'product database lookup must exist');
  assert.ok(cmsLookup > productLookup, 'published CMS lookup must follow the product knowledge lookup');
  assert.ok(aiCall > cmsLookup, 'AI call must occur after database knowledge lookups');
  assert.equal(route.includes('isDeterministicAgricultureFaqRequest(normalizedActionText)'), false, 'a database miss must reach the AI fallback instead of a hard-coded agriculture answer');
  assert.match(route, /ai_call_skipped:\s*true/);
  assert.match(knowledgeTool, /\.from\('product_faqs'\)/);
  assert.match(knowledgeTool, /explicitlyMentionedProducts\.length === 1/);
  assert.match(knowledgeTool, /explicitlyMentionedProducts\.length === 0 && verifiedProductId/);
  assert.match(knowledgeTool, /formatMessengerProductFaqReply/);
  assert.match(knowledgeTool, /findExplicitKnowledgeProductsByName/);
  assert.match(knowledgeTool, /name_bn\.ilike/);
  assert.match(knowledgeTool, /\.eq\('country_code', country\)/);
  assert.match(cmsTool, /\.from\('landing_faqs'\)/);
  assert.match(cmsTool, /\.from\('pages'\)/);
  assert.match(cmsTool, /\.from\('blogs'\)/);
  assert.match(cmsTool, /export function isMessengerWebsitePolicyQuestion/);
  assert.match(cmsTool, /!isLikelyKnowledgeQuestion\(text\) && !isMessengerWebsitePolicyQuestion\(text\)/);

  const policyGuard = route.indexOf('if (isMessengerWebsitePolicyQuestion(normalizedActionText))');
  assert.ok(policyGuard > cmsLookup, 'policy fallback must follow verified CMS lookup');
  assert.ok(policyGuard < aiCall, 'policy fallback must run before generative AI');
  assert.match(route, /actionStatus: 'website_policy_unverified'/);
  assert.match(route, /verified_cms_answer_found: false/);
  assert.match(route, /ai_call_skipped: true/);
});

test('database lookup errors never fall through to a speculative AI response', () => {
  assert.match(route, /database_lookup_failed:\s*true/);
  assert.match(route, /if \(cmsKnowledge\.lookupFailed && !cmsKnowledge\.handled\)/);
  assert.match(route, /actionStatus:\s*'knowledge_lookup_failed'/);
  assert.match(route, /actionStatus:\s*'database_lookup_failed'/);
  assert.match(cmsTool, /return \{ handled: false, lookupFailed \}/);
});

test('support fallback routes customers to the matching country contact', () => {
  assert.match(supportTool, /https:\/\/wa\.me\/916002786881/);
  assert.match(supportTool, /https:\/\/wa\.me\/8801811332293/);
  assert.match(supportTool, /directPhone: '\+91 6002786881'/);
  assert.match(supportTool, /directPhone: '01811332293'/);
});


test('Messenger recommendation prices skip zero or negative offer fields and fall back to a valid price', () => {
  const recommendationBlock = route.slice(
    route.indexOf('const productCards = recommendations.products.map'),
    route.indexOf('await saveMessage(sb, conversation.id, {', route.indexOf('const productCards = recommendations.products.map')),
  );

  assert.match(recommendationBlock, /productRecord\.offer_price[\s\S]*productRecord\.sale_price[\s\S]*productRecord\.price[\s\S]*productRecord\.regular_price/);
  assert.match(recommendationBlock, /typeof value === 'number' && value > 0/);
  assert.match(recommendationBlock, /\?\? 0/);
});


const messengerAdminRoute = fs.readFileSync(
  path.join(root, 'app/api/admin/ai-assistant/route.ts'),
  'utf8',
);
const messengerSupportRoute = fs.readFileSync(
  path.join(root, 'app/api/admin/ai-assistant/human-support/route.ts'),
  'utf8',
);

test('Messenger Admin endpoints reject non-admin users before branch data queries', () => {
  const tokenGuard = messengerAdminRoute.indexOf("if (!accessToken)");
  const identityCheck = messengerAdminRoute.indexOf('sb.auth.getUser(accessToken)');
  const activeAdminLookup = messengerAdminRoute.indexOf(".from('admin_users')");
  const activeAdminFilter = messengerAdminRoute.indexOf(".eq('is_active', true)", activeAdminLookup);
  const noAdminDenial = messengerAdminRoute.indexOf('if (!adminRow)', activeAdminFilter);
  const dashboardDataRead = messengerAdminRoute.indexOf(".from('ai_settings')");

  assert.ok(tokenGuard >= 0, 'dashboard route must reject requests without a bearer token');
  assert.ok(identityCheck > tokenGuard, 'dashboard route must validate the bearer token with Supabase');
  assert.ok(activeAdminLookup > identityCheck, 'dashboard route must look up the authenticated user as an admin');
  assert.ok(activeAdminFilter > activeAdminLookup, 'dashboard route must require an active admin record');
  assert.ok(noAdminDenial > activeAdminFilter, 'dashboard route must deny users without an active admin record');
  assert.ok(dashboardDataRead > noAdminDenial, 'dashboard data queries must happen only after the active-admin gate');
  assert.match(messengerAdminRoute.slice(noAdminDenial, dashboardDataRead), /status:\s*403/);

  const supportGateStart = messengerSupportRoute.indexOf('async function requireAdmin(request: Request)');
  const supportIdentityCheck = messengerSupportRoute.indexOf('sb.auth.getUser(accessToken)', supportGateStart);
  const supportAdminLookup = messengerSupportRoute.indexOf(".from('admin_users')", supportIdentityCheck);
  const supportActiveAdminFilter = messengerSupportRoute.indexOf(".eq('is_active', true)", supportAdminLookup);
  const supportNoAdminDenial = messengerSupportRoute.indexOf('if (!adminRow)', supportActiveAdminFilter);
  const supportGetStart = messengerSupportRoute.indexOf('export async function GET');
  const supportGetGate = messengerSupportRoute.indexOf('const auth = await requireAdmin(request);', supportGetStart);
  const supportGetDataRead = messengerSupportRoute.indexOf(".from('ai_handoffs')", supportGetStart);
  const supportPostStart = messengerSupportRoute.indexOf('export async function POST');
  const supportPostGate = messengerSupportRoute.indexOf('const auth = await requireAdmin(request);', supportPostStart);
  const supportPostBodyRead = messengerSupportRoute.indexOf('await request.json()', supportPostStart);

  assert.ok(supportIdentityCheck > supportGateStart, 'human-support route must validate the authenticated user');
  assert.ok(supportAdminLookup > supportIdentityCheck, 'human-support route must look up active admin access');
  assert.ok(supportActiveAdminFilter > supportAdminLookup, 'human-support route must require an active admin record');
  assert.ok(supportNoAdminDenial > supportActiveAdminFilter, 'human-support route must deny users without an active admin record');
  assert.ok(supportGetGate > supportGetStart && supportGetGate < supportGetDataRead, 'support GET must authorize before reading handoffs');
  assert.ok(supportPostGate > supportPostStart && supportPostGate < supportPostBodyRead, 'support POST must authorize before reading action input');
});

test('Messenger AI prompt understands context and formats concise professional replies', () => {
  assert.match(route, /Understand the customer's intent before answering/);
  assert.match(route, /Read the latest message together with recent conversation history/);
  assert.match(route, /do not ask the customer to repeat information already provided/);
  assert.match(route, /general language and reasoning ability for greetings/);
  assert.match(route, /do not require a matching FAQ row/);
  assert.match(route, /GAZI SEED-specific company, product, quality, germination, packaging, shipping, delivery, payment, price, stock, offer, and order claims/);
  assert.match(route, /Answer the exact question first/);
  assert.match(route, /Keep simple replies to 1–3 short sentences/);
  assert.match(route, /Do not use Markdown tables/);
  assert.match(route, /Avoid repeating facts already stated in the conversation/);
  assert.match(route, /Never invent claims/);
  assert.match(route, /Treat planting\/growing intent/);
  assert.match(route, /unless the customer clearly says they want to buy, order, or checkout/);
  assert.match(route, /If any numeric cultivation detail is not explicitly present in VERIFIED DATA, omit it/);
  assert.match(route, /Never claim a product is available/);
});


test('Banglish seed requests normalize common chili and rani lonka product terms', () => {
  const intents = fs.readFileSync(path.join(root, 'lib/ai/messenger-intents.ts'), 'utf8');
  const products = fs.readFileSync(path.join(root, 'lib/ai/messenger-product-tool.ts'), 'utf8');
  assert.match(intents, /apnader/);
  assert.match(intents, /morich/);
  assert.match(intents, /lonka/);
  assert.match(products, /morich\|lonka\|lanka\|bij\|beej/);
  assert.match(products, /'chili'/);
  assert.match(products, /'lanka'/);
  assert.ok(products.includes(".replace(/\\bmorich\\b/gi, 'chili')"));
  assert.ok(products.includes(".replace(/\\b(?:lonka|lanka)\\b/gi, 'lanka')"));
  assert.ok(products.includes(".replace(/[^\\p{L}\\p{M}\\p{N}\\s]/gu, ' ')"));
  assert.ok(products.includes(".replace(/রানি/g, 'rani')"));
  assert.ok(products.includes(".replace(/লঙ্কা|লংকা/g, 'lanka')"));
  assert.match(products, /বীজের\?\\|লাগাতে\|চাই/);
  assert.ok(products.includes('term.match(/[\\p{L}\\p{M}\\p{N}]+/gu)'));

});


test('cultivation requests bypass pending checkout and block AI order prompts', () => {
  assert.match(route, /!isGeneralSeedAdviceRequest\(normalizedActionText\) &&/);
  assert.match(route, /function hasAgricultureCheckoutPrompt\(reply: string\)/);
  assert.match(route, /function getSafeCultivationIntentReply\(language: string\)/);
  assert.match(route, /unsafeAgricultureCheckoutReply/);
  assert.match(route, /cultivation_intent_guard/);
  assert.match(route, /agriculture_checkout_guard: unsafeAgricultureCheckoutReply/);
});


test('Preview Messenger test endpoint is isolated, authenticated, and database-first', () => {
  const previewTestRoute = fs.readFileSync(
    path.join(root, 'app/api/admin/ai-assistant/preview-test/route.ts'),
    'utf8',
  );
  const previewGuard = previewTestRoute.indexOf("process.env.VERCEL_ENV !== 'preview'");
  const authGuard = previewTestRoute.indexOf('if (!isAuthorized(request))');
  const databaseLookup = previewTestRoute.indexOf('searchMessengerProducts(');
  const databaseFailure = previewTestRoute.indexOf('Database lookup failed; AI fallback was not called');
  const trustedMatch = previewTestRoute.indexOf('products.filter(isTrustedMessengerProductMatch)');
  const aiFallback = previewTestRoute.indexOf('messengerAIChat({');

  assert.ok(previewGuard >= 0 && previewGuard < authGuard, 'non-Preview deployments must be blocked before authorization or work');
  assert.ok(authGuard > previewGuard && authGuard < databaseLookup, 'secret authorization must happen before database access');
  assert.ok(databaseLookup > authGuard, 'database lookup must follow authorization');
  assert.ok(databaseFailure > databaseLookup && databaseFailure < aiFallback, 'database errors must stop before AI fallback');
  assert.ok(trustedMatch > databaseLookup && trustedMatch < aiFallback, 'trusted database matches must be returned before AI fallback');
  assert.ok(aiFallback > trustedMatch, 'AI fallback may run only after no trusted database match exists');
  assert.match(previewTestRoute, /timingSafeEqual/);
  assert.match(previewTestRoute, /MESSENGER_PREVIEW_TEST_SECRET/);
  assert.match(previewTestRoute, /x-preview-test-secret/);
  assert.match(previewTestRoute, /country !== 'IN' && country !== 'BD'/);
  assert.match(previewTestRoute, /message.length > 500/);
  assert.match(previewTestRoute, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(previewTestRoute, /server-only Supabase access/);
  assert.doesNotMatch(previewTestRoute, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY/);
});
