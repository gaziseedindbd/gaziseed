export function normalizeMessengerPhone(value: string): string {
  return value.replace(/\D/g, '');
}

export function extractMessengerPhone(text: string): string | null {
  const match = text.match(/(?:^|\s)(\+?\d[\d\s().-]{8,}\d)(?=$|\s|[^\d])/);
  return match?.[1] ? normalizeMessengerPhone(match[1]) : null;
}
