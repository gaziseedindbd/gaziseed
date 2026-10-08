import assert from 'node:assert/strict';
import test from 'node:test';

import {
  limitMessengerAIHistoryMessages,
  shouldIncludeMessengerAIHistoryMessage,
} from '../lib/ai/messenger-history';

test('keeps a bounded recent suffix in chronological order', () => {
  const messages = Array.from({ length: 40 }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: 'message-' + index,
  }));

  const result = limitMessengerAIHistoryMessages(messages, {
    maxMessages: 30,
    maxCharacters: 10_000,
  });

  assert.equal(result.length, 30);
  assert.equal(result[0].content, 'message-10');
  assert.equal(result.at(-1)?.content, 'message-39');
});

test('drops older messages before exceeding the character budget', () => {
  const messages = [
    { role: 'user', content: 'oldest' },
    { role: 'assistant', content: 'older' },
    { role: 'user', content: 'recent' },
    { role: 'assistant', content: 'latest' },
  ];

  const result = limitMessengerAIHistoryMessages(messages, {
    maxMessages: 10,
    maxCharacters: 12,
  });

  assert.deepEqual(result.map((message) => message.content), ['recent', 'latest']);
});

test('always preserves the latest turn intact', () => {
  const messages = [
    { role: 'user', content: 'an older turn that is too long to keep' },
    { role: 'user', content: 'the complete latest customer message' },
  ];

  const result = limitMessengerAIHistoryMessages(messages, {
    maxMessages: 10,
    maxCharacters: 8,
  });

  assert.deepEqual(result, [messages[1]]);
});

test('keeps provider and failed internal states out of conversation prompts', () => {
  assert.equal(shouldIncludeMessengerAIHistoryMessage({ action_status: 'provider_result' }), false);
  assert.equal(shouldIncludeMessengerAIHistoryMessage({ action_status: 'generated' }), false);
  assert.equal(shouldIncludeMessengerAIHistoryMessage({ action_status: 'failed' }), false);
  assert.equal(shouldIncludeMessengerAIHistoryMessage({ action_status: 'sent' }), true);
  assert.equal(shouldIncludeMessengerAIHistoryMessage({ action_status: null }), true);
});
