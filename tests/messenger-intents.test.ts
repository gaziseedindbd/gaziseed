import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isMessengerOrderInterruptRequest,
  isMessengerOrderResumeRequest,
  isMessengerDeliveryIntent,
  isMessengerHumanSupportIntent,
  isMessengerSeedKnowledgeQuestion,
  isOtherProductRequest,
  isProductCatalogRequest,
  isProductListRequest,
} from '../lib/ai/messenger-intents';

test('recognizes typo-tolerant other-product request', () => {
  assert.equal(isOtherProductRequest('OTHER PRODCUT DEKHTE CHAIE'), true);
  assert.equal(isOtherProductRequest('OTHER PRODUCT DEKHTE CHAI'), true);
  assert.equal(isOtherProductRequest('SHOW ME OTHER PRODUCTS'), true);
  assert.equal(isOtherProductRequest('আরও পণ্য দেখান'), true);
});

test('does not classify ordinary order details as catalog intent', () => {
  assert.equal(isProductCatalogRequest('2'), false);
  assert.equal(isProductListRequest('Rahim'), false);
  assert.equal(isOtherProductRequest('01XXXXXXXXX'), false);
});

test('recognizes catalog and list requests', () => {
  assert.equal(isProductCatalogRequest('what products do you have'), true);
  assert.equal(isProductListRequest('product list'), true);
});

test('recognizes interrupting intents', () => {
  assert.equal(isMessengerOrderInterruptRequest('delivery charge koto'), true);
  assert.equal(isMessengerOrderInterruptRequest('এই বীজ কীভাবে লাগাব'), true);
  assert.equal(isMessengerOrderInterruptRequest('human support chai'), true);
});

test('recognizes order resume phrases and never treats resume as interrupt', () => {
  assert.equal(isMessengerOrderResumeRequest('continue order'), true);
  assert.equal(isMessengerOrderResumeRequest('আগের অর্ডারটা চালিয়ে যেতে চাই'), true);
  assert.equal(isMessengerOrderInterruptRequest('আগের অর্ডারটা চালিয়ে যেতে চাই'), false);
});

test('classifies delivery, support, and seed knowledge questions independently', () => {
  assert.equal(isMessengerDeliveryIntent('delivery time koto'), true);
  assert.equal(isMessengerHumanSupportIntent('talk to a person'), true);
  assert.equal(isMessengerSeedKnowledgeQuestion('লাউয়ের বীজ কীভাবে বপন করব'), true);
});
