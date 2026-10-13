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

test('verified website/product knowledge and published CMS lookup run before support fallback', () => {
  const productLookup = route.indexOf('getMessengerWebsiteKnowledgeAnswer({');
  const cmsLookup = route.indexOf('getMessengerPublishedContentAnswer({');

  assert.ok(productLookup > 0, 'product database lookup must exist');
  assert.ok(cmsLookup > productLookup, 'published CMS lookup must follow the product knowledge lookup');
  assert.equal(route.includes('messengerAIChat({'), false, 'Messenger webhook must not call generative AI');
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
  assert.ok(policyGuard > 0, 'policy fallback must run after CMS lookup');
  assert.match(route, /actionStatus: 'website_policy_unverified'/);
  assert.match(route, /verified_cms_answer_found: false/);
  assert.match(route, /ai_call_skipped: true/);
});

test('unmatched website questions go to branch support and never reach generative AI', () => {
  const cmsLookup = route.indexOf('getMessengerPublishedContentAnswer({');
  const supportFallback = route.indexOf("actionStatus: 'website_knowledge_unavailable'");
  assert.ok(supportFallback > cmsLookup, 'database/CMS lookups must run before the unmatched-question handoff');
  assert.equal(route.includes('messengerAIChat({'), false, 'no generative AI call may remain in the Messenger webhook');
  assert.equal(route.includes('api.duckduckgo.com'), false, 'external web research must not be used as an answer source');
  assert.match(route, /generative_ai_disabled_for_unmatched_questions:\\s*true/);
  assert.match(route, /verified_answer_found:\\s*false/);
  assert.ok(route.includes("source_tables: ['products', 'product_faqs', 'landing_faqs', 'pages', 'blogs']"));
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
