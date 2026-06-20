const MAURITIUS_COUNTRY = '230'

/** Normalize user input or webhook values to WhatsApp E.164 digits (no + prefix). */
export function normalizeWhatsAppPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (!digits) return ''

  while (digits.startsWith('00')) {
    digits = digits.slice(2)
  }

  if (digits.startsWith(MAURITIUS_COUNTRY)) {
    return digits
  }

  if (digits.startsWith('0')) {
    return `${MAURITIUS_COUNTRY}${digits.slice(1)}`
  }

  // Bare local Mauritius number (e.g. 57833020, 52512197)
  if (digits.length <= 8) {
    return `${MAURITIUS_COUNTRY}${digits}`
  }

  // Already includes another country code — do not prepend 230
  return digits
}

export function isPlausibleWhatsAppPhone(phone: string): boolean {
  const normalized = normalizeWhatsAppPhone(phone)
  return normalized.length >= 10 && normalized.length <= 15
}
