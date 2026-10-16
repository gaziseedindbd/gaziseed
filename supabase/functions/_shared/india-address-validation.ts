// India-only, fail-closed postal validation for Cashfree payment session creators.
// The checkout's City/District/Town field must identify a location reported for the PIN.
type PostalOffice = { State?: string; District?: string; Name?: string; Block?: string; Division?: string };
const normalize = (s: string) => s.normalize("NFKC").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export async function validateIndiaShippingAddress(fullAddress: string): Promise<{ valid: boolean; error?: string }> {
  const parts = fullAddress.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 4) return { valid: false, error: "Complete address, city, state and PIN are required" };
  const pin = parts[parts.length - 1];
  const state = parts[parts.length - 2];
  const city = parts[parts.length - 3];
  const street = parts.slice(0, -3).join(", ");
  if (!/^[1-9][0-9]{5}$/.test(pin) || !state || !city || street.length < 5)
    return { valid: false, error: "Invalid Indian delivery address or PIN" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch("https://api.postalpincode.in/pincode/" + pin, {
      headers: { Accept: "application/json" }, signal: controller.signal
    });
    if (!response.ok) return { valid: false, error: "Postal verification unavailable" };
    const payload = await response.json();
    const record = Array.isArray(payload) ? payload[0] : null;
    const offices: PostalOffice[] = record?.Status === "Success" && Array.isArray(record?.PostOffice)
      ? record.PostOffice : [];
    const normalizedState = normalize(state), normalizedCity = normalize(city);
    if (!normalizedState || !normalizedCity || !offices.length)
      return { valid: false, error: "PIN not found or postal information incomplete" };

    const matchingOffices = offices.filter((office) => normalize(String(office.State || "")) === normalizedState);
    if (!matchingOffices.length) return { valid: false, error: "PIN and State do not match" };

    const cityMatches = matchingOffices.some((office) =>
      [office.District, office.Name, office.Block, office.Division]
        .some((location) => typeof location === "string" && normalize(location) === normalizedCity)
    );
    if (!cityMatches) return { valid: false, error: "City/District/Town does not match this PIN. Enter the postal district or post office name." };
    return { valid: true };
  } catch {
    return { valid: false, error: "Postal verification unavailable, please retry" };
  } finally {
    clearTimeout(timeout);
  }
}
