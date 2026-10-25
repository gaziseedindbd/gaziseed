import assert from 'node:assert/strict';
import test from 'node:test';
import { getMetaPurchaseEventId } from '../lib/marketing-event-id.ts';
import {
  isMetaCapiOrderSource,
  shouldSuppressMetaCapiUserIdentifiers,
} from '../lib/meta-capi-policy.ts';

test('website and paid web checkout sources are eligible for Meta CAPI', () => {
  for (const source of [
    'website',
    'ads',
    'facebook',
    'instagram',
    'google',
    'tiktok',
    'animated_landing',
    'combo',
  ]) {
    assert.equal(isMetaCapiOrderSource(source), true, `${source} should be eligible`);
  }
});

test('Messenger and unknown sources stay excluded from website Purchase CAPI', () => {
  for (const source of [
    'facebook_messenger_ai',
    'facebook_messenger_ai_combo',
    'unknown_source',
    '',
    null,
    undefined,
  ]) {
    assert.equal(isMetaCapiOrderSource(source), false);
  }
});

test('browser and server Purchase event ID stays deterministic by branch and order', () => {
  assert.equal(getMetaPurchaseEventId('IN', 'GS-IN-TEST001'), 'purchase:IN:GS-IN-TEST001');
  assert.equal(getMetaPurchaseEventId('BD', 'GS-BD-TEST001'), 'purchase:BD:GS-BD-TEST001');
  assert.notEqual(
    getMetaPurchaseEventId('IN', 'GS-IN-TEST001'),
    getMetaPurchaseEventId('BD', 'GS-IN-TEST001'),
  );
});

test('preview test events suppress client identifiers only while a test code is configured', () => {
  assert.equal(shouldSuppressMetaCapiUserIdentifiers('preview', 'TEST123'), true);
  assert.equal(shouldSuppressMetaCapiUserIdentifiers('preview', '  TEST123  '), true);
  assert.equal(shouldSuppressMetaCapiUserIdentifiers('preview', '  '), false);
  assert.equal(shouldSuppressMetaCapiUserIdentifiers('production', 'TEST123'), false);
});
