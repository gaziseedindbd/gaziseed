import 'server-only';

import { cookies } from 'next/headers';
import { isCountryCode, type CountryCode } from '@/lib/seed-bari/domain';

const COUNTRY_COOKIE = 'seed-bari-country';

/** Resolve the active storefront market without changing the existing default. */
export async function getStoreCountry(defaultCountry: CountryCode = 'BD'): Promise<CountryCode> {
  const cookieStore = await cookies();
  const value = cookieStore.get(COUNTRY_COOKIE)?.value;
  return isCountryCode(value) ? value : defaultCountry;
}
