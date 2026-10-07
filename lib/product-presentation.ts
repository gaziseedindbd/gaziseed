// Treat editorial placeholders as missing pack data, never as a quantity.
export function isKnownPackDetail(value?: string | null) {
  return Boolean(value?.trim() && !/^(not\s*specified|varies\s*by\s*packet|see\s*packet\s*label)$/i.test(value.trim()));
}
