const MAURITIUS_COUNTRY = '230'

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

  if (digits.length <= 8) {
    return `${MAURITIUS_COUNTRY}${digits}`
  }

  return digits
}
