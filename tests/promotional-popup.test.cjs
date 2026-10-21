const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getPopupCopy,
  getSafePopupHref,
  isAllowedPopupHref,
  isPopupScheduled,
  selectEligiblePopup,
} = require('../.tmp/popup-tests/promotional-popup.js');

function popup(overrides = {}) {
  return {
    id: 'popup-test',
    country_code: 'IN',
    title: 'Legacy title',
    description: 'Legacy description',
    image: '',
    offer: 'Legacy offer',
    cta_text: 'Shop now',
    cta_link: '/all-products',
    localized_content: {},
    display_delay: 3,
    start_date: '2026-10-01T00:00:00.000Z',
    end_date: null,
    is_active: true,
    show_on_main: true,
    show_on_offers: false,
    show_close_button: true,
    auto_close: false,
    auto_close_seconds: 10,
    display_frequency: 'once_per_day',
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

test('popup copy uses the selected language and falls back to legacy text', () => {
  const value = popup({
    localized_content: {
      bn: { title: 'বাংলা অফার', cta_text: 'এখনই কিনুন' },
      en: { title: 'Seed offer', description: 'Fresh seeds for your garden.' },
    },
  });
  assert.deepEqual(getPopupCopy(value, 'bn'), {
    title: 'বাংলা অফার',
    description: 'Fresh seeds for your garden.',
    offer: 'Legacy offer',
    cta_text: 'এখনই কিনুন',
  });
  assert.equal(getPopupCopy(value, 'hi').title, 'Seed offer');
});

test('popup CTA accepts safe local and web URLs, rejects script and protocol-relative URLs', () => {
  assert.equal(getSafePopupHref('/offer/summer'), '/offer/summer');
  assert.equal(getSafePopupHref('https://gaziseed.com/offers'), 'https://gaziseed.com/offers');
  assert.equal(isAllowedPopupHref('javascript:alert(1)'), false);
  assert.equal(isAllowedPopupHref('//evil.example/path'), false);
  assert.equal(getSafePopupHref('javascript:alert(1)'), '/all-products');
});

test('popup date window includes start and excludes end', () => {
  const value = popup({ start_date: '2026-10-21T10:00:00.000Z', end_date: '2026-10-21T11:00:00.000Z' });
  assert.equal(isPopupScheduled(value, new Date('2026-10-21T10:00:00.000Z')), true);
  assert.equal(isPopupScheduled(value, new Date('2026-10-21T11:00:00.000Z')), false);
});

test('selection skips expired and wrong-placement popups to find the newest eligible one', () => {
  const now = new Date('2026-10-21T12:00:00.000Z');
  const expired = popup({ id: 'expired', end_date: '2026-10-21T11:00:00.000Z', created_at: '2026-10-21T11:50:00.000Z' });
  const wrongPlacement = popup({ id: 'wrong-placement', show_on_main: false, created_at: '2026-10-21T11:40:00.000Z' });
  const olderEligible = popup({ id: 'eligible', created_at: '2026-10-21T11:00:00.000Z' });
  const selected = selectEligiblePopup([expired, wrongPlacement, olderEligible], 'main', now, () => true);
  assert.equal(selected.id, 'eligible');
});
