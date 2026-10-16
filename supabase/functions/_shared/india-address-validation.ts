// Shared validation draft for India-only Cashfree session creators.
// Must run inside the payment Edge Function BEFORE any intent/session is created.
export async function validateIndiaShippingAddress(fullAddress: string): Promise<{ valid: boolean; error?: string }> {
  const parts = fullAddress.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 4) return { valid: false, error: 'Complete address, city, state and PIN are required' };
  const pin = parts[parts.length - 1];
  const state = parts[parts.length - 2];
  const city = parts[parts.length - 3];
  const street = parts.slice(0, -3).join(', ');
  if (!/^[1-9][0-9]{5}$/.test(pin) || !state || !city || street.length < 5)
    return { valid: false, error: 'Invalid Indian delivery address or PIN' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch('https://api.postalpincode.in/pincode/' + pin, {
      headers: { Accept: 'application/json' }, signal: controller.signal
    });
    if (!response.ok) return { valid: false, error: 'Postal verification unavailable' };
    const result = await response.json();
    const offices = Array.isArray(result) && result[0]?.Status === 'Success' ? result[0].PostOffice : [];
    const validState = Array.isArray(offices) && offices.some(
      (office: { State?: string }) => String(office.State || '').trim().toLowerCase() === state.toLowerCase()
    );
    return validState ? { valid: true } : { valid: false, error: 'PIN and State do not match' };
  } catch {
    return { valid: false, error: 'Postal verification unavailable, please retry' };
  } finally {
    clearTimeout(timeout);
  }
}
