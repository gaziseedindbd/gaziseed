/** Build a branch-local opaque key without copying names, emails, or raw phone numbers into CRM tables. */
export async function makeCrmCustomerKey(userId?: string | null, phone?: string | null, orderId?: string | null) {
  if (userId) return `user:${userId.toLowerCase()}`;
  const normalizedPhone = (phone || '').replace(/\D/g, '');
  if (normalizedPhone.length >= 7) {
    if (!window.crypto?.subtle) throw new Error('Secure customer identity is unavailable.');
    const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizedPhone));
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `guest:${hash}`;
  }
  return orderId ? `order:${orderId.toLowerCase()}` : null;
}
