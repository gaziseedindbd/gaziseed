export type MarketingCountryCode = 'BD' | 'IN';

export function getMetaPurchaseEventId(
  countryCode: MarketingCountryCode,
  orderNumber: string,
): string {
  return 'purchase:' + countryCode + ':' + orderNumber;
}
