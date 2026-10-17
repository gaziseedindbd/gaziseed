// India-only, fail-closed postal validation for Cashfree payment session creators.
// The checkout's City/District/Town field must identify a location reported for the PIN.
type PostalOffice = { State?: string; District?: string; Name?: string; Block?: string; Division?: string };
const normalize = (s: string) => s.normalize("NFKC").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// Accept common postal-office suffix variations, but never approximate/fuzzy-match
// arbitrary place names (which could conceal a genuine PIN/city mismatch).
const normalizePostalPlace = (s: string) => normalize(s)
  .replace(/\b(?:head post office|sub post office|branch post office|post office|h o|s o|b o|g p o|gpo|ho|so|bo)\b$/g, "")
  .trim();

// Verified PIN responses cached per Edge isolate for 24 hours (best effort only).
const verifiedCache = new Map<string, { offices: PostalOffice[]; expires: number }>();
const TTL = 24 * 60 * 60 * 1000;
const getCached = (pin: string) => { const v = verifiedCache.get(pin); if (!v) return null; if (Date.now() >= v.expires) { verifiedCache.delete(pin); return null; } return v.offices; };
const putCached = (pin: string, offices: PostalOffice[]) => { if (verifiedCache.size >= 500) verifiedCache.delete(verifiedCache.keys().next().value!); verifiedCache.set(pin, { offices, expires: Date.now() + TTL }); };

export async function validateIndiaShippingAddress(fullAddress: string): Promise<{ valid: boolean; error?: string }> {
  const parts = fullAddress.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 4) return { valid: false, error: "Complete address, city, state and PIN are required" };
  const pin = parts[parts.length - 1];
  const state = parts[parts.length - 2];
  const city = parts[parts.length - 3];
  const street = parts.slice(0, -3).join(", ");
  if (!/^[1-9][0-9]{5}$/.test(pin) || !state || !city || street.length < 5)
    return { valid: false, error: "Invalid Indian delivery address or PIN" };

  let offices: PostalOffice[] | null = null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch("https://api.postalpincode.in/pincode/" + pin, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!response.ok) throw new Error("Postal API failure");
    const payload = await response.json();
    const record = Array.isArray(payload) ? payload[0] : null;
    if (record?.Status !== "Success" || !Array.isArray(record.PostOffice) || !record.PostOffice.length)
      return { valid: false, error: "PIN not found or postal information incomplete" };
    offices = record.PostOffice;
    putCached(pin, offices);
  } catch {
    offices = getCached(pin);
    if (!offices) return { valid: false, error: "Postal verification unavailable, please retry" };
  } finally { clearTimeout(timeout); }
    const normalizedState = normalize(state), normalizedCity = normalizePostalPlace(city);
    if (!normalizedState || !normalizedCity || !offices.length)
      return { valid: false, error: "PIN not found or postal information incomplete" };

    const matchingOffices = offices.filter((office) => normalize(String(office.State || "")) === normalizedState);
    if (!matchingOffices.length) return { valid: false, error: "PIN and State do not match" };

    const cityMatches = matchingOffices.some((office) =>
      [office.District, office.Name, office.Block, office.Division]
        .some((location) => typeof location === "string" && normalizePostalPlace(location) === normalizedCity)
    );
    if (!cityMatches) return { valid: false, error: "City/District/Town does not match this PIN. Enter the postal district or post office name." };
    return { valid: true };
}